import { describe, expect, it } from "vitest";

import {
  applyImageTwoFingerTransformDelta,
  normalizeImageRotationRadians,
  rotateImageClientPoint,
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

const delta = (
  overrides: Partial<ImageTwoFingerTransformDelta> = {},
): ImageTwoFingerTransformDelta => ({
  currentCentroid: { x: 150, y: 100 },
  previousCentroid: { x: 150, y: 100 },
  rotationRadians: 0,
  zoomFactor: 1,
  ...overrides,
});

const apply = (
  currentView: ImageViewportTransform,
  transformDelta: ImageTwoFingerTransformDelta,
  overrides: Partial<Parameters<typeof applyImageTwoFingerTransformDelta>[0]> = {},
) =>
  applyImageTwoFingerTransformDelta({
    currentStageCenter: stationaryStageCenter,
    delta: transformDelta,
    maximumZoom: 64,
    minimumZoom: 0.25,
    previousStageCenter: stationaryStageCenter,
    view: currentView,
    ...overrides,
  });

describe("image viewport transform math", () => {
  it("normalizes rotation across the ±π boundary", () => {
    const degrees = (value: number) => (value * Math.PI) / 180;

    expect(normalizeImageRotationRadians(degrees(358))).toBeCloseTo(degrees(-2));
    expect(normalizeImageRotationRadians(degrees(-358))).toBeCloseTo(degrees(2));
  });

  it("translates two-finger motion exactly 1:1", () => {
    const result = apply(
      view({ panX: 10, panY: -5 }),
      delta({
        currentCentroid: { x: 150, y: 90 },
        previousCentroid: { x: 120, y: 110 },
      }),
    );

    expect(result.panX).toBeCloseTo(40);
    expect(result.panY).toBeCloseTo(-25);
    expect(result.zoom).toBe(2);
    expect(result.rotationRadians).toBeCloseTo(0);
  });

  it("keeps the content beneath a stationary pinch centroid anchored", () => {
    const result = apply(view(), delta({ zoomFactor: 2 }));

    expect(result.zoom).toBe(4);
    expect(result.panX).toBeCloseTo(-50);
    expect(result.panY).toBeCloseTo(0);
  });

  it("zooms around one stationary finger when only the other finger moves", () => {
    const result = apply(
      view(),
      delta({
        currentCentroid: { x: 180, y: 100 },
        previousCentroid: { x: 150, y: 100 },
        zoomFactor: 2,
      }),
    );
    const nextCenterX = stationaryStageCenter.x + result.panX;
    const projectedStationaryFinger =
      nextCenterX + (120 - stationaryStageCenter.x) * (result.zoom / view().zoom);

    expect(result.zoom).toBe(4);
    expect(projectedStationaryFinger).toBeCloseTo(120);
  });

  it("combines translation, scale and rotation in one anchored update", () => {
    const result = apply(
      view({ panX: 20, panY: -10 }),
      delta({
        currentCentroid: { x: 280, y: 210 },
        previousCentroid: { x: 250, y: 180 },
        rotationRadians: Math.PI / 2,
        zoomFactor: 1.5,
      }),
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
    const initialView = view({
      panX: 17,
      panY: -9,
      rotationRadians: 0.35,
      zoom: 3.25,
    });
    const initialCentroid = { x: 170, y: 100 };
    const middleCentroid = { x: 190, y: 114 };
    const finalCentroid = { x: 226, y: 139 };
    const firstScale = 1.25;
    const secondScale = 1.12;
    const firstRotation = 0.18;
    const secondRotation = -0.07;
    const throughMiddle = apply(
      apply(
        initialView,
        delta({
          currentCentroid: middleCentroid,
          previousCentroid: initialCentroid,
          rotationRadians: firstRotation,
          zoomFactor: firstScale,
        }),
      ),
      delta({
        currentCentroid: finalCentroid,
        previousCentroid: middleCentroid,
        rotationRadians: secondRotation,
        zoomFactor: secondScale,
      }),
    );
    const direct = apply(
      initialView,
      delta({
        currentCentroid: finalCentroid,
        previousCentroid: initialCentroid,
        rotationRadians: firstRotation + secondRotation,
        zoomFactor: firstScale * secondScale,
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
      delta({
        currentCentroid: { x: 170, y: 150 },
        previousCentroid: { x: 170, y: 150 },
      }),
      {
        currentStageCenter: { x: 125, y: 130 },
        previousStageCenter: { x: 100, y: 100 },
      },
    );

    expect(result.panX).toBeCloseTo(-13);
    expect(result.panY).toBeCloseTo(-37);
  });

  it("uses the effective scale at zoom limits while pan remains continuous", () => {
    const result = apply(
      view({ zoom: 60 }),
      delta({
        currentCentroid: { x: 165, y: 100 },
        previousCentroid: { x: 150, y: 100 },
        zoomFactor: 2,
      }),
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
