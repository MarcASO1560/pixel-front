import { describe, expect, it } from "vitest";

import {
  getAnchoredImagePinchPan,
  getImagePinchGeometry,
  getImagePinchZoom,
  getImageTwoFingerGestureIntent,
} from "./pinchZoom";

describe("image pinch zoom", () => {
  it("derives the midpoint and distance from two contacts", () => {
    expect(getImagePinchGeometry({ x: 20, y: 40 }, { x: 80, y: 120 })).toEqual({
      distance: 100,
      midpoint: { x: 50, y: 80 },
    });
  });

  it("recognizes parallel two-finger movement as pan despite small imperfections", () => {
    expect(
      getImageTwoFingerGestureIntent({
        currentFirst: { x: 38, y: 47 },
        currentSecond: { x: 99, y: 125 },
        initialFirst: { x: 20, y: 40 },
        initialSecond: { x: 80, y: 120 },
      }),
    ).toBe("pan");
  });

  it("recognizes approximately opposing finger movement as zoom", () => {
    expect(
      getImageTwoFingerGestureIntent({
        currentFirst: { x: 8, y: 42 },
        currentSecond: { x: 93, y: 117 },
        initialFirst: { x: 20, y: 40 },
        initialSecond: { x: 80, y: 120 },
      }),
    ).toBe("zoom");
  });

  it("waits through contact jitter before choosing a gesture", () => {
    expect(
      getImageTwoFingerGestureIntent({
        currentFirst: { x: 22, y: 41 },
        currentSecond: { x: 79, y: 118 },
        initialFirst: { x: 20, y: 40 },
        initialSecond: { x: 80, y: 120 },
      }),
    ).toBeNull();
  });

  it("does not lock zoom from an isolated contact update", () => {
    expect(
      getImageTwoFingerGestureIntent({
        currentFirst: { x: 20, y: 40 },
        currentSecond: { x: 104, y: 138 },
        initialFirst: { x: 20, y: 40 },
        initialSecond: { x: 80, y: 120 },
      }),
    ).toBeNull();
  });

  it("scales from the initial distance and respects the zoom limits", () => {
    expect(
      getImagePinchZoom({
        currentDistance: 200,
        initialDistance: 100,
        initialZoom: 4,
        minimumZoom: 0.25,
        maximumZoom: 64,
      }),
    ).toBe(8);
    expect(
      getImagePinchZoom({
        currentDistance: 1,
        initialDistance: 100,
        initialZoom: 4,
        minimumZoom: 0.25,
        maximumZoom: 64,
      }),
    ).toBe(0.25);
  });

  it("keeps the anchored image point below a moving midpoint", () => {
    expect(
      getAnchoredImagePinchPan({
        anchor: { x: 0.25, y: 0.75 },
        artboardSize: { width: 400, height: 200 },
        midpoint: { x: 260, y: 190 },
        stageCenter: { x: 260, y: 220 },
      }),
    ).toEqual({ x: 100, y: -80 });
  });

  it("supports an artboard center that is offset inside the stage", () => {
    expect(
      getAnchoredImagePinchPan({
        anchor: { x: 0.25, y: 0.75 },
        artboardSize: { width: 400, height: 200 },
        midpoint: { x: 260, y: 190 },
        stageCenter: { x: 260, y: 204 },
      }),
    ).toEqual({ x: 100, y: -64 });
  });

  it("turns movement of the pinch midpoint into the same amount of two-finger pan", () => {
    const anchor = { x: 0.55, y: 0.4 };
    const artboardSize = { width: 320, height: 640 };
    const stageCenter = { x: 200, y: 180 };
    const initialMidpoint = { x: 246, y: 283 };
    const initialPan = getAnchoredImagePinchPan({
      anchor,
      artboardSize,
      midpoint: initialMidpoint,
      stageCenter,
    });
    const movedPan = getAnchoredImagePinchPan({
      anchor,
      artboardSize,
      midpoint: { x: initialMidpoint.x + 18, y: initialMidpoint.y - 12 },
      stageCenter,
    });

    expect(movedPan).toEqual({
      x: initialPan.x + 18,
      y: initialPan.y - 12,
    });
  });
});
