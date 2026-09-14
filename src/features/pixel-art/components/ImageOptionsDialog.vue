<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  auxiliaryControlsId?: string;
  dialogId: string;
  label: string;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);
let opener: HTMLElement | null = null;

const restoreFocus = () => {
  const target = opener;
  opener = null;
  if (target?.isConnected) {
    void nextTick(() => target.focus({ preventScroll: true }));
  }
};

const syncDialog = async (open: boolean) => {
  await nextTick();
  const dialog = dialogRef.value;
  if (!dialog) return;

  if (open) {
    if (!dialog.open) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.show();
    }
    await nextTick();
    dialog.querySelector<HTMLElement>("[data-image-dialog-initial-focus]")?.focus({
      preventScroll: true,
    });
    return;
  }

  if (dialog.open) dialog.close();
  restoreFocus();
};

watch(() => props.open, syncDialog, { immediate: true });

const requestClose = () => emit("close");

const getFocusableElements = () => {
  const dialog = dialogRef.value;
  if (!dialog) return [];

  const selector =
    'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
  const dialogElements = Array.from(dialog.querySelectorAll<HTMLElement>(selector));
  const auxiliaryControls = props.auxiliaryControlsId
    ? document.getElementById(props.auxiliaryControlsId)
    : null;
  const auxiliaryElements = auxiliaryControls
    ? Array.from(auxiliaryControls.querySelectorAll<HTMLElement>(selector))
    : [];

  return [...dialogElements, ...auxiliaryElements].filter(
    (element) => !element.hasAttribute("hidden") && element.getClientRects().length > 0,
  );
};

const trapFocus = (event: KeyboardEvent) => {
  if (event.key !== "Tab") return;

  const dialog = dialogRef.value;
  const focusable = getFocusableElements();
  if (!dialog || focusable.length === 0) {
    event.preventDefault();
    dialog?.focus({ preventScroll: true });
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeElement = document.activeElement;

  const focusIsInScope = focusable.includes(activeElement as HTMLElement);

  if (event.shiftKey && (activeElement === first || !focusIsInScope)) {
    event.preventDefault();
    last?.focus({ preventScroll: true });
  } else if (!event.shiftKey && (activeElement === last || !focusIsInScope)) {
    event.preventDefault();
    first?.focus({ preventScroll: true });
  }
};

const handleCancel = (event: Event) => {
  event.preventDefault();
  requestClose();
};

const handleWindowKeydown = (event: KeyboardEvent) => {
  if (!props.open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    requestClose();
    return;
  }

  trapFocus(event);
};

const handleNativeClose = () => {
  if (props.open) emit("close");
  else restoreFocus();
};

onMounted(() => {
  window.addEventListener("keydown", handleWindowKeydown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleWindowKeydown, true);
  if (dialogRef.value?.open) dialogRef.value.close();
  restoreFocus();
});
</script>

<template>
  <div
    v-if="open"
    class="image-options-dialog__backdrop"
    aria-hidden="true"
    @pointerdown="requestClose"
  ></div>
  <dialog
    :id="dialogId"
    ref="dialogRef"
    class="image-options-dialog"
    :aria-label="label"
    data-image-shortcuts="off"
    @cancel="handleCancel"
    @close="handleNativeClose"
  >
    <slot></slot>
  </dialog>
</template>

<style scoped>
  .image-options-dialog {
    position: fixed;
    z-index: 21;
    width: min(430px, calc(100vw - 32px));
    height: min(680px, calc(100dvh - 48px));
    max-width: none;
    max-height: none;
    padding: 0;
    overflow: hidden;
    color: #f2f2f2;
    background: #101010;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    box-shadow:
      0 28px 72px rgba(0, 0, 0, 0.62),
      0 8px 24px rgba(0, 0, 0, 0.42),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .image-options-dialog__backdrop {
    position: fixed;
    z-index: 20;
    inset: 0;
    background: rgba(0, 0, 0, 0.58);
    backdrop-filter: blur(3px);
  }

  .image-options-dialog[open] {
    display: grid;
    grid-template-rows: minmax(0, 1fr);
  }

  .image-options-dialog:not([open]) {
    display: none;
  }

  @media (min-width: 1121px) {
    .image-options-dialog {
      position: fixed;
      inset: 0 70px 0 auto;
      margin: auto 0;
    }
  }

  @media (min-width: 641px) and (max-width: 1120px) {
    .image-options-dialog {
      inset: 0 0 0 auto;
      width: min(390px, calc(100vw - 48px));
      height: 100dvh;
      margin: 0 0 0 auto;
      border-top: 0;
      border-right: 0;
      border-bottom: 0;
      border-radius: 12px 0 0 12px;
    }
  }

  @media (max-width: 640px) {
    .image-options-dialog {
      position: fixed;
      inset: auto 0 0;
      width: 100vw;
      height: min(82dvh, 720px);
      margin: 0;
      border-right: 0;
      border-bottom: 0;
      border-left: 0;
      border-radius: 14px 14px 0 0;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .image-options-dialog[open] {
      animation: image-options-dialog-enter 180ms cubic-bezier(0.22, 1, 0.36, 1);
    }
  }

  @media (forced-colors: active) {
    .image-options-dialog {
      border-color: CanvasText;
    }
  }

  @keyframes image-options-dialog-enter {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.985);
    }
  }
</style>
