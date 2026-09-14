import {
  brushPoints,
  linePoints,
  type BrushShape,
  type PixelBounds,
  type Point,
} from "./drawing";

export type GraffitiPixel = Readonly<
  Point & {
    color: string;
  }
>;

export type GraffitiBrushOptions = Readonly<{
  /** Stamp size, following the same 1..8 rules as the pencil. */
  brushSize: number;
  brushShape?: BrushShape;
  primaryColor: string;
  secondaryColor: string;
  /** Swaps the two checkerboard phases, for example on right-click. */
  inverted?: boolean;
  bounds?: PixelBounds;
}>;

export type GraffitiGestureState = Readonly<{
  /** Last sampled canvas point, used to bridge separate pointer events. */
  lastPoint: Point | null;
}>;

export type GraffitiStrokeResult = Readonly<{
  pixels: ReadonlyArray<GraffitiPixel>;
  state: GraffitiGestureState;
}>;

const integer = (value: number) => (Number.isFinite(value) ? Math.round(value) : 0);

const normalizePoint = (point: Point): Point => ({
  x: integer(point.x),
  y: integer(point.y),
});

const pointKey = (point: Point) => `${point.x},${point.y}`;

export const graffitiCheckerColorAt = (point: Point, options: GraffitiBrushOptions) => {
  const phase = options.inverted ? 1 : 0;
  return (point.x + point.y + phase) % 2 === 0
    ? options.primaryColor
    : options.secondaryColor;
};

/** Creates immutable state for a new continuous graffiti gesture. */
export const createGraffitiGestureState = (): GraffitiGestureState => ({
  lastPoint: null,
});

/**
 * Creates one shaped stamp filled with a canvas-anchored 1x1 checkerboard.
 * Its phase depends only on absolute pixel coordinates, so overlapping stamps
 * cannot make already-painted pixels change color.
 */
export const graffitiBrushStamp = (
  center: Point,
  options: GraffitiBrushOptions,
): GraffitiPixel[] =>
  brushPoints(center, options.brushSize, options.brushShape, options.bounds).map((point) => ({
    ...point,
    color: graffitiCheckerColorAt(point, options),
  }));

const strokeCenters = (
  path: ReadonlyArray<Point>,
  previousPoint: Point | null,
): Point[] => {
  const centers: Point[] = [];
  let cursor = previousPoint ? normalizePoint(previousPoint) : null;

  for (const rawTarget of path) {
    const target = normalizePoint(rawTarget);
    if (!cursor) {
      centers.push(target);
    } else {
      // The cursor itself was stamped by the preceding sample or event.
      centers.push(...linePoints(cursor, target).slice(1));
    }
    cursor = target;
  }

  return centers;
};

/**
 * Generates a continuous checker-texture stroke and state for the next pointer
 * event. Bresenham interpolation prevents gaps when pointer events are sparse.
 */
export const graffitiBrushStroke = (
  path: ReadonlyArray<Point>,
  options: GraffitiBrushOptions,
  state: GraffitiGestureState,
): GraffitiStrokeResult => {
  if (path.length === 0) return { pixels: [], state };

  const pixelsByPoint = new Map<string, GraffitiPixel>();
  for (const center of strokeCenters(path, state.lastPoint)) {
    for (const pixel of graffitiBrushStamp(center, options)) {
      pixelsByPoint.set(pointKey(pixel), pixel);
    }
  }

  return {
    pixels: [...pixelsByPoint.values()],
    state: { lastPoint: normalizePoint(path[path.length - 1]) },
  };
};
