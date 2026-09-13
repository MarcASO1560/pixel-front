export type ImageClientPoint = Readonly<{
  x: number;
  y: number;
}>;

export type ImageTwoFingerTransformDelta = Readonly<{
  currentCentroid: ImageClientPoint;
  previousCentroid: ImageClientPoint;
  rotationRadians: number;
  zoomFactor: number;
}>;

export type ImageViewportTransform = Readonly<{
  panX: number;
  panY: number;
  rotationRadians: number;
  zoom: number;
}>;

const isFinitePoint = (point: ImageClientPoint) =>
  Number.isFinite(point.x) && Number.isFinite(point.y);

export const normalizeImageRotationRadians = (rotationRadians: number) =>
  Math.atan2(Math.sin(rotationRadians), Math.cos(rotationRadians));

export const rotateImageClientPoint = ({
  center,
  point,
  rotationRadians,
}: Readonly<{
  center: ImageClientPoint;
  point: ImageClientPoint;
  rotationRadians: number;
}>): ImageClientPoint => {
  const cosine = Math.cos(rotationRadians);
  const sine = Math.sin(rotationRadians);
  const deltaX = point.x - center.x;
  const deltaY = point.y - center.y;

  return {
    x: center.x + deltaX * cosine - deltaY * sine,
    y: center.y + deltaX * sine + deltaY * cosine,
  };
};

/**
 * Applies one similarity-transform delta around the live gesture centroid.
 * The effective (clamped) scale is used when calculating the new center, so
 * reaching a zoom limit cannot make the artboard jump beneath the contacts.
 */
export const applyImageTwoFingerTransformDelta = ({
  currentStageCenter,
  delta,
  maximumZoom,
  minimumZoom,
  previousStageCenter,
  view,
}: Readonly<{
  currentStageCenter: ImageClientPoint;
  delta: ImageTwoFingerTransformDelta;
  maximumZoom: number;
  minimumZoom: number;
  previousStageCenter: ImageClientPoint;
  view: ImageViewportTransform;
}>): ImageViewportTransform => {
  if (
    !isFinitePoint(currentStageCenter) ||
    !isFinitePoint(previousStageCenter) ||
    !isFinitePoint(delta.currentCentroid) ||
    !isFinitePoint(delta.previousCentroid) ||
    !Number.isFinite(view.panX) ||
    !Number.isFinite(view.panY) ||
    !Number.isFinite(view.rotationRadians) ||
    !Number.isFinite(view.zoom) ||
    view.zoom <= 0
  ) {
    return view;
  }

  const safeZoomFactor =
    Number.isFinite(delta.zoomFactor) && delta.zoomFactor > 0 ? delta.zoomFactor : 1;
  const requestedZoom = view.zoom * safeZoomFactor;
  const nextZoom = Math.min(maximumZoom, Math.max(minimumZoom, requestedZoom));
  const effectiveScale = nextZoom / view.zoom;
  const rotationDelta = Number.isFinite(delta.rotationRadians) ? delta.rotationRadians : 0;
  const previousArtboardCenter = {
    x: previousStageCenter.x + view.panX,
    y: previousStageCenter.y + view.panY,
  };
  const rotatedAnchor = rotateImageClientPoint({
    center: previousArtboardCenter,
    point: delta.previousCentroid,
    rotationRadians: rotationDelta,
  });
  const transformedAnchorOffset = {
    x: (rotatedAnchor.x - previousArtboardCenter.x) * effectiveScale,
    y: (rotatedAnchor.y - previousArtboardCenter.y) * effectiveScale,
  };
  const nextArtboardCenter = {
    x: delta.currentCentroid.x - transformedAnchorOffset.x,
    y: delta.currentCentroid.y - transformedAnchorOffset.y,
  };

  return {
    panX: nextArtboardCenter.x - currentStageCenter.x,
    panY: nextArtboardCenter.y - currentStageCenter.y,
    rotationRadians: view.rotationRadians + rotationDelta,
    zoom: nextZoom,
  };
};
