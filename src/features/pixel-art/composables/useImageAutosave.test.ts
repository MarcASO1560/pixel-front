import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useImageAutosave } from "./useImageAutosave";

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
};

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("useImageAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("debounces schedules and saves only the latest snapshot", async () => {
    const save = vi.fn(async () => undefined);
    const autosave = useImageAutosave(save);

    autosave.schedule({ revision: 1 });
    autosave.schedule({ revision: 2 });

    expect(autosave.status.value).toBe("dirty");
    expect(autosave.hasPendingChanges.value).toBe(true);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(419);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await settle();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ revision: 2 });
    expect(autosave.status.value).toBe("saved");
    expect(autosave.hasPendingChanges.value).toBe(false);
  });

  it("records the time only after a confirmed save", async () => {
    vi.setSystemTime(new Date("2026-09-11T20:00:00Z"));
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce(undefined);
    const autosave = useImageAutosave(save, { debounceMs: 1 });

    expect(autosave.status.value).toBe("saved");
    expect(autosave.lastSavedAt.value).toBeNull();

    autosave.schedule("document");
    await vi.advanceTimersByTimeAsync(1);
    await settle();

    expect(autosave.status.value).toBe("error");
    expect(autosave.lastSavedAt.value).toBeNull();

    vi.setSystemTime(new Date("2026-09-11T20:01:00Z"));
    await autosave.retry();

    expect(autosave.status.value).toBe("saved");
    expect(autosave.lastSavedAt.value).toBe(
      new Date("2026-09-11T20:01:00Z").getTime(),
    );
  });

  it("allows only one request in flight and follows it with the latest pending snapshot", async () => {
    const firstSave = deferred();
    const secondSave = deferred();
    const save = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);
    const autosave = useImageAutosave(save, { debounceMs: 10 });

    autosave.schedule(1);
    await vi.advanceTimersByTimeAsync(10);
    await settle();
    expect(save).toHaveBeenCalledWith(1);

    autosave.schedule(2);
    autosave.schedule(3);
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);

    firstSave.resolve();
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(3);

    secondSave.resolve();
    await settle();
    expect(autosave.status.value).toBe("saved");
  });

  it("flushes immediately and waits for snapshots queued during the active save", async () => {
    const firstSave = deferred();
    const secondSave = deferred();
    const save = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);
    const autosave = useImageAutosave(save);

    autosave.schedule("first");
    const flushPromise = autosave.flush();
    await settle();
    expect(save).toHaveBeenCalledWith("first");

    autosave.schedule("second");
    firstSave.resolve();
    await settle();
    expect(save).toHaveBeenLastCalledWith("second");

    let didFlush = false;
    void flushPromise.then(() => {
      didFlush = true;
    });
    await settle();
    expect(didFlush).toBe(false);

    secondSave.resolve();
    await flushPromise;
    expect(didFlush).toBe(true);
    expect(autosave.status.value).toBe("saved");
  });

  it("retains a thrown snapshot and saves it on retry", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce(undefined);
    const autosave = useImageAutosave(save, { debounceMs: 1 });

    autosave.schedule({ pixels: ["#FFFFFF"] });
    await vi.advanceTimersByTimeAsync(1);
    await settle();

    expect(autosave.status.value).toBe("error");
    expect(autosave.errorMessage.value).toBe("Connection lost");
    expect(autosave.hasPendingChanges.value).toBe(true);

    await autosave.retry();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ pixels: ["#FFFFFF"] });
    expect(autosave.status.value).toBe("saved");
    expect(autosave.errorMessage.value).toBe("");
    expect(autosave.hasPendingChanges.value).toBe(false);
  });

  it("treats a failed HTTP response as an error without dropping the snapshot", async () => {
    const save = vi.fn(async () => ({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    }));
    const autosave = useImageAutosave(save, { debounceMs: 1 });

    autosave.schedule("document");
    await vi.advanceTimersByTimeAsync(1);
    await settle();

    expect(autosave.status.value).toBe("error");
    expect(autosave.errorMessage.value).toContain("HTTP 503 Service Unavailable");
    expect(autosave.hasPendingChanges.value).toBe(true);
  });

  it("keeps only a newer snapshot when the active request fails", async () => {
    const activeSave = deferred();
    const save = vi.fn(() => activeSave.promise);
    const autosave = useImageAutosave(save, { debounceMs: 1 });

    autosave.schedule(1);
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    autosave.schedule(2);
    activeSave.reject(new Error("Failed"));
    await settle();

    save.mockResolvedValueOnce(undefined);
    await autosave.retry();

    expect(save).toHaveBeenLastCalledWith(2);
    expect(autosave.status.value).toBe("saved");
  });

  it("pauses while offline and resumes with the pending snapshot when online", async () => {
    const browserEvents = new EventTarget();
    const network = { onLine: false };
    vi.stubGlobal("window", browserEvents);
    vi.stubGlobal("navigator", network);
    const save = vi.fn(async () => undefined);
    const autosave = useImageAutosave(save, { debounceMs: 1 });

    autosave.schedule("offline change");
    await vi.advanceTimersByTimeAsync(100);
    expect(save).not.toHaveBeenCalled();
    expect(autosave.status.value).toBe("offline");
    expect(autosave.hasPendingChanges.value).toBe(true);

    network.onLine = true;
    browserEvents.dispatchEvent(new Event("online"));
    await settle();

    expect(save).toHaveBeenCalledWith("offline change");
    expect(autosave.status.value).toBe("saved");
  });

  it("cancels a pending debounce when the browser goes offline", async () => {
    const browserEvents = new EventTarget();
    const network = { onLine: true };
    vi.stubGlobal("window", browserEvents);
    vi.stubGlobal("navigator", network);
    const save = vi.fn(async () => undefined);
    const autosave = useImageAutosave(save, { debounceMs: 10 });

    autosave.schedule("change");
    network.onLine = false;
    browserEvents.dispatchEvent(new Event("offline"));
    await vi.advanceTimersByTimeAsync(20);

    expect(save).not.toHaveBeenCalled();
    expect(autosave.status.value).toBe("offline");
    expect(autosave.hasPendingChanges.value).toBe(true);
  });

  it("dispose cancels timers, unregisters network handling, and is idempotent", async () => {
    const browserEvents = new EventTarget();
    vi.stubGlobal("window", browserEvents);
    const save = vi.fn(async () => undefined);
    const autosave = useImageAutosave(save, { debounceMs: 10 });

    autosave.schedule("change");
    autosave.dispose();
    autosave.dispose();
    browserEvents.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(20);

    expect(save).not.toHaveBeenCalled();
    expect(autosave.hasPendingChanges.value).toBe(true);
  });

  it("rejects an invalid debounce", () => {
    expect(() => useImageAutosave(vi.fn(), { debounceMs: -1 })).toThrow(RangeError);
  });
});
