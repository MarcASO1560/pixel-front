export type ImageClientPoint = Readonly<{
  x: number;
  y: number;
}>;

export type ImagePinchGeometry = Readonly<{
  distance: number;
  midpoint: ImageClientPoint;
}>;

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
