import { describe, expect, it } from "vitest";

import { createPixelArtDocument } from "./document";
import { resizePixelArtDocument } from "./resize";

describe("pixel-art resize", () => {
  it("resizes every layer using the requested anchor", () => {
    const document = createPixelArtDocument(2, 1, {
      layers: [
        {
          id: "one",
          name: "One",
          visible: true,
          locked: false,
          opacity: 1,
          pixels: ["#FF0000", "#00FF00"],
        },
        {
          id: "two",
          name: "Two",
          visible: true,
          locked: false,
          opacity: 1,
          pixels: [null, "#0000FF"],
        },
      ],
    });

    const resized = resizePixelArtDocument(document, 3, 2, "bottom-right");

    expect(resized.layers[0]?.pixels).toEqual([
      null,
      null,
      null,
      null,
      "#FF0000",
      "#00FF00",
    ]);
    expect(resized.layers[1]?.pixels).toEqual([null, null, null, null, null, "#0000FF"]);
  });

  it("does not mutate the source document", () => {
    const document = createPixelArtDocument(1, 1);
    const resized = resizePixelArtDocument(document, 2, 2, "top-left");

    expect(document.width).toBe(1);
    expect(document.layers[0]?.pixels).toHaveLength(1);
    expect(resized.layers[0]?.pixels).toHaveLength(4);
  });
});
