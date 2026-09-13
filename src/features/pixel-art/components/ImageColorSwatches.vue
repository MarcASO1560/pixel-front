<script setup lang="ts">
import { ArrowLeftRight, RotateCcw } from "@lucide/vue";
import { computed, useId } from "vue";

import {
  imageColorInputRgb,
  normalizeImageColor,
  replaceImageColorRgb,
} from "../lib/color";

const props = defineProps<{
  primaryColor: string;
  secondaryColor: string;
  canEdit: boolean;
}>();

const emit = defineEmits<{
  swap: [];
  reset: [];
  "update:primaryColor": [color: string];
  "update:secondaryColor": [color: string];
}>();

const normalizedPrimaryColor = computed(() => normalizeImageColor(props.primaryColor, "#FFFFFF"));
const normalizedSecondaryColor = computed(() =>
  normalizeImageColor(props.secondaryColor, "#000000"),
);
const primaryColorInputValue = computed(() => imageColorInputRgb(props.primaryColor, "#FFFFFF"));
const secondaryColorInputValue = computed(() =>
  imageColorInputRgb(props.secondaryColor, "#000000"),
);
const titleId = useId();

const updateColor = (target: "primary" | "secondary", event: Event) => {
  if (!props.canEdit) {
    return;
  }

  const input = event.currentTarget as HTMLInputElement;
  const fallback = target === "primary" ? "#FFFFFF" : "#000000";
  const currentColor = target === "primary" ? props.primaryColor : props.secondaryColor;
  const color = replaceImageColorRgb(input.value, currentColor, fallback);
  emit(target === "primary" ? "update:primaryColor" : "update:secondaryColor", color);
};
</script>

<template>
  <section class="image-color-swatches" :aria-labelledby="titleId">
    <h2 :id="titleId" class="image-color-swatches__sr-only">
      Drawing colors
    </h2>

    <div class="image-color-swatches__stack" role="group" aria-label="Primary and secondary colors">
      <label
        class="image-color-swatches__swatch image-color-swatches__swatch--secondary"
        :style="{ '--swatch-color': normalizedSecondaryColor }"
        title="Secondary color"
      >
        <span class="image-color-swatches__fill" aria-hidden="true"></span>
        <span class="image-color-swatches__badge" aria-hidden="true">S</span>
        <input
          type="color"
          :value="secondaryColorInputValue"
          :disabled="!canEdit"
          aria-label="Secondary color"
          @input="updateColor('secondary', $event)"
        />
      </label>

      <label
        class="image-color-swatches__swatch image-color-swatches__swatch--primary"
        :style="{ '--swatch-color': normalizedPrimaryColor }"
        title="Primary color"
      >
        <span class="image-color-swatches__fill" aria-hidden="true"></span>
        <span class="image-color-swatches__badge" aria-hidden="true">P</span>
        <input
          type="color"
          :value="primaryColorInputValue"
          :disabled="!canEdit"
          aria-label="Primary color"
          @input="updateColor('primary', $event)"
        />
      </label>
    </div>

    <dl class="image-color-swatches__values">
      <div>
        <dt>Primary</dt>
        <dd>{{ normalizedPrimaryColor }}</dd>
      </div>
      <div>
        <dt>Secondary</dt>
        <dd>{{ normalizedSecondaryColor }}</dd>
      </div>
    </dl>

    <div class="image-color-swatches__actions" role="group" aria-label="Color actions">
      <button
        type="button"
        :disabled="!canEdit"
        aria-label="Swap primary and secondary colors"
        aria-keyshortcuts="X"
        title="Swap colors (X)"
        @click="emit('swap')"
      >
        <ArrowLeftRight aria-hidden="true" />
        <span>Swap</span>
      </button>
      <button
        type="button"
        :disabled="!canEdit"
        aria-label="Reset colors to white and black"
        title="Reset to white and black"
        @click="emit('reset')"
      >
        <RotateCcw aria-hidden="true" />
        <span>Reset</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
  .image-color-swatches {
    --colors-focus: #f2f2f2;
    --colors-ink: #f2f2f2;
    --colors-muted: rgba(242, 242, 242, 0.64);
    --colors-line: rgba(242, 242, 242, 0.14);
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    grid-template-areas:
      "stack values"
      "actions actions";
    gap: 7px 8px;
    width: 100%;
    min-width: 0;
    padding: 8px 0 0;
    box-sizing: border-box;
    color: var(--colors-ink);
    background: transparent;
    border: 0;
    border-top: 1px solid var(--colors-line);
  }

  .image-color-swatches__stack {
    position: relative;
    grid-area: stack;
    width: 56px;
    height: 54px;
  }

  .image-color-swatches__swatch {
    position: absolute;
    display: block;
    width: 38px;
    height: 38px;
    overflow: hidden;
    background-color: #181919;
    background-image:
      linear-gradient(45deg, rgba(247, 241, 231, 0.13) 25%, transparent 25%),
      linear-gradient(-45deg, rgba(247, 241, 231, 0.13) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, rgba(247, 241, 231, 0.13) 75%),
      linear-gradient(-45deg, transparent 75%, rgba(247, 241, 231, 0.13) 75%);
    background-position: 0 0, 0 4px, 4px -4px, -4px 0;
    background-size: 8px 8px;
    border: 1px solid rgba(242, 242, 242, 0.5);
    border-radius: 6px;
    box-shadow: 0 3px 9px rgba(0, 0, 0, 0.28);
    cursor: pointer;
    transition:
      border-color 140ms ease,
      transform 140ms ease;
  }

  .image-color-swatches__fill {
    position: absolute;
    inset: 0;
    background: var(--swatch-color);
    forced-color-adjust: none;
  }

  .image-color-swatches__badge {
    position: absolute;
    right: 3px;
    bottom: 3px;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 13px;
    height: 13px;
    color: #ffffff;
    font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
    font-size: 8px;
    font-weight: 800;
    line-height: 1;
    background: rgba(10, 10, 10, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.58);
    border-radius: 3px;
    pointer-events: none;
  }

  .image-color-swatches__swatch--secondary {
    right: 2px;
    bottom: 2px;
    z-index: 1;
  }

  .image-color-swatches__swatch--primary {
    top: 2px;
    left: 2px;
    z-index: 2;
  }

  .image-color-swatches__swatch:hover:not(:has(input:disabled)) {
    z-index: 3;
    border-color: rgba(255, 255, 255, 0.86);
    transform: translateY(-1px);
  }

  .image-color-swatches__swatch input {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    padding: 0;
    cursor: pointer;
    opacity: 0;
  }

  .image-color-swatches__swatch:focus-within {
    outline: 2px solid var(--colors-focus);
    outline-offset: 2px;
  }

  .image-color-swatches__swatch:has(input:disabled) {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .image-color-swatches__swatch input:disabled {
    cursor: not-allowed;
  }

  .image-color-swatches__values {
    display: grid;
    grid-area: values;
    gap: 6px;
    align-content: center;
    min-width: 0;
    padding: 0;
    margin: 0;
  }

  .image-color-swatches__values div {
    display: flex;
    gap: 5px;
    align-items: baseline;
    justify-content: space-between;
    min-width: 0;
  }

  .image-color-swatches__values dt {
    overflow: hidden;
    color: var(--colors-muted);
    font-size: 9px;
    font-weight: 720;
    line-height: 1.15;
    letter-spacing: 0.055em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .image-color-swatches__values dd {
    margin: 0;
    color: rgba(242, 242, 242, 0.88);
    font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    font-weight: 650;
    line-height: 1.15;
  }

  .image-color-swatches__actions {
    display: grid;
    grid-area: actions;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0;
    padding-top: 5px;
    border-top: 1px solid var(--colors-line);
  }

  .image-color-swatches__actions button {
    display: inline-flex;
    gap: 5px;
    align-items: center;
    justify-content: center;
    height: 28px;
    padding: 0 8px;
    color: rgba(242, 242, 242, 0.78);
    font: inherit;
    font-size: 11px;
    font-weight: 650;
    background: transparent;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
  }

  .image-color-swatches__actions button:hover:not(:disabled) {
    color: #ffffff;
    background: rgba(242, 242, 242, 0.07);
  }

  .image-color-swatches__actions button + button {
    border-left: 1px solid var(--colors-line);
    border-radius: 0 4px 4px 0;
  }

  .image-color-swatches__actions button:focus-visible {
    outline: 2px solid var(--colors-focus);
    outline-offset: 1px;
  }

  .image-color-swatches__actions button:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }

  .image-color-swatches__actions svg {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
    stroke-width: 1.8;
  }

  .image-color-swatches__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 768px) {
    .image-color-swatches {
      grid-template-areas:
        "primary primary-value"
        "secondary secondary-value"
        "actions actions";
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 6px 9px;
      width: 100%;
    }

    .image-color-swatches__stack,
    .image-color-swatches__values {
      display: contents;
    }

    .image-color-swatches__swatch {
      position: relative;
      inset: auto;
      width: 34px;
      height: 34px;
      box-shadow: none;
    }

    .image-color-swatches__swatch:hover:not(:has(input:disabled)) {
      transform: none;
    }

    .image-color-swatches__swatch--primary {
      grid-area: primary;
    }

    .image-color-swatches__swatch--secondary {
      grid-area: secondary;
    }

    .image-color-swatches__values div:first-child {
      grid-area: primary-value;
    }

    .image-color-swatches__values div:last-child {
      grid-area: secondary-value;
    }

    .image-color-swatches__actions {
      gap: 0;
      padding-top: 6px;
    }
  }

  @media (forced-colors: active) {
    .image-color-swatches__swatch,
    .image-color-swatches__actions button {
      border-color: ButtonBorder;
    }
  }
</style>
