<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";

type BoardSize = {
  width: number;
  height: number;
  columns: number;
  rows: number;
  cellSize: number;
};

type Camera = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  focusX: number;
  focusY: number;
  targetFocusX: number;
  targetFocusY: number;
  velocityX: number;
  velocityY: number;
  zoom: number;
  targetZoom: number;
  orbitAngle: number;
  orbitRadius: number;
  targetOrbitRadius: number;
  orbitSpeed: number;
  nextShotAt: number;
};

type Point = readonly [row: number, column: number];
type Pattern = readonly Point[];
type SceneVariant = "ambient" | "travelers";
type SpawnZone = {
  minRow: number;
  maxRow: number;
  minColumn: number;
  maxColumn: number;
};

const props = withDefaults(
  defineProps<{
    variant?: SceneVariant;
  }>(),
  {
    variant: "ambient",
  },
);

const patternFromRle = (rle: string): Pattern => {
  const points: Point[] = [];
  let row = 0;
  let column = 0;
  let count = "";
  const body = rle
    .split("\n")
    .filter((line) => !line.startsWith("#") && !line.startsWith("x"))
    .join("");

  for (const token of body) {
    if (/\d/.test(token)) {
      count += token;
      continue;
    }

    const amount = count === "" ? 1 : Number(count);
    count = "";

    if (token === "o") {
      for (let offset = 0; offset < amount; offset += 1) {
        points.push([row, column + offset]);
      }
      column += amount;
    } else if (token === "b") {
      column += amount;
    } else if (token === "$") {
      row += amount;
      column = 0;
    } else if (token === "!") {
      break;
    }
  }

  return points;
};

const GLIDER: Pattern = [
  [0, 1],
  [1, 2],
  [2, 0],
  [2, 1],
  [2, 2],
];

const BLINKER: Pattern = [
  [0, 0],
  [0, 1],
  [0, 2],
];

const BEACON: Pattern = [
  [0, 0],
  [0, 1],
  [1, 0],
  [2, 3],
  [3, 2],
  [3, 3],
];

const TOAD: Pattern = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 0],
  [1, 1],
  [1, 2],
];

const LIGHTWEIGHT_SPACESHIP = patternFromRle("bo2bo$o4b$o3bo$4o!");
const MEDIUMWEIGHT_SPACESHIP = patternFromRle("bo3bo$o5b$o4bo$5o!");
const HEAVYWEIGHT_SPACESHIP = patternFromRle("bo4bo$o6b$o5bo$6o!");

const SMALL_EXPLODER: Pattern = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, 2],
  [2, 0],
  [2, 2],
  [3, 1],
];

const R_PENTOMINO = patternFromRle("b2o$2ob$bo!");
const ACORN = patternFromRle("bo5b$3bo3b$2o2b3o!");
const DIEHARD = patternFromRle("6bo$2o4bobo$bobo3b3o!");
const PENTADECATHLON = patternFromRle("2b3o2b$obo3bobo$2b3o2b!");
const FIGURE_EIGHT = patternFromRle("3o3b$3o3b$3o3b$3b3o$3b3o$3b3o!");
const TRAFFIC_LIGHT = patternFromRle("3o$3b$3o$3b$3o!");

const PULSAR: Pattern = [
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

const GOSPER_GLIDER_GUN: Pattern = [
  [5, 1],
  [5, 2],
  [6, 1],
  [6, 2],
  [3, 13],
  [3, 14],
  [4, 12],
  [4, 16],
  [5, 11],
  [5, 17],
  [6, 11],
  [6, 15],
  [6, 17],
  [6, 18],
  [7, 11],
  [7, 17],
  [8, 12],
  [8, 16],
  [9, 13],
  [9, 14],
  [1, 25],
  [2, 23],
  [2, 25],
  [3, 21],
  [3, 22],
  [4, 21],
  [4, 22],
  [5, 21],
  [5, 22],
  [6, 23],
  [6, 25],
  [7, 25],
  [3, 35],
  [3, 36],
  [4, 35],
  [4, 36],
];

const MOTIFS: Pattern[] = [
  GLIDER,
  BLINKER,
  BEACON,
  TOAD,
  LIGHTWEIGHT_SPACESHIP,
  MEDIUMWEIGHT_SPACESHIP,
  HEAVYWEIGHT_SPACESHIP,
  SMALL_EXPLODER,
  R_PENTOMINO,
  ACORN,
  DIEHARD,
  PENTADECATHLON,
  FIGURE_EIGHT,
  TRAFFIC_LIGHT,
  PULSAR,
];

const SHIPS: Pattern[] = [
  LIGHTWEIGHT_SPACESHIP,
  MEDIUMWEIGHT_SPACESHIP,
  HEAVYWEIGHT_SPACESHIP,
];

const TRAVELER_MOTIFS: Pattern[] = [
  GLIDER,
  LIGHTWEIGHT_SPACESHIP,
  MEDIUMWEIGHT_SPACESHIP,
  HEAVYWEIGHT_SPACESHIP,
];

const ORBIT_PATTERNS: Pattern[] = [
  GLIDER,
  LIGHTWEIGHT_SPACESHIP,
  MEDIUMWEIGHT_SPACESHIP,
  HEAVYWEIGHT_SPACESHIP,
  R_PENTOMINO,
  ACORN,
  DIEHARD,
  SMALL_EXPLODER,
  PENTADECATHLON,
  FIGURE_EIGHT,
];

const stageRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const cells = shallowRef<Uint8Array>(new Uint8Array());
const trails = shallowRef<Float32Array>(new Float32Array());
const size = ref<BoardSize>({
  width: 0,
  height: 0,
  columns: 0,
  rows: 0,
  cellSize: 20,
});

let context: CanvasRenderingContext2D | null = null;
let resizeObserver: ResizeObserver | null = null;
let animationFrame = 0;
let resizeFrame = 0;
let lastTick = 0;
let lastCameraFrame = 0;
let nextInjectionAt = 0;
let palettePhase = Math.random() * 360;

const STEP_MS = 70;
const INJECTION_MS = 5000;
const WORLD_SCALE = 2.55;
const TRAVELER_STEP_MS = 82;
const TRAVELER_INJECTION_MS = 1800;
const TRAVELER_WORLD_SCALE = 1.45;
const CAMERA_FOCUS_PULL = 0.035;
const CAMERA_ZOOM_EASE = 0.005;
const CAMERA_MAX_SPEED = 24;
const CAMERA_ACCELERATION = 7;
const CAMERA_MAX_ZOOM_SPEED = 0.035;
const CAMERA_MAX_ORBIT_RADIUS_SPEED = 8;

const camera: Camera = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  focusX: 0,
  focusY: 0,
  targetFocusX: 0,
  targetFocusY: 0,
  velocityX: 0,
  velocityY: 0,
  zoom: 1,
  targetZoom: 1,
  orbitAngle: Math.random() * Math.PI * 2,
  orbitRadius: 0,
  targetOrbitRadius: 72,
  orbitSpeed: Math.random() > 0.5 ? 0.034 : -0.034,
  nextShotAt: 0,
};

const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomFloat = (min: number, max: number) =>
  min + Math.random() * (max - min);

const isTravelerScene = () => props.variant === "travelers";

const currentStepMs = () => (isTravelerScene() ? TRAVELER_STEP_MS : STEP_MS);

const currentInjectionMs = () =>
  isTravelerScene() ? TRAVELER_INJECTION_MS : INJECTION_MS;

const currentWorldScale = () =>
  isTravelerScene() ? TRAVELER_WORLD_SCALE : WORLD_SCALE;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

const moveToward = (from: number, to: number, maxDelta: number) => {
  const delta = to - from;

  if (Math.abs(delta) <= maxDelta) {
    return to;
  }

  return from + Math.sign(delta) * maxDelta;
};

const normalizePattern = (pattern: Point[]) => {
  const minRow = Math.min(...pattern.map(([row]) => row));
  const minColumn = Math.min(...pattern.map(([, column]) => column));

  return pattern.map(
    ([row, column]) => [row - minRow, column - minColumn] as const,
  );
};

const transformPatternWithOptions = (
  pattern: Pattern,
  turns: number,
  mirrored: boolean,
) => {
  let transformed = pattern.map(([row, column]) => [row, column] as Point);

  for (let turn = 0; turn < turns; turn += 1) {
    transformed = transformed.map(([row, column]) => [column, -row] as Point);
  }

  if (mirrored) {
    transformed = transformed.map(([row, column]) => [row, -column] as Point);
  }

  return normalizePattern(transformed);
};

const transformPattern = (pattern: Pattern) =>
  transformPatternWithOptions(pattern, randomBetween(0, 3), Math.random() > 0.5);

const patternCenter = (pattern: Pattern) => {
  const sums = pattern.reduce(
    (accumulator, [row, column]) => ({
      row: accumulator.row + row,
      column: accumulator.column + column,
    }),
    { row: 0, column: 0 },
  );

  return {
    row: sums.row / pattern.length,
    column: sums.column / pattern.length,
  };
};

const stepPatternPoints = (pattern: Pattern) => {
  const liveCells = new Set(pattern.map(([row, column]) => `${row},${column}`));
  const neighborCounts = new Map<string, number>();

  for (const [row, column] of pattern) {
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        if (rowOffset === 0 && columnOffset === 0) {
          continue;
        }

        const key = `${row + rowOffset},${column + columnOffset}`;
        neighborCounts.set(key, (neighborCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const nextPattern: Point[] = [];

  for (const [key, neighbors] of neighborCounts) {
    if (neighbors === 3 || (neighbors === 2 && liveCells.has(key))) {
      const [row, column] = key.split(",").map(Number);
      nextPattern.push([row, column]);
    }
  }

  return nextPattern;
};

const directedTravelerPattern = (pattern: Pattern, angle: number) => {
  const targetRow = Math.sin(angle);
  const targetColumn = Math.cos(angle);
  let bestPattern = transformPattern(pattern);
  let bestScore = -Infinity;

  for (let turns = 0; turns < 4; turns += 1) {
    for (const mirrored of [false, true]) {
      const candidate = transformPatternWithOptions(pattern, turns, mirrored);
      const start = patternCenter(candidate);
      let evolved: Pattern = candidate;

      for (let step = 0; step < 4; step += 1) {
        evolved = stepPatternPoints(evolved);
      }

      if (evolved.length === 0) {
        continue;
      }

      const end = patternCenter(evolved);
      const driftRow = end.row - start.row;
      const driftColumn = end.column - start.column;
      const driftLength = Math.hypot(driftRow, driftColumn);

      if (driftLength < 0.05) {
        continue;
      }

      const score =
        (driftRow / driftLength) * targetRow +
        (driftColumn / driftLength) * targetColumn;

      if (score > bestScore) {
        bestScore = score;
        bestPattern = candidate;
      }
    }
  }

  return bestPattern;
};

const placePattern = (
  board: Uint8Array,
  pattern: Pattern,
  startRow: number,
  startColumn: number,
  columns: number,
  rows: number,
) => {
  for (const [row, column] of pattern) {
    const nextRow = (startRow + row + rows) % rows;
    const nextColumn = (startColumn + column + columns) % columns;
    board[nextRow * columns + nextColumn] = 1;
  }
};

const setCell = (
  board: Uint8Array,
  row: number,
  column: number,
  columns: number,
  rows: number,
) => {
  const wrappedRow = (Math.round(row) + rows) % rows;
  const wrappedColumn = (Math.round(column) + columns) % columns;
  board[wrappedRow * columns + wrappedColumn] = 1;
};

const placeSpiralGlyph = (
  board: Uint8Array,
  columns: number,
  rows: number,
  centerRow: number,
  centerColumn: number,
) => {
  const arms = randomBetween(3, 5);
  const maxRadius = randomBetween(10, Math.max(11, Math.floor(Math.min(columns, rows) * 0.38)));
  const twist = Math.random() > 0.5 ? 1 : -1;

  for (let arm = 0; arm < arms; arm += 1) {
    const armOffset = (Math.PI * 2 * arm) / arms;

    for (let step = 0; step < maxRadius * 4; step += 1) {
      const radius = 2 + step * 0.27;
      const angle = armOffset + twist * step * 0.22;
      const row = centerRow + Math.sin(angle) * radius;
      const column = centerColumn + Math.cos(angle) * radius;

      if (step % 3 !== 0 || Math.random() > 0.28) {
        setCell(board, row, column, columns, rows);
      }

      if (step % 7 === 0) {
        setCell(board, row + Math.sin(angle + Math.PI / 2), column + Math.cos(angle + Math.PI / 2), columns, rows);
      }
    }
  }
};

const placeOrbitalRing = (
  board: Uint8Array,
  columns: number,
  rows: number,
  centerRow: number,
  centerColumn: number,
) => {
  const radius = randomBetween(8, Math.max(9, Math.floor(Math.min(columns, rows) * 0.28)));
  const samples = radius * 10;
  const gaps = randomBetween(3, 5);

  for (let index = 0; index < samples; index += 1) {
    const angle = (Math.PI * 2 * index) / samples;
    const gap = Math.floor((index / samples) * gaps);

    if ((index + gap * 5) % randomBetween(8, 12) < 2) {
      continue;
    }

    const wobble = Math.sin(angle * randomBetween(2, 4)) * 1.4;
    setCell(
      board,
      centerRow + Math.sin(angle) * (radius + wobble),
      centerColumn + Math.cos(angle) * (radius + wobble),
      columns,
      rows,
    );
  }
};

const placeRibbon = (
  board: Uint8Array,
  columns: number,
  rows: number,
  startRow: number,
  startColumn: number,
) => {
  const length = randomBetween(20, Math.max(24, Math.floor(columns * 0.42)));
  const amplitude = randomBetween(4, Math.max(5, Math.floor(rows * 0.18)));
  const direction = Math.random() > 0.5 ? 1 : -1;

  for (let step = 0; step < length; step += 1) {
    const row = startRow + Math.sin(step * 0.42) * amplitude;
    const column = startColumn + direction * step;

    setCell(board, row, column, columns, rows);

    if (step % 4 === 0) {
      setCell(board, row + 1, column, columns, rows);
    }

    if (step % 9 === 0) {
      placePattern(
        board,
        transformPattern(SHIPS[randomBetween(0, SHIPS.length - 1)]),
        Math.round(row),
        Math.round(column),
        columns,
        rows,
      );
    }
  }
};

const placeFleet = (board: Uint8Array, columns: number, rows: number) => {
  const originRow = randomBetween(0, rows - 1);
  const originColumn = randomBetween(0, columns - 1);
  const shipCount = randomBetween(4, 8);
  const direction = Math.random() > 0.5 ? 1 : -1;

  for (let index = 0; index < shipCount; index += 1) {
    const ship = transformPattern(SHIPS[randomBetween(0, SHIPS.length - 1)]);
    placePattern(
      board,
      ship,
      originRow + index * randomBetween(4, 7),
      originColumn + direction * index * randomBetween(8, 12),
      columns,
      rows,
    );
  }
};

const placeHeroConstellation = (
  board: Uint8Array,
  columns: number,
  rows: number,
  centerRow: number,
  centerColumn: number,
) => {
  placePattern(board, PULSAR, centerRow - 6, centerColumn - 6, columns, rows);
  placeOrbitalRing(board, columns, rows, centerRow, centerColumn);
  placeSpiralGlyph(board, columns, rows, centerRow, centerColumn);

  if (columns > 58 && rows > 32 && Math.random() > 0.35) {
    placePattern(
      board,
      transformPattern(GOSPER_GLIDER_GUN),
      centerRow - randomBetween(10, 18),
      centerColumn + randomBetween(10, 18),
      columns,
      rows,
    );
  }

  const arms = randomBetween(3, 5);
  const steps = randomBetween(6, 9);

  for (let arm = 0; arm < arms; arm += 1) {
    const baseAngle = (Math.PI * 2 * arm) / arms + Math.random() * 0.35;

    for (let step = 1; step <= steps; step += 1) {
      const distance = 4 + step * randomBetween(3, 5);
      const angle = baseAngle + step * 0.42;
      const pattern =
        step % 3 === 0
          ? SHIPS[randomBetween(0, SHIPS.length - 1)]
          : ORBIT_PATTERNS[randomBetween(0, ORBIT_PATTERNS.length - 1)];

      placePattern(
        board,
        transformPattern(pattern),
        Math.round(centerRow + Math.sin(angle) * distance),
        Math.round(centerColumn + Math.cos(angle) * distance),
        columns,
        rows,
      );
    }
  }

  const satellites = randomBetween(10, 16);

  for (let index = 0; index < satellites; index += 1) {
    const angle = (Math.PI * 2 * index) / satellites + Math.random() * 0.2;
    const distance = randomBetween(12, Math.max(13, Math.min(columns, rows) / 3));
    const pattern = ORBIT_PATTERNS[randomBetween(0, ORBIT_PATTERNS.length - 1)];

    placePattern(
      board,
      transformPattern(pattern),
      Math.round(centerRow + Math.sin(angle) * distance),
      Math.round(centerColumn + Math.cos(angle) * distance),
      columns,
      rows,
    );
  }
};

const placeFeatureScene = (board: Uint8Array, columns: number, rows: number) => {
  const centerRow = randomBetween(Math.floor(rows * 0.28), Math.floor(rows * 0.72));
  const centerColumn = randomBetween(Math.floor(columns * 0.28), Math.floor(columns * 0.72));

  placeSpiralGlyph(board, columns, rows, centerRow, centerColumn);
  placeOrbitalRing(board, columns, rows, centerRow, centerColumn);

  const anchors = [
    [centerRow - 8, centerColumn - 11, PENTADECATHLON],
    [centerRow + 7, centerColumn + 9, FIGURE_EIGHT],
    [centerRow - 3, centerColumn + 15, PULSAR],
    [centerRow + 10, centerColumn - 14, TRAFFIC_LIGHT],
  ] as const;

  for (const [row, column, pattern] of anchors) {
    placePattern(
      board,
      transformPattern(pattern),
      row,
      column,
      columns,
      rows,
    );
  }
};

const placeGunBattery = (board: Uint8Array, columns: number, rows: number) => {
  const anchors = [
    [randomBetween(2, Math.max(2, Math.floor(rows * 0.2))), randomBetween(2, Math.max(2, Math.floor(columns * 0.2)))],
    [
      randomBetween(Math.floor(rows * 0.68), Math.max(Math.floor(rows * 0.68), rows - 10)),
      randomBetween(Math.floor(columns * 0.65), Math.max(Math.floor(columns * 0.65), columns - 42)),
    ],
    [
      randomBetween(Math.floor(rows * 0.35), Math.max(Math.floor(rows * 0.35), rows - 18)),
      randomBetween(Math.floor(columns * 0.55), Math.max(Math.floor(columns * 0.55), columns - 42)),
    ],
  ];
  const [row, column] = anchors[randomBetween(0, anchors.length - 1)];

  placePattern(
    board,
    transformPattern(GOSPER_GLIDER_GUN),
    row,
    column,
    columns,
    rows,
  );
};

const placeTravelerBurst = (
  board: Uint8Array,
  columns: number,
  rows: number,
  centerRow: number,
  centerColumn: number,
) => {
  const armCount = randomBetween(8, 11);
  const ringCount = randomBetween(3, 5);
  const maxRadius = Math.max(9, Math.floor(Math.min(columns, rows) * 0.48));
  const angleOffset = Math.random() * Math.PI * 2;

  for (let arm = 0; arm < armCount; arm += 1) {
    const angle =
      angleOffset +
      (Math.PI * 2 * arm) / armCount +
      randomFloat(-0.1, 0.1);

    for (let ring = 0; ring < ringCount; ring += 1) {
      const motif =
        TRAVELER_MOTIFS[randomBetween(0, TRAVELER_MOTIFS.length - 1)];
      const distance =
        3 + ((ring + 1) / (ringCount + 0.6)) * maxRadius + randomFloat(-1.4, 1.4);

      placePattern(
        board,
        directedTravelerPattern(motif, angle),
        Math.round(centerRow + Math.sin(angle) * distance),
        Math.round(centerColumn + Math.cos(angle) * distance),
        columns,
        rows,
      );
    }
  }
};

const createTravelerSeedBoard = (columns: number, rows: number) => {
  const board = new Uint8Array(columns * rows);

  placeTravelerBurst(board, columns, rows, rows / 2, columns / 2);

  return board;
};

const createSeedBoard = (columns: number, rows: number) => {
  if (isTravelerScene()) {
    return createTravelerSeedBoard(columns, rows);
  }

  const board = new Uint8Array(columns * rows);
  const motifCount = Math.max(8, Math.floor((columns * rows) / 480));
  const fleetCount = Math.max(2, Math.floor((columns * rows) / 2400));
  const heroCount = columns > 56 && rows > 34 ? randomBetween(2, 3) : 1;
  const featureCount = columns > 56 && rows > 34 ? randomBetween(2, 4) : 1;
  const noise = 0.006 + Math.random() * 0.01;

  if (columns > 48 && rows > 22) {
    for (let index = 0; index < randomBetween(2, 4); index += 1) {
      placeGunBattery(board, columns, rows);
    }
  }

  placeHeroConstellation(
    board,
    columns,
    rows,
    Math.floor(rows * 0.52) + randomBetween(-4, 4),
    Math.floor(columns * 0.5) + randomBetween(-5, 5),
  );

  for (let index = 1; index < heroCount; index += 1) {
    placeHeroConstellation(
      board,
      columns,
      rows,
      randomBetween(Math.floor(rows * 0.24), Math.max(Math.floor(rows * 0.24), Math.floor(rows * 0.76))),
      randomBetween(Math.floor(columns * 0.24), Math.max(Math.floor(columns * 0.24), Math.floor(columns * 0.76))),
    );
  }

  for (let index = 0; index < featureCount; index += 1) {
    placeFeatureScene(board, columns, rows);
  }

  for (let index = 0; index < randomBetween(2, 4); index += 1) {
    placeRibbon(
      board,
      columns,
      rows,
      randomBetween(Math.floor(rows * 0.18), Math.floor(rows * 0.82)),
      randomBetween(0, columns - 1),
    );
  }

  for (let index = 0; index < fleetCount; index += 1) {
    placeFleet(board, columns, rows);
  }

  for (let index = 0; index < motifCount; index += 1) {
    const motif = transformPattern(MOTIFS[randomBetween(0, MOTIFS.length - 1)]);
    placePattern(
      board,
      motif,
      randomBetween(0, rows - 1),
      randomBetween(0, columns - 1),
      columns,
      rows,
    );
  }

  for (let index = 0; index < board.length; index += 1) {
    if (Math.random() < noise) {
      board[index] = 1;
    }
  }

  return board;
};

const reviveTrailsFromCells = () => {
  const current = cells.value;
  const currentTrails =
    trails.value.length === current.length
      ? trails.value
      : new Float32Array(current.length);

  for (let index = 0; index < current.length; index += 1) {
    if (current[index] === 1) {
      currentTrails[index] = 1;
    }
  }

  trails.value = currentTrails;
};

const pickOffCameraSpawn = (): Point => {
  const { columns, rows, cellSize, width, height } = size.value;
  const visibleMinColumn = camera.x / cellSize;
  const visibleMaxColumn = (camera.x + width / camera.zoom) / cellSize;
  const visibleMinRow = camera.y / cellSize;
  const visibleMaxRow = (camera.y + height / camera.zoom) / cellSize;
  const edgeMargin = 10;
  const sceneClearance = 32;
  const minColumn = edgeMargin;
  const maxColumn = Math.max(edgeMargin, columns - edgeMargin - 1);
  const minRow = edgeMargin;
  const maxRow = Math.max(edgeMargin, rows - edgeMargin - 1);
  const zones: SpawnZone[] = [];

  if (visibleMinColumn - sceneClearance > minColumn) {
    zones.push({
      minRow,
      maxRow,
      minColumn,
      maxColumn: Math.floor(visibleMinColumn - sceneClearance),
    });
  }

  if (visibleMaxColumn + sceneClearance < maxColumn) {
    zones.push({
      minRow,
      maxRow,
      minColumn: Math.ceil(visibleMaxColumn + sceneClearance),
      maxColumn,
    });
  }

  if (visibleMinRow - sceneClearance > minRow) {
    zones.push({
      minRow,
      maxRow: Math.floor(visibleMinRow - sceneClearance),
      minColumn,
      maxColumn,
    });
  }

  if (visibleMaxRow + sceneClearance < maxRow) {
    zones.push({
      minRow: Math.ceil(visibleMaxRow + sceneClearance),
      maxRow,
      minColumn,
      maxColumn,
    });
  }

  if (zones.length === 0) {
    let bestRow = rows / 2;
    let bestColumn = columns / 2;
    let bestDistance = -1;
    const cameraCenterColumn = (visibleMinColumn + visibleMaxColumn) / 2;
    const cameraCenterRow = (visibleMinRow + visibleMaxRow) / 2;

    for (let index = 0; index < 18; index += 1) {
      const row = randomFloat(minRow, maxRow);
      const column = randomFloat(minColumn, maxColumn);
      const distance = Math.hypot(row - cameraCenterRow, column - cameraCenterColumn);

      if (distance > bestDistance) {
        bestDistance = distance;
        bestRow = row;
        bestColumn = column;
      }
    }

    return [bestRow, bestColumn];
  }

  const weightedZones = zones.map((zone) => ({
    zone,
    weight: Math.max(1, zone.maxRow - zone.minRow) * Math.max(1, zone.maxColumn - zone.minColumn),
  }));
  const totalWeight = weightedZones.reduce((sum, { weight }) => sum + weight, 0);
  let cursor = Math.random() * totalWeight;
  const chosen =
    weightedZones.find(({ weight }) => {
      cursor -= weight;
      return cursor <= 0;
    })?.zone ?? weightedZones[weightedZones.length - 1].zone;

  return [
    randomFloat(chosen.minRow, chosen.maxRow),
    randomFloat(chosen.minColumn, chosen.maxColumn),
  ];
};

const injectFreshPattern = (timestamp: number) => {
  const { columns, rows } = size.value;
  const board = cells.value;

  if (columns === 0 || rows === 0 || board.length === 0) {
    return;
  }

  if (isTravelerScene()) {
    placeTravelerBurst(
      board,
      columns,
      rows,
      rows / 2 + randomFloat(-rows * 0.035, rows * 0.035),
      columns / 2 + randomFloat(-columns * 0.035, columns * 0.035),
    );
    reviveTrailsFromCells();
    return;
  }

  const [centerRow, centerColumn] = pickOffCameraSpawn();
  const sceneType = randomBetween(0, 5);

  if (sceneType === 0) {
    placeHeroConstellation(board, columns, rows, centerRow, centerColumn);
  } else if (sceneType === 1) {
    placeSpiralGlyph(board, columns, rows, centerRow, centerColumn);
    placeOrbitalRing(board, columns, rows, centerRow, centerColumn);
  } else if (sceneType === 2) {
    placePattern(
      board,
      transformPattern(PULSAR),
      Math.round(centerRow - 6),
      Math.round(centerColumn - 6),
      columns,
      rows,
    );
    placePattern(
      board,
      transformPattern(PENTADECATHLON),
      Math.round(centerRow + randomBetween(-9, 9)),
      Math.round(centerColumn + randomBetween(-12, 12)),
      columns,
      rows,
    );
  } else if (sceneType === 3) {
    placeRibbon(board, columns, rows, centerRow, centerColumn);
  } else if (sceneType === 4 && columns > 58 && rows > 32) {
    placePattern(
      board,
      transformPattern(GOSPER_GLIDER_GUN),
      Math.round(centerRow - 8),
      Math.round(centerColumn - 18),
      columns,
      rows,
    );
  } else {
    for (let index = 0; index < randomBetween(5, 9); index += 1) {
      placePattern(
        board,
        transformPattern(ORBIT_PATTERNS[randomBetween(0, ORBIT_PATTERNS.length - 1)]),
        Math.round(centerRow + randomBetween(-16, 16)),
        Math.round(centerColumn + randomBetween(-22, 22)),
        columns,
        rows,
      );
    }
  }

  reviveTrailsFromCells();

  if (Math.random() > 0.55) {
    camera.nextShotAt = Math.min(
      camera.nextShotAt,
      timestamp + randomBetween(9000, 15000),
    );
  }
};

const cameraLimits = (zoom = camera.zoom) => {
  const { width, height, columns, rows, cellSize } = size.value;
  const worldWidth = columns * cellSize;
  const worldHeight = rows * cellSize;

  return {
    maxX: Math.max(0, worldWidth - width / zoom),
    maxY: Math.max(0, worldHeight - height / zoom),
  };
};

const clampCamera = () => {
  const current = cameraLimits(camera.zoom);
  const target = cameraLimits(camera.targetZoom);
  const { columns, rows, cellSize } = size.value;
  const worldWidth = columns * cellSize;
  const worldHeight = rows * cellSize;

  camera.x = clamp(camera.x, 0, current.maxX);
  camera.y = clamp(camera.y, 0, current.maxY);
  camera.targetX = clamp(camera.targetX, 0, target.maxX);
  camera.targetY = clamp(camera.targetY, 0, target.maxY);
  camera.focusX = clamp(camera.focusX, 0, worldWidth);
  camera.focusY = clamp(camera.focusY, 0, worldHeight);
  camera.targetFocusX = clamp(camera.targetFocusX, 0, worldWidth);
  camera.targetFocusY = clamp(camera.targetFocusY, 0, worldHeight);
};

const placeCameraFromFocus = () => {
  const { width, height } = size.value;
  const limits = cameraLimits(camera.zoom);
  const orbitX = Math.cos(camera.orbitAngle) * camera.orbitRadius;
  const orbitY = Math.sin(camera.orbitAngle) * camera.orbitRadius * 0.62;

  camera.targetX = clamp(
    camera.focusX + orbitX - width / (camera.zoom * 2),
    0,
    limits.maxX,
  );
  camera.targetY = clamp(
    camera.focusY + orbitY - height / (camera.zoom * 2),
    0,
    limits.maxY,
  );
  camera.x = camera.targetX;
  camera.y = camera.targetY;
};

const aimCameraAt = (row: number, column: number, zoom: number) => {
  const { width, height, cellSize } = size.value;
  const targetZoom = clamp(zoom, 0.82, 1.42);
  const limits = cameraLimits(targetZoom);
  const orbitBase = Math.min(width, height) / targetZoom;

  camera.targetZoom = targetZoom;
  camera.targetFocusX = column * cellSize;
  camera.targetFocusY = row * cellSize;
  camera.targetOrbitRadius = randomFloat(orbitBase * 0.035, orbitBase * 0.11);
  camera.targetX = clamp(column * cellSize - width / (targetZoom * 2), 0, limits.maxX);
  camera.targetY = clamp(row * cellSize - height / (targetZoom * 2), 0, limits.maxY);
  clampCamera();
};

const pickCameraTarget = () => {
  const { columns, rows } = size.value;
  if (columns === 0 || rows === 0 || cells.value.length === 0) {
    return;
  }

  if (isTravelerScene()) {
    aimCameraAt(rows / 2, columns / 2, 0.94);
    return;
  }

  const bucketColumns = 9;
  const bucketRows = 6;
  const scores = new Float32Array(bucketColumns * bucketRows);
  const current = cells.value;
  const currentTrails = trails.value;

  for (let row = 0; row < rows; row += 1) {
    const bucketRow = Math.min(bucketRows - 1, Math.floor((row / rows) * bucketRows));

    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const alive = current[index] === 1 ? 2.8 : 0;
      const trail = currentTrails[index] ?? 0;

      if (alive === 0 && trail < 0.08) {
        continue;
      }

      const bucketColumn = Math.min(
        bucketColumns - 1,
        Math.floor((column / columns) * bucketColumns),
      );
      const centerBias =
        1 -
        Math.min(
          0.45,
          Math.hypot(column / columns - 0.5, row / rows - 0.5) * 0.38,
        );

      scores[bucketRow * bucketColumns + bucketColumn] +=
        (alive + trail) * centerBias;
    }
  }

  const candidates = Array.from(scores)
    .map((score, index) => ({ index, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .filter(({ score }) => score > 0);

  if (candidates.length === 0) {
    aimCameraAt(rows / 2, columns / 2, 0.92);
    return;
  }

  const chosen = candidates[randomBetween(0, candidates.length - 1)];
  const bucketRow = Math.floor(chosen.index / bucketColumns);
  const bucketColumn = chosen.index % bucketColumns;
  const rowSpan = rows / bucketRows;
  const columnSpan = columns / bucketColumns;
  const targetRow = (bucketRow + randomFloat(0.26, 0.74)) * rowSpan;
  const targetColumn = (bucketColumn + randomFloat(0.24, 0.76)) * columnSpan;
  const zoom = isTravelerScene()
    ? randomFloat(0.88, 1.08)
    : chosen.score > 180
      ? randomFloat(0.9, 1.16)
      : randomFloat(1.05, 1.38);

  aimCameraAt(targetRow, targetColumn, zoom);
};

const updateCamera = (timestamp: number) => {
  const deltaSeconds =
    lastCameraFrame === 0 ? 1 / 60 : Math.min((timestamp - lastCameraFrame) / 1000, 0.12);
  lastCameraFrame = timestamp;

  if (timestamp >= camera.nextShotAt) {
    pickCameraTarget();
    camera.nextShotAt = timestamp + randomBetween(16000, 26000);
  }

  camera.zoom = moveToward(
    camera.zoom,
    lerp(camera.zoom, camera.targetZoom, CAMERA_ZOOM_EASE),
    CAMERA_MAX_ZOOM_SPEED * deltaSeconds,
  );
  const focusDeltaX = camera.targetFocusX - camera.focusX;
  const focusDeltaY = camera.targetFocusY - camera.focusY;
  const focusDistance = Math.hypot(focusDeltaX, focusDeltaY);
  const maxVelocityChange = CAMERA_ACCELERATION * deltaSeconds;

  if (focusDistance < 1) {
    camera.velocityX = moveToward(camera.velocityX, 0, maxVelocityChange);
    camera.velocityY = moveToward(camera.velocityY, 0, maxVelocityChange);
  } else {
    const directionX = focusDeltaX / focusDistance;
    const directionY = focusDeltaY / focusDistance;
    const orbitDirection = Math.sign(camera.orbitSpeed) || 1;
    const curve = clamp(focusDistance / 520, 0, 1) * 0.36;
    const curvedDirectionX = directionX * (1 - curve) - directionY * curve * orbitDirection;
    const curvedDirectionY = directionY * (1 - curve) + directionX * curve * orbitDirection;
    const curvedLength = Math.hypot(curvedDirectionX, curvedDirectionY) || 1;
    const desiredSpeed = clamp(focusDistance * CAMERA_FOCUS_PULL, 2, CAMERA_MAX_SPEED);

    camera.velocityX = moveToward(
      camera.velocityX,
      (curvedDirectionX / curvedLength) * desiredSpeed,
      maxVelocityChange,
    );
    camera.velocityY = moveToward(
      camera.velocityY,
      (curvedDirectionY / curvedLength) * desiredSpeed,
      maxVelocityChange,
    );
  }

  camera.focusX += camera.velocityX * deltaSeconds;
  camera.focusY += camera.velocityY * deltaSeconds;
  camera.orbitRadius = moveToward(
    camera.orbitRadius,
    lerp(camera.orbitRadius, camera.targetOrbitRadius, 0.006),
    CAMERA_MAX_ORBIT_RADIUS_SPEED * deltaSeconds,
  );
  camera.orbitAngle += camera.orbitSpeed * deltaSeconds;
  placeCameraFromFocus();
  clampCamera();
};

const drawCell = (
  row: number,
  column: number,
  alpha: number,
  color: string,
) => {
  if (!context || alpha <= 0) {
    return;
  }

  const { cellSize } = size.value;
  const pixelSize = cellSize * camera.zoom + 0.75;
  const x = (column * cellSize - camera.x) * camera.zoom;
  const y = (row * cellSize - camera.y) * camera.zoom;

  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(x, y, pixelSize, pixelSize);
  context.globalAlpha = 1;
};

const draw = () => {
  if (!context) {
    return;
  }

  const { width, height, columns, rows, cellSize } = size.value;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050505";
  context.fillRect(0, 0, width, height);

  const centerColumn = columns / 2;
  const centerRow = rows / 2;
  const startColumn = Math.max(0, Math.floor(camera.x / cellSize) - 2);
  const endColumn = Math.min(
    columns,
    Math.ceil((camera.x + width / camera.zoom) / cellSize) + 2,
  );
  const startRow = Math.max(0, Math.floor(camera.y / cellSize) - 2);
  const endRow = Math.min(
    rows,
    Math.ceil((camera.y + height / camera.zoom) / cellSize) + 2,
  );

  const colorForCell = (row: number, column: number, trail = false) => {
    const dx = column - centerColumn;
    const dy = row - centerRow;
    const radius = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const wave = Math.sin(radius * 0.28);
    const hue = (angle + radius * 4.4 + palettePhase) % 360;
    const saturation = trail ? 34 + wave * 5 : 48 + wave * 7;
    const lightness = trail ? 60 + wave * 3 : 85 + wave * 3;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  for (let row = startRow; row < endRow; row += 1) {
    for (let column = startColumn; column < endColumn; column += 1) {
      const index = row * columns + column;
      const trail = trails.value[index] ?? 0;

      if (trail > 0.04 && cells.value[index] === 0) {
        drawCell(row, column, trail * 0.2, colorForCell(row, column, true));
      }
    }
  }

  for (let row = startRow; row < endRow; row += 1) {
    for (let column = startColumn; column < endColumn; column += 1) {
      const index = row * columns + column;
      const isAlive = cells.value[index] === 1;

      if (isAlive) {
        drawCell(row, column, 0.5, colorForCell(row, column));
      }
    }
  }

};

const resizeBoard = () => {
  const stage = stageRef.value;
  const canvas = canvasRef.value;
  if (!stage || !canvas) {
    return;
  }

  const rect = stage.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return;
  }

  const nextCellSize = isTravelerScene()
    ? rect.width < 720
      ? 16
      : 20
    : rect.width < 720
      ? 14
      : 18;
  const minColumns = isTravelerScene() ? 36 : 48;
  const minRows = isTravelerScene() ? 28 : 34;
  const nextColumns = Math.max(
    minColumns,
    Math.ceil((rect.width / nextCellSize) * currentWorldScale()),
  );
  const nextRows = Math.max(
    minRows,
    Math.ceil((rect.height / nextCellSize) * currentWorldScale()),
  );
  const nextWidth = rect.width;
  const nextHeight = rect.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const previous = size.value;
  const previousWorldWidth = previous.columns * previous.cellSize;
  const previousWorldHeight = previous.rows * previous.cellSize;
  const previousCameraCenterX =
    previousWorldWidth > 0 ? camera.focusX / previousWorldWidth : 0.5;
  const previousCameraCenterY =
    previousWorldHeight > 0 ? camera.focusY / previousWorldHeight : 0.5;
  const previousTargetCenterX =
    previousWorldWidth > 0 ? camera.targetFocusX / previousWorldWidth : 0.5;
  const previousTargetCenterY =
    previousWorldHeight > 0 ? camera.targetFocusY / previousWorldHeight : 0.5;

  canvas.width = Math.ceil(nextWidth * dpr);
  canvas.height = Math.ceil(nextHeight * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";

  context = canvas.getContext("2d");
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);

  const nextCells = new Uint8Array(nextColumns * nextRows);
  const nextTrails = new Float32Array(nextColumns * nextRows);

  if (cells.value.length === 0) {
    cells.value = createSeedBoard(nextColumns, nextRows);
    trails.value = Float32Array.from(cells.value);
  } else {
    const seed = createSeedBoard(nextColumns, nextRows);
    const previousCells = cells.value;
    const previousTrails = trails.value;

    for (let row = 0; row < nextRows; row += 1) {
      const previousRow = Math.min(
        previous.rows - 1,
        Math.floor(((row + 0.5) * previous.rows) / nextRows),
      );

      for (let column = 0; column < nextColumns; column += 1) {
        const previousColumn = Math.min(
          previous.columns - 1,
          Math.floor(((column + 0.5) * previous.columns) / nextColumns),
        );
        const previousIndex = previousRow * previous.columns + previousColumn;
        const nextIndex = row * nextColumns + column;
        const sampledTrail = previousTrails[previousIndex] ?? 0;
        const seeded = seed[nextIndex] === 1;

        nextCells[nextIndex] =
          previousCells[previousIndex] === 1 || (seeded && Math.random() > 0.42)
            ? 1
            : 0;
        nextTrails[nextIndex] = Math.max(sampledTrail * 0.9, seeded ? 0.42 : 0);
      }
    }

    cells.value = nextCells;
    trails.value = nextTrails;
  }

  size.value = {
    width: nextWidth,
    height: nextHeight,
    columns: nextColumns,
    rows: nextRows,
    cellSize: nextCellSize,
  };

  const nextWorldWidth = nextColumns * nextCellSize;
  const nextWorldHeight = nextRows * nextCellSize;
  const nextCenterX = previousCameraCenterX * nextWorldWidth;
  const nextCenterY = previousCameraCenterY * nextWorldHeight;

  camera.focusX = nextCenterX;
  camera.focusY = nextCenterY;
  camera.targetFocusX = previousTargetCenterX * nextWorldWidth;
  camera.targetFocusY = previousTargetCenterY * nextWorldHeight;
  clampCamera();

  if (previous.columns === 0 || previous.rows === 0) {
    pickCameraTarget();
    camera.focusX = camera.targetFocusX;
    camera.focusY = camera.targetFocusY;
    camera.zoom = camera.targetZoom;
    camera.orbitRadius = camera.targetOrbitRadius;
    camera.orbitAngle = Math.random() * Math.PI * 2;
    camera.velocityX = 0;
    camera.velocityY = 0;
    lastCameraFrame = performance.now();
    camera.nextShotAt = performance.now() + randomBetween(12000, 18000);
  }

  placeCameraFromFocus();

  draw();
};

const scheduleResize = () => {
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(resizeBoard);
};

const countNeighbors = (
  board: Uint8Array,
  row: number,
  column: number,
  columns: number,
  rows: number,
) => {
  let count = 0;

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) {
        continue;
      }

      const nextRow = (row + rowOffset + rows) % rows;
      const nextColumn = (column + columnOffset + columns) % columns;
      count += board[nextRow * columns + nextColumn];
    }
  }

  return count;
};

const stepBoard = () => {
  const { columns, rows } = size.value;
  if (columns === 0 || rows === 0) {
    return;
  }

  const current = cells.value;
  const currentTrails =
    trails.value.length === current.length
      ? trails.value
      : new Float32Array(current.length);
  const next = new Uint8Array(current.length);
  const nextTrails = new Float32Array(current.length);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const neighbors = countNeighbors(current, row, column, columns, rows);
      const alive = current[index] === 1;

      next[index] = alive
        ? neighbors === 2 || neighbors === 3
          ? 1
          : 0
        : neighbors === 3
          ? 1
          : 0;
      nextTrails[index] =
        next[index] === 1 ? 1 : Math.max(currentTrails[index] * 0.992 - 0.00025, 0);
    }
  }

  cells.value = next;
  trails.value = nextTrails;
};

const loop = (timestamp: number) => {
  if (lastTick === 0) {
    lastTick = timestamp;
    nextInjectionAt = timestamp + currentInjectionMs();
    draw();
    animationFrame = window.requestAnimationFrame(loop);
    return;
  }

  const stepMs = currentStepMs();

  while (timestamp - lastTick >= stepMs) {
    stepBoard();
    lastTick += stepMs;
  }

  if (timestamp >= nextInjectionAt) {
    injectFreshPattern(timestamp);
    nextInjectionAt = timestamp + currentInjectionMs();
  }

  updateCamera(timestamp);
  draw();
  animationFrame = window.requestAnimationFrame(loop);
};

onMounted(() => {
  resizeBoard();
  resizeObserver = new ResizeObserver(scheduleResize);

  if (stageRef.value) {
    resizeObserver.observe(stageRef.value);
  }

  window.addEventListener("resize", scheduleResize);
  window.visualViewport?.addEventListener("resize", scheduleResize);
  animationFrame = window.requestAnimationFrame(loop);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener("resize", scheduleResize);
  window.visualViewport?.removeEventListener("resize", scheduleResize);
  window.cancelAnimationFrame(animationFrame);
  window.cancelAnimationFrame(resizeFrame);
});
</script>

<template>
  <section ref="stageRef" class="life-stage" aria-label="Juego de la vida">
    <canvas ref="canvasRef" class="life-board" aria-hidden="true"></canvas>
  </section>
</template>

<style scoped>
.life-stage {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #050505;
}

.life-board {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
