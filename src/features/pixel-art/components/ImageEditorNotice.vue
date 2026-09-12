<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, X } from "@lucide/vue";
import { computed } from "vue";

export type ImageEditorNoticeTone = "success" | "error" | "info";

const props = defineProps<{
  message: string;
  tone: ImageEditorNoticeTone;
}>();

const emit = defineEmits<{
  dismiss: [];
}>();

const noticeIcon = computed(() => {
  if (props.tone === "success") {
    return CircleCheck;
  }
  if (props.tone === "error") {
    return CircleAlert;
  }
  return Info;
});

const accessibleLabel = computed(() => {
  if (props.tone === "success") {
    return "Success";
  }
  if (props.tone === "error") {
    return "Error";
  }
  return "Information";
});
</script>

<template>
  <Transition name="image-editor-notice">
    <div
      v-if="message"
      class="image-editor-notice"
      :class="`image-editor-notice--${tone}`"
      :role="tone === 'error' ? 'alert' : 'status'"
      :aria-live="tone === 'error' ? 'assertive' : 'polite'"
      aria-atomic="true"
    >
      <component :is="noticeIcon" class="image-editor-notice__icon" aria-hidden="true" />
      <div class="image-editor-notice__copy">
        <span class="image-editor-notice__label">{{ accessibleLabel }}</span>
        <p>{{ message }}</p>
      </div>
      <button
        type="button"
        class="image-editor-notice__dismiss"
        :aria-label="`Dismiss ${accessibleLabel.toLowerCase()} message`"
        title="Dismiss"
        @click="emit('dismiss')"
      >
        <X aria-hidden="true" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
  .image-editor-notice {
    --notice-accent: #9fc9ea;

    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    width: min(100%, 340px);
    min-width: 0;
    padding: 8px 8px 8px 11px;
    overflow: hidden;
    color: #f2f2f2;
    pointer-events: auto;
    background: #111313;
    border: 1px solid rgba(242, 242, 242, 0.18);
    border-radius: 8px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.32);
  }

  .image-editor-notice::before {
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    content: "";
    background: var(--notice-accent);
  }

  .image-editor-notice--success {
    --notice-accent: #8fcca9;
  }

  .image-editor-notice--error {
    --notice-accent: #ef8f7d;
  }

  .image-editor-notice--info {
    --notice-accent: #9fc9ea;
  }

  .image-editor-notice__icon {
    width: 16px;
    height: 16px;
    color: var(--notice-accent);
    stroke-width: 1.9;
  }

  .image-editor-notice__copy {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .image-editor-notice__label {
    color: var(--notice-accent);
    font-size: 11px;
    font-weight: 650;
    line-height: 1;
  }

  .image-editor-notice__copy p {
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 11px;
    line-height: 1.35;
  }

  .image-editor-notice__dismiss {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: rgba(242, 242, 242, 0.72);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 5px;
    cursor: pointer;
  }

  .image-editor-notice__dismiss:hover {
    color: #ffffff;
    background: rgba(242, 242, 242, 0.08);
    border-color: rgba(242, 242, 242, 0.16);
  }

  .image-editor-notice__dismiss:focus-visible {
    outline: 2px solid var(--notice-accent);
    outline-offset: 1px;
  }

  .image-editor-notice__dismiss svg {
    width: 14px;
    height: 14px;
    stroke-width: 1.9;
  }

  .image-editor-notice-enter-active,
  .image-editor-notice-leave-active {
    transition:
      opacity 150ms ease,
      transform 150ms ease;
  }

  .image-editor-notice-enter-from,
  .image-editor-notice-leave-to {
    opacity: 0;
    transform: translateY(-5px);
  }

  @media (prefers-reduced-motion: reduce) {
    .image-editor-notice-enter-active,
    .image-editor-notice-leave-active {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .image-editor-notice {
      border-color: CanvasText;
    }
  }
</style>
