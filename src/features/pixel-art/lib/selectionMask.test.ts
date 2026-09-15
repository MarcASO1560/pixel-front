import { describe, expect, it } from "vitest";

import {
  combineSelectionMasks,
  createEmptySelectionMask,
  createLassoSelectionMask,
  createMagicWandSelectionMask,
  createPixelSelectionMask,
  createPointSelectionMask,
  createRectangleSelectionMask,
  isPixelSelected,
  selectedPixelCount,
} from "./selectionMask";

const selectedPoints = (mask: ReturnType<typeof createEmptySelectionMask>) => {
  const points: string[] = [];
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (isPixelSelected(mask, { x, y })) points.push(`${x},${y}`);
    }
  }
  return points;
};

describe("pixel selection masks", () => {
  it("canonicalizes binary data and derives the smallest selected bounds", () => {
    const source = [0, 2, 0, -1, 0, 0];
    const mask = createPixelSelectionMask({ width: 3, height: 2 }, source);

    expect([...mask.data]).toEqual([0, 1, 0, 1, 0, 0]);
    expect(mask.bounds).toEqual({ x: 0, y: 0, width: 2, height: 2 });
    expect(source).toEqual([0, 2, 0, -1, 0, 0]);
  });

  it("represents empty and point-based selections without duplicates or overflow", () => {
    const empty = createEmptySelectionMask({ width: 3, height: 2 });
    const points = createPointSelectionMask(
      [{ x: 2, y: 1 }, { x: 2, y: 1 }, { x: -1, y: 0 }],
      { width: 3, height: 2 },
    );

    expect(empty.bounds).toBeNull();
    expect(empty.data).toHaveLength(6);
    expect(selectedPoints(points)).toEqual(["2,1"]);
    expect(points.bounds).toEqual({ x: 2, y: 1, width: 1, height: 1 });
  });

  it("creates inclusive rectangular selections for reverse and clipped drags", () => {
    const mask = createRectangleSelectionMask(
      { x: 4, y: 3 },
      { x: -1, y: 1 },
      { width: 4, height: 3 },
    );

    expect([...mask.data]).toEqual([
      0, 0, 0, 0,
      1, 1, 1, 1,
      1, 1, 1, 1,
    ]);
    expect(mask.bounds).toEqual({ x: 0, y: 1, width: 4, height: 2 });
  });

  it("returns an empty rectangle mask when the drag misses the canvas", () => {
    const mask = createRectangleSelectionMask(
      { x: -4, y: -4 },
      { x: -2, y: -1 },
      { width: 3, height: 3 },
    );

    expect(selectedPixelCount(mask)).toBe(0);
    expect(mask.bounds).toBeNull();
  });
});

describe("lasso selection rasterization", () => {
  it("closes and fills a hard-edged freehand polygon", () => {
    const mask = createLassoSelectionMask(
      [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }, { x: 1, y: 4 }],
      { width: 6, height: 6 },
    );

    expect(mask.bounds).toEqual({ x: 1, y: 1, width: 4, height: 4 });
    expect(selectedPixelCount(mask)).toBe(16);
    expect(isPixelSelected(mask, { x: 2, y: 2 })).toBe(true);
    expect(isPixelSelected(mask, { x: 0, y: 2 })).toBe(false);
  });

  it("clips an off-canvas polygon without clipping its geometry first", () => {
    const mask = createLassoSelectionMask(
      [{ x: -2, y: -2 }, { x: 4, y: -2 }, { x: 4, y: 4 }, { x: -2, y: 4 }],
      { width: 3, height: 3 },
    );

    expect(selectedPixelCount(mask)).toBe(9);
    expect(mask.bounds).toEqual({ x: 0, y: 0, width: 3, height: 3 });
  });

  it("rasterizes one-point and degenerate lasso paths without scanline artifacts", () => {
    const point = createLassoSelectionMask([{ x: 2, y: 1 }], { width: 4, height: 3 });
    const line = createLassoSelectionMask(
      [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 1, y: 0 }],
      { width: 4, height: 2 },
    );

    expect(selectedPoints(point)).toEqual(["2,1"]);
    expect(selectedPoints(line)).toEqual(["0,0", "1,0", "2,0", "3,0"]);
  });

  it("fills self-intersecting paths whose signed areas cancel out", () => {
    const mask = createLassoSelectionMask(
      [{ x: 30, y: 12 }, { x: 26, y: 7 }, { x: 14, y: 8 }, { x: 22, y: 6 }],
      { width: 32, height: 32 },
    );

    expect(isPixelSelected(mask, { x: 20, y: 7 })).toBe(true);
  });
});

describe("exact-color magic wand selections", () => {
  const source = {
    width: 4,
    height: 3,
    pixels: [
      "A", "A", "B", "A",
      "B", "A", "B", "B",
      "A", "B", "A", "A",
    ],
  };

  it("selects only the four-connected exact-color region by default", () => {
    const mask = createMagicWandSelectionMask(source, { x: 0, y: 0 });

    expect(selectedPoints(mask)).toEqual(["0,0", "1,0", "1,1"]);
    expect(mask.bounds).toEqual({ x: 0, y: 0, width: 2, height: 2 });
  });

  it("selects every exact match when contiguous is disabled", () => {
    const mask = createMagicWandSelectionMask(
      source,
      { x: 0, y: 0 },
      { contiguous: false },
    );

    expect(selectedPoints(mask)).toEqual([
      "0,0", "1,0", "3,0", "1,1", "0,2", "2,2", "3,2",
    ]);
    expect(mask.bounds).toEqual({ x: 0, y: 0, width: 4, height: 3 });
  });

  it("matches transparent pixels exactly and ignores out-of-bounds starts", () => {
    const transparent = {
      width: 3,
      height: 2,
      pixels: [null, "A", null, null, "A", "A"],
    };

    expect(
      selectedPoints(createMagicWandSelectionMask(transparent, { x: 0, y: 0 })),
    ).toEqual(["0,0", "0,1"]);
    expect(
      createMagicWandSelectionMask(transparent, { x: 5, y: 0 }).bounds,
    ).toBeNull();
  });
});

describe("selection mask combinations", () => {
  const horizontal = createRectangleSelectionMask(
    { x: 0, y: 1 },
    { x: 2, y: 1 },
    { width: 3, height: 3 },
  );
  const vertical = createRectangleSelectionMask(
    { x: 1, y: 0 },
    { x: 1, y: 2 },
    { width: 3, height: 3 },
  );

  it.each([
    ["replace", ["1,0", "1,1", "1,2"]],
    ["add", ["1,0", "0,1", "1,1", "2,1", "1,2"]],
    ["subtract", ["0,1", "2,1"]],
    ["intersect", ["1,1"]],
  ] as const)("supports %s without mutating its operands", (mode, expected) => {
    const beforeHorizontal = [...horizontal.data];
    const beforeVertical = [...vertical.data];
    const result = combineSelectionMasks(horizontal, vertical, mode);

    expect(selectedPoints(result)).toEqual(expected);
    expect([...horizontal.data]).toEqual(beforeHorizontal);
    expect([...vertical.data]).toEqual(beforeVertical);
    expect(result.data).not.toBe(vertical.data);
  });

  it("treats a missing current selection as empty for every mode", () => {
    expect(selectedPoints(combineSelectionMasks(null, vertical, "replace"))).toEqual(
      selectedPoints(vertical),
    );
    expect(selectedPoints(combineSelectionMasks(null, vertical, "add"))).toEqual(
      selectedPoints(vertical),
    );
    expect(combineSelectionMasks(null, vertical, "subtract").bounds).toBeNull();
    expect(combineSelectionMasks(null, vertical, "intersect").bounds).toBeNull();
  });

  it("rejects masks from different canvases", () => {
    const other = createEmptySelectionMask({ width: 4, height: 3 });
    expect(() => combineSelectionMasks(horizontal, other, "add")).toThrow(RangeError);
  });
});
