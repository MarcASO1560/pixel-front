import { describe, expect, it } from "vitest";

import {
  clipClientSegmentToRect,
  getImagePixelIndexFromClientPoint,
  getImagePixelSegmentFromClientSegment,
} from "./hitTesting";

describe("image artboard hit testing", () => {
  it("reaches the final row and column when client dimensions already exclude the border", () => {
    expect(
      getImagePixelIndexFromClientPoint({
        borderLeft: 1,
        borderTop: 1,
        cellSize: 7.25,
        clientHeight: 29,
        clientWidth: 29,
        clientX: 129.75,
        clientY: 79.75,
        gridHeight: 4,
        gridWidth: 4,
        rectLeft: 100,
        rectTop: 50,
      }),
    ).toBe(15);
  });
});

describe("client segment clipping", () => {
  const bounds = { left: 0, top: 0, right: 10, bottom: 10 };

  it("leaves a segment fully inside the rectangle unchanged", () => {
    expect(
      clipClientSegmentToRect({
        bounds,
        from: { x: 2, y: 3 },
        to: { x: 8, y: 7 },
      }),
    ).toEqual({
      start: { x: 2, y: 3 },
      end: { x: 8, y: 7 },
    });
  });

  it.each([
    {
      label: "left",
      from: { x: -5, y: 5 },
      to: { x: 5, y: 5 },
      expected: { start: { x: 0, y: 5 }, end: { x: 5, y: 5 } },
    },
    {
      label: "top",
      from: { x: 5, y: -5 },
      to: { x: 5, y: 5 },
      expected: { start: { x: 5, y: 0 }, end: { x: 5, y: 5 } },
    },
    {
      label: "right",
      from: { x: 15, y: 5 },
      to: { x: 5, y: 5 },
      expected: { start: { x: 10, y: 5 }, end: { x: 5, y: 5 } },
    },
    {
      label: "bottom",
      from: { x: 5, y: 15 },
      to: { x: 5, y: 5 },
      expected: { start: { x: 5, y: 10 }, end: { x: 5, y: 5 } },
    },
  ])("clips an outside-to-inside segment entering through $label", ({ expected, from, to }) => {
    expect(clipClientSegmentToRect({ bounds, from, to })).toEqual(expected);
  });

  it.each([
    {
      label: "left",
      from: { x: 5, y: 5 },
      to: { x: -5, y: 5 },
      expected: { start: { x: 5, y: 5 }, end: { x: 0, y: 5 } },
    },
    {
      label: "top",
      from: { x: 5, y: 5 },
      to: { x: 5, y: -5 },
      expected: { start: { x: 5, y: 5 }, end: { x: 5, y: 0 } },
    },
    {
      label: "right",
      from: { x: 5, y: 5 },
      to: { x: 15, y: 5 },
      expected: { start: { x: 5, y: 5 }, end: { x: 10, y: 5 } },
    },
    {
      label: "bottom",
      from: { x: 5, y: 5 },
      to: { x: 5, y: 15 },
      expected: { start: { x: 5, y: 5 }, end: { x: 5, y: 10 } },
    },
  ])("clips an inside-to-outside segment leaving through $label", ({ expected, from, to }) => {
    expect(clipClientSegmentToRect({ bounds, from, to })).toEqual(expected);
  });

  it("clips an outside-to-outside segment that crosses the complete rectangle", () => {
    expect(
      clipClientSegmentToRect({
        bounds,
        from: { x: -5, y: 5 },
        to: { x: 15, y: 5 },
      }),
    ).toEqual({
      start: { x: 0, y: 5 },
      end: { x: 10, y: 5 },
    });
  });

  it("preserves direction when clipping a reverse outside-to-outside segment", () => {
    expect(
      clipClientSegmentToRect({
        bounds,
        from: { x: 15, y: 5 },
        to: { x: -5, y: 5 },
      }),
    ).toEqual({
      start: { x: 10, y: 5 },
      end: { x: 0, y: 5 },
    });
  });

  it("clips a diagonal crossing through opposite corners", () => {
    expect(
      clipClientSegmentToRect({
        bounds,
        from: { x: -5, y: -5 },
        to: { x: 15, y: 15 },
      }),
    ).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
    });
  });

  it("clips a fractional diagonal through two edges", () => {
    const result = clipClientSegmentToRect({
      bounds,
      from: { x: -5, y: 2 },
      to: { x: 15, y: 8 },
    });

    expect(result?.start.x).toBeCloseTo(0);
    expect(result?.start.y).toBeCloseTo(3.5);
    expect(result?.end.x).toBeCloseTo(10);
    expect(result?.end.y).toBeCloseTo(6.5);
  });

  it("retains a segment that lies along an inclusive border", () => {
    expect(
      clipClientSegmentToRect({
        bounds,
        from: { x: -5, y: 0 },
        to: { x: 15, y: 0 },
      }),
    ).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    });
  });

  it("returns a one-point segment when only a corner is touched", () => {
    expect(
      clipClientSegmentToRect({
        bounds,
        from: { x: -5, y: 5 },
        to: { x: 5, y: -5 },
      }),
    ).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 },
    });
  });

  it.each([
    {
      label: "parallel above",
      from: { x: -5, y: -1 },
      to: { x: 15, y: -1 },
    },
    {
      label: "parallel beside",
      from: { x: -1, y: -5 },
      to: { x: -1, y: 15 },
    },
    {
      label: "diagonal past a corner",
      from: { x: -5, y: 0 },
      to: { x: 0, y: -5 },
    },
  ])("returns null for a non-intersecting segment: $label", ({ from, to }) => {
    expect(clipClientSegmentToRect({ bounds, from, to })).toBeNull();
  });

  it("supports a zero-length segment inside the rectangle", () => {
    expect(
      clipClientSegmentToRect({
        bounds,
        from: { x: 4, y: 6 },
        to: { x: 4, y: 6 },
      }),
    ).toEqual({
      start: { x: 4, y: 6 },
      end: { x: 4, y: 6 },
    });
  });

  it("rejects a zero-length segment outside the rectangle", () => {
    expect(
      clipClientSegmentToRect({
        bounds,
        from: { x: -1, y: 6 },
        to: { x: -1, y: 6 },
      }),
    ).toBeNull();
  });

  it("rejects invalid bounds and non-finite coordinates", () => {
    expect(
      clipClientSegmentToRect({
        bounds: { left: 10, top: 0, right: 0, bottom: 10 },
        from: { x: 2, y: 2 },
        to: { x: 8, y: 8 },
      }),
    ).toBeNull();
    expect(
      clipClientSegmentToRect({
        bounds,
        from: { x: Number.NaN, y: 2 },
        to: { x: 8, y: 8 },
      }),
    ).toBeNull();
  });
});

describe("client segment to pixel-grid mapping", () => {
  const geometry = {
    borderLeft: 1,
    borderTop: 1,
    bounds: { left: 101, top: 201, right: 157, bottom: 257 },
    cellSize: 7,
    clientHeight: 56,
    clientWidth: 56,
    gridHeight: 8,
    gridWidth: 8,
    rectLeft: 100,
    rectTop: 200,
  } as const;

  it("maps one sparse outside-to-outside sample across every horizontal column", () => {
    expect(
      getImagePixelSegmentFromClientSegment({
        ...geometry,
        from: { x: 50, y: 228 },
        to: { x: 220, y: 228 },
      }),
    ).toEqual({ startIndex: 24, endIndex: 31 });
  });

  it("maps one sparse diagonal sample to opposite corner cells", () => {
    expect(
      getImagePixelSegmentFromClientSegment({
        ...geometry,
        from: { x: 50, y: 150 },
        to: { x: 220, y: 320 },
      }),
    ).toEqual({ startIndex: 0, endIndex: 63 });
  });

  it("preserves direction for a reverse full-grid crossing", () => {
    expect(
      getImagePixelSegmentFromClientSegment({
        ...geometry,
        from: { x: 220, y: 228 },
        to: { x: 50, y: 228 },
      }),
    ).toEqual({ startIndex: 31, endIndex: 24 });
  });

  it("returns null when a sparse segment misses the artboard", () => {
    expect(
      getImagePixelSegmentFromClientSegment({
        ...geometry,
        from: { x: 50, y: 150 },
        to: { x: 90, y: 190 },
      }),
    ).toBeNull();
  });
});
