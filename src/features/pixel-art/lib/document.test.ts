import { describe, expect, it } from "vitest";

import {
  blendPixelColors,
  compositeVisibleLayers,
  createPixelArtDocument,
  normalizePalette,
  normalizePixelColor,
} from "./document";

describe("pixel-art document", () => {
  it("creates a valid document with one transparent layer", () => {
    const document = createPixelArtDocument(4, 3);

    expect(document.version).toBe(2);
    expect(document.layers).toHaveLength(1);
    expect(document.layers[0]?.pixels).toEqual(Array(12).fill(null));
  });

  it("normalizes RGB and RGBA colors and removes palette duplicates", () => {
    expect(normalizePixelColor("#aabbcc80")).toBe("#AABBCC80");
    expect(normalizePixelColor("red")).toBeNull();
    expect(normalizePalette(["#ffffff", "#FFFFFF", "bad", "#00000080"])).toEqual([
      "#FFFFFF",
      "#00000080",
    ]);
  });

  it("alpha-composites visible layers in their stored order", () => {
    const document = createPixelArtDocument(1, 1, {
      layers: [
        {
          id: "background",
          name: "Background",
          visible: true,
          locked: false,
          opacity: 1,
          pixels: ["#000000"],
        },
        {
          id: "foreground",
          name: "Foreground",
          visible: true,
          locked: false,
          opacity: 1,
          pixels: ["#FFFFFF80"],
        },
      ],
    });

    expect(blendPixelColors("#000000", "#FFFFFF80")).toBe("#808080");
    expect(compositeVisibleLayers(document)).toEqual(["#808080"]);

    document.layers[1]!.visible = false;
    expect(compositeVisibleLayers(document)).toEqual(["#000000"]);
  });
});
