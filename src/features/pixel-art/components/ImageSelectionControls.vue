<script setup lang="ts">
import {
  LassoSelect,
  SquareDashed,
  SquareDashedMousePointer,
  SquaresIntersect,
  SquaresSubtract,
  SquaresUnite,
  WandSparkles,
} from "@lucide/vue";

import type {
  ImageSelectionMode,
  ImageSelectionTool,
} from "./ImageSelectionControls.types";

withDefaults(defineProps<{
  tool: ImageSelectionTool;
  mode: ImageSelectionMode;
  canEdit: boolean;
  hasSelection?: boolean;
  contiguous?: boolean;
}>(), {
  hasSelection: false,
  contiguous: true,
});

const emit = defineEmits<{
  "update:tool": [tool: ImageSelectionTool];
  "update:mode": [mode: ImageSelectionMode];
  "update:contiguous": [contiguous: boolean];
}>();

const selectionTools = [
  {
    icon: SquareDashed,
    label: "Rectangle",
    title: "Rectangular selection",
    value: "rectangle",
  },
  {
    icon: LassoSelect,
    label: "Lasso",
    title: "Freehand selection",
    value: "lasso",
  },
  {
    icon: WandSparkles,
    label: "Magic wand",
    title: "Select matching pixels on the active layer",
    value: "wand",
  },
] as const satisfies ReadonlyArray<{
  icon: typeof SquareDashed;
  label: string;
  title: string;
  value: ImageSelectionTool;
}>;

const selectionModes = [
  {
    icon: SquareDashedMousePointer,
    label: "Replace",
    title: "Replace the current selection",
    value: "replace",
  },
  {
    icon: SquaresUnite,
    label: "Add",
    title: "Add to the current selection (Shift)",
    value: "add",
  },
  {
    icon: SquaresSubtract,
    label: "Subtract",
    title: "Subtract from the current selection (Alt)",
    value: "subtract",
  },
  {
    icon: SquaresIntersect,
    label: "Intersect",
    title: "Keep only the overlapping selection (Shift + Alt)",
    value: "intersect",
  },
] as const satisfies ReadonlyArray<{
  icon: typeof SquareDashed;
  label: string;
  title: string;
  value: ImageSelectionMode;
}>;

const navigateSegment = (event: KeyboardEvent) => {
  if (!new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]).has(event.key)) {
    return;
  }

  const group = event.currentTarget as HTMLElement;
  const buttons = Array.from(
    group.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
  );
  if (buttons.length === 0) return;

  event.preventDefault();
  event.stopPropagation();

  const currentIndex = buttons.indexOf(event.target as HTMLButtonElement);
  if (event.key === "Home") {
    buttons[0]?.focus();
    return;
  }
  if (event.key === "End") {
    buttons[buttons.length - 1]?.focus();
    return;
  }

  const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const nextIndex = currentIndex < 0
    ? 0
    : (currentIndex + direction + buttons.length) % buttons.length;
  buttons[nextIndex]?.focus();
};

const selectionModeIsDisabled = (
  mode: ImageSelectionMode,
  canEdit: boolean,
  hasSelection: boolean,
) => !canEdit || ((mode === "subtract" || mode === "intersect") && !hasSelection);
</script>

<template>
  <div class="image-selection-controls" role="group" aria-label="Selection options">
    <div class="image-selection-controls__field">
      <span class="image-selection-controls__label" aria-hidden="true">Type</span>
      <div
        class="image-selection-controls__segment"
        role="radiogroup"
        aria-label="Selection type"
        @keydown="navigateSegment"
      >
        <button
          v-for="option in selectionTools"
          :key="option.value"
          type="button"
          role="radio"
          class="image-selection-controls__button"
          :class="{ 'is-active': tool === option.value }"
          :disabled="!canEdit"
          :tabindex="tool === option.value ? 0 : -1"
          :aria-label="option.title"
          :aria-checked="tool === option.value"
          :title="option.title"
          @click="emit('update:tool', option.value)"
        >
          <component :is="option.icon" :size="16" :stroke-width="2" aria-hidden="true" />
          <span class="image-selection-controls__button-label">{{ option.label }}</span>
        </button>
      </div>
    </div>

    <span class="image-selection-controls__separator" aria-hidden="true"></span>

    <div class="image-selection-controls__field">
      <span class="image-selection-controls__label" aria-hidden="true">Mode</span>
      <div
        class="image-selection-controls__segment is-compact"
        role="radiogroup"
        aria-label="Selection combination mode"
        @keydown="navigateSegment"
      >
        <button
          v-for="option in selectionModes"
          :key="option.value"
          type="button"
          role="radio"
          class="image-selection-controls__button is-icon-only"
          :class="{ 'is-active': mode === option.value }"
          :disabled="selectionModeIsDisabled(option.value, canEdit, hasSelection)"
          :tabindex="mode === option.value ? 0 : -1"
          :aria-label="option.title"
          :aria-checked="mode === option.value"
          :title="option.title"
          @click="emit('update:mode', option.value)"
        >
          <component :is="option.icon" :size="16" :stroke-width="2" aria-hidden="true" />
          <span class="image-selection-controls__visually-hidden">{{ option.label }}</span>
        </button>
      </div>
    </div>

    <label v-if="tool === 'wand'" class="image-selection-controls__contiguous">
      <input
        type="checkbox"
        :checked="contiguous"
        :disabled="!canEdit"
        :aria-label="
          contiguous
            ? 'Magic wand: select connected pixels only'
            : 'Magic wand: select matching pixels everywhere'
        "
        :title="
          contiguous
            ? 'Connected area only'
            : 'Matching color everywhere'
        "
        @change="emit('update:contiguous', ($event.currentTarget as HTMLInputElement).checked)"
      />
      <span class="image-selection-controls__contiguous-long">
        {{ contiguous ? "Connected only" : "Match all" }}
      </span>
      <span class="image-selection-controls__contiguous-short" aria-hidden="true">
        {{ contiguous ? "Area" : "All" }}
      </span>
    </label>
  </div>
</template>

<style scoped>
  .image-selection-controls {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 8px;
    align-items: center;
    min-width: 0;
    color: var(--editor-text, #eeeeee);
  }

  .image-selection-controls__field {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 6px;
    align-items: center;
  }

  .image-selection-controls__label {
    color: var(--editor-muted, #989898);
    font-size: 10px;
    font-weight: 600;
  }

  .image-selection-controls__segment {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    min-width: 0;
    overflow: hidden;
    background: var(--editor-panel, #090909);
    border: 1px solid var(--editor-border, #2c2c2c);
    border-radius: 6px;
  }

  .image-selection-controls__button {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 5px;
    align-items: center;
    justify-content: center;
    min-width: 34px;
    height: 28px;
    padding: 0 7px;
    color: var(--editor-muted, #989898);
    font: inherit;
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-left: 1px solid var(--editor-border, #2c2c2c);
    outline: none;
  }

  .image-selection-controls__button:first-child {
    border-left: 0;
  }

  .image-selection-controls__button:hover:not(:disabled) {
    color: var(--editor-text, #ffffff);
    background: var(--editor-hover, #1c1c1c);
  }

  .image-selection-controls__button.is-active {
    color: var(--editor-selected-ink, #101010);
    background: var(--editor-selected, #eeeeee);
  }

  .image-selection-controls__button:focus-visible {
    position: relative;
    z-index: 1;
    box-shadow: inset 0 0 0 2px var(--editor-focus, #ffffff);
  }

  .image-selection-controls__button:disabled {
    cursor: not-allowed;
    opacity: 0.34;
  }

  .image-selection-controls__button.is-icon-only {
    width: 30px;
    min-width: 30px;
    padding: 0;
  }

  .image-selection-controls__separator {
    flex: 0 0 1px;
    width: 1px;
    height: 20px;
    background: var(--editor-border, #333333);
  }

  .image-selection-controls__contiguous {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 6px;
    align-items: center;
    min-height: 28px;
    padding: 0 4px;
    color: #d0d0d0;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 5px;
  }

  .image-selection-controls__contiguous:hover:not(:has(input:disabled)) {
    color: #ffffff;
  }

  .image-selection-controls__contiguous input {
    width: 15px;
    height: 15px;
    margin: 0;
    accent-color: var(--editor-selected, #eeeeee);
  }

  .image-selection-controls__contiguous:has(input:focus-visible) {
    outline: 2px solid var(--editor-focus, #ffffff);
    outline-offset: 1px;
  }

  .image-selection-controls__contiguous:has(input:disabled) {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .image-selection-controls__contiguous-short {
    display: none;
  }

  .image-selection-controls__visually-hidden {
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

  @media (max-width: 980px) {
    .image-selection-controls__button-label,
    .image-selection-controls__label {
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

    .image-selection-controls__button {
      width: 32px;
      min-width: 32px;
      padding: 0;
    }
  }

  @media (max-width: 768px) {
    .image-selection-controls {
      gap: 6px;
    }

    .image-selection-controls__field {
      gap: 0;
    }

    .image-selection-controls__button,
    .image-selection-controls__button.is-icon-only {
      width: 36px;
      min-width: 36px;
      height: 34px;
    }

    .image-selection-controls__separator {
      height: 24px;
    }

    .image-selection-controls__contiguous {
      min-height: 34px;
      padding-right: 6px;
      padding-left: 3px;
      font-size: 10px;
    }

    .image-selection-controls__contiguous input {
      width: 17px;
      height: 17px;
    }
  }

  @media (max-width: 520px) {
    .image-selection-controls {
      gap: 4px;
    }

    .image-selection-controls__separator {
      display: none;
    }

    .image-selection-controls__button,
    .image-selection-controls__button.is-icon-only {
      width: 34px;
      min-width: 34px;
    }

    .image-selection-controls__contiguous-long {
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

    .image-selection-controls__contiguous-short {
      display: inline;
    }
  }

  @media (max-width: 380px) {
    .image-selection-controls {
      gap: 2px;
    }

    .image-selection-controls__button,
    .image-selection-controls__button.is-icon-only {
      width: 29px;
      min-width: 29px;
    }

    .image-selection-controls__contiguous {
      gap: 3px;
      padding-right: 2px;
      padding-left: 2px;
    }
  }

  @media (forced-colors: active) {
    .image-selection-controls__segment,
    .image-selection-controls__button,
    .image-selection-controls__contiguous {
      border-color: ButtonBorder;
    }

    .image-selection-controls__button.is-active {
      color: HighlightText;
      background: Highlight;
    }
  }
</style>
