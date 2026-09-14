import { describe, expect, it } from "vitest";

import {
  clampCanvasMirrorAxis,
  expandCanvasMirrorPoints,
  positiveModulo,
  wrapCanvasPoint,
  wrapCanvasPoints,
} from "./canvasModes";

describe("canvas mirror modes", () => {
  it("keeps the original stroke when both mirror modes are off", () => {
    expect(
      expandCanvasMirrorPoints([{ x: 1, y: 2 }], { width: 6, height: 8 }, {
        horizontal: false,
        vertical: false,
      }),
    ).toEqual([{ x: 1, y: 2 }]);
  });

  it("copies paint across the horizontal center axis", () => {
    expect(
      expandCanvasMirrorPoints([{ x: 1, y: 2 }], { width: 6, height: 8 }, {
        horizontal: true,
        vertical: false,
      }),
    ).toEqual([
      { x: 1, y: 2 },
      { x: 1, y: 5 },
    ]);
  });

  it("copies paint across the vertical center axis", () => {
    expect(
      expandCanvasMirrorPoints([{ x: 1, y: 2 }], { width: 6, height: 8 }, {
        horizontal: false,
        vertical: true,
      }),
    ).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 2 },
    ]);
  });

  it("combines both modes into four-way symmetry", () => {
    expect(
      expandCanvasMirrorPoints([{ x: 1, y: 2 }], { width: 6, height: 8 }, {
        horizontal: true,
        vertical: true,
      }),
    ).toEqual([
      { x: 1, y: 2 },
      { x: 1, y: 5 },
      { x: 4, y: 2 },
      { x: 4, y: 5 },
    ]);
  });

  it("deduplicates points that sit on an odd-sized center axis", () => {
    expect(
      expandCanvasMirrorPoints([{ x: 2, y: 2 }], { width: 5, height: 5 }, {
        horizontal: true,
        vertical: true,
      }),
    ).toEqual([{ x: 2, y: 2 }]);
  });

  it("copies paint across a moved horizontal axis", () => {
    expect(
      expandCanvasMirrorPoints([{ x: 1, y: 0 }], { width: 6, height: 8 }, {
        horizontal: true,
        horizontalAxisY: 2,
        vertical: false,
      }),
    ).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 3 },
    ]);
  });

  it("copies paint across a moved vertical axis on a pixel center", () => {
    expect(
      expandCanvasMirrorPoints([{ x: 0, y: 2 }], { width: 6, height: 8 }, {
        horizontal: false,
        vertical: true,
        verticalAxisX: 1.5,
      }),
    ).toEqual([
      { x: 0, y: 2 },
      { x: 2, y: 2 },
    ]);
  });

  it("keeps the original point when a moved-axis copy falls outside the canvas", () => {
    expect(
      expandCanvasMirrorPoints([{ x: 4, y: 2 }], { width: 6, height: 8 }, {
        horizontal: false,
        vertical: true,
        verticalAxisX: 1,
      }),
    ).toEqual([{ x: 4, y: 2 }]);
  });

  it("wraps moved-axis copies that cross a tile edge in wrap-around mode", () => {
    expect(
      expandCanvasMirrorPoints(
        [{ x: 4, y: 2 }],
        { width: 6, height: 8 },
        {
          horizontal: false,
          vertical: true,
          verticalAxisX: 1,
        },
        { wrapAround: true },
      ),
    ).toEqual([
      { x: 4, y: 2 },
      { x: 3, y: 2 },
    ]);
  });

  it("snaps mirror axes to half pixels and clamps them to the canvas", () => {
    expect(clampCanvasMirrorAxis(2.26, 8)).toBe(2.5);
    expect(clampCanvasMirrorAxis(-4, 8)).toBe(0);
    expect(clampCanvasMirrorAxis(12, 8)).toBe(8);
    expect(clampCanvasMirrorAxis(Number.NaN, 7)).toBe(3.5);
  });
});

describe("wrap-around canvas mode", () => {
  it("uses positive modulo for points before and after the canvas", () => {
    expect(positiveModulo(-1, 8)).toBe(7);
    expect(positiveModulo(8, 8)).toBe(0);
    expect(wrapCanvasPoint({ x: -2, y: 9 }, { width: 8, height: 6 })).toEqual({
      x: 6,
      y: 3,
    });
  });

  it("wraps and deduplicates equivalent tiled points", () => {
    expect(
      wrapCanvasPoints(
        [
          { x: -1, y: 0 },
          { x: 3, y: 0 },
          { x: 7, y: 4 },
          { x: 0, y: -1 },
        ],
        { width: 4, height: 5 },
      ),
    ).toEqual([
      { x: 3, y: 0 },
      { x: 3, y: 4 },
      { x: 0, y: 4 },
    ]);
  });

  it("returns no points for an empty canvas", () => {
    expect(wrapCanvasPoints([{ x: 4, y: 3 }], { width: 0, height: 8 })).toEqual([]);
  });
});
