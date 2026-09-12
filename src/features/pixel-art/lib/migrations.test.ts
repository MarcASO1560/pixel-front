import { describe, expect, it } from "vitest";

import {
  parsePixelArtResourceData,
  PixelArtMigrationError,
  serializePixelArtResourceData,
} from "./migrations";

describe("pixel-art migrations", () => {
  it("migrates a legacy flat resource into one v2 layer", () => {
    const result = parsePixelArtResourceData({
      pixel_art: {
        version: 1,
        width: 2,
        height: 1,
        palette: ["#ffffff"],
        pixels: ["#ffffff", null],
      },
    });

    expect(result.migrated).toBe(true);
    expect(result.document).toMatchObject({
      version: 2,
      width: 2,
      height: 1,
      palette: ["#FFFFFF"],
    });
    expect(result.document.layers[0]?.pixels).toEqual(["#FFFFFF", null]);
  });

  it("preserves legacy square documents that use size instead of width and height", () => {
    const pixels = ["#FF0000", null, "#00FF00", "#0000FF"];
    const result = parsePixelArtResourceData({
      pixel_art: {
        version: 1,
        size: 2,
        palette: ["#ff0000", "#00ff00", "#0000ff"],
        pixels,
      },
    });

    expect(result.migrated).toBe(true);
    expect(result.document.width).toBe(2);
    expect(result.document.height).toBe(2);
    expect(result.document.layers[0]?.pixels).toEqual([
      "#FF0000",
      null,
      "#00FF00",
      "#0000FF",
    ]);
  });

  it("preserves unversioned legacy square documents that use size", () => {
    const result = parsePixelArtResourceData({
      pixel_art: {
        size: 1,
        pixels: ["#12345678"],
      },
    });

    expect(result.document).toMatchObject({ width: 1, height: 1, version: 2 });
    expect(result.document.layers[0]?.pixels).toEqual(["#12345678"]);
  });

  it("rejects unknown stored versions instead of replacing them with a blank document", () => {
    expect(() =>
      parsePixelArtResourceData({
        pixel_art: { version: 3, width: 1, height: 1, layers: [] },
      }),
    ).toThrow(PixelArtMigrationError);

    try {
      parsePixelArtResourceData({ pixel_art: { version: 3 } });
    } catch (error) {
      expect(error).toMatchObject({
        code: "unsupported-version",
        name: "PixelArtMigrationError",
        version: 3,
      });
    }
  });

  it.each([
    {
      label: "missing layers",
      document: { version: 2, width: 1, height: 1, palette: [] },
    },
    {
      label: "empty layers",
      document: { version: 2, width: 1, height: 1, palette: [], layers: [] },
    },
    {
      label: "wrong pixel count",
      document: {
        version: 2,
        width: 2,
        height: 1,
        palette: [],
        layers: [
          {
            id: "layer-one",
            name: "Layer 1",
            visible: true,
            locked: false,
            opacity: 1,
            pixels: [null],
          },
        ],
      },
    },
  ])("rejects malformed v2 data with $label", ({ document }) => {
    expect(() => parsePixelArtResourceData({ pixel_art: document })).toThrow(
      PixelArtMigrationError,
    );
  });

  it("rejects a malformed pixel_art wrapper", () => {
    expect(() => parsePixelArtResourceData({ pixel_art: null })).toThrow(
      PixelArtMigrationError,
    );

    try {
      parsePixelArtResourceData({ pixel_art: null });
    } catch (error) {
      expect(error).toMatchObject({
        code: "invalid-document",
        name: "PixelArtMigrationError",
      });
    }
  });

  it("round-trips a v2 document while preserving sibling resource data", () => {
    const migrated = parsePixelArtResourceData({
      pixel_art: {
        version: 2,
        width: 1,
        height: 1,
        palette: [],
        layers: [
          {
            id: "layer-one",
            name: "Ink",
            visible: true,
            locked: false,
            opacity: 0.5,
            pixels: ["#FF000080"],
          },
        ],
      },
    });
    const serialized = serializePixelArtResourceData({ unrelated: true }, migrated.document);

    expect(migrated.migrated).toBe(false);
    expect(serialized).toMatchObject({ unrelated: true });
    expect(serialized.pixel_art.layers[0]).toEqual({
      id: "layer-one",
      name: "Ink",
      visible: true,
      locked: false,
      opacity: 0.5,
      pixels: ["#FF000080"],
    });
  });
});
