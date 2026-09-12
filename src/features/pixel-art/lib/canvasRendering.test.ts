import { describe, expect, it } from "vitest";

import { createImageCanvasRenderPlan } from "./canvasRendering";

describe("createImageCanvasRenderPlan", () => {
  it("renders at logical resolution while preserving a fractional CSS zoom", () => {
    expect(
      createImageCanvasRenderPlan({
        cellSize: 33.06545903847264,
        gridHeight: 32,
        gridWidth: 16,
      }),
    ).toEqual({
      bitmapHeight: 32,
      bitmapWidth: 16,
      cellSize: 1,
      cellStride: 1,
      cssHeight: 1058.0946892311244,
      cssWidth: 529.0473446155622,
    });
  });

  it("derives the canvas size only from the document dimensions and zoom", () => {
    expect(
      createImageCanvasRenderPlan({
        cellSize: 24,
        gridHeight: 3,
        gridWidth: 4,
      }),
    ).toEqual({
      bitmapHeight: 3,
      bitmapWidth: 4,
      cellSize: 1,
      cellStride: 1,
      cssHeight: 72,
      cssWidth: 96,
    });
  });
});
