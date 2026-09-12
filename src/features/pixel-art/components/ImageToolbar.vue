<script setup lang="ts">
import {
  Ellipse,
  Eraser,
  Minus,
  Move,
  PaintBucket,
  Pencil,
  Pipette,
  RectangleHorizontal,
  SprayCan,
  SquareDashed,
} from "@lucide/vue";

import type { ImageTool } from "../types";

defineProps<{
  activeTool: ImageTool;
  canEdit: boolean;
}>();

const emit = defineEmits<{
  "select-tool": [tool: ImageTool];
}>();

const tools = [
  { icon: Pencil, label: "Pencil", shortcut: "B", value: "pencil" },
  { icon: SprayCan, label: "Graffiti", shortcut: "A", value: "graffiti" },
  { icon: Eraser, label: "Eraser", shortcut: "E", value: "erase" },
  { icon: PaintBucket, label: "Fill", shortcut: "G", value: "fill" },
  { icon: Pipette, label: "Color picker", shortcut: "I", value: "picker" },
  { icon: Minus, label: "Line", shortcut: "L", value: "line" },
  { icon: RectangleHorizontal, label: "Rectangle", shortcut: "R", value: "rectangle" },
  { icon: Ellipse, label: "Ellipse", shortcut: "O", value: "ellipse" },
  { icon: SquareDashed, label: "Selection", shortcut: "S", value: "select" },
  { icon: Move, label: "Move", shortcut: "M", value: "move" },
] as const satisfies ReadonlyArray<{
  icon: typeof Pencil;
  label: string;
  shortcut: string;
  value: ImageTool;
}>;

const navigateTools = (event: KeyboardEvent) => {
  if (!new Set(["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home"]).has(event.key)) {
    return;
  }

  const toolbar = event.currentTarget as HTMLElement;
  const buttons = Array.from(
    toolbar.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
  );
  if (buttons.length === 0) {
    return;
  }

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

const getToolAriaLabel = (tool: (typeof tools)[number]) =>
  tool.value === "graffiti" ? "Graffiti checker brush" : tool.label;
const getToolTitle = (tool: (typeof tools)[number]) =>
  tool.value === "graffiti"
    ? `Graffiti · two-color checker · Right click reverses (${tool.shortcut})`
    : `${tool.label} (${tool.shortcut})`;
</script>

<template>
  <div
    class="image-toolbar"
    role="toolbar"
    aria-label="Drawing tools"
    aria-orientation="vertical"
    @keydown="navigateTools"
  >
    <button
      v-for="tool in tools"
      :key="tool.value"
      type="button"
      class="image-toolbar__button"
      :class="{ 'is-active': activeTool === tool.value }"
      :disabled="!canEdit"
      :tabindex="activeTool === tool.value ? 0 : -1"
      :aria-label="getToolAriaLabel(tool)"
      :aria-keyshortcuts="tool.shortcut"
      :aria-pressed="activeTool === tool.value"
      :title="getToolTitle(tool)"
      @click="emit('select-tool', tool.value)"
    >
      <component :is="tool.icon" :size="17" :stroke-width="2" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
  .image-toolbar {
    display: grid;
    grid-template-columns: 32px;
    gap: 2px;
    width: 36px;
    min-width: 0;
    padding: 2px;
    box-sizing: border-box;
    color: #f2f2f2;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .image-toolbar__button {
    display: grid;
    place-items: center;
    width: 32px;
    min-width: 32px;
    height: 32px;
    min-height: 32px;
    padding: 0;
    color: #a6a6a6;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 6px;
    outline: none;
  }

  .image-toolbar__button:hover:not(:disabled) {
    color: #f5f5f5;
    background: #1b1b1b;
  }

  .image-toolbar__button.is-active {
    color: #090909;
    background: #f2f2f2;
  }

  .image-toolbar__button:focus-visible {
    outline: 1px solid #ffffff;
    outline-offset: -2px;
  }

  .image-toolbar__button:disabled {
    cursor: not-allowed;
    opacity: 0.34;
  }

  @media (forced-colors: active) {
    .image-toolbar__button {
      border: 1px solid ButtonBorder;
    }

    .image-toolbar__button.is-active {
      color: HighlightText;
      background: Highlight;
    }
  }
</style>
