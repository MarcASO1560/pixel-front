import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type TouchPoint = Readonly<{
  clientX: number;
  clientY: number;
  identifier: number;
  target: EventTarget;
}>;

type GestureFrame = Readonly<{
  active: boolean;
  last: boolean;
  origin: readonly [number, number];
  pan: readonly [number, number];
  rotationDegrees: number;
  scale: number;
  sessionActive: boolean;
}>;

type PinchGestureConstructor = typeof import("@use-gesture/vanilla")["PinchGesture"];

let PinchGesture: PinchGestureConstructor;

const touch = (
  target: EventTarget,
  identifier: number,
  clientX: number,
  clientY: number,
): TouchPoint => ({ clientX, clientY, identifier, target });

/**
 * Node exposes EventTarget but not TouchEvent. @use-gesture intentionally uses
 * structural touch-event checks, so complete touch lists exercise the same
 * TouchEvent path as a browser without adding a second DOM implementation.
 */
const dispatchTouch = ({
  changedTouches,
  target,
  touches,
  type,
}: Readonly<{
  changedTouches: readonly TouchPoint[];
  target: EventTarget;
  touches: readonly TouchPoint[];
  type: "touchend" | "touchmove" | "touchstart";
}>) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    changedTouches: { value: changedTouches },
    targetTouches: { value: touches },
    touches: { value: touches },
  });
  target.dispatchEvent(event);
  return event;
};

const pairAtAngle = (
  target: EventTarget,
  angleDegrees: number,
  center: readonly [number, number] = [150, 100],
  distance = 100,
) => {
  const radians = (angleDegrees * Math.PI) / 180;
  const radiusX = (Math.cos(radians) * distance) / 2;
  const radiusY = (Math.sin(radians) * distance) / 2;
  return [
    touch(target, 1, center[0] - radiusX, center[1] - radiusY),
    touch(target, 2, center[0] + radiusX, center[1] + radiusY),
  ] as const;
};

const createTouchPinchHarness = () => {
  const target = new EventTarget();
  const frames: GestureFrame[] = [];
  let initialOrigin: readonly [number, number] | null = null;

  const gesture = new PinchGesture(
    target,
    ({ active, event, last, offset, origin }) => {
      const nextOrigin = [origin[0], origin[1]] as const;
      const startsSession = event.type === "touchstart";
      const endsSession = event.type === "touchend" || event.type === "touchcancel";
      // With triggerAllEvents, use-gesture emits before either threshold is
      // intentional. `first` is therefore still false on the callback that
      // establishes the two-touch origin; the DOM session boundary is stable.
      if (startsSession || !initialOrigin) initialOrigin = nextOrigin;
      frames.push({
        active,
        last,
        origin: nextOrigin,
        pan: [nextOrigin[0] - initialOrigin[0], nextOrigin[1] - initialOrigin[1]],
        rotationDegrees: offset[1],
        scale: offset[0],
        sessionActive: !endsSession,
      });
      if (endsSession) initialOrigin = null;
    },
    {
      eventOptions: { passive: false },
      from: [1, 0],
      pinchOnWheel: false,
      pointer: { touch: true },
      preventDefault: true,
      rubberband: false,
      // `triggerAllEvents` keeps origin live for pan before pinch intent. Both
      // channels use threshold subtraction, so they begin at only the excess.
      threshold: [0.08, 12],
      triggerAllEvents: true,
    },
  );

  return {
    destroy: () => gesture.destroy(),
    frames,
    move: (touches: readonly TouchPoint[]) =>
      dispatchTouch({ changedTouches: touches, target, touches, type: "touchmove" }),
    start: (touches: readonly TouchPoint[]) =>
      dispatchTouch({ changedTouches: touches, target, touches, type: "touchstart" }),
    end: (remaining: readonly TouchPoint[], ended: readonly TouchPoint[]) =>
      dispatchTouch({ changedTouches: ended, target, touches: remaining, type: "touchend" }),
    target,
  };
};

beforeAll(async () => {
  const documentStub = {
    createElement: () => ({}),
    pointerLockElement: null,
  };
  vi.stubGlobal("document", documentStub);
  vi.stubGlobal("window", {
    document: documentStub,
    navigator: { maxTouchPoints: 2 },
    ontouchstart: null,
  });
  vi.resetModules();
  ({ PinchGesture } = await import("@use-gesture/vanilla"));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("@use-gesture/vanilla full TouchEvent pinch input", () => {
  it("reports parallel two-finger movement as origin pan without scale or rotation", () => {
    const harness = createTouchPinchHarness();
    const initial = pairAtAngle(harness.target, 0);
    const translated = pairAtAngle(harness.target, 0, [180, 118]);

    harness.start(initial);
    harness.move(translated);

    const frame = harness.frames.at(-1);
    expect(frame).toMatchObject({ active: false, pan: [30, 18], sessionActive: true });
    expect(frame?.scale).toBeCloseTo(1, 10);
    expect(frame?.rotationDegrees).toBeCloseTo(0, 10);
    harness.destroy();
  });

  it("suppresses rotation below 12 degrees", () => {
    const harness = createTouchPinchHarness();

    harness.start(pairAtAngle(harness.target, 0));
    harness.move(pairAtAngle(harness.target, 11));

    const frame = harness.frames.at(-1);
    expect(frame?.scale).toBeCloseTo(1, 10);
    expect(frame?.rotationDegrees).toBeCloseTo(0, 10);
    harness.destroy();
  });

  it("suppresses scale below 8 percent", () => {
    const harness = createTouchPinchHarness();

    harness.start(pairAtAngle(harness.target, 0));
    harness.move(pairAtAngle(harness.target, 0, [150, 100], 107));

    const frame = harness.frames.at(-1);
    expect(frame?.scale).toBeCloseTo(1, 10);
    expect(frame?.rotationDegrees).toBeCloseTo(0, 10);
    harness.destroy();
  });

  it("starts scale above 8 percent from only the threshold excess", () => {
    const harness = createTouchPinchHarness();

    harness.start(pairAtAngle(harness.target, 0));
    harness.move(pairAtAngle(harness.target, 0, [150, 100], 107));
    const beforeCrossing = harness.frames.at(-1);
    harness.move(pairAtAngle(harness.target, 0, [150, 100], 109));
    const afterCrossing = harness.frames.at(-1);
    harness.move(pairAtAngle(harness.target, 0, [150, 100], 112));
    const continued = harness.frames.at(-1);

    expect(beforeCrossing?.scale).toBeCloseTo(1, 10);
    expect(afterCrossing?.scale).toBeCloseTo(1.01, 10);
    expect(continued?.scale).toBeCloseTo(1.04, 10);
    harness.destroy();
  });

  it("starts rotation above 12 degrees from only the threshold excess", () => {
    const harness = createTouchPinchHarness();

    harness.start(pairAtAngle(harness.target, 0));
    harness.move(pairAtAngle(harness.target, 11));
    const beforeCrossing = harness.frames.at(-1);
    harness.move(pairAtAngle(harness.target, 13));
    const afterCrossing = harness.frames.at(-1);
    harness.move(pairAtAngle(harness.target, 16));
    const continued = harness.frames.at(-1);

    expect(beforeCrossing?.rotationDegrees).toBeCloseTo(0, 10);
    expect(afterCrossing?.rotationDegrees).toBeCloseTo(1, 10);
    expect(continued?.rotationDegrees).toBeCloseTo(4, 10);
    harness.destroy();
  });

  it("ends with the last emitted transform instead of adding a touchend jump", () => {
    const harness = createTouchPinchHarness();
    const initial = pairAtAngle(harness.target, 0);
    const transformed = pairAtAngle(harness.target, 16, [174, 91], 140);

    harness.start(initial);
    harness.move(transformed);
    const lastActive = harness.frames.at(-1);
    const endEvent = harness.end([transformed[0]], [transformed[1]]);
    const ended = harness.frames.at(-1);

    expect(endEvent.defaultPrevented).toBe(true);
    expect(lastActive).toBeDefined();
    expect(ended).toMatchObject({ active: false, last: true });
    expect(ended?.origin).toEqual(lastActive?.origin);
    expect(ended?.pan).toEqual(lastActive?.pan);
    expect(ended?.scale).toBeCloseTo(lastActive?.scale ?? 0, 10);
    expect(ended?.rotationDegrees).toBeCloseTo(lastActive?.rotationDegrees ?? 0, 10);
    harness.destroy();
  });
});
