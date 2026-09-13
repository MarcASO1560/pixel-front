import { describe, expect, it } from "vitest";

import {
  createGraffitiGestureState,
  graffitiBrushStamp,
  graffitiBrushStroke,
  type GraffitiBrushOptions,
  type GraffitiPixel,
} from "./graffitiBrush";

const options = (overrides: Partial<GraffitiBrushOptions> = {}): GraffitiBrushOptions => ({
  brushSize: 3,
  primaryColor: "#112233",
  secondaryColor: "#AABBCC",
  bounds: { width: 20, height: 20 },
  ...overrides,
});

const pixelMap = (pixels: ReadonlyArray<GraffitiPixel>) =>
  new Map(pixels.map((pixel) => [`${pixel.x},${pixel.y}`, pixel.color]));

describe("graffiti checkerboard stamps", () => {
  it("anchors the normal phase to absolute 1x1 canvas coordinates", () => {
    const pixels = graffitiBrushStamp({ x: 2, y: 2 }, options());

    expect(pixels).toEqual([
      { x: 1, y: 1, color: "#112233" },
      { x: 2, y: 1, color: "#AABBCC" },
      { x: 3, y: 1, color: "#112233" },
      { x: 1, y: 2, color: "#AABBCC" },
      { x: 2, y: 2, color: "#112233" },
      { x: 3, y: 2, color: "#AABBCC" },
      { x: 1, y: 3, color: "#112233" },
      { x: 2, y: 3, color: "#AABBCC" },
      { x: 3, y: 3, color: "#112233" },
    ]);
  });

  it("inverts the complete checkerboard phase", () => {
    const normal = pixelMap(graffitiBrushStamp({ x: 4, y: 4 }, options()));
    const inverted = pixelMap(
      graffitiBrushStamp({ x: 4, y: 4 }, options({ inverted: true })),
    );

    for (const [coordinate, color] of normal) {
      expect(inverted.get(coordinate)).toBe(
        color === "#112233" ? "#AABBCC" : "#112233",
      );
    }
  });

  it("clips stamps to bounds without changing their canvas phase", () => {
    expect(
      graffitiBrushStamp(
        { x: 0, y: 0 },
        options({ brushSize: 3, bounds: { width: 2, height: 2 } }),
      ),
    ).toEqual([
      { x: 0, y: 0, color: "#112233" },
      { x: 1, y: 0, color: "#AABBCC" },
      { x: 0, y: 1, color: "#AABBCC" },
      { x: 1, y: 1, color: "#112233" },
    ]);
  });

  it("follows the pencil's documented negative-axis bias for even sizes", () => {
    expect(graffitiBrushStamp({ x: 2, y: 2 }, options({ brushSize: 2 }))).toEqual([
      { x: 1, y: 1, color: "#112233" },
      { x: 2, y: 1, color: "#AABBCC" },
      { x: 1, y: 2, color: "#AABBCC" },
      { x: 2, y: 2, color: "#112233" },
    ]);
  });

  it("preserves the checker pattern inside non-square brush shapes", () => {
    const pixels = graffitiBrushStamp(
      { x: 4, y: 4 },
      options({ brushSize: 5, brushShape: "diamond" }),
    );

    expect(pixels).toHaveLength(13);
    expect(pixels.every((pixel) =>
      pixel.color === ((pixel.x + pixel.y) % 2 === 0 ? "#112233" : "#AABBCC"),
    )).toBe(true);
  });

  it("gives the same canvas pixel one stable color across overlapping stamps", () => {
    const leftStamp = pixelMap(graffitiBrushStamp({ x: 4, y: 4 }, options()));
    const rightStamp = pixelMap(graffitiBrushStamp({ x: 5, y: 4 }, options()));

    for (const [coordinate, color] of leftStamp) {
      if (rightStamp.has(coordinate)) expect(rightStamp.get(coordinate)).toBe(color);
    }
  });
});

describe("graffiti checkerboard strokes", () => {
  it("interpolates fast pointer movement without event-sized gaps", () => {
    const result = graffitiBrushStroke(
      [{ x: 1, y: 3 }, { x: 8, y: 3 }],
      options({ brushSize: 1 }),
      createGraffitiGestureState(),
    );

    expect(result.pixels.map(({ x, y }) => ({ x, y }))).toEqual(
      Array.from({ length: 8 }, (_, index) => ({ x: index + 1, y: 3 })),
    );
    expect(result.state).toEqual({ lastPoint: { x: 8, y: 3 } });
  });

  it("produces the same pixels when a path arrives across separate events", () => {
    const brush = options({ brushSize: 3 });
    const initialState = createGraffitiGestureState();
    const singleCall = graffitiBrushStroke(
      [{ x: 2, y: 2 }, { x: 10, y: 5 }],
      brush,
      initialState,
    );

    const firstEvent = graffitiBrushStroke([{ x: 2, y: 2 }], brush, initialState);
    const secondEvent = graffitiBrushStroke([{ x: 10, y: 5 }], brush, firstEvent.state);

    expect(pixelMap([...firstEvent.pixels, ...secondEvent.pixels])).toEqual(
      pixelMap(singleCall.pixels),
    );
    expect(secondEvent.state).toEqual(singleCall.state);
  });

  it("deduplicates overlapping stamps within one stroke update", () => {
    const result = graffitiBrushStroke(
      [{ x: 4, y: 4 }, { x: 5, y: 4 }],
      options({ brushSize: 3 }),
      createGraffitiGestureState(),
    );
    const coordinates = result.pixels.map(({ x, y }) => `${x},${y}`);

    expect(new Set(coordinates).size).toBe(coordinates.length);
    expect(result.pixels).toHaveLength(12);
  });

  it("can enter the bounded canvas from a gesture that began outside it", () => {
    const first = graffitiBrushStroke(
      [{ x: -3, y: 1 }],
      options({ brushSize: 1, bounds: { width: 3, height: 3 } }),
      createGraffitiGestureState(),
    );
    const entered = graffitiBrushStroke(
      [{ x: 1, y: 1 }],
      options({ brushSize: 1, bounds: { width: 3, height: 3 } }),
      first.state,
    );

    expect(first.pixels).toEqual([]);
    expect(entered.pixels.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
  });

  it("does not mutate state and treats an empty event as a no-op", () => {
    const state = Object.freeze(createGraffitiGestureState());
    const result = graffitiBrushStroke([], options(), state);

    expect(result).toEqual({ pixels: [], state });
    expect(result.state).toBe(state);
  });
});
