<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

type Point = readonly [row: number, column: number];

const canvasRef = ref<HTMLCanvasElement | null>(null);

const COLUMNS = 17;
const ROWS = 17;
const CELL_SIZE = 7;
const PHASE_MS = 150;
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

let phaseBoards: Uint8Array[] = [];
let animationFrame = 0;
let context: CanvasRenderingContext2D | null = null;

const indexFor = (row: number, column: number) => row * COLUMNS + column;
const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;
const smoothstep = (value: number) => value * value * (3 - 2 * value);
const phaseBlend = (value: number) => smoothstep(Math.min(value * 2.5, 1));

const createPulsarBoard = () => {
  const board = new Uint8Array(COLUMNS * ROWS);

  for (const [row, column] of PULSAR) {
    board[indexFor(row + 2, column + 2)] = 1;
  }

  return board;
};

const countNeighbors = (source: Uint8Array, row: number, column: number) => {
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
        nextRow < ROWS &&
        nextColumn >= 0 &&
        nextColumn < COLUMNS
      ) {
        count += source[indexFor(nextRow, nextColumn)];
      }
    }
  }

  return count;
};

const stepBoard = (source: Uint8Array) => {
  const next = new Uint8Array(COLUMNS * ROWS);

  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const index = indexFor(row, column);
      const neighbors = countNeighbors(source, row, column);
      const alive = source[index] === 1;

      next[index] = alive
        ? neighbors === 2 || neighbors === 3
          ? 1
          : 0
        : neighbors === 3
          ? 1
          : 0;
    }
  }

  return next;
};

const buildPhaseBoards = () => {
  const first = createPulsarBoard();
  const second = stepBoard(first);
  const third = stepBoard(second);
  phaseBoards = [first, second, third];
};

const draw = (timestamp = 0) => {
  if (!context || phaseBoards.length === 0) {
    return;
  }

  context.clearRect(0, 0, COLUMNS * CELL_SIZE, ROWS * CELL_SIZE);
  const cycle = timestamp / PHASE_MS;
  const phaseIndex = Math.floor(cycle) % phaseBoards.length;
  const nextPhaseIndex = (phaseIndex + 1) % phaseBoards.length;
  const progress = phaseBlend(cycle - Math.floor(cycle));
  const currentBoard = phaseBoards[phaseIndex];
  const nextBoard = phaseBoards[nextPhaseIndex];

  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const index = indexFor(row, column);
      const presence = lerp(currentBoard[index], nextBoard[index], progress);

      if (presence <= 0.02) {
        continue;
      }

      const distanceFromCenter = Math.hypot(row - ROWS / 2, column - COLUMNS / 2);
      const hue = 150 + distanceFromCenter * 9 + timestamp * 0.006;
      const alpha = 0.12 + presence * 0.86;

      context.fillStyle = `hsla(${hue}, 46%, 94%, ${alpha})`;
      context.fillRect(
        column * CELL_SIZE,
        row * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE,
      );
    }
  }
};

const loop = (timestamp: number) => {
  draw(timestamp);
  animationFrame = window.requestAnimationFrame(loop);
};

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = COLUMNS * CELL_SIZE * dpr;
  canvas.height = ROWS * CELL_SIZE * dpr;
  context = canvas.getContext("2d");
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (context) {
    context.imageSmoothingEnabled = true;
  }
  buildPhaseBoards();
  draw();
  animationFrame = window.requestAnimationFrame(loop);
});

onBeforeUnmount(() => {
  window.cancelAnimationFrame(animationFrame);
});
</script>

<template>
  <canvas ref="canvasRef" class="pulsar-logo" aria-hidden="true"></canvas>
</template>

<style scoped>
.pulsar-logo {
  display: block;
  width: clamp(96px, 27vw, 124px);
  height: clamp(96px, 27vw, 124px);
  image-rendering: auto;
  opacity: 0.96;
  filter:
    drop-shadow(0 0 16px rgba(225, 245, 236, 0.22))
    drop-shadow(0 14px 24px rgba(0, 0, 0, 0.28));
}
</style>
