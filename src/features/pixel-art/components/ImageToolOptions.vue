<script setup lang="ts">
import { Redo2, Undo2 } from "@lucide/vue";
import { computed } from "vue";

import type { ImageTool } from "../types";

const props = defineProps<{
  activeTool: ImageTool;
  brushSize: number;
  shapeFilled: boolean;
  canEdit: boolean;
  canUndo: boolean;
  canRedo: boolean;
}>();

const emit = defineEmits<{
  "update:brushSize": [size: number];
  "update:shapeFilled": [filled: boolean];
  undo: [];
  redo: [];
}>();

const toolLabels: Record<ImageTool, string> = {
  pencil: "Pencil",
  graffiti: "Graffiti",
  erase: "Eraser",
  fill: "Fill",
  picker: "Color picker",
  line: "Line",
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  select: "Selection",
  move: "Move",
};

const brushTools: ReadonlySet<ImageTool> = new Set([
  "pencil",
  "graffiti",
  "erase",
  "line",
  "rectangle",
  "ellipse",
]);

const normalizedBrushSize = computed(() =>
  Math.min(8, Math.max(1, Math.round(props.brushSize))),
);
const supportsBrushSize = computed(() => brushTools.has(props.activeTool));
const supportsFilledShape = computed(
  () => props.activeTool === "rectangle" || props.activeTool === "ellipse",
);

const updateBrushSize = (event: Event) => {
  const input = event.currentTarget as HTMLInputElement;
  const size = Math.min(8, Math.max(1, Math.round(Number(input.value) || 1)));
  emit("update:brushSize", size);
};
</script>

<template>
  <div class="image-tool-options" role="toolbar" aria-label="Tool options">
    <div class="image-tool-options__history" role="group" aria-label="Edit history">
      <button
        type="button"
        class="image-tool-options__button"
        :disabled="!canEdit || !canUndo"
        aria-label="Undo"
        aria-keyshortcuts="Control+Z Meta+Z"
        title="Undo (Ctrl/Cmd + Z)"
        @click="emit('undo')"
      >
        <Undo2 aria-hidden="true" />
      </button>
      <button
        type="button"
        class="image-tool-options__button"
        :disabled="!canEdit || !canRedo"
        aria-label="Redo"
        aria-keyshortcuts="Control+Y Meta+Y Control+Shift+Z Meta+Shift+Z"
        title="Redo (Ctrl/Cmd + Y)"
        @click="emit('redo')"
      >
        <Redo2 aria-hidden="true" />
      </button>
    </div>

    <span class="image-tool-options__separator" aria-hidden="true"></span>
    <span class="image-tool-options__tool">{{ toolLabels[activeTool] }}</span>

    <label v-if="supportsBrushSize" class="image-tool-options__size">
      <span>Size</span>
      <input
        type="range"
        min="1"
        max="8"
        step="1"
        :disabled="!canEdit"
        :value="normalizedBrushSize"
        :aria-valuetext="`${normalizedBrushSize} ${normalizedBrushSize === 1 ? 'pixel' : 'pixels'}`"
        @input="updateBrushSize"
      />
      <output>{{ normalizedBrushSize }} px</output>
    </label>

    <label v-if="supportsFilledShape" class="image-tool-options__filled">
      <input
        type="checkbox"
        :checked="shapeFilled"
        :disabled="!canEdit"
        @change="emit('update:shapeFilled', ($event.currentTarget as HTMLInputElement).checked)"
      />
      <span>Filled</span>
    </label>
  </div>
</template>

<style scoped>
  .image-tool-options {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
    min-width: 0;
    min-height: 36px;
    padding: 0 6px;
    box-sizing: border-box;
    color: #c9c9c9;
    font-size: 11px;
    background: #0c0c0c;
    border: 0;
    border-bottom: 1px solid #292929;
    border-radius: 0;
    box-shadow: none;
  }

  .image-tool-options__history {
    display: inline-flex;
    gap: 0;
    align-items: center;
  }

  .image-tool-options__button {
    display: inline-grid;
    place-items: center;
    width: 28px;
    min-width: 28px;
    height: 28px;
    min-height: 28px;
    padding: 0;
    color: #a6a6a6;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 5px;
    outline: none;
  }

  .image-tool-options__button:hover:not(:disabled) {
    color: #f5f5f5;
    background: #1b1b1b;
  }

  .image-tool-options__button:focus-visible {
    outline: 1px solid #ffffff;
    outline-offset: -2px;
  }

  .image-tool-options__button:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }

  .image-tool-options__button svg {
    width: 15px;
    height: 15px;
    stroke-width: 2;
  }

  .image-tool-options__separator {
    flex: 0 0 1px;
    width: 1px;
    height: 18px;
    background: #343434;
  }

  .image-tool-options__tool {
    flex: 0 0 auto;
    min-width: 68px;
    color: #f0f0f0;
    font-weight: 600;
  }

  .image-tool-options__size,
  .image-tool-options__filled {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    min-height: 28px;
  }

  .image-tool-options__size input[type="range"] {
    width: 112px;
    min-height: 24px;
    margin: 0;
    accent-color: #f2f2f2;
  }

  .image-tool-options__size output {
    min-width: 32px;
    color: #f0f0f0;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .image-tool-options__filled {
    min-width: 58px;
    padding: 0 4px;
    color: #d0d0d0;
    cursor: pointer;
    border-radius: 5px;
  }

  .image-tool-options__filled:hover:not(:has(input:disabled)) {
    background: #1b1b1b;
  }

  .image-tool-options__filled input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: #f2f2f2;
  }

  .image-tool-options__filled:has(input:disabled) {
    cursor: not-allowed;
    opacity: 0.4;
  }

  @media (max-width: 768px) {
    .image-tool-options {
      min-height: 44px;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none;
    }

    .image-tool-options::-webkit-scrollbar {
      display: none;
    }

    .image-tool-options__history,
    .image-tool-options__tool,
    .image-tool-options__size,
    .image-tool-options__filled {
      flex-shrink: 0;
    }

    .image-tool-options__button {
      width: 36px;
      min-width: 36px;
      height: 36px;
      min-height: 36px;
    }

    .image-tool-options__tool {
      min-width: 0;
    }

    .image-tool-options__size input[type="range"] {
      width: 72px;
    }
  }

  @media (max-width: 380px) {
    .image-tool-options {
      gap: 6px;
      padding-right: 4px;
      padding-left: 4px;
    }

    .image-tool-options__size input[type="range"] {
      width: 60px;
    }

    .image-tool-options__tool {
      display: none;
    }
  }

  @media (forced-colors: active) {
    .image-tool-options,
    .image-tool-options__button,
    .image-tool-options__separator {
      border-color: ButtonBorder;
    }
  }
</style>
