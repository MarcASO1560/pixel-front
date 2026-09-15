import type { PixelColor } from "../types";

export type PixelSelectionPoint = Readonly<{
  x: number;
  y: number;
}>;

export type PixelSelectionBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type PixelSelectionDimensions = Readonly<{
  width: number;
  height: number;
}>;

/**
 * A hard-edged selection over a complete pixel canvas.
 *
 * `data` is row-major and always contains exactly `width * height` bytes. A
 * byte is canonicalized to either 0 (outside) or 1 (selected). `bounds` is the
 * smallest rectangle containing every selected pixel, or null for an empty
 * selection.
 */
export type PixelSelectionMask = Readonly<{
  width: number;
  height: number;
  data: Uint8Array;
  bounds: PixelSelectionBounds | null;
}>;

export type PixelSelectionCombineMode = "replace" | "add" | "subtract" | "intersect";

export type PixelSelectionSource = Readonly<{
  width: number;
  height: number;
  pixels: ReadonlyArray<PixelColor>;
}>;

export type MagicWandSelectionOptions = Readonly<{
  /** Select only the four-connected region. Disable to select every exact match. */
  contiguous?: boolean;
}>;

const integer = (value: number) => (Number.isFinite(value) ? Math.round(value) : 0);

const dimension = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const normalizeDimensions = (
  dimensions: PixelSelectionDimensions,
): PixelSelectionDimensions => ({
  width: dimension(dimensions.width),
  height: dimension(dimensions.height),
});

const normalizePoint = (point: PixelSelectionPoint): PixelSelectionPoint => ({
  x: integer(point.x),
  y: integer(point.y),
});

const isInside = (point: PixelSelectionPoint, dimensions: PixelSelectionDimensions) =>
  point.x >= 0 &&
  point.x < dimensions.width &&
  point.y >= 0 &&
  point.y < dimensions.height;

const indexOf = (point: PixelSelectionPoint, width: number) => point.y * width + point.x;

const deriveBounds = (
  width: number,
  height: number,
  data: Uint8Array,
): PixelSelectionBounds | null => {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let index = 0; index < data.length; index += 1) {
    if (data[index] === 0) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return maxX < 0
    ? null
    : {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      };
};

const maskFromData = (
  dimensions: PixelSelectionDimensions,
  source?: ArrayLike<number>,
): PixelSelectionMask => {
  const { width, height } = normalizeDimensions(dimensions);
  const data = new Uint8Array(width * height);

  if (source) {
    const length = Math.min(data.length, source.length);
    for (let index = 0; index < length; index += 1) {
      data[index] = source[index] ? 1 : 0;
    }
  }

  return { width, height, data, bounds: deriveBounds(width, height, data) };
};

/** Builds a canonical immutable-by-convention mask from binary-like data. */
export const createPixelSelectionMask = (
  dimensions: PixelSelectionDimensions,
  data?: ArrayLike<number>,
): PixelSelectionMask => maskFromData(dimensions, data);

export const createEmptySelectionMask = (
  dimensions: PixelSelectionDimensions,
): PixelSelectionMask => maskFromData(dimensions);

/** Builds a mask from points, clipping points outside the canvas. */
export const createPointSelectionMask = (
  points: ReadonlyArray<PixelSelectionPoint>,
  dimensions: PixelSelectionDimensions,
): PixelSelectionMask => {
  const normalizedDimensions = normalizeDimensions(dimensions);
  const data = new Uint8Array(
    normalizedDimensions.width * normalizedDimensions.height,
  );

  for (const rawPoint of points) {
    const point = normalizePoint(rawPoint);
    if (isInside(point, normalizedDimensions)) {
      data[indexOf(point, normalizedDimensions.width)] = 1;
    }
  }

  return maskFromData(normalizedDimensions, data);
};

/** Creates an inclusive rectangular mask, clipped to the canvas. */
export const createRectangleSelectionMask = (
  from: PixelSelectionPoint,
  to: PixelSelectionPoint,
  dimensions: PixelSelectionDimensions,
): PixelSelectionMask => {
  const normalizedDimensions = normalizeDimensions(dimensions);
  const start = normalizePoint(from);
  const end = normalizePoint(to);
  const left = Math.max(0, Math.min(start.x, end.x));
  const top = Math.max(0, Math.min(start.y, end.y));
  const right = Math.min(normalizedDimensions.width - 1, Math.max(start.x, end.x));
  const bottom = Math.min(normalizedDimensions.height - 1, Math.max(start.y, end.y));
  const data = new Uint8Array(
    normalizedDimensions.width * normalizedDimensions.height,
  );

  if (left <= right && top <= bottom) {
    for (let y = top; y <= bottom; y += 1) {
      data.fill(
        1,
        y * normalizedDimensions.width + left,
        y * normalizedDimensions.width + right + 1,
      );
    }
  }

  return maskFromData(normalizedDimensions, data);
};

const rasterizeLine = (
  from: PixelSelectionPoint,
  to: PixelSelectionPoint,
): PixelSelectionPoint[] => {
  const points: PixelSelectionPoint[] = [];
  let x = from.x;
  let y = from.y;
  const xStep = x < to.x ? 1 : -1;
  const yStep = y < to.y ? 1 : -1;
  const xDelta = Math.abs(to.x - x);
  const yDelta = -Math.abs(to.y - y);
  let error = xDelta + yDelta;

  while (true) {
    points.push({ x, y });
    if (x === to.x && y === to.y) return points;

    const doubledError = error * 2;
    if (doubledError >= yDelta) {
      error += yDelta;
      x += xStep;
    }
    if (doubledError <= xDelta) {
      error += xDelta;
      y += yStep;
    }
  }
};

/**
 * Rasterizes a freehand lasso as a closed, hard-edged polygon.
 *
 * One-point and degenerate paths select their rasterized path, so a lasso
 * gesture never creates surprising scanline artifacts.
 */
export const createLassoSelectionMask = (
  path: ReadonlyArray<PixelSelectionPoint>,
  dimensions: PixelSelectionDimensions,
): PixelSelectionMask => {
  const normalizedDimensions = normalizeDimensions(dimensions);
  const vertices = path.map(normalizePoint).filter((point, index, points) => {
    const previous = points[index - 1];
    return !previous || point.x !== previous.x || point.y !== previous.y;
  });
  if (
    vertices.length > 1 &&
    vertices[0].x === vertices.at(-1)?.x &&
    vertices[0].y === vertices.at(-1)?.y
  ) {
    vertices.pop();
  }

  const data = new Uint8Array(
    normalizedDimensions.width * normalizedDimensions.height,
  );
  if (vertices.length === 0) return maskFromData(normalizedDimensions, data);

  if (vertices.length === 1 && isInside(vertices[0], normalizedDimensions)) {
    data[indexOf(vertices[0], normalizedDimensions.width)] = 1;
  }

  const edgeCount = vertices.length >= 3 ? vertices.length : vertices.length - 1;
  for (let index = 0; index < edgeCount; index += 1) {
    const from = vertices[index];
    const to = vertices[(index + 1) % vertices.length];
    for (const point of rasterizeLine(from, to)) {
      if (isInside(point, normalizedDimensions)) {
        data[indexOf(point, normalizedDimensions.width)] = 1;
      }
    }
  }

  if (vertices.length >= 3) {
    let pathMinimumY = vertices[0]!.y;
    let pathMaximumY = vertices[0]!.y;
    for (const point of vertices) {
      pathMinimumY = Math.min(pathMinimumY, point.y);
      pathMaximumY = Math.max(pathMaximumY, point.y);
    }
    const minimumY = Math.max(0, pathMinimumY);
    const maximumY = Math.min(normalizedDimensions.height - 1, pathMaximumY);

    // Scanline filling is O(rows x vertices), rather than testing every canvas
    // pixel against every vertex. Long freehand gestures therefore remain
    // responsive even at the maximum 256 x 256 canvas size.
    for (let y = minimumY; y <= maximumY; y += 1) {
      const intersections: number[] = [];
      for (
        let index = 0, previousIndex = vertices.length - 1;
        index < vertices.length;
        previousIndex = index, index += 1
      ) {
        const current = vertices[index];
        const previous = vertices[previousIndex];
        if (current.y > y === previous.y > y) continue;
        intersections.push(
          ((previous.x - current.x) * (y - current.y)) /
            (previous.y - current.y) +
            current.x,
        );
      }
      intersections.sort((left, right) => left - right);

      for (let index = 0; index + 1 < intersections.length; index += 2) {
        const left = Math.max(0, Math.ceil(intersections[index]));
        const right = Math.min(
          normalizedDimensions.width - 1,
          Math.ceil(intersections[index + 1]) - 1,
        );
        if (left <= right) {
          data.fill(
            1,
            y * normalizedDimensions.width + left,
            y * normalizedDimensions.width + right + 1,
          );
        }
      }
    }
  }

  return maskFromData(normalizedDimensions, data);
};

const pixelAt = (source: PixelSelectionSource, index: number): PixelColor =>
  source.pixels[index] ?? null;

/** Selects an exact color match, either four-connected or across the full canvas. */
export const createMagicWandSelectionMask = (
  source: PixelSelectionSource,
  start: PixelSelectionPoint,
  options: MagicWandSelectionOptions = {},
): PixelSelectionMask => {
  const dimensions = normalizeDimensions(source);
  const origin = normalizePoint(start);
  const data = new Uint8Array(dimensions.width * dimensions.height);
  if (!isInside(origin, dimensions)) return maskFromData(dimensions, data);

  const originIndex = indexOf(origin, dimensions.width);
  const target = pixelAt(source, originIndex);
  if (options.contiguous === false) {
    for (let index = 0; index < data.length; index += 1) {
      if (pixelAt(source, index) === target) data[index] = 1;
    }
    return maskFromData(dimensions, data);
  }

  const pending = [originIndex];
  while (pending.length > 0) {
    const index = pending.pop();
    if (index === undefined || data[index] !== 0 || pixelAt(source, index) !== target) {
      continue;
    }

    data[index] = 1;
    const x = index % dimensions.width;
    const y = Math.floor(index / dimensions.width);
    if (x > 0) pending.push(index - 1);
    if (x < dimensions.width - 1) pending.push(index + 1);
    if (y > 0) pending.push(index - dimensions.width);
    if (y < dimensions.height - 1) pending.push(index + dimensions.width);
  }

  return maskFromData(dimensions, data);
};

const assertSameDimensions = (
  left: PixelSelectionMask,
  right: PixelSelectionMask,
) => {
  if (left.width !== right.width || left.height !== right.height) {
    throw new RangeError("Selection masks must have the same canvas dimensions.");
  }
};

/** Combines masks without mutating either input. */
export const combineSelectionMasks = (
  current: PixelSelectionMask | null,
  incoming: PixelSelectionMask,
  mode: PixelSelectionCombineMode,
): PixelSelectionMask => {
  if (current) assertSameDimensions(current, incoming);
  const dimensions = { width: incoming.width, height: incoming.height };
  const currentData = current?.data;
  const data = new Uint8Array(incoming.width * incoming.height);

  for (let index = 0; index < data.length; index += 1) {
    const left = currentData?.[index] ? 1 : 0;
    const right = incoming.data[index] ? 1 : 0;
    if (mode === "replace") data[index] = right;
    else if (mode === "add") data[index] = left || right ? 1 : 0;
    else if (mode === "subtract") data[index] = left && !right ? 1 : 0;
    else data[index] = left && right ? 1 : 0;
  }

  return maskFromData(dimensions, data);
};

export const isPixelSelected = (
  selection: PixelSelectionMask | null,
  point: PixelSelectionPoint,
): boolean => {
  if (!selection) return false;
  const normalized = normalizePoint(point);
  return (
    isInside(normalized, selection) &&
    selection.data[indexOf(normalized, selection.width)] === 1
  );
};

export const selectedPixelCount = (selection: PixelSelectionMask | null): number => {
  if (!selection) return 0;
  let count = 0;
  for (const value of selection.data) count += value === 0 ? 0 : 1;
  return count;
};
