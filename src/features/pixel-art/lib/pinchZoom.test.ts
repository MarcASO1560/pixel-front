import { describe, expect, it } from "vitest";

import {
  advanceImageGestureZoom,
  advanceImageTransformChannelIntent,
  applyImageTwoFingerTransformDelta,
  getImageTwoFingerFramePlan,
  getImageTwoFingerGeometry,
  getImageTwoFingerIntentMotion,
  getImageTwoFingerTransformDelta,
  normalizeImageRotationRadians,
  rotateImageClientPoint,
  type ImageTransformChannelIntent,
  type ImageTwoFingerTransformDelta,
  type ImageViewportTransform,
} from "./pinchZoom";

const stationaryStageCenter = { x: 100, y: 100 };

const view = (
  overrides: Partial<ImageViewportTransform> = {},
): ImageViewportTransform => ({
  panX: 0,
  panY: 0,
  rotationRadians: 0,
  zoom: 2,
  ...overrides,
});

const apply = (
  currentView: ImageViewportTransform,
  delta: ImageTwoFingerTransformDelta,
  overrides: Partial<Parameters<typeof applyImageTwoFingerTransformDelta>[0]> = {},
) =>
  applyImageTwoFingerTransformDelta({
    currentStageCenter: stationaryStageCenter,
    delta,
    maximumZoom: 64,
    minimumZoom: 0.25,
    previousStageCenter: stationaryStageCenter,
    view: currentView,
    ...overrides,
  });

describe("continuous image multitouch transforms", () => {
  it("derives centroid, distance and angle from the same contact pair", () => {
    const geometry = getImageTwoFingerGeometry({ x: 20, y: 40 }, { x: 80, y: 120 });

    expect(geometry.centroid).toEqual({ x: 50, y: 80 });
    expect(geometry.distance).toBe(100);
    expect(geometry.angleRadians).toBeCloseTo(Math.atan2(80, 60));
  });

  it("reports pan, zoom and rotation simultaneously between frames", () => {
    const delta = getImageTwoFingerTransformDelta({
      previousFirst: { x: 0, y: 0 },
      previousSecond: { x: 20, y: 0 },
      currentFirst: { x: 5, y: 5 },
      currentSecond: { x: 5, y: 45 },
    });

    expect(delta.pan).toEqual({ x: -5, y: 25 });
    expect(delta.zoomFactor).toBe(2);
    expect(delta.rotationRadians).toBeCloseTo(Math.PI / 2);
  });

  it("uses the shortest rotation delta across the ±π boundary", () => {
    const degrees = (value: number) => (value * Math.PI) / 180;
    const previousAngle = degrees(179);
    const currentAngle = degrees(-179);
    const radius = 50;
    const delta = getImageTwoFingerTransformDelta({
      previousFirst: { x: 0, y: 0 },
      previousSecond: {
        x: Math.cos(previousAngle) * radius,
        y: Math.sin(previousAngle) * radius,
      },
      currentFirst: { x: 0, y: 0 },
      currentSecond: {
        x: Math.cos(currentAngle) * radius,
        y: Math.sin(currentAngle) * radius,
      },
    });

    expect(delta.rotationRadians).toBeCloseTo(degrees(2));
    expect(normalizeImageRotationRadians(degrees(358))).toBeCloseTo(degrees(-2));
  });

  it("treats a collapsed contact pair as translation without invalid scale or rotation", () => {
    const delta = getImageTwoFingerTransformDelta({
      previousFirst: { x: 10, y: 10 },
      previousSecond: { x: 10, y: 10 },
      currentFirst: { x: 14, y: 17 },
      currentSecond: { x: 14, y: 17 },
    });

    expect(delta.pan).toEqual({ x: 4, y: 7 });
    expect(delta.zoomFactor).toBe(1);
    expect(delta.rotationRadians).toBe(0);
  });

  it("suspends noisy scale and rotation while close contacts still translate", () => {
    const delta = getImageTwoFingerTransformDelta({
      previousFirst: { x: 10, y: 10 },
      previousSecond: { x: 18, y: 10 },
      currentFirst: { x: 15, y: 16 },
      currentSecond: { x: 15, y: 26 },
    });

    expect(delta.pan).toEqual({ x: 1, y: 11 });
    expect(delta.zoomFactor).toBe(1);
    expect(delta.rotationRadians).toBe(0);
  });

  it("keeps sub-threshold scale and rotation noise below the shared touch slop", () => {
    const motion = getImageTwoFingerIntentMotion({
      initialFirst: { x: 0, y: 0 },
      initialSecond: { x: 100, y: 0 },
      currentFirst: { x: 0, y: 0 },
      currentSecond: { x: 104, y: 4 },
    });

    expect(Math.abs(motion.zoomPixels)).toBeLessThan(5);
    expect(Math.abs(motion.rotationPixels)).toBeLessThan(5);
  });

  it("does not mistake an almost-rigid two-finger pan for zoom or rotation intent", () => {
    const initialFirst = { x: 0, y: 0 };
    const initialSecond = { x: 100, y: 0 };
    const currentFirst = { x: 20, y: 10 };
    const currentSecond = { x: 120.8, y: 10.6 };
    const delta = getImageTwoFingerTransformDelta({
      currentFirst,
      currentSecond,
      previousFirst: initialFirst,
      previousSecond: initialSecond,
    });
    const motion = getImageTwoFingerIntentMotion({
      currentFirst,
      currentSecond,
      initialFirst,
      initialSecond,
    });

    expect(delta.pan.x).toBeCloseTo(20.4);
    expect(delta.pan.y).toBeCloseTo(10.3);
    expect(Math.abs(motion.zoomPixels)).toBeLessThan(1);
    expect(Math.abs(motion.rotationPixels)).toBeLessThan(1);
  });

  it("activates a transform channel after two consistent above-slop samples", () => {
    let intent: ImageTransformChannelIntent = {
      active: false,
      direction: 0,
      samples: 0,
    };

    intent = advanceImageTransformChannelIntent({
      activationDistance: 5,
      motion: 6,
      requiredSamples: 2,
      state: intent,
    });
    expect(intent).toEqual({ active: false, direction: 1, samples: 1 });

    intent = advanceImageTransformChannelIntent({
      activationDistance: 5,
      motion: 8,
      requiredSamples: 2,
      state: intent,
    });
    expect(intent).toEqual({ active: true, direction: 1, samples: 2 });
  });

  it("restarts transform-channel evidence when motion reverses direction", () => {
    const positiveSample = advanceImageTransformChannelIntent({
      activationDistance: 5,
      motion: 7,
      requiredSamples: 2,
      state: { active: false, direction: 0, samples: 0 },
    });
    const reversedSample = advanceImageTransformChannelIntent({
      activationDistance: 5,
      motion: -7,
      requiredSamples: 2,
      state: positiveSample,
    });

    expect(positiveSample).toEqual({ active: false, direction: 1, samples: 1 });
    expect(reversedSample).toEqual({ active: false, direction: -1, samples: 1 });
  });

  it("preserves unclamped zoom overflow until the gesture re-enters its limits", () => {
    const saturated = advanceImageGestureZoom({
      currentZoom: 60,
      maximumZoom: 64,
      minimumZoom: 0.25,
      rawZoom: 60,
      zoomFactor: 2,
    });
    const stillSaturated = advanceImageGestureZoom({
      currentZoom: 64,
      maximumZoom: 64,
      minimumZoom: 0.25,
      rawZoom: saturated.rawZoom,
      zoomFactor: 0.95,
    });
    const backInRange = advanceImageGestureZoom({
      currentZoom: 64,
      maximumZoom: 64,
      minimumZoom: 0.25,
      rawZoom: stillSaturated.rawZoom,
      zoomFactor: 0.5,
    });

    expect(saturated.rawZoom).toBe(120);
    expect(saturated.zoomFactor).toBeCloseTo(64 / 60);
    expect(stillSaturated.rawZoom).toBe(114);
    expect(stillSaturated.zoomFactor).toBe(1);
    expect(backInRange.rawZoom).toBe(57);
    expect(backInRange.zoomFactor).toBeCloseTo(57 / 64);
  });

  it("defers contact A and then applies A and B together without a partial frame", () => {
    const deferred = getImageTwoFingerFramePlan({
      allowUnpairedFrame: true,
      coordination: { deferredPointerId: null, soloPointerId: null },
      firstMoved: true,
      firstPointerId: 11,
      secondMoved: false,
      secondPointerId: 22,
    });
    const paired = getImageTwoFingerFramePlan({
      allowUnpairedFrame: true,
      coordination: deferred.coordination,
      firstMoved: true,
      firstPointerId: 11,
      secondMoved: true,
      secondPointerId: 22,
    });

    expect(deferred).toEqual({
      action: "defer",
      coordination: { deferredPointerId: 11, soloPointerId: null },
    });
    expect(paired).toEqual({
      action: "apply",
      coordination: { deferredPointerId: null, soloPointerId: null },
    });
  });

  it("recognizes one moving contact after one deferred frame and then applies it immediately", () => {
    const deferred = getImageTwoFingerFramePlan({
      allowUnpairedFrame: true,
      coordination: { deferredPointerId: null, soloPointerId: null },
      firstMoved: true,
      firstPointerId: 11,
      secondMoved: false,
      secondPointerId: 22,
    });
    const recognized = getImageTwoFingerFramePlan({
      allowUnpairedFrame: true,
      coordination: deferred.coordination,
      firstMoved: true,
      firstPointerId: 11,
      secondMoved: false,
      secondPointerId: 22,
    });
    const immediate = getImageTwoFingerFramePlan({
      allowUnpairedFrame: true,
      coordination: recognized.coordination,
      firstMoved: true,
      firstPointerId: 11,
      secondMoved: false,
      secondPointerId: 22,
    });

    expect(recognized).toEqual({
      action: "apply",
      coordination: { deferredPointerId: null, soloPointerId: 11 },
    });
    expect(immediate).toEqual(recognized);
  });

  it("drops an unpaired pending contact when pointerup ends the gesture", () => {
    const plan = getImageTwoFingerFramePlan({
      allowUnpairedFrame: false,
      coordination: { deferredPointerId: 11, soloPointerId: null },
      firstMoved: true,
      firstPointerId: 11,
      secondMoved: false,
      secondPointerId: 22,
    });

    expect(plan).toEqual({
      action: "drop",
      coordination: { deferredPointerId: 11, soloPointerId: null },
    });
  });

  it("translates rigid two-finger motion exactly 1:1", () => {
    const result = apply(
      view({ panX: 10, panY: -5 }),
      getImageTwoFingerTransformDelta({
        previousFirst: { x: 110, y: 100 },
        previousSecond: { x: 130, y: 120 },
        currentFirst: { x: 140, y: 80 },
        currentSecond: { x: 160, y: 100 },
      }),
    );

    expect(result.panX).toBeCloseTo(40);
    expect(result.panY).toBeCloseTo(-25);
    expect(result.zoom).toBe(2);
    expect(result.rotationRadians).toBeCloseTo(0);
  });

  it("keeps the content beneath a stationary pinch centroid anchored", () => {
    const result = apply(view(), {
      currentCentroid: { x: 150, y: 100 },
      pan: { x: 0, y: 0 },
      previousCentroid: { x: 150, y: 100 },
      rotationRadians: 0,
      zoomFactor: 2,
    });

    expect(result.zoom).toBe(4);
    expect(result.panX).toBeCloseTo(-50);
    expect(result.panY).toBeCloseTo(0);
  });

  it("zooms around one stationary finger when only the other finger moves", () => {
    const delta = getImageTwoFingerTransformDelta({
      previousFirst: { x: 120, y: 100 },
      previousSecond: { x: 180, y: 100 },
      currentFirst: { x: 120, y: 100 },
      currentSecond: { x: 240, y: 100 },
    });
    const result = apply(view(), delta);
    const nextCenterX = stationaryStageCenter.x + result.panX;
    const projectedStationaryFinger =
      nextCenterX + (120 - stationaryStageCenter.x) * (result.zoom / view().zoom);

    expect(delta.pan.x).toBe(30);
    expect(delta.zoomFactor).toBe(2);
    expect(result.zoom).toBe(4);
    expect(projectedStationaryFinger).toBeCloseTo(120);
  });

  it("combines translation, scale and rotation in one anchored update", () => {
    const result = apply(
      view({ panX: 20, panY: -10 }),
      {
        currentCentroid: { x: 280, y: 210 },
        pan: { x: 30, y: 30 },
        previousCentroid: { x: 250, y: 180 },
        rotationRadians: Math.PI / 2,
        zoomFactor: 1.5,
      },
      {
        currentStageCenter: { x: 200, y: 150 },
        previousStageCenter: { x: 200, y: 150 },
      },
    );

    expect(result.zoom).toBeCloseTo(3);
    expect(result.rotationRadians).toBeCloseTo(Math.PI / 2);
    expect(result.panX).toBeCloseTo(140);
    expect(result.panY).toBeCloseTo(15);
  });

  it("composes sampled frames without path-dependent transform drift", () => {
    const initialFirst = { x: 120, y: 80 };
    const initialSecond = { x: 220, y: 120 };
    const middleFirst = { x: 132, y: 70 };
    const middleSecond = { x: 248, y: 146 };
    const finalFirst = { x: 154, y: 58 };
    const finalSecond = { x: 286, y: 174 };
    const initialView = view({
      panX: 17,
      panY: -9,
      rotationRadians: 0.35,
      zoom: 3.25,
    });
    const throughMiddle = apply(
      apply(
        initialView,
        getImageTwoFingerTransformDelta({
          currentFirst: middleFirst,
          currentSecond: middleSecond,
          previousFirst: initialFirst,
          previousSecond: initialSecond,
        }),
      ),
      getImageTwoFingerTransformDelta({
        currentFirst: finalFirst,
        currentSecond: finalSecond,
        previousFirst: middleFirst,
        previousSecond: middleSecond,
      }),
    );
    const direct = apply(
      initialView,
      getImageTwoFingerTransformDelta({
        currentFirst: finalFirst,
        currentSecond: finalSecond,
        previousFirst: initialFirst,
        previousSecond: initialSecond,
      }),
    );

    expect(throughMiddle.panX).toBeCloseTo(direct.panX, 10);
    expect(throughMiddle.panY).toBeCloseTo(direct.panY, 10);
    expect(throughMiddle.zoom).toBeCloseTo(direct.zoom, 10);
    expect(throughMiddle.rotationRadians).toBeCloseTo(direct.rotationRadians, 10);
  });

  it("keeps the client-space artboard fixed when the stage center moves", () => {
    const result = apply(
      view({ panX: 12, panY: -7 }),
      {
        currentCentroid: { x: 170, y: 150 },
        pan: { x: 0, y: 0 },
        previousCentroid: { x: 170, y: 150 },
        rotationRadians: 0,
        zoomFactor: 1,
      },
      {
        currentStageCenter: { x: 125, y: 130 },
        previousStageCenter: { x: 100, y: 100 },
      },
    );

    expect(result.panX).toBeCloseTo(-13);
    expect(result.panY).toBeCloseTo(-37);
  });

  it("is invariant when the two contacts keep their IDs but are listed in reverse order", () => {
    const forward = getImageTwoFingerTransformDelta({
      previousFirst: { x: 50, y: 60 },
      previousSecond: { x: 150, y: 90 },
      currentFirst: { x: 42, y: 72 },
      currentSecond: { x: 178, y: 142 },
    });
    const reversed = getImageTwoFingerTransformDelta({
      previousFirst: { x: 150, y: 90 },
      previousSecond: { x: 50, y: 60 },
      currentFirst: { x: 178, y: 142 },
      currentSecond: { x: 42, y: 72 },
    });

    expect(reversed.pan).toEqual(forward.pan);
    expect(reversed.zoomFactor).toBeCloseTo(forward.zoomFactor);
    expect(reversed.rotationRadians).toBeCloseTo(forward.rotationRadians);
  });

  it("uses the effective scale at zoom limits while pan remains continuous", () => {
    const result = apply(
      view({ zoom: 60 }),
      {
        currentCentroid: { x: 165, y: 100 },
        pan: { x: 15, y: 0 },
        previousCentroid: { x: 150, y: 100 },
        rotationRadians: 0,
        zoomFactor: 2,
      },
    );

    expect(result.zoom).toBe(64);
    expect(result.panX).toBeCloseTo(165 - 100 - 50 * (64 / 60));
  });

  it("rotates client points around an arbitrary center", () => {
    const rotated = rotateImageClientPoint({
      center: { x: 10, y: 20 },
      point: { x: 14, y: 20 },
      rotationRadians: Math.PI / 2,
    });

    expect(rotated.x).toBeCloseTo(10);
    expect(rotated.y).toBeCloseTo(24);
  });

  it("round-trips a rotated client point for inverse hit testing", () => {
    const center = { x: 137, y: 211 };
    const point = { x: 284, y: 96 };
    const rotationRadians = 0.73;
    const rotated = rotateImageClientPoint({ center, point, rotationRadians });
    const restored = rotateImageClientPoint({
      center,
      point: rotated,
      rotationRadians: -rotationRadians,
    });

    expect(restored.x).toBeCloseTo(point.x, 10);
    expect(restored.y).toBeCloseTo(point.y, 10);
  });
});
