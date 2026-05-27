<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

type Point = readonly [row: number, column: number];
type PatternKey = "cell" | "glider" | "ship" | "pulsar" | "acorn";
type PaintMode = "draw" | "erase";

const props = defineProps<{
  userName?: string;
}>();

const GLIDER: Point[] = [
  [0, 1],
  [1, 2],
  [2, 0],
  [2, 1],
  [2, 2],
];

const LIGHTWEIGHT_SPACESHIP: Point[] = [
  [0, 1],
  [0, 4],
  [1, 0],
  [2, 0],
  [2, 4],
  [3, 0],
  [3, 1],
  [3, 2],
  [3, 3],
];

const ACORN: Point[] = [
  [0, 1],
  [1, 3],
  [2, 0],
  [2, 1],
  [2, 4],
  [2, 5],
  [2, 6],
];

const PULSAR: Point[] = [
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 8],
  [0, 9],
  [0, 10],
  [2, 0],
  [2, 5],
  [2, 7],
  [2, 12],
  [3, 0],
  [3, 5],
  [3, 7],
  [3, 12],
  [4, 0],
  [4, 5],
  [4, 7],
  [4, 12],
  [5, 2],
  [5, 3],
  [5, 4],
  [5, 8],
  [5, 9],
  [5, 10],
  [7, 2],
  [7, 3],
  [7, 4],
  [7, 8],
  [7, 9],
  [7, 10],
  [8, 0],
  [8, 5],
  [8, 7],
  [8, 12],
  [9, 0],
  [9, 5],
  [9, 7],
  [9, 12],
  [10, 0],
  [10, 5],
  [10, 7],
  [10, 12],
  [12, 2],
  [12, 3],
  [12, 4],
  [12, 8],
  [12, 9],
  [12, 10],
];

const PATTERNS: Record<Exclude<PatternKey, "cell">, Point[]> = {
  acorn: ACORN,
  glider: GLIDER,
  pulsar: PULSAR,
  ship: LIGHTWEIGHT_SPACESHIP,
};

const canvasRef = ref<HTMLCanvasElement | null>(null);
const boardRef = ref<HTMLDivElement | null>(null);
const selectedPattern = ref<PatternKey>("cell");
const paintMode = ref<PaintMode>("draw");
const isRunning = ref(true);
const generation = ref(0);
const population = ref(0);
const speed = ref(9);

let context: CanvasRenderingContext2D | null = null;
let board = new Uint8Array();
let columns = 0;
let rows = 0;
let cellSize = 14;
let resizeObserver: ResizeObserver | null = null;
let animationFrame = 0;
let lastFrame = 0;
let stepAccumulator = 0;
let pointerIsDown = false;
let lastPaintedCell = "";

const stepMs = computed(() => 230 - speed.value * 16);

const patternOptions: Array<{ key: PatternKey; label: string }> = [
  { key: "cell", label: "Cell" },
  { key: "glider", label: "Glider" },
  { key: "ship", label: "Ship" },
  { key: "pulsar", label: "Pulsar" },
  { key: "acorn", label: "Acorn" },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const indexFor = (row: number, column: number) => row * columns + column;

const normalizePattern = (pattern: Point[]) => {
  const minRow = Math.min(...pattern.map(([row]) => row));
  const minColumn = Math.min(...pattern.map(([, column]) => column));

  return pattern.map(
    ([row, column]) => [row - minRow, column - minColumn] as const,
  );
};

const rotatePattern = (pattern: Point[], turns: number) => {
  let transformed = pattern.map(([row, column]) => [row, column] as Point);

  for (let turn = 0; turn < turns; turn += 1) {
    transformed = transformed.map(([row, column]) => [column, -row] as Point);
  }

  return normalizePattern(transformed);
};

const setCell = (nextRow: number, nextColumn: number, value: number) => {
  if (
    nextRow < 0 ||
    nextColumn < 0 ||
    nextRow >= rows ||
    nextColumn >= columns
  ) {
    return;
  }

  board[indexFor(nextRow, nextColumn)] = value;
};

const placePattern = (
  pattern: Point[],
  startRow: number,
  startColumn: number,
  value = 1,
) => {
  const normalized = normalizePattern(pattern);
  const maxRow = Math.max(...normalized.map(([row]) => row));
  const maxColumn = Math.max(...normalized.map(([, column]) => column));
  const rowOffset = Math.floor(maxRow / 2);
  const columnOffset = Math.floor(maxColumn / 2);

  for (const [row, column] of normalized) {
    setCell(startRow + row - rowOffset, startColumn + column - columnOffset, value);
  }
};

const updatePopulation = () => {
  let nextPopulation = 0;

  for (const cell of board) {
    nextPopulation += cell;
  }

  population.value = nextPopulation;
};

const seedDemoBoard = () => {
  if (columns === 0 || rows === 0) {
    return;
  }

  board.fill(0);
  generation.value = 0;

  const centerRow = Math.floor(rows / 2);
  const centerColumn = Math.floor(columns / 2);

  placePattern(PULSAR, centerRow, centerColumn);

  for (let index = 0; index < 7; index += 1) {
    const angle = (Math.PI * 2 * index) / 7;
    const distance = Math.min(columns, rows) * 0.28;
    const pattern = index % 2 === 0 ? GLIDER : LIGHTWEIGHT_SPACESHIP;

    placePattern(
      rotatePattern(pattern, index % 4),
      Math.round(centerRow + Math.sin(angle) * distance),
      Math.round(centerColumn + Math.cos(angle) * distance),
    );
  }

  updatePopulation();
};

const randomizeBoard = () => {
  for (let index = 0; index < board.length; index += 1) {
    board[index] = Math.random() > 0.78 ? 1 : 0;
  }

  generation.value = 0;
  updatePopulation();
  draw();
};

const clearBoard = () => {
  board.fill(0);
  generation.value = 0;
  updatePopulation();
  draw();
};

const countNeighbors = (row: number, column: number) => {
  let count = 0;

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) {
        continue;
      }

      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;

      if (
        nextRow >= 0 &&
        nextColumn >= 0 &&
        nextRow < rows &&
        nextColumn < columns
      ) {
        count += board[indexFor(nextRow, nextColumn)];
      }
    }
  }

  return count;
};

const stepBoard = () => {
  const nextBoard = new Uint8Array(board.length);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = indexFor(row, column);
      const alive = board[index] === 1;
      const neighbors = countNeighbors(row, column);

      nextBoard[index] = alive
        ? neighbors === 2 || neighbors === 3
          ? 1
          : 0
        : neighbors === 3
          ? 1
          : 0;
    }
  }

  board = nextBoard;
  generation.value += 1;
  updatePopulation();
};

const colorForCell = (row: number, column: number) => {
  const centerRow = rows / 2;
  const centerColumn = columns / 2;
  const dx = column - centerColumn;
  const dy = row - centerRow;
  const radius = Math.sqrt(dx * dx + dy * dy);
  const hue = (Math.atan2(dy, dx) * 57.2958 + radius * 5.4 + 210) % 360;

  return `hsl(${hue}, 42%, 84%)`;
};

const draw = () => {
  if (!context || !canvasRef.value) {
    return;
  }

  const canvas = canvasRef.value;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050505";
  context.fillRect(0, 0, width, height);

  const visibleWidth = columns * cellSize;
  const visibleHeight = rows * cellSize;
  const offsetX = Math.floor((width - visibleWidth) / 2);
  const offsetY = Math.floor((height - visibleHeight) / 2);

  context.fillStyle = "rgba(255, 252, 255, 0.025)";

  if (cellSize >= 11) {
    for (let column = 0; column <= columns; column += 1) {
      const x = offsetX + column * cellSize;
      context.fillRect(x, offsetY, 1, visibleHeight);
    }

    for (let row = 0; row <= rows; row += 1) {
      const y = offsetY + row * cellSize;
      context.fillRect(offsetX, y, visibleWidth, 1);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (board[indexFor(row, column)] === 0) {
        continue;
      }

      context.fillStyle = colorForCell(row, column);
      context.globalAlpha = 0.92;
      context.fillRect(
        offsetX + column * cellSize + 1,
        offsetY + row * cellSize + 1,
        Math.max(2, cellSize - 2),
        Math.max(2, cellSize - 2),
      );
    }
  }

  context.globalAlpha = 1;
};

const resizeBoard = () => {
  const boardElement = boardRef.value;
  const canvas = canvasRef.value;

  if (!boardElement || !canvas) {
    return;
  }

  const rect = boardElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return;
  }

  const previousBoard = board;
  const previousColumns = columns;
  const previousRows = rows;
  const nextCellSize = rect.width < 640 ? 11 : rect.width < 980 ? 13 : 15;
  const nextColumns = Math.max(26, Math.floor(rect.width / nextCellSize));
  const nextRows = Math.max(22, Math.floor(rect.height / nextCellSize));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.ceil(rect.width * dpr);
  canvas.height = Math.ceil(rect.height * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";

  context = canvas.getContext("2d");
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);

  columns = nextColumns;
  rows = nextRows;
  cellSize = nextCellSize;
  board = new Uint8Array(columns * rows);

  if (previousBoard.length === 0) {
    seedDemoBoard();
  } else {
    for (let row = 0; row < rows; row += 1) {
      const previousRow = clamp(
        Math.floor((row / rows) * previousRows),
        0,
        previousRows - 1,
      );

      for (let column = 0; column < columns; column += 1) {
        const previousColumn = clamp(
          Math.floor((column / columns) * previousColumns),
          0,
          previousColumns - 1,
        );

        board[indexFor(row, column)] =
          previousBoard[previousRow * previousColumns + previousColumn] ?? 0;
      }
    }

    updatePopulation();
  }

  draw();
};

const pointerToCell = (event: PointerEvent) => {
  const canvas = canvasRef.value;
  if (!canvas) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const visibleWidth = columns * cellSize;
  const visibleHeight = rows * cellSize;
  const offsetX = (rect.width - visibleWidth) / 2;
  const offsetY = (rect.height - visibleHeight) / 2;
  const column = Math.floor((event.clientX - rect.left - offsetX) / cellSize);
  const row = Math.floor((event.clientY - rect.top - offsetY) / cellSize);

  if (row < 0 || column < 0 || row >= rows || column >= columns) {
    return null;
  }

  return { row, column };
};

const paintAt = (event: PointerEvent) => {
  const cell = pointerToCell(event);
  if (!cell) {
    return;
  }

  const cellKey = `${cell.row}:${cell.column}:${selectedPattern.value}:${paintMode.value}`;
  if (cellKey === lastPaintedCell) {
    return;
  }

  lastPaintedCell = cellKey;

  if (selectedPattern.value === "cell") {
    setCell(cell.row, cell.column, paintMode.value === "draw" ? 1 : 0);
  } else {
    placePattern(
      PATTERNS[selectedPattern.value],
      cell.row,
      cell.column,
      paintMode.value === "draw" ? 1 : 0,
    );
  }

  generation.value = 0;
  updatePopulation();
  draw();
};

const handlePointerDown = (event: PointerEvent) => {
  canvasRef.value?.setPointerCapture(event.pointerId);
  pointerIsDown = true;
  lastPaintedCell = "";
  paintAt(event);
};

const handlePointerMove = (event: PointerEvent) => {
  if (!pointerIsDown) {
    return;
  }

  paintAt(event);
};

const handlePointerUp = (event: PointerEvent) => {
  canvasRef.value?.releasePointerCapture(event.pointerId);
  pointerIsDown = false;
  lastPaintedCell = "";
};

const loop = (timestamp: number) => {
  if (lastFrame === 0) {
    lastFrame = timestamp;
  }

  const delta = timestamp - lastFrame;
  lastFrame = timestamp;

  if (isRunning.value) {
    stepAccumulator += delta;

    while (stepAccumulator >= stepMs.value) {
      stepBoard();
      stepAccumulator -= stepMs.value;
    }
  }

  draw();
  animationFrame = window.requestAnimationFrame(loop);
};

onMounted(() => {
  resizeBoard();
  resizeObserver = new ResizeObserver(resizeBoard);

  if (boardRef.value) {
    resizeObserver.observe(boardRef.value);
  }

  animationFrame = window.requestAnimationFrame(loop);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.cancelAnimationFrame(animationFrame);
});
</script>

<template>
  <section class="life-playground" aria-label="Interactive Game of Life">
    <header class="playground-header">
      <div class="playground-title">
        <p>Sefkira Studio</p>
        <h1>Life Lab</h1>
      </div>
      <div class="playground-status" aria-label="Board status">
        <span>{{ population }} alive</span>
        <span>{{ generation }} gen</span>
        <span v-if="props.userName">{{ props.userName }}</span>
      </div>
    </header>

    <div ref="boardRef" class="board-frame">
      <canvas
        ref="canvasRef"
        class="life-canvas"
        aria-label="Game of Life board"
        @pointerdown.prevent="handlePointerDown"
        @pointermove.prevent="handlePointerMove"
        @pointerup.prevent="handlePointerUp"
        @pointercancel.prevent="handlePointerUp"
        @pointerleave.prevent="handlePointerUp"
      ></canvas>
    </div>

    <footer class="playground-controls">
      <div class="control-group primary-actions">
        <button class="control-button is-primary" type="button" @click="isRunning = !isRunning">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path v-if="isRunning" d="M8 5v14M16 5v14" />
            <path v-else d="M8 5v14l11-7z" />
          </svg>
          <span>{{ isRunning ? "Pause" : "Play" }}</span>
        </button>
        <button class="control-button" type="button" @click="stepBoard(); draw()">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5v14l8-7z" />
            <path d="M19 5v14" />
          </svg>
          <span>Step</span>
        </button>
        <button class="control-button" type="button" @click="randomizeBoard">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 3h5v5" />
            <path d="M4 20 21 3" />
            <path d="M21 16v5h-5" />
            <path d="m15 15 6 6" />
            <path d="M4 4l5 5" />
          </svg>
          <span>Random</span>
        </button>
        <button class="control-button" type="button" @click="clearBoard">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M6 6l1 14h10l1-14" />
          </svg>
          <span>Clear</span>
        </button>
      </div>

      <div class="control-group mode-group" aria-label="Paint mode">
        <button
          class="segmented-button"
          :class="{ 'is-active': paintMode === 'draw' }"
          type="button"
          @click="paintMode = 'draw'"
        >
          Draw
        </button>
        <button
          class="segmented-button"
          :class="{ 'is-active': paintMode === 'erase' }"
          type="button"
          @click="paintMode = 'erase'"
        >
          Erase
        </button>
      </div>

      <div class="control-group pattern-group" aria-label="Pattern">
        <button
          v-for="pattern in patternOptions"
          :key="pattern.key"
          class="pattern-button"
          :class="{ 'is-active': selectedPattern === pattern.key }"
          type="button"
          @click="selectedPattern = pattern.key"
        >
          {{ pattern.label }}
        </button>
      </div>

      <label class="speed-control">
        <span>Tempo</span>
        <input v-model.number="speed" min="3" max="12" type="range" />
      </label>
    </footer>
  </section>
</template>

<style scoped>
.life-playground {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: clamp(12px, 2vw, 18px);
  width: 100%;
  height: 100vh;
  max-height: 100dvh;
  min-height: 0;
  overflow: hidden;
  padding: clamp(12px, 2.2vw, 22px);
  color: rgba(255, 252, 255, 0.94);
}

.playground-header,
.playground-controls {
  width: 100%;
}

.playground-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
}

.playground-title {
  display: grid;
  gap: 5px;
}

.playground-title p,
.playground-title h1,
.playground-status span {
  margin: 0;
}

.playground-title p {
  color: rgba(255, 252, 255, 0.56);
  font-size: 0.76rem;
  font-weight: 650;
  line-height: 1;
}

.playground-title h1 {
  color: rgba(255, 252, 255, 0.98);
  font-size: clamp(1.75rem, 4vw, 2.7rem);
  font-weight: 680;
  letter-spacing: 0;
  line-height: 0.95;
}

.playground-status {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  color: rgba(255, 252, 255, 0.66);
}

.playground-status span {
  min-height: 28px;
  display: grid;
  place-items: center;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
  font-size: 0.78rem;
  font-weight: 620;
  line-height: 1;
}

.board-frame {
  position: relative;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 42%, rgba(216, 246, 226, 0.07), transparent 36%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.015)),
    #050505;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 28px 90px rgba(0, 0, 0, 0.42);
}

.life-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  image-rendering: pixelated;
  touch-action: none;
}

.playground-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.playground-controls::-webkit-scrollbar {
  display: none;
}

.control-group {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 8px;
}

.control-button,
.segmented-button,
.pattern-button {
  height: 42px;
  border: 1px solid rgba(225, 245, 236, 0.14);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(236, 250, 241, 0.08), rgba(235, 218, 244, 0.07)),
    rgba(3, 4, 7, 0.58);
  color: rgba(255, 252, 255, 0.88);
  cursor: pointer;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 640;
  letter-spacing: 0;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    transform 160ms ease;
}

.control-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 12px;
}

.control-button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.control-button.is-primary {
  min-width: 96px;
}

.segmented-button,
.pattern-button {
  padding: 0 12px;
}

.control-button:hover,
.segmented-button:hover,
.pattern-button:hover,
.segmented-button.is-active,
.pattern-button.is-active {
  border-color: rgba(225, 245, 236, 0.3);
  background:
    linear-gradient(135deg, rgba(236, 250, 241, 0.15), rgba(235, 218, 244, 0.12)),
    rgba(8, 9, 12, 0.72);
}

.control-button:active,
.segmented-button:active,
.pattern-button:active {
  transform: translateY(1px);
}

.speed-control {
  min-width: 156px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  height: 42px;
  padding: 0 12px;
  border: 1px solid rgba(225, 245, 236, 0.11);
  border-radius: 8px;
  background: rgba(3, 4, 7, 0.48);
}

.speed-control span {
  color: rgba(255, 252, 255, 0.68);
  font-size: 0.8rem;
  font-weight: 640;
}

.speed-control input {
  width: 92px;
  accent-color: rgba(223, 249, 232, 0.92);
}

@media (max-width: 720px) {
  .life-playground {
    gap: 10px;
    padding: 12px;
  }

  .playground-header {
    align-items: start;
    flex-direction: column;
    gap: 10px;
  }

  .playground-status {
    justify-content: flex-start;
  }

  .control-button span {
    display: none;
  }

  .control-button {
    width: 42px;
    padding: 0;
  }

  .control-button.is-primary {
    min-width: 42px;
  }

  .segmented-button,
  .pattern-button {
    padding: 0 11px;
  }
}
</style>
