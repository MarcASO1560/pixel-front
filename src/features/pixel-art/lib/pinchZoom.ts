export type ImageClientPoint = Readonly<{
  x: number;
  y: number;
}>;

export type ImagePinchGeometry = Readonly<{
  distance: number;
  midpoint: ImageClientPoint;
}>;

export type ImageTwoFingerGestureIntent = "pan" | "zoom";

type ImageRect = Readonly<{
  height: number;
  left: number;
  top: number;
  width: number;
}>;

export const getImagePinchGeometry = (
  first: ImageClientPoint,
  second: ImageClientPoint,
): ImagePinchGeometry => ({
  distance: Math.hypot(second.x - first.x, second.y - first.y),
  midpoint: {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  },
});

/**
 * Distinguishes a two-finger drag from a pinch before either gesture mutates
 * the viewport. Parallel contact movement is a pan, while approximately
 * opposing movement is a zoom. Ambiguous movement stays pending until both
 * contacts make their shared intent clear.
 */
export const getImageTwoFingerGestureIntent = ({
  currentFirst,
  currentSecond,
  initialFirst,
  initialSecond,
  minimumMovement = 6,
}: Readonly<{
  currentFirst: ImageClientPoint;
  currentSecond: ImageClientPoint;
  initialFirst: ImageClientPoint;
  initialSecond: ImageClientPoint;
  minimumMovement?: number;
}>): ImageTwoFingerGestureIntent | null => {
  const firstMovement = {
    x: currentFirst.x - initialFirst.x,
    y: currentFirst.y - initialFirst.y,
  };
  const secondMovement = {
    x: currentSecond.x - initialSecond.x,
    y: currentSecond.y - initialSecond.y,
  };
  const firstMagnitude = Math.hypot(firstMovement.x, firstMovement.y);
  const secondMagnitude = Math.hypot(secondMovement.x, secondMovement.y);

  if (Math.max(firstMagnitude, secondMagnitude) < minimumMovement) {
    return null;
  }

  if (firstMagnitude >= minimumMovement && secondMagnitude >= minimumMovement) {
    const directionSimilarity =
      (firstMovement.x * secondMovement.x + firstMovement.y * secondMovement.y) /
      (firstMagnitude * secondMagnitude);

    if (directionSimilarity >= 0.25) return "pan";
    if (directionSimilarity <= -0.25) return "zoom";
  }

  const initialGeometry = getImagePinchGeometry(initialFirst, initialSecond);
  const currentGeometry = getImagePinchGeometry(currentFirst, currentSecond);
  const midpointMovement = Math.hypot(
    currentGeometry.midpoint.x - initialGeometry.midpoint.x,
    currentGeometry.midpoint.y - initialGeometry.midpoint.y,
  );
  const separationMovement = Math.abs(currentGeometry.distance - initialGeometry.distance) / 2;

  if (
    midpointMovement >= minimumMovement &&
    midpointMovement > separationMovement * 1.35
  ) {
    return "pan";
  }
  if (
    separationMovement >= minimumMovement &&
    separationMovement > midpointMovement * 1.35
  ) {
    return "zoom";
  }

  return null;
};

export const getImagePinchZoom = ({
  currentDistance,
  initialDistance,
  initialZoom,
  maximumZoom,
  minimumZoom,
}: Readonly<{
  currentDistance: number;
  initialDistance: number;
  initialZoom: number;
  maximumZoom: number;
  minimumZoom: number;
}>) => {
  const safeInitialDistance = Math.max(1, initialDistance);
  const requestedZoom = initialZoom * (Math.max(1, currentDistance) / safeInitialDistance);
  return Math.min(maximumZoom, Math.max(minimumZoom, requestedZoom));
};

export const getImagePinchStageCenterRatio = ({
  artboard,
  pan,
  stage,
}: Readonly<{
  artboard: ImageRect;
  pan: ImageClientPoint;
  stage: ImageRect;
}>): ImageClientPoint => ({
  x: (artboard.left + artboard.width / 2 - pan.x - stage.left) / stage.width,
  y: (artboard.top + artboard.height / 2 - pan.y - stage.top) / stage.height,
});

/**
 * Keeps the same logical point of the image beneath the live pinch midpoint.
 * The midpoint may move while the gesture scales, which makes two-finger pan
 * and zoom feel like one continuous manipulation.
 */
export const getAnchoredImagePinchPan = ({
  anchor,
  artboardSize,
  midpoint,
  stageCenter,
}: Readonly<{
  anchor: ImageClientPoint;
  artboardSize: Readonly<{ height: number; width: number }>;
  midpoint: ImageClientPoint;
  stageCenter: ImageClientPoint;
}>): ImageClientPoint => {
  const centeredLeft = stageCenter.x - artboardSize.width / 2;
  const centeredTop = stageCenter.y - artboardSize.height / 2;

  return {
    x: midpoint.x - centeredLeft - anchor.x * artboardSize.width,
    y: midpoint.y - centeredTop - anchor.y * artboardSize.height,
  };
};
