<script setup lang="ts">
import { computed, ref, watch } from "vue";

type PaintTool = "pencil" | "erase";
type PixelTool = PaintTool | "fill" | "move";
type PixelSnapshot = Array<string | null>;

const HISTORY_LIMIT = 80;

const props = withDefaults(
  defineProps<{
    pixels: Array<string | null>;
    palette: string[];
    size?: number;
    ariaLabel?: string;
  }>(),
  {
    size: 16,
    ariaLabel: "Pixel art editor",
  },
);

const emit = defineEmits<{
  "update:pixels": [pixels: Array<string | null>];
  changed: [];
}>();

const selectedColor = ref(props.palette[0] || "#ffffff");
const activeTool = ref<PixelTool>("pencil");
const isDrawing = ref(false);
const isMoving = ref(false);
const hoveredPixelIndex = ref<number | null>(null);
const undoStack = ref<PixelSnapshot[]>([]);
const redoStack = ref<PixelSnapshot[]>([]);

let expectedPixelsKey = "";
let strokeStartPixels: PixelSnapshot | null = null;
let strokeHistoryRecorded = false;
let lastPaintedPixelIndex: number | null = null;
let moveStartPixels: PixelSnapshot | null = null;
let moveLastPixels: PixelSnapshot | null = null;
let moveStartPixelIndex: number | null = null;
let lastMoveDelta = { column: 0, row: 0 };

const emptyPixels = () => Array<string | null>(props.size * props.size).fill(null);

const normalizedPixels = computed(() =>
  emptyPixels().map((_, index) => props.pixels[index] || null),
);

const canvasGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.size}, 1fr)`,
  gridTemplateRows: `repeat(${props.size}, 1fr)`,
  "--pixel-grid-size": `${props.size}`,
}));

const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);

const pixelsKey = (pixels: PixelSnapshot) => pixels.map((pixel) => pixel || "").join("|");

const pixelsAreEqual = (left: PixelSnapshot, right: PixelSnapshot) =>
  left.length === right.length && left.every((pixel, index) => pixel === right[index]);

const normalizeSnapshot = (pixels: PixelSnapshot) =>
  emptyPixels().map((_, index) => pixels[index] || null);

const currentSnapshot = () => [...normalizedPixels.value];

const rememberSnapshot = (snapshot: PixelSnapshot, nextPixels: PixelSnapshot) => {
  if (pixelsAreEqual(snapshot, nextPixels)) {
    return false;
  }

  undoStack.value = [...undoStack.value, snapshot].slice(-HISTORY_LIMIT);
  redoStack.value = [];
  return true;
};

const emitPixels = (nextPixels: PixelSnapshot) => {
  expectedPixelsKey = pixelsKey(nextPixels);
  emit("update:pixels", nextPixels);
  emit("changed");
};

watch(
  () => props.palette,
  (palette) => {
    if (!palette.includes(selectedColor.value)) {
      selectedColor.value = palette[0] || "#ffffff";
    }
  },
);

watch(
  () => props.pixels,
  () => {
    const nextKey = pixelsKey(normalizedPixels.value);
    if (expectedPixelsKey === nextKey) {
      expectedPixelsKey = "";
      return;
    }

    undoStack.value = [];
    redoStack.value = [];
    isDrawing.value = false;
    isMoving.value = false;
    strokeStartPixels = null;
    strokeHistoryRecorded = false;
    lastPaintedPixelIndex = null;
    moveStartPixels = null;
    moveLastPixels = null;
    moveStartPixelIndex = null;
    lastMoveDelta = { column: 0, row: 0 };
  },
  { deep: true },
);

const updatePixels = (
  nextPixels: PixelSnapshot,
  options: { history?: "record" | "skip"; snapshot?: PixelSnapshot } = {},
) => {
  const normalizedNextPixels = normalizeSnapshot(nextPixels);

  if (pixelsAreEqual(normalizedPixels.value, normalizedNextPixels)) {
    return false;
  }

  if (options.history !== "skip") {
    rememberSnapshot(options.snapshot || currentSnapshot(), normalizedNextPixels);
  }

  emitPixels(normalizedNextPixels);
  return true;
};

const pixelPosition = (index: number) => ({
  column: index % props.size,
  row: Math.floor(index / props.size),
});

const pixelIndexFor = (row: number, column: number) => row * props.size + column;

const shiftedPixels = (sourcePixels: PixelSnapshot, rowDelta: number, columnDelta: number) => {
  const nextPixels = emptyPixels();

  sourcePixels.forEach((pixel, index) => {
    if (!pixel) {
      return;
    }

    const { row, column } = pixelPosition(index);
    const nextRow = row + rowDelta;
    const nextColumn = column + columnDelta;

    if (
      nextRow < 0 ||
      nextRow >= props.size ||
      nextColumn < 0 ||
      nextColumn >= props.size
    ) {
      return;
    }

    nextPixels[pixelIndexFor(nextRow, nextColumn)] = pixel;
  });

  return nextPixels;
};

const lineBetweenPixels = (fromIndex: number, toIndex: number) => {
  const from = pixelPosition(fromIndex);
  const to = pixelPosition(toIndex);
  const pixels: number[] = [];

  let column = from.column;
  let row = from.row;
  const columnStep = column < to.column ? 1 : -1;
  const rowStep = row < to.row ? 1 : -1;
  const columnDelta = Math.abs(to.column - column);
  const rowDelta = -Math.abs(to.row - row);
  let error = columnDelta + rowDelta;

  while (true) {
    pixels.push(pixelIndexFor(row, column));

    if (column === to.column && row === to.row) {
      break;
    }

    const doubledError = error * 2;

    if (doubledError >= rowDelta) {
      error += rowDelta;
      column += columnStep;
    }

    if (doubledError <= columnDelta) {
      error += columnDelta;
      row += rowStep;
    }
  }

  return pixels;
};

const paintPixels = (indexes: number[], forcedTool?: PaintTool) => {
  const tool = forcedTool || activeTool.value;
  const nextPixels = currentSnapshot();

  for (const index of indexes) {
    nextPixels[index] = tool === "erase" ? null : selectedColor.value;
  }

  if (!strokeStartPixels) {
    updatePixels(nextPixels);
    return;
  }

  if (!strokeHistoryRecorded) {
    strokeHistoryRecorded = rememberSnapshot(strokeStartPixels, nextPixels);
  }

  updatePixels(nextPixels, { history: "skip" });
};

const paintPixel = (index: number, forcedTool?: PaintTool) => {
  paintPixels([index], forcedTool);
};

const fillPixelsFrom = (startIndex: number) => {
  const targetColor = normalizedPixels.value[startIndex] || null;
  const replacementColor = selectedColor.value;

  if (targetColor === replacementColor) {
    return;
  }

  const nextPixels = currentSnapshot();
  const pending = [startIndex];
  const visited = new Set<number>();

  while (pending.length > 0) {
    const index = pending.pop();

    if (index === undefined || visited.has(index) || nextPixels[index] !== targetColor) {
      continue;
    }

    visited.add(index);
    nextPixels[index] = replacementColor;

    const row = Math.floor(index / props.size);
    const column = index % props.size;

    if (row > 0) pending.push(index - props.size);
    if (row < props.size - 1) pending.push(index + props.size);
    if (column > 0) pending.push(index - 1);
    if (column < props.size - 1) pending.push(index + 1);
  }

  updatePixels(nextPixels);
};

const getPixelIndexFromPointer = (event: PointerEvent) => {
  const canvas = event.currentTarget as HTMLElement;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
    return null;
  }

  const column = Math.min(props.size - 1, Math.floor((x / rect.width) * props.size));
  const row = Math.min(props.size - 1, Math.floor((y / rect.height) * props.size));
  return row * props.size + column;
};

const updateHoveredPixelFromPointer = (event: PointerEvent) => {
  const pixelIndex = getPixelIndexFromPointer(event);
  hoveredPixelIndex.value = pixelIndex;
  return pixelIndex;
};

const getPointerTool = (event: PointerEvent): PixelTool =>
  event.button === 2 || (event.buttons & 2) === 2 ? "erase" : activeTool.value;

const focusAndCapturePointer = (event: PointerEvent) => {
  const canvas = event.currentTarget as HTMLElement;
  canvas.focus();
  canvas.setPointerCapture?.(event.pointerId);
};

const startMoveFromPointer = (event: PointerEvent, pixelIndex: number) => {
  moveStartPixels = currentSnapshot();
  moveLastPixels = null;
  moveStartPixelIndex = pixelIndex;
  lastMoveDelta = { column: 0, row: 0 };
  isDrawing.value = true;
  isMoving.value = true;
  focusAndCapturePointer(event);
};

const continueMoveFromPointer = (event: PointerEvent, pixelIndex: number | null) => {
  if (
    !isMoving.value ||
    !moveStartPixels ||
    moveStartPixelIndex === null ||
    pixelIndex === null
  ) {
    return;
  }

  const startPosition = pixelPosition(moveStartPixelIndex);
  const currentPosition = pixelPosition(pixelIndex);
  const rowDelta = currentPosition.row - startPosition.row;
  const columnDelta = currentPosition.column - startPosition.column;

  if (rowDelta === lastMoveDelta.row && columnDelta === lastMoveDelta.column) {
    return;
  }

  lastMoveDelta = { column: columnDelta, row: rowDelta };
  const nextPixels = shiftedPixels(moveStartPixels, rowDelta, columnDelta);
  moveLastPixels = nextPixels;
  updatePixels(nextPixels, { history: "skip" });
};

const nudgePixels = (rowDelta: number, columnDelta: number) => {
  const startPixels = currentSnapshot();
  updatePixels(shiftedPixels(startPixels, rowDelta, columnDelta), { snapshot: startPixels });
};

const startPaintFromPointer = (event: PointerEvent) => {
  const pixelIndex = updateHoveredPixelFromPointer(event);
  const pointerTool = getPointerTool(event);

  if (pixelIndex === null) {
    return;
  }

  if (pointerTool === "move") {
    startMoveFromPointer(event, pixelIndex);
    return;
  }

  if (pointerTool === "fill") {
    fillPixelsFrom(pixelIndex);
    return;
  }

  strokeStartPixels = currentSnapshot();
  strokeHistoryRecorded = false;
  isDrawing.value = true;
  focusAndCapturePointer(event);
  paintPixel(pixelIndex, pointerTool);
  lastPaintedPixelIndex = pixelIndex;
};

const continuePaintFromPointer = (event: PointerEvent) => {
  const pixelIndex = updateHoveredPixelFromPointer(event);
  const pointerTool = getPointerTool(event);

  if (moveStartPixels) {
    continueMoveFromPointer(event, pixelIndex);
    return;
  }

  if (!isDrawing.value || pointerTool === "fill") {
    return;
  }

  if (pixelIndex === null) {
    lastPaintedPixelIndex = null;
    return;
  }

  paintPixels(
    lineBetweenPixels(lastPaintedPixelIndex ?? pixelIndex, pixelIndex),
    pointerTool,
  );
  lastPaintedPixelIndex = pixelIndex;
};

const stopMove = () => {
  if (moveStartPixels) {
    const finalPixels = moveLastPixels || currentSnapshot();

    if (!pixelsAreEqual(moveStartPixels, finalPixels)) {
      rememberSnapshot(moveStartPixels, finalPixels);
    }
  }

  moveStartPixels = null;
  moveLastPixels = null;
  moveStartPixelIndex = null;
  lastMoveDelta = { column: 0, row: 0 };
  isMoving.value = false;
};

const stopPaint = () => {
  isDrawing.value = false;
  stopMove();
  strokeStartPixels = null;
  strokeHistoryRecorded = false;
  lastPaintedPixelIndex = null;
};

const leaveCanvas = () => {
  hoveredPixelIndex.value = null;
  if (!isMoving.value) {
    stopPaint();
  }
};

const cancelCanvasInteraction = () => {
  hoveredPixelIndex.value = null;
  stopPaint();
};

const clearPixels = () => {
  updatePixels(emptyPixels());
};

const restorePixels = (pixels: PixelSnapshot) => {
  isDrawing.value = false;
  isMoving.value = false;
  stopMove();
  strokeStartPixels = null;
  strokeHistoryRecorded = false;
  lastPaintedPixelIndex = null;
  emitPixels(normalizeSnapshot(pixels));
};

const undoPixels = () => {
  if (!canUndo.value) {
    return;
  }

  const previousPixels = undoStack.value[undoStack.value.length - 1];
  undoStack.value = undoStack.value.slice(0, -1);
  redoStack.value = [...redoStack.value, currentSnapshot()].slice(-HISTORY_LIMIT);
  restorePixels(previousPixels);
};

const redoPixels = () => {
  if (!canRedo.value) {
    return;
  }

  const nextPixels = redoStack.value[redoStack.value.length - 1];
  redoStack.value = redoStack.value.slice(0, -1);
  undoStack.value = [...undoStack.value, currentSnapshot()].slice(-HISTORY_LIMIT);
  restorePixels(nextPixels);
};

const handleCanvasKeydown = (event: KeyboardEvent) => {
  if (!event.ctrlKey && !event.metaKey && activeTool.value === "move") {
    const nudges: Record<string, [number, number]> = {
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
    };
    const nudge = nudges[event.key];

    if (nudge) {
      event.preventDefault();
      nudgePixels(nudge[0], nudge[1]);
      return;
    }
  }

  if (!event.ctrlKey && !event.metaKey) {
    return;
  }

  const key = event.key.toLowerCase();
  const isUndoShortcut = key === "z" && !event.shiftKey;
  const isRedoShortcut = key === "y" || (key === "z" && event.shiftKey);

  if (isUndoShortcut) {
    event.preventDefault();
    undoPixels();
    return;
  }

  if (isRedoShortcut) {
    event.preventDefault();
    redoPixels();
  }
};
</script>

<template>
  <div class="shared-pixel-editor">
    <div class="shared-pixel-editor__toolbar">
      <div class="shared-pixel-editor__actions" aria-label="Pixel art actions">
        <button
          type="button"
          class="shared-tool-button"
          :disabled="!canUndo"
          aria-label="Undo"
          title="Undo"
          @click="undoPixels"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10a6 6 0 0 1 0 12h-2" />
          </svg>
        </button>
        <button
          type="button"
          class="shared-tool-button"
          :disabled="!canRedo"
          aria-label="Redo"
          title="Redo"
          @click="redoPixels"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 14 5-5-5-5" />
            <path d="M20 9H10a6 6 0 0 0 0 12h2" />
          </svg>
        </button>
        <span class="shared-tool-separator" aria-hidden="true"></span>
        <button
          type="button"
          class="shared-tool-button"
          :class="{ 'is-active': activeTool === 'pencil' }"
          aria-label="Pencil"
          title="Pencil"
          @click="activeTool = 'pencil'"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z" />
            <path d="M13 6.5 17.5 11" />
          </svg>
        </button>
        <button
          type="button"
          class="shared-tool-button"
          :class="{ 'is-active': activeTool === 'fill' }"
          aria-label="Fill"
          title="Fill"
          @click="activeTool = 'fill'"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 13 12 5l7 7-8 8-7-7Z" />
            <path d="M5 12h13" />
            <path d="M18 15.5c1.4 1.5 2 2.7 2 3.5a2 2 0 0 1-4 0c0-.8.6-2 2-3.5Z" />
          </svg>
        </button>
        <button
          type="button"
          class="shared-tool-button"
          :class="{ 'is-active': activeTool === 'erase' }"
          aria-label="Erase"
          title="Erase"
          @click="activeTool = 'erase'"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 15.5 12.5 7a2.2 2.2 0 0 1 3.1 0L20 11.4a2.2 2.2 0 0 1 0 3.1L14.5 20H8.8L4 15.5Z" />
            <path d="M8.5 11 16 18.5" />
            <path d="M14.5 20H21" />
          </svg>
        </button>
        <button
          type="button"
          class="shared-tool-button"
          :class="{ 'is-active': activeTool === 'move' }"
          aria-label="Move"
          title="Move"
          @click="activeTool = 'move'"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v18" />
            <path d="M3 12h18" />
            <path d="m8 7 4-4 4 4" />
            <path d="m16 17-4 4-4-4" />
            <path d="m7 8-4 4 4 4" />
            <path d="m17 16 4-4-4-4" />
          </svg>
        </button>
        <button
          type="button"
          class="shared-tool-button"
          aria-label="Clear"
          title="Clear"
          @click="clearPixels"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 7h14" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M8 7l1-3h6l1 3" />
            <path d="M7 7l1 13h8l1-13" />
          </svg>
        </button>
      </div>
    </div>

    <div class="shared-pixel-editor__workspace">
      <div class="shared-pixel-canvas-frame">
        <div
          class="shared-pixel-canvas"
          :class="{ 'is-move-tool': activeTool === 'move', 'is-moving': isMoving }"
          :style="canvasGridStyle"
          :aria-label="ariaLabel"
          tabindex="0"
          @keydown="handleCanvasKeydown"
          @pointerdown.prevent="startPaintFromPointer"
          @pointermove.prevent="continuePaintFromPointer"
          @pointerup="stopPaint"
          @pointercancel="cancelCanvasInteraction"
          @pointerleave="leaveCanvas"
          @contextmenu.prevent
        >
          <span
            v-for="(pixel, index) in normalizedPixels"
            :key="`shared-pixel-${index}`"
            :class="{ 'is-hovered': hoveredPixelIndex === index }"
            :style="{ backgroundColor: pixel || 'transparent' }"
          ></span>
        </div>
      </div>

      <aside class="shared-pixel-editor__tools" aria-label="Color palette">
        <div class="shared-tool-group">
          <span class="shared-sr-only">Brush</span>
          <div class="shared-palette-row" aria-label="Color palette">
            <button
              v-for="color in palette"
              :key="color"
              type="button"
              :class="{
                'is-active':
                  selectedColor === color && activeTool !== 'erase' && activeTool !== 'move',
              }"
              :style="{ '--swatch-color': color }"
              :aria-label="`Use ${color}`"
              @click="
                selectedColor = color;
                if (activeTool === 'erase' || activeTool === 'move') activeTool = 'pencil';
              "
            ></button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
  .shared-pixel-editor {
    display: grid;
    align-content: start;
    justify-self: center;
    width: min(100%, var(--pixel-editor-max-width, 430px));
    gap: clamp(10px, 2.8vw, 14px);
  }

  .shared-pixel-editor__toolbar {
    display: flex;
    gap: clamp(10px, 3vw, 16px);
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  .shared-pixel-editor__actions {
    display: flex;
    gap: clamp(6px, 2vw, 8px);
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  .shared-tool-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: clamp(36px, 10vw, 42px);
    height: clamp(36px, 10vw, 42px);
    min-height: clamp(36px, 10vw, 42px);
    padding: 0;
    color: #f7f1e7;
    background: rgba(255, 252, 244, 0.045);
    border: 1px solid rgba(255, 252, 244, 0.16);
    border-radius: 8px;
    cursor: pointer;
  }

  .shared-tool-button:hover:not(:disabled) {
    background: rgba(255, 252, 244, 0.1);
    border-color: rgba(255, 252, 244, 0.24);
  }

  .shared-tool-button.is-active {
    background: rgba(255, 252, 244, 0.12);
    border-color: rgba(255, 252, 244, 0.34);
  }

  .shared-tool-button svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.9;
  }

  .shared-tool-button:disabled {
    cursor: default;
    opacity: 0.34;
  }

  .shared-tool-separator {
    width: 1px;
    height: 26px;
    background: rgba(255, 252, 244, 0.14);
  }

  .shared-pixel-editor__workspace {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-areas:
      "canvas"
      "tools";
    gap: 12px;
    justify-items: center;
  }

  .shared-pixel-canvas-frame {
    display: grid;
    grid-area: canvas;
    place-items: center;
    width: 100%;
    min-width: 0;
  }

  .shared-pixel-canvas {
    position: relative;
    display: grid;
    width: min(390px, 100%, var(--pixel-canvas-max-size, 390px));
    max-width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    border: 1px solid rgba(255, 252, 244, 0.18);
    border-radius: 8px;
    background:
      linear-gradient(rgba(255, 252, 244, 0.075) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 252, 244, 0.075) 1px, transparent 1px),
      rgba(255, 252, 244, 0.035);
    background-size: calc(100% / var(--pixel-grid-size)) calc(100% / var(--pixel-grid-size));
    cursor: crosshair;
    touch-action: none;
    user-select: none;
  }

  .shared-pixel-canvas::before,
  .shared-pixel-canvas::after {
    position: absolute;
    z-index: 3;
    content: "";
    pointer-events: none;
  }

  .shared-pixel-canvas::before {
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    background: rgba(16, 17, 17, 0.38);
    box-shadow: 1px 0 0 rgba(255, 252, 244, 0.26);
  }

  .shared-pixel-canvas::after {
    top: 50%;
    right: 0;
    left: 0;
    height: 1px;
    background: rgba(16, 17, 17, 0.38);
    box-shadow: 0 1px 0 rgba(255, 252, 244, 0.26);
  }

  .shared-pixel-canvas.is-move-tool {
    cursor: grab;
  }

  .shared-pixel-canvas.is-moving {
    cursor: grabbing;
  }

  .shared-pixel-canvas:focus-visible {
    outline: 2px solid rgba(255, 252, 244, 0.42);
    outline-offset: 4px;
  }

  .shared-pixel-canvas span {
    position: relative;
    min-width: 0;
    min-height: 0;
    pointer-events: none;
  }

  .shared-pixel-canvas span.is-hovered {
    z-index: 1;
  }

  .shared-pixel-canvas span.is-hovered::after {
    position: absolute;
    inset: 0;
    content: "";
    border: 2px solid rgba(255, 255, 255, 0.96);
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.58),
      0 0 0 1px rgba(0, 0, 0, 0.34);
    pointer-events: none;
  }

  .shared-pixel-editor__tools {
    display: grid;
    grid-area: tools;
    align-content: start;
    gap: 0;
    justify-items: center;
    width: 100%;
  }

  .shared-tool-group {
    display: grid;
    gap: 8px;
    justify-items: center;
  }

  .shared-palette-row {
    display: grid;
    grid-template-columns: repeat(6, clamp(28px, 8vw, 32px));
    gap: clamp(8px, 2.4vw, 10px);
    width: max-content;
    max-width: 100%;
    justify-items: center;
  }

  .shared-palette-row button {
    width: clamp(28px, 8vw, 32px);
    height: clamp(28px, 8vw, 32px);
    padding: 0;
    background: var(--swatch-color);
    border: 2px solid rgba(255, 252, 244, 0.34);
    border-radius: 999px;
    cursor: pointer;
  }

  .shared-palette-row button.is-active {
    box-shadow:
      0 0 0 3px rgba(16, 17, 17, 1),
      0 0 0 5px rgba(255, 252, 244, 0.72);
  }

  .shared-sr-only {
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

  @media (max-width: 520px) {
    .shared-pixel-editor__toolbar {
      align-items: center;
    }

    .shared-pixel-editor__workspace {
      grid-template-columns: 1fr;
      grid-template-areas:
        "canvas"
        "tools";
      gap: 14px;
      justify-items: center;
    }

    .shared-pixel-canvas-frame {
      width: 100%;
    }

    .shared-palette-row {
      justify-content: center;
    }

    .shared-pixel-editor__actions {
      width: 100%;
      justify-content: center;
    }

    .shared-pixel-canvas {
      width: min(100%, var(--pixel-canvas-max-size, 390px));
    }
  }

  @media (max-width: 360px) {
    .shared-pixel-editor {
      gap: 9px;
    }

    .shared-pixel-editor__workspace {
      gap: 10px;
    }

    .shared-tool-separator {
      display: none;
    }

    .shared-tool-button svg {
      width: 17px;
      height: 17px;
    }

    .shared-palette-row {
      grid-template-columns: repeat(6, clamp(26px, 8vw, 28px));
      gap: 7px;
    }

    .shared-palette-row button {
      width: clamp(26px, 8vw, 28px);
      height: clamp(26px, 8vw, 28px);
    }
  }
</style>
