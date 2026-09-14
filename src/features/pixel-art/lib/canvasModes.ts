import type { PixelBounds, Point } from "./drawing";

export type CanvasMirrorModes = Readonly<{
  horizontal: boolean;
  horizontalAxisY?: number;
  vertical: boolean;
  verticalAxisX?: number;
}>;

export type CanvasMirrorOptions = Readonly<{
  wrapAround?: boolean;
}>;

const normalizeDimension = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const normalizePoint = (point: Point): Point => ({
  x: Number.isFinite(point.x) ? Math.round(point.x) : 0,
  y: Number.isFinite(point.y) ? Math.round(point.y) : 0,
});

const pointKey = (point: Point) => `${point.x},${point.y}`;

/**
 * Mirror axes sit on pixel edges or pixel centers. Keeping them on half-pixel
 * increments guarantees that reflected pixel centers always land on the grid.
 */
export const clampCanvasMirrorAxis = (value: number, dimension: number) => {
  const normalizedDimension = normalizeDimension(dimension);
  if (normalizedDimension === 0) return 0;
  const normalizedValue = Number.isFinite(value) ? value : normalizedDimension / 2;

  return Math.min(normalizedDimension, Math.max(0, Math.round(normalizedValue * 2) / 2));
};

export const positiveModulo = (value: number, modulus: number) => {
  const normalizedModulus = normalizeDimension(modulus);
  if (normalizedModulus === 0) return 0;
  return ((Math.round(value) % normalizedModulus) + normalizedModulus) % normalizedModulus;
};

export const wrapCanvasPoint = (point: Point, bounds: PixelBounds): Point => ({
  x: positiveModulo(point.x, bounds.width),
  y: positiveModulo(point.y, bounds.height),
});

export const wrapCanvasPoints = (
  points: ReadonlyArray<Point>,
  bounds: PixelBounds,
): Point[] => {
  const width = normalizeDimension(bounds.width);
  const height = normalizeDimension(bounds.height);
  if (width === 0 || height === 0) return [];

  const seen = new Set<string>();
  const wrapped: Point[] = [];
  for (const rawPoint of points) {
    const point = wrapCanvasPoint(normalizePoint(rawPoint), { width, height });
    const key = pointKey(point);
    if (seen.has(key)) continue;
    seen.add(key);
    wrapped.push(point);
  }
  return wrapped;
};

/**
 * Mirrors paint results around configurable canvas axes. Axis coordinates use
 * pixel-edge space: 0 is the leading edge and `dimension` is the trailing edge.
 * A horizontal axis reflects Y, while a vertical axis reflects X.
 */
export const expandCanvasMirrorPoints = (
  points: ReadonlyArray<Point>,
  bounds: PixelBounds,
  modes: CanvasMirrorModes,
  options: CanvasMirrorOptions = {},
): Point[] => {
  const width = normalizeDimension(bounds.width);
  const height = normalizeDimension(bounds.height);
  if (width === 0 || height === 0) return [];
  const horizontalAxisY = clampCanvasMirrorAxis(
    modes.horizontalAxisY ?? height / 2,
    height,
  );
  const verticalAxisX = clampCanvasMirrorAxis(
    modes.verticalAxisX ?? width / 2,
    width,
  );

  const seen = new Set<string>();
  const mirrored: Point[] = [];
  const append = (rawPoint: Point) => {
    if (
      !options.wrapAround &&
      (rawPoint.x < 0 || rawPoint.x >= width || rawPoint.y < 0 || rawPoint.y >= height)
    ) {
      return;
    }
    const point = options.wrapAround
      ? wrapCanvasPoint(rawPoint, { width, height })
      : rawPoint;
    const key = pointKey(point);
    if (seen.has(key)) return;
    seen.add(key);
    mirrored.push(point);
  };

  for (const rawPoint of points) {
    const point = normalizePoint(rawPoint);
    const reflectedX = Math.round(verticalAxisX * 2 - point.x - 1);
    const reflectedY = Math.round(horizontalAxisY * 2 - point.y - 1);
    append(point);
    if (modes.horizontal) append({ x: point.x, y: reflectedY });
    if (modes.vertical) append({ x: reflectedX, y: point.y });
    if (modes.horizontal && modes.vertical) {
      append({ x: reflectedX, y: reflectedY });
    }
  }

  return mirrored;
};
