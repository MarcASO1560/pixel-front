import { describe, expect, it } from "vitest";

import {
  calculateImagePreviewSize,
  IMAGE_PREVIEW_MAX_SIZE,
  IMAGE_PREVIEW_MIN_SIZE,
} from "./previewSizing";

describe("pixel-art preview sizing", () => {
  const largeStage = { stageHeight: 1127, stageWidth: 2112 };

  it.each([
    { documentHeight: 32, documentWidth: 16 },
    { documentHeight: 16, documentWidth: 32 },
    { documentHeight: 32, documentWidth: 32 },
  ])("gives small pixel-art documents a readable preview", (document) => {
    expect(calculateImagePreviewSize({ ...document, ...largeStage })).toBe(160);
  });

  it("caps high-resolution documents instead of growing with their resolution", () => {
    expect(
      calculateImagePreviewSize({
        documentHeight: 256,
        documentWidth: 256,
        ...largeStage,
      }),
    ).toBe(IMAGE_PREVIEW_MAX_SIZE);
  });

  it("shrinks to the available workspace height", () => {
    expect(
      calculateImagePreviewSize({
        documentHeight: 64,
        documentWidth: 64,
        stageHeight: 500,
        stageWidth: 700,
      }),
    ).toBe(120);
  });

  it("shrinks to the available workspace width", () => {
    expect(
      calculateImagePreviewSize({
        documentHeight: 64,
        documentWidth: 64,
        stageHeight: 900,
        stageWidth: 500,
      }),
    ).toBe(100);
  });

  it("uses a compact safety size when both workspace axes are constrained", () => {
    expect(
      calculateImagePreviewSize({
        documentHeight: 256,
        documentWidth: 256,
        stageHeight: 200,
        stageWidth: 400,
      }),
    ).toBe(64);
  });

  it("keeps very small documents legible", () => {
    expect(
      calculateImagePreviewSize({
        documentHeight: 8,
        documentWidth: 8,
        ...largeStage,
      }),
    ).toBe(IMAGE_PREVIEW_MIN_SIZE);
  });
});
