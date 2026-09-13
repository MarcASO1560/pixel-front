import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type {
  TouchViewportGesture,
  TouchViewportGestureFrame,
  TouchViewportGestureOptions,
} from "./touchViewportGesture";

type TouchPoint = Readonly<{
  clientX: number;
  clientY: number;
  identifier: number;
  target: EventTarget;
}>;

type TouchViewportGestureModule = typeof import("./touchViewportGesture");

let gestureModule: TouchViewportGestureModule;

const touch = (
  target: EventTarget,
  identifier: number,
  clientX: number,
  clientY: number,
): TouchPoint => ({ clientX, clientY, identifier, target });

const pair = (
  target: EventTarget,
  center: readonly [number, number],
  distance: number,
  angleDegrees = 0,
) => {
  const angleRadians = (angleDegrees * Math.PI) / 180;
  const radiusX = (Math.cos(angleRadians) * distance) / 2;
  const radiusY = (Math.sin(angleRadians) * distance) / 2;

  return [
    touch(target, 1, center[0] - radiusX, center[1] - radiusY),
    touch(target, 2, center[0] + radiusX, center[1] + radiusY),
  ] as const;
};

const dispatchTouch = (
  target: EventTarget,
  type: "touchend" | "touchmove" | "touchstart",
  touches: readonly TouchPoint[],
  changedTouches: readonly TouchPoint[] = touches,
) => {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    changedTouches: { value: changedTouches },
    targetTouches: { value: touches },
    touches: { value: touches },
  });
  target.dispatchEvent(event);
  return event;
};

const createHarness = (options: TouchViewportGestureOptions = {}) => {
  const target = new EventTarget();
  const starts: TouchViewportGestureFrame[] = [];
  const changes: TouchViewportGestureFrame[] = [];
  const ends: TouchViewportGestureFrame[] = [];
  const gesture: TouchViewportGesture = gestureModule.createTouchViewportGesture(
    target,
    {
      onChange: (frame) => changes.push(frame),
      onEnd: (frame) => ends.push(frame),
      onStart: (frame) => starts.push(frame),
    },
    options,
  );

  return { changes, ends, gesture, starts, target };
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
  gestureModule = await import("./touchViewportGesture");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("touch viewport gesture adapter", () => {
  it("leaves a single touch to the drawing interaction", () => {
    const harness = createHarness();
    const first = touch(harness.target, 1, 50, 70);

    dispatchTouch(harness.target, "touchstart", [first]);
    dispatchTouch(harness.target, "touchmove", [touch(harness.target, 1, 55, 74)]);

    expect(harness.starts).toHaveLength(0);
    expect(harness.changes).toHaveLength(0);
    harness.gesture.destroy();
  });

  it("pans from the full two-touch centroid on every synchronous move", () => {
    const harness = createHarness();
    const initial = pair(harness.target, [100, 120], 100);
    const translated = pair(harness.target, [137, 141], 100);

    dispatchTouch(harness.target, "touchstart", initial);
    dispatchTouch(harness.target, "touchmove", translated);

    expect(harness.starts).toHaveLength(1);
    expect(harness.changes).toHaveLength(1);
    expect(harness.changes[0]).toMatchObject({
      centroid: { x: 137, y: 141 },
      initialCentroid: { x: 100, y: 120 },
      rotationRadians: 0,
      scale: 1,
    });
    harness.gesture.destroy();
  });

  it("keeps zoom at one below 8% and starts from only the excess after crossing", () => {
    const harness = createHarness();

    dispatchTouch(harness.target, "touchstart", pair(harness.target, [100, 100], 100));
    dispatchTouch(harness.target, "touchmove", pair(harness.target, [100, 100], 107));
    expect(harness.changes.at(-1)?.scale).toBeCloseTo(1, 10);

    dispatchTouch(harness.target, "touchmove", pair(harness.target, [100, 100], 109));
    expect(harness.changes.at(-1)?.scale).toBeCloseTo(1.01, 10);
    harness.gesture.destroy();
  });

  it("keeps rotation at zero below 12 degrees and avoids a threshold jump", () => {
    const harness = createHarness();

    dispatchTouch(harness.target, "touchstart", pair(harness.target, [100, 100], 100));
    dispatchTouch(harness.target, "touchmove", pair(harness.target, [100, 100], 100, 11));
    expect(harness.changes.at(-1)?.rotationRadians).toBeCloseTo(0, 10);

    dispatchTouch(harness.target, "touchmove", pair(harness.target, [100, 100], 100, 13));
    expect(harness.changes.at(-1)?.rotationRadians).toBeCloseTo(Math.PI / 180, 10);
    harness.gesture.destroy();
  });

  it("keeps contact identity stable when TouchList order changes", () => {
    const harness = createHarness();
    const initial = pair(harness.target, [100, 100], 100);

    dispatchTouch(harness.target, "touchstart", initial);
    dispatchTouch(harness.target, "touchmove", [initial[1], initial[0]]);

    expect(harness.changes.at(-1)).toMatchObject({
      centroid: { x: 100, y: 100 },
      rotationRadians: 0,
      scale: 1,
    });
    harness.gesture.destroy();
  });

  it("ends on the last rendered frame without applying touchend coordinates", () => {
    const harness = createHarness();
    const initial = pair(harness.target, [100, 100], 100);
    const transformed = pair(harness.target, [130, 82], 150, 20);

    dispatchTouch(harness.target, "touchstart", initial);
    dispatchTouch(harness.target, "touchmove", transformed);
    const lastChange = harness.changes.at(-1);
    dispatchTouch(harness.target, "touchend", [transformed[0]], [transformed[1]]);

    expect(harness.ends).toHaveLength(1);
    expect(harness.ends[0]).toMatchObject({
      centroid: lastChange?.centroid,
      initialCentroid: lastChange?.initialCentroid,
      rotationRadians: lastChange?.rotationRadians,
      scale: lastChange?.scale,
      touchCount: 1,
    });
    harness.gesture.destroy();
  });

  it("supports stricter independent thresholds without changing pan", () => {
    const harness = createHarness({
      rotationThresholdDegrees: 20,
      zoomThreshold: 0.1,
    });

    dispatchTouch(harness.target, "touchstart", pair(harness.target, [50, 50], 100));
    dispatchTouch(harness.target, "touchmove", pair(harness.target, [75, 80], 108, 15));

    expect(harness.changes.at(-1)).toMatchObject({
      centroid: { x: 75, y: 80 },
      rotationRadians: 0,
      scale: 1,
    });
    harness.gesture.destroy();
  });
});
