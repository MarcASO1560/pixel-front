export type ImagePixelHitTest = Readonly<{
  borderLeft: number;
  borderTop: number;
  cellSize: number;
  clientHeight: number;
  clientWidth: number;
  clientX: number;
  clientY: number;
  gridHeight: number;
  gridWidth: number;
  rectLeft: number;
  rectTop: number;
}>;

export type ClientPoint = Readonly<{
  x: number;
  y: number;
}>;

export type ClientRectBounds = Readonly<{
  bottom: number;
  left: number;
  right: number;
  top: number;
}>;

export type ClientSegmentClip = Readonly<{
  end: ClientPoint;
  start: ClientPoint;
}>;

export type ImagePixelSegment = Readonly<{
  endIndex: number;
  startIndex: number;
}>;

export const getImagePixelIndexFromClientPoint = ({
  borderLeft,
  borderTop,
  cellSize,
  clientHeight,
  clientWidth,
  clientX,
  clientY,
  gridHeight,
  gridWidth,
  rectLeft,
  rectTop,
}: ImagePixelHitTest): number | null => {
  const x = clientX - rectLeft - borderLeft;
  const y = clientY - rectTop - borderTop;
  const contentWidth = Math.max(1, clientWidth);
  const contentHeight = Math.max(1, clientHeight);

  if (x < 0 || y < 0 || x > contentWidth || y > contentHeight) {
    return null;
  }

  const column = Math.min(gridWidth - 1, Math.floor(x / cellSize));
  const row = Math.min(gridHeight - 1, Math.floor(y / cellSize));
  return row * gridWidth + column;
};

/**
 * Clips a directed client-coordinate segment to an inclusive rectangle.
 *
 * Liang–Barsky clipping retains the segment's original direction, so `start`
 * is always the first intersection reached while travelling from `from` to
 * `to`. A one-point result represents a tangent or zero-length intersection.
 */
export const clipClientSegmentToRect = ({
  bounds,
  from,
  to,
}: Readonly<{
  bounds: ClientRectBounds;
  from: ClientPoint;
  to: ClientPoint;
}>): ClientSegmentClip | null => {
  const values = [
    bounds.left,
    bounds.top,
    bounds.right,
    bounds.bottom,
    from.x,
    from.y,
    to.x,
    to.y,
  ];
  if (
    values.some((value) => !Number.isFinite(value)) ||
    bounds.left > bounds.right ||
    bounds.top > bounds.bottom
  ) {
    return null;
  }

  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  let startRatio = 0;
  let endRatio = 1;
  const boundaries = [
    [-deltaX, from.x - bounds.left],
    [deltaX, bounds.right - from.x],
    [-deltaY, from.y - bounds.top],
    [deltaY, bounds.bottom - from.y],
  ] as const;

  for (const [direction, distance] of boundaries) {
    if (direction === 0) {
      if (distance < 0) {
        return null;
      }
      continue;
    }

    const ratio = distance / direction;
    if (direction < 0) {
      startRatio = Math.max(startRatio, ratio);
    } else {
      endRatio = Math.min(endRatio, ratio);
    }

    if (startRatio > endRatio) {
      return null;
    }
  }

  const clampX = (value: number) => Math.min(bounds.right, Math.max(bounds.left, value));
  const clampY = (value: number) => Math.min(bounds.bottom, Math.max(bounds.top, value));

  return {
    start: {
      x: clampX(from.x + startRatio * deltaX),
      y: clampY(from.y + startRatio * deltaY),
    },
    end: {
      x: clampX(from.x + endRatio * deltaX),
      y: clampY(from.y + endRatio * deltaY),
    },
  };
};

/** Maps the visible portion of a client-coordinate segment to its first and last grid cells. */
export const getImagePixelSegmentFromClientSegment = ({
  bounds,
  from,
  to,
  ...hitTest
}: Omit<ImagePixelHitTest, "clientX" | "clientY"> &
  Readonly<{
    bounds: ClientRectBounds;
    from: ClientPoint;
    to: ClientPoint;
  }>): ImagePixelSegment | null => {
  const clippedSegment = clipClientSegmentToRect({ bounds, from, to });
  if (!clippedSegment) {
    return null;
  }

  const startIndex = getImagePixelIndexFromClientPoint({
    ...hitTest,
    clientX: clippedSegment.start.x,
    clientY: clippedSegment.start.y,
  });
  const endIndex = getImagePixelIndexFromClientPoint({
    ...hitTest,
    clientX: clippedSegment.end.x,
    clientY: clippedSegment.end.y,
  });
  return startIndex === null || endIndex === null ? null : { endIndex, startIndex };
};
