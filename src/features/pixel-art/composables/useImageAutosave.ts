import { ref } from "vue";

export type ImageAutosaveStatus = "dirty" | "error" | "offline" | "saved" | "saving";

export type ImageAutosaveOptions = {
  debounceMs?: number;
};

export type ImageAutosaveSave<T> = (snapshot: T) => Promise<unknown> | unknown;

const DEFAULT_DEBOUNCE_MS = 420;
const DEFAULT_ERROR_MESSAGE = "Unable to save changes.";

const normalizeDebounceMs = (debounceMs: number | undefined) => {
  const normalizedDebounceMs = debounceMs ?? DEFAULT_DEBOUNCE_MS;

  if (!Number.isFinite(normalizedDebounceMs) || normalizedDebounceMs < 0) {
    throw new RangeError("Autosave debounce must be a non-negative finite number.");
  }

  return normalizedDebounceMs;
};

const browserIsOnline = () =>
  typeof navigator === "undefined" || navigator.onLine !== false;

const failedHttpResponse = (result: unknown) => {
  if (!result || typeof result !== "object" || !("ok" in result)) {
    return null;
  }

  const response = result as {
    ok?: unknown;
    status?: unknown;
    statusText?: unknown;
  };

  if (response.ok !== false) {
    return null;
  }

  const status = typeof response.status === "number" ? ` ${response.status}` : "";
  const statusText =
    typeof response.statusText === "string" && response.statusText.trim()
      ? ` ${response.statusText.trim()}`
      : "";

  return new Error(`Autosave failed (HTTP${status}${statusText}).`);
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message.trim()
    ? error.message
    : DEFAULT_ERROR_MESSAGE;

export const useImageAutosave = <T>(
  saveSnapshot: ImageAutosaveSave<T>,
  options: ImageAutosaveOptions = {},
) => {
  const debounceMs = normalizeDebounceMs(options.debounceMs);
  let online = browserIsOnline();

  const status = ref<ImageAutosaveStatus>(online ? "saved" : "offline");
  const errorMessage = ref("");
  const hasPendingChanges = ref(false);
  const lastSavedAt = ref<number | null>(null);

  let activeSave: Promise<void> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let hasPendingSnapshot = false;
  let inFlight = false;
  let pendingSnapshot: T | undefined;

  const syncPendingState = () => {
    hasPendingChanges.value = hasPendingSnapshot || inFlight;
  };

  const clearDebounce = () => {
    if (debounceTimer === null) {
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = null;
  };

  const updateSettledStatus = () => {
    if (!online) {
      status.value = "offline";
    } else if (hasPendingSnapshot) {
      status.value = "dirty";
    } else {
      status.value = "saved";
      errorMessage.value = "";
    }
  };

  const processQueue = async () => {
    let failed = false;

    while (!disposed && online && hasPendingSnapshot) {
      const snapshot = pendingSnapshot as T;
      pendingSnapshot = undefined;
      hasPendingSnapshot = false;
      inFlight = true;
      status.value = "saving";
      errorMessage.value = "";
      syncPendingState();

      try {
        const result = await saveSnapshot(snapshot);
        const httpError = failedHttpResponse(result);

        if (httpError) {
          throw httpError;
        }

        lastSavedAt.value = Date.now();
      } catch (error) {
        if (!hasPendingSnapshot) {
          pendingSnapshot = snapshot;
          hasPendingSnapshot = true;
        }

        online = browserIsOnline();
        errorMessage.value = getErrorMessage(error);
        status.value = online ? "error" : "offline";
        failed = true;
      } finally {
        inFlight = false;
        syncPendingState();
      }

      if (failed) {
        break;
      }
    }

    if (!failed) {
      updateSettledStatus();
    }
  };

  const startQueue = () => {
    clearDebounce();

    if (activeSave) {
      return activeSave;
    }

    if (disposed || !online || !hasPendingSnapshot) {
      syncPendingState();
      return Promise.resolve();
    }

    const operation = Promise.resolve().then(processQueue);
    activeSave = operation;

    void operation.finally(() => {
      if (activeSave === operation) {
        activeSave = null;
      }

      syncPendingState();

      if (
        !disposed &&
        online &&
        hasPendingSnapshot &&
        status.value !== "error"
      ) {
        void startQueue();
      }
    });

    return operation;
  };

  const scheduleDebouncedSave = () => {
    clearDebounce();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void startQueue();
    }, debounceMs);
  };

  const schedule = (snapshot: T) => {
    if (disposed) {
      return;
    }

    pendingSnapshot = snapshot;
    hasPendingSnapshot = true;
    errorMessage.value = "";
    syncPendingState();

    if (!online) {
      clearDebounce();
      status.value = "offline";
      return;
    }

    if (activeSave || inFlight) {
      status.value = "saving";
      return;
    }

    status.value = "dirty";
    scheduleDebouncedSave();
  };

  const flush = async () => {
    clearDebounce();

    while (!disposed && online) {
      const operation = activeSave ?? (hasPendingSnapshot ? startQueue() : null);

      if (!operation) {
        break;
      }

      await operation;

      if (status.value === "error" || status.value === "offline") {
        break;
      }

      if (!activeSave && !hasPendingSnapshot) {
        break;
      }
    }
  };

  const retry = async () => {
    if (disposed || !hasPendingChanges.value) {
      return;
    }

    online = browserIsOnline();
    if (!online) {
      status.value = "offline";
      return;
    }

    errorMessage.value = "";
    status.value = activeSave ? "saving" : "dirty";
    await flush();
  };

  const handleOnline = () => {
    if (disposed) {
      return;
    }

    online = true;
    errorMessage.value = "";

    if (hasPendingChanges.value) {
      status.value = activeSave ? "saving" : "dirty";
      void retry();
    } else {
      status.value = "saved";
    }
  };

  const handleOffline = () => {
    if (disposed) {
      return;
    }

    online = false;
    clearDebounce();
    status.value = "offline";
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  const dispose = () => {
    if (disposed) {
      return;
    }

    disposed = true;
    clearDebounce();

    if (typeof window !== "undefined") {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    }
  };

  return {
    dispose,
    errorMessage,
    flush,
    hasPendingChanges,
    lastSavedAt,
    retry,
    schedule,
    status,
  };
};
