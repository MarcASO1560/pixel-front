import { describe, expect, it } from "vitest";

import { createImageCanvasRenderPlan } from "./canvasRendering";
import {
  createImageGridOverlayPlan,
  getImageGridKeylineColor,
  IMAGE_GRID_LINE_STYLES,
} from "./gridOverlay";

describe("getImageGridKeylineColor", () => {
  it.each([
    ["#FFFFFF", "#000000"],
    ["#F7F1E7", "#000000"],
    ["#808080", "#000000"],
    ["#777777", "#000000"],
    ["#757575", "#FFFFFF"],
    ["#101010", "#FFFFFF"],
    ["#000000", "#FFFFFF"],
  ])("chooses the strongest keyline for %s", (color, expected) => {
    expect(getImageGridKeylineColor(color)).toBe(expected);
  });

  it("normalizes alpha colors and invalid input", () => {
    expect(getImageGridKeylineColor("#FFFFFF80")).toBe("#000000");
    expect(getImageGridKeylineColor("not-a-color")).toBe("#000000");
  });
});

describe("createImageGridOverlayPlan", () => {
  it.each(IMAGE_GRID_LINE_STYLES)(
    "keeps %s outside the document layout and aligned to the canvas geometry",
    (lineStyle) => {
      const input = {
        cellSize: 33.06545903847264,
        gridHeight: 32,
        gridWidth: 16,
      };
      const canvas = createImageCanvasRenderPlan(input);
      const overlay = createImageGridOverlayPlan({ ...input, lineStyle });

      expect(overlay).toMatchObject({
        cssHeight: canvas.cssHeight,
        cssWidth: canvas.cssWidth,
        lineStyle,
        step: input.cellSize,
      });
    },
  );

  it("uses the exact same dimensions, step and boundaries for every line style", () => {
    const plans = IMAGE_GRID_LINE_STYLES.map((lineStyle) =>
      createImageGridOverlayPlan({
        cellSize: 17.25,
        gridHeight: 3,
        gridWidth: 5,
        lineStyle,
      }),
    );
    const geometry = ({ lineStyle: _lineStyle, ...plan }: (typeof plans)[number]) => plan;

    expect(plans.map(geometry)).toEqual([
      geometry(plans[0]),
      geometry(plans[0]),
      geometry(plans[0]),
    ]);
    expect(plans[0].verticalLines.map(({ x1 }) => x1)).toEqual([
      17.25,
      34.5,
      51.75,
      69,
    ]);
    expect(plans[0].horizontalLines.map(({ y1 }) => y1)).toEqual([17.25, 34.5]);
  });

  it("represents dashed grid lines as continuous artboard-wide segments", () => {
    const plan = createImageGridOverlayPlan({
      cellSize: 12,
      gridHeight: 3,
      gridWidth: 5,
      lineStyle: "dashed",
    });

    expect(plan.verticalLines).toHaveLength(4);
    expect(plan.horizontalLines).toHaveLength(2);
    expect(plan.verticalLines).toEqual(
      expect.arrayContaining([
        { x1: 12, x2: 12, y1: 0, y2: 36 },
        { x1: 48, x2: 48, y1: 0, y2: 36 },
      ]),
    );
    expect(plan.horizontalLines).toEqual(
      expect.arrayContaining([
        { x1: 0, x2: 60, y1: 12, y2: 12 },
        { x1: 0, x2: 60, y1: 24, y2: 24 },
      ]),
    );

    // A cell-by-cell implementation would produce 22 independent segments
    // here, causing stroke-dasharray to restart at every cell boundary.
    expect(plan.verticalLines.length + plan.horizontalLines.length).toBe(6);
  });
});
