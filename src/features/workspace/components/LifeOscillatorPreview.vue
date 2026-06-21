<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const COLUMNS = 13;
const ROWS = 9;
const STEP_MS = 190;

type Point = readonly [row: number, column: number];

const TABLE_OSCILLATOR: Point[] = [
  [2, 4],
  [2, 5],
  [2, 7],
  [2, 8],
  [4, 5],
  [4, 7],
  [5, 2],
  [5, 3],
  [5, 5],
  [5, 7],
  [5, 9],
  [5, 10],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 8],
  [6, 9],
  [6, 10],
];

const board = ref<Uint8Array>(new Uint8Array(COLUMNS * ROWS));
let timer = 0;

const indexFor = (row: number, column: number) => row * COLUMNS + column;

const createBoard = () => {
  const nextBoard = new Uint8Array(COLUMNS * ROWS);

  for (const [row, column] of TABLE_OSCILLATOR) {
    nextBoard[indexFor(row, column)] = 1;
  }

  return nextBoard;
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

const stepBoard = () => {
  const nextBoard = new Uint8Array(COLUMNS * ROWS);
  const source = board.value;

  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const index = indexFor(row, column);
      const neighbors = countNeighbors(source, row, column);
      const isAlive = source[index] === 1;

      nextBoard[index] = isAlive
        ? neighbors === 2 || neighbors === 3
          ? 1
          : 0
        : neighbors === 3
          ? 1
          : 0;
    }
  }

  board.value = nextBoard;
};

const cells = computed(() => Array.from(board.value));

onMounted(() => {
  board.value = createBoard();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  timer = window.setInterval(stepBoard, STEP_MS);
});

onBeforeUnmount(() => {
  window.clearInterval(timer);
});
</script>

<template>
  <div class="life-oscillator" aria-hidden="true">
    <span
      v-for="(cell, index) in cells"
      :key="index"
      :class="{ 'is-alive': cell === 1 }"
    ></span>
  </div>
</template>

<style scoped>
  .life-oscillator {
    display: grid;
    grid-template-columns: repeat(13, 14px);
    grid-template-rows: repeat(9, 14px);
    gap: 0;
    padding: 10px;
    border-radius: 8px;
    background: transparent;
    image-rendering: pixelated;
  }

  .life-oscillator span {
    width: 14px;
    height: 14px;
    border-radius: 0;
    background: transparent;
    transition:
      background 120ms steps(1, end),
      box-shadow 120ms steps(1, end);
  }

  .life-oscillator span.is-alive {
    background: #f7f1e7;
    box-shadow:
      0 0 10px rgba(247, 241, 231, 0.2),
      inset 0 0 0 1px rgba(255, 255, 255, 0.14);
  }
</style>
