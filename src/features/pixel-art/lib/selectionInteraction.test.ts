import { describe, expect, it } from "vitest";

import { isSinglePixelSelectionGesture } from "./selectionInteraction";

describe("image selection pointer gestures", () => {
  it("treats a press released on the same pixel as a click", () => {
    expect(isSinglePixelSelectionGesture({ x: 3, y: 5 }, { x: 3, y: 5 })).toBe(true);
  });

  it("keeps horizontal, vertical, and diagonal drags as selection gestures", () => {
    expect(isSinglePixelSelectionGesture({ x: 3, y: 5 }, { x: 4, y: 5 })).toBe(false);
    expect(isSinglePixelSelectionGesture({ x: 3, y: 5 }, { x: 3, y: 6 })).toBe(false);
    expect(isSinglePixelSelectionGesture({ x: 3, y: 5 }, { x: 4, y: 6 })).toBe(false);
  });

  it("does not classify incomplete gestures as clicks", () => {
    expect(isSinglePixelSelectionGesture(null, { x: 3, y: 5 })).toBe(false);
    expect(isSinglePixelSelectionGesture({ x: 3, y: 5 }, null)).toBe(false);
  });
});
