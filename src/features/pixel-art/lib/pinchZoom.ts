export type ImageClientPoint = Readonly<{
  x: number;
  y: number;
}>;

export type ImageTwoFingerGeometry = Readonly<{
  angleRadians: number;
  centroid: ImageClientPoint;
  distance: number;
}>;

export type ImageTwoFingerTransformDelta = Readonly<{
  currentCentroid: ImageClientPoint;
  pan: ImageClientPoint;
  previousCentroid: ImageClientPoint;
  rotationRadians: number;
  zoomFactor: number;
}>;

export type ImageTwoFingerIntentMotion = Readonly<{
  /** Signed radial travel of either fingertip, expressed in CSS pixels. */
  zoomPixels: number;
  /** Signed tangential travel of either fingertip, expressed in CSS pixels. */
  rotationPixels: number;
}>;

export type ImageTransformIntentDirection = -1 | 0 | 1;

export type ImageTransformChannelIntent = Readonly<{
  active: boolean;
  direction: ImageTransformIntentDirection;
  samples: number;
}>;

export type ImageGestureZoomStep = Readonly<{
  /** Unclamped zoom used to preserve the gesture path while at a limit. */
  rawZoom: number;
  /** Effective factor that can be applied to the currently rendered view. */
  zoomFactor: number;
}>;

export type ImageTwoFingerFrameCoordination = Readonly<{
  deferredPointerId: number | null;
  soloPointerId: number | null;
}>;

export type ImageTwoFingerFramePlan = Readonly<{
  action: "apply" | "defer" | "drop";
  coordination: ImageTwoFingerFrameCoordination;
}>;

export type ImageViewportTransform = Readonly<{
  panX: number;
  panY: number;
  rotationRadians: number;
  zoom: number;
}>;

// Below roughly one fingertip of separation, scale and angle are dominated by
// touch-sensor noise. Translation remains valid, so only those two channels
// are suspended until the pair has a stable span again.
const MINIMUM_TWO_FINGER_DISTANCE = 12;

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

export const getImageTwoFingerGeometry = (
  first: ImageClientPoint,
  second: ImageClientPoint,
): ImageTwoFingerGeometry => {
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;

  return {
    angleRadians: Math.atan2(deltaY, deltaX),
    centroid: {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    },
    distance: Math.hypot(deltaX, deltaY),
  };
};

/**
 * Mirrors the transform deltas exposed by native multitouch detectors: pan,
 * zoom and rotation are measured together between the previous and current
 * contact pair. No component is classified or locked out.
 */
export const getImageTwoFingerTransformDelta = ({
  currentFirst,
  currentSecond,
  previousFirst,
  previousSecond,
}: Readonly<{
  currentFirst: ImageClientPoint;
  currentSecond: ImageClientPoint;
  previousFirst: ImageClientPoint;
  previousSecond: ImageClientPoint;
}>): ImageTwoFingerTransformDelta => {
  const previous = getImageTwoFingerGeometry(previousFirst, previousSecond);
  const current = getImageTwoFingerGeometry(currentFirst, currentSecond);
  const hasStableDistance =
    previous.distance >= MINIMUM_TWO_FINGER_DISTANCE &&
    current.distance >= MINIMUM_TWO_FINGER_DISTANCE;

  return {
    currentCentroid: current.centroid,
    pan: {
      x: current.centroid.x - previous.centroid.x,
      y: current.centroid.y - previous.centroid.y,
    },
    previousCentroid: previous.centroid,
    rotationRadians: hasStableDistance
      ? normalizeImageRotationRadians(current.angleRadians - previous.angleRadians)
      : 0,
    zoomFactor: hasStableDistance ? current.distance / previous.distance : 1,
  };
};

/**
 * Expresses scale and rotation intent in the same unit as pointer movement.
 * Using per-finger CSS pixels makes one touch slop work consistently for
 * closely and widely spaced contacts. Translation is deliberately excluded:
 * two-finger pan should remain immediate and track the centroid 1:1.
 */
export const getImageTwoFingerIntentMotion = ({
  currentFirst,
  currentSecond,
  initialFirst,
  initialSecond,
}: Readonly<{
  currentFirst: ImageClientPoint;
  currentSecond: ImageClientPoint;
  initialFirst: ImageClientPoint;
  initialSecond: ImageClientPoint;
}>): ImageTwoFingerIntentMotion => {
  const initial = getImageTwoFingerGeometry(initialFirst, initialSecond);
  const current = getImageTwoFingerGeometry(currentFirst, currentSecond);
  const hasStableDistance =
    initial.distance >= MINIMUM_TWO_FINGER_DISTANCE &&
    current.distance >= MINIMUM_TWO_FINGER_DISTANCE;

  if (!hasStableDistance) {
    return { rotationPixels: 0, zoomPixels: 0 };
  }

  const rotationRadians = normalizeImageRotationRadians(
    current.angleRadians - initial.angleRadians,
  );

  return {
    rotationPixels: rotationRadians * (initial.distance / 2),
    zoomPixels: (current.distance - initial.distance) / 2,
  };
};

/**
 * Arms one transform channel only after sustained movement outside its slop.
 * The caller rebases the channel on the activation sample, preventing the
 * threshold itself from appearing as a sudden scale or rotation jump.
 */
export const advanceImageTransformChannelIntent = ({
  activationDistance,
  motion,
  requiredSamples,
  state,
}: Readonly<{
  activationDistance: number;
  motion: number;
  requiredSamples: number;
  state: ImageTransformChannelIntent;
}>): ImageTransformChannelIntent => {
  if (state.active) return state;

  if (!Number.isFinite(motion) || Math.abs(motion) < Math.max(0, activationDistance)) {
    return { active: false, direction: 0, samples: 0 };
  }

  const direction: ImageTransformIntentDirection = motion < 0 ? -1 : 1;
  const samples = state.direction === direction ? state.samples + 1 : 1;

  return {
    active: samples >= Math.max(1, Math.trunc(requiredSamples)),
    direction,
    samples,
  };
};

/**
 * Advances the unclamped zoom separately from the rendered zoom. Keeping the
 * overflow means a tiny reversal after overshooting a limit cannot make the
 * artboard jump away from the fingers before the gesture re-enters the range.
 */
export const advanceImageGestureZoom = ({
  currentZoom,
  maximumZoom,
  minimumZoom,
  rawZoom,
  zoomFactor,
}: Readonly<{
  currentZoom: number;
  maximumZoom: number;
  minimumZoom: number;
  rawZoom: number;
  zoomFactor: number;
}>): ImageGestureZoomStep => {
  const safeRawZoom = Number.isFinite(rawZoom) && rawZoom > 0 ? rawZoom : currentZoom;
  const safeZoomFactor =
    Number.isFinite(zoomFactor) && zoomFactor > 0 ? zoomFactor : 1;
  const nextRawZoom = safeRawZoom * safeZoomFactor;
  const nextZoom = Math.min(maximumZoom, Math.max(minimumZoom, nextRawZoom));

  return {
    rawZoom: nextRawZoom,
    zoomFactor:
      Number.isFinite(currentZoom) && currentZoom > 0 ? nextZoom / currentZoom : 1,
  };
};

/**
 * Coalesces independently delivered Pointer Events. A newly moving contact
 * gets one animation frame for its partner to arrive. If the partner really
 * is stationary, that contact is then recognized as the solo mover and later
 * frames apply immediately. A normal pointerup can request `drop` instead of
 * committing half of a contact pair.
 */
export const getImageTwoFingerFramePlan = ({
  allowUnpairedFrame,
  coordination,
  firstMoved,
  firstPointerId,
  secondMoved,
  secondPointerId,
}: Readonly<{
  allowUnpairedFrame: boolean;
  coordination: ImageTwoFingerFrameCoordination;
  firstMoved: boolean;
  firstPointerId: number;
  secondMoved: boolean;
  secondPointerId: number;
}>): ImageTwoFingerFramePlan => {
  if (firstMoved === secondMoved) {
    return {
      action: "apply",
      coordination: {
        deferredPointerId: null,
        soloPointerId: firstMoved ? null : coordination.soloPointerId,
      },
    };
  }

  const movedPointerId = firstMoved ? firstPointerId : secondPointerId;
  if (coordination.soloPointerId === movedPointerId) {
    return {
      action: "apply",
      coordination: { deferredPointerId: null, soloPointerId: movedPointerId },
    };
  }

  if (!allowUnpairedFrame) {
    return { action: "drop", coordination };
  }

  if (coordination.deferredPointerId !== movedPointerId) {
    return {
      action: "defer",
      coordination: {
        deferredPointerId: movedPointerId,
        soloPointerId: coordination.soloPointerId,
      },
    };
  }

  return {
    action: "apply",
    coordination: { deferredPointerId: null, soloPointerId: movedPointerId },
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
