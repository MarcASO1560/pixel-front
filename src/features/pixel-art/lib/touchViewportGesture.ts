import { PinchGesture, type Handler } from "@use-gesture/vanilla";

export const TOUCH_VIEWPORT_ZOOM_THRESHOLD = 0.08;
export const TOUCH_VIEWPORT_ROTATION_THRESHOLD_DEGREES = 12;

export type TouchViewportClientPoint = Readonly<{
  x: number;
  y: number;
}>;

export type TouchViewportGestureFrame = Readonly<{
  /** Current midpoint of the two contacts in client coordinates. */
  centroid: TouchViewportClientPoint;
  /** Midpoint captured when the second contact started the gesture. */
  initialCentroid: TouchViewportClientPoint;
  /** Native touch or pointer event that produced this synchronous frame. */
  event: Event;
  /** Threshold-corrected rotation measured from the gesture start. */
  rotationRadians: number;
  /** Threshold-corrected scale measured from the gesture start. */
  scale: number;
  touchCount: number;
}>;

export type TouchViewportGestureCallbacks = Readonly<{
  onChange: (frame: TouchViewportGestureFrame) => void;
  onEnd?: (frame: TouchViewportGestureFrame) => void;
  onStart?: (frame: TouchViewportGestureFrame) => void;
}>;

export type TouchViewportGestureOptions = Readonly<{
  rotationThresholdDegrees?: number;
  zoomThreshold?: number;
}>;

export type TouchViewportGesture = Readonly<{
  destroy: () => void;
}>;

type GestureSession = Readonly<{
  initialCentroid: TouchViewportClientPoint;
  lastFrame: TouchViewportGestureFrame;
}>;

const isFinitePoint = (point: readonly [number, number]) =>
  Number.isFinite(point[0]) && Number.isFinite(point[1]);

const sanitizeThreshold = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? Math.max(0, value ?? fallback) : fallback;

/**
 * Binds the maintained @use-gesture recognizer to one viewport.
 *
 * The recognizer is deliberately forced onto Touch Events whenever the browser
 * exposes them. A TouchEvent contains a coherent snapshot of both contacts,
 * whereas Pointer Events arrive one contact at a time and can turn a rigid
 * two-finger pan into transient scale/rotation noise. @use-gesture remains the
 * fallback owner on PointerEvent-only touchscreens, where the adapter keeps
 * coherent midpoint pan but suppresses unreliable scale and rotation.
 *
 * Pan is represented by the unfiltered centroid on every native touchmove.
 * Scale and rotation come from @use-gesture's independently thresholded
 * offsets. Those offsets have the signed threshold removed, so crossing either
 * threshold starts at zero instead of producing an activation jump.
 */
export const createTouchViewportGesture = (
  target: EventTarget,
  callbacks: TouchViewportGestureCallbacks,
  options: TouchViewportGestureOptions = {},
): TouchViewportGesture => {
  let session: GestureSession | null = null;

  const handler: Handler<"pinch"> = ({ event, last, offset, origin, touches }) => {
    const hasCoherentTouchSnapshot = "touches" in event;
    const nativeTouchCount = hasCoherentTouchSnapshot
      ? (event as TouchEvent).touches.length
      : touches;
    const touchCount = Number.isFinite(nativeTouchCount) ? nativeTouchCount : 0;
    const isEnding =
      last ||
      event.type === "touchend" ||
      event.type === "touchcancel" ||
      event.type === "pointerup" ||
      event.type === "pointercancel" ||
      event.type === "lostpointercapture";

    if (isEnding) {
      if (session) {
        const finalFrame = {
          ...session.lastFrame,
          event,
          touchCount,
        };
        callbacks.onEnd?.(finalFrame);
        session = null;
      }
      return;
    }

    if (touchCount < 2 || !isFinitePoint(origin)) return;

    const centroid = { x: origin[0], y: origin[1] };
    const initialCentroid = session?.initialCentroid ?? centroid;
    const previousFrame = session?.lastFrame;
    const scale = hasCoherentTouchSnapshot && Number.isFinite(offset[0]) && offset[0] > 0
      ? offset[0]
      : previousFrame?.scale ?? 1;
    const rotationDegrees = hasCoherentTouchSnapshot && Number.isFinite(offset[1])
      ? offset[1]
      : ((previousFrame?.rotationRadians ?? 0) * 180) / Math.PI;
    const frame: TouchViewportGestureFrame = {
      centroid,
      initialCentroid,
      event,
      rotationRadians: (rotationDegrees * Math.PI) / 180,
      scale,
      touchCount,
    };

    if (!session) {
      session = { initialCentroid, lastFrame: frame };
      callbacks.onStart?.(frame);
      return;
    }

    session = { ...session, lastFrame: frame };
    callbacks.onChange(frame);
  };

  const recognizer = new PinchGesture<TouchEvent>(target, handler, {
    eventOptions: { passive: false },
    from: [1, 0],
    pinchOnWheel: false,
    pointer: { touch: true },
    preventDefault: true,
    rubberband: false,
    threshold: [
      sanitizeThreshold(options.zoomThreshold, TOUCH_VIEWPORT_ZOOM_THRESHOLD),
      sanitizeThreshold(
        options.rotationThresholdDegrees,
        TOUCH_VIEWPORT_ROTATION_THRESHOLD_DEGREES,
      ),
    ],
    // The callback must also receive sub-threshold moves so the midpoint can
    // pan immediately while scale and rotation remain locked at 1 / 0.
    triggerAllEvents: true,
  });

  return {
    destroy: () => {
      recognizer.destroy();
      session = null;
    },
  };
};
