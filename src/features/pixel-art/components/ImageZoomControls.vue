<script setup lang="ts">
import { Maximize2, Minus, Plus, RotateCcw, RotateCw, ScanLine } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  zoom: number;
  min: number;
  max: number;
  rotationRadians: number;
}>();

const emit = defineEmits<{
  "zoom-in": [];
  "zoom-out": [];
  fit: [];
  "actual-size": [];
  "rotate-left": [];
  "rotate-right": [];
  "reset-rotation": [];
}>();

const normalizedMinimum = computed(() =>
  Number.isFinite(props.min) ? Math.max(0, props.min) : 0,
);
const normalizedMaximum = computed(() =>
  Number.isFinite(props.max)
    ? Math.max(normalizedMinimum.value, props.max)
    : normalizedMinimum.value,
);
const normalizedZoom = computed(() =>
  Number.isFinite(props.zoom)
    ? Math.min(normalizedMaximum.value, Math.max(normalizedMinimum.value, props.zoom))
    : normalizedMinimum.value,
);
const zoomPercentage = computed(() => Math.round(normalizedZoom.value * 100));
const canZoomOut = computed(() => normalizedZoom.value > normalizedMinimum.value + 1e-9);
const canZoomIn = computed(() => normalizedZoom.value < normalizedMaximum.value - 1e-9);
const rotationDegrees = computed(() => {
  if (!Number.isFinite(props.rotationRadians)) return 0;

  const normalizedRadians = Math.atan2(
    Math.sin(props.rotationRadians),
    Math.cos(props.rotationRadians),
  );
  const roundedDegrees = Math.round((normalizedRadians * 180) / Math.PI);
  return Object.is(roundedDegrees, -0) ? 0 : roundedDegrees;
});
</script>

<template>
  <div class="image-zoom-controls" role="group" aria-label="Canvas view controls">
    <button
      type="button"
      class="image-zoom-controls__button"
      :disabled="!canZoomOut"
      aria-label="Zoom out"
      title="Zoom out"
      @click="emit('zoom-out')"
    >
      <Minus aria-hidden="true" />
    </button>

    <output
      class="image-zoom-controls__value"
      :aria-label="`Canvas zoom ${zoomPercentage}%`"
      aria-live="polite"
    >
      {{ zoomPercentage }}%
    </output>

    <button
      type="button"
      class="image-zoom-controls__button"
      :disabled="!canZoomIn"
      aria-label="Zoom in"
      title="Zoom in"
      @click="emit('zoom-in')"
    >
      <Plus aria-hidden="true" />
    </button>

    <span class="image-zoom-controls__separator" aria-hidden="true"></span>

    <button
      type="button"
      class="image-zoom-controls__button"
      aria-label="Fit canvas to screen"
      aria-keyshortcuts="1"
      title="Fit to screen (1)"
      @click="emit('fit')"
    >
      <Maximize2 aria-hidden="true" />
    </button>

    <button
      type="button"
      class="image-zoom-controls__button"
      :class="{ 'is-active': Math.abs(normalizedZoom - 1) < 1e-9 }"
      :aria-label="Math.abs(normalizedZoom - 1) < 1e-9
        ? 'Canvas is at actual size'
        : 'Show canvas at actual size'"
      :aria-pressed="Math.abs(normalizedZoom - 1) < 1e-9"
      aria-keyshortcuts="2"
      title="Actual size, 100% (2)"
      @click="emit('actual-size')"
    >
      <ScanLine aria-hidden="true" />
    </button>

    <span
      class="image-zoom-controls__rotation"
      role="group"
      aria-label="Canvas rotation controls"
    >
      <span class="image-zoom-controls__separator" aria-hidden="true"></span>

      <button
        type="button"
        class="image-zoom-controls__button"
        aria-label="Rotate canvas view left by 15 degrees"
        title="Rotate view left 15°"
        @click="emit('rotate-left')"
      >
        <RotateCcw aria-hidden="true" />
      </button>

      <button
        type="button"
        class="image-zoom-controls__button image-zoom-controls__rotation-value"
        :aria-label="`Canvas rotation ${rotationDegrees} degrees. Reset rotation to 0 degrees. Hold Shift and Space, then drag to rotate`"
        title="Reset canvas rotation to 0° · Shift + Space + drag to rotate"
        @click="emit('reset-rotation')"
      >
        {{ rotationDegrees }}°
      </button>

      <button
        type="button"
        class="image-zoom-controls__button"
        aria-label="Rotate canvas view right by 15 degrees"
        title="Rotate view right 15°"
        @click="emit('rotate-right')"
      >
        <RotateCw aria-hidden="true" />
      </button>
    </span>
  </div>
</template>

<style scoped>
  .image-zoom-controls {
    display: inline-flex;
    gap: 0;
    align-items: center;
    min-width: 0;
    height: 28px;
    padding: 0;
    color: #f2f2f2;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .image-zoom-controls__button {
    display: inline-grid;
    flex: 0 0 auto;
    place-items: center;
    width: 28px;
    min-width: 28px;
    height: 28px;
    min-height: 28px;
    padding: 0;
    color: #a6a6a6;
    background: transparent;
    border: 0;
    border-radius: 5px;
    cursor: pointer;
    outline: none;
  }

  .image-zoom-controls__button:hover:not(:disabled) {
    color: #f5f5f5;
    background: #1b1b1b;
  }

  .image-zoom-controls__button.is-active {
    color: #090909;
    background: #f2f2f2;
  }

  .image-zoom-controls__button:focus-visible {
    outline: 1px solid #ffffff;
    outline-offset: -2px;
  }

  .image-zoom-controls__button:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }

  .image-zoom-controls__button svg {
    width: 14px;
    height: 14px;
    stroke-width: 1.9;
  }

  .image-zoom-controls__value {
    min-width: 48px;
    padding: 0 4px;
    color: #c9c9c9;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    line-height: 28px;
    text-align: center;
  }

  .image-zoom-controls__rotation {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
  }

  .image-zoom-controls__rotation-value {
    width: auto;
    min-width: 48px;
    padding: 0 4px;
    color: #c9c9c9;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .image-zoom-controls__separator {
    width: 1px;
    height: 16px;
    margin: 0 4px;
    background: #343434;
  }

  @media (max-width: 768px) {
    .image-zoom-controls {
      height: 36px;
    }

    .image-zoom-controls__button {
      width: 36px;
      min-width: 36px;
      height: 36px;
      min-height: 36px;
    }

    .image-zoom-controls__value {
      min-width: 44px;
      padding-right: 2px;
      padding-left: 2px;
      line-height: 36px;
    }

    .image-zoom-controls__separator {
      margin-right: 2px;
      margin-left: 2px;
    }

    .image-zoom-controls__rotation {
      display: none;
    }
  }

  @media (forced-colors: active) {
    .image-zoom-controls__button {
      border: 1px solid ButtonBorder;
    }

    .image-zoom-controls__button.is-active {
      color: HighlightText;
      background: Highlight;
    }
  }
</style>
