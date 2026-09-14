export type ImageSelectionGesturePoint = Readonly<{
  x: number;
  y: number;
}>;

/** A selection gesture that never leaves its starting pixel is a click/tap. */
export const isSinglePixelSelectionGesture = (
  start: ImageSelectionGesturePoint | null,
  end: ImageSelectionGesturePoint | null,
): boolean => Boolean(start && end && start.x === end.x && start.y === end.y);
