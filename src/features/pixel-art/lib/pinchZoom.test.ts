import { describe, expect, it } from "vitest";

import {
  getAnchoredImagePinchPan,
  getImagePinchGeometry,
  getImagePinchZoom,
} from "./pinchZoom";

describe("image pinch zoom", () => {
  it("derives the midpoint and distance from two contacts", () => {
    expect(getImagePinchGeometry({ x: 20, y: 40 }, { x: 80, y: 120 })).toEqual({
      distance: 100,
      midpoint: { x: 50, y: 80 },
    });
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
        stage: { left: 10, top: 20, width: 500, height: 400 },
      }),
    ).toEqual({ x: 100, y: -80 });
  });
});
