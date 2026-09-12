import { afterEach, describe, expect, it, vi } from "vitest";

import type { PixelArtDocumentV2 } from "../types";
import {
  PixelArtImportError,
  RasterImageTooLargeError,
  calculateRasterFitDimensions,
  exportPixelArtJson,
  exportPixelArtJsonBlob,
  exportPixelArtPng,
  importPixelArtJson,
  importRasterImage,
  importRasterImageReduced,
  parsePixelArtJson,
  parsePixelArtJsonValue,
  resizeDecodedRasterNearestNeighbor,
  rgbaBytesToPixelColors,
  sanitizeImageFileName,
} from "./importExport";

const documentV2: PixelArtDocumentV2 = {
  version: 2,
  width: 2,
  height: 1,
  palette: ["#FF0000", "#00FF0080"],
  layers: [
    {
      id: "base",
      name: "Base",
      visible: true,
      locked: false,
      opacity: 1,
      pixels: ["#FF0000", null],
    },
    {
      id: "highlight",
      name: "Highlight",
      visible: false,
      locked: true,
      opacity: 0.5,
      pixels: [null, "#00FF0080"],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sanitizeImageFileName", () => {
  it("creates a portable base name and strips known extensions", () => {
    expect(sanitizeImageFileName("  Héroe: Idle / Norte.PNG  ")).toBe("heroe-idle-norte");
    expect(sanitizeImageFileName("CON.json")).toBe("con-image");
    expect(sanitizeImageFileName("***", "Untitled image")).toBe("untitled-image");
  });
});

describe("pixel-art JSON", () => {
  it("exports a native wrapper and imports it without losing layers", async () => {
    const json = exportPixelArtJson(documentV2);
    const parsedJson = JSON.parse(json) as { pixel_art: PixelArtDocumentV2 };

    expect(parsedJson).toEqual({ pixel_art: documentV2 });
    await expect(importPixelArtJson(new Blob([json]))).resolves.toEqual(documentV2);

    const blob = exportPixelArtJsonBlob(documentV2, { pretty: false });
    expect(blob.type).toBe("application/json");
    expect(await blob.text()).toBe(JSON.stringify({ pixel_art: documentV2 }));
  });

  it("accepts direct v1 data and migrates it to one normalized v2 layer", () => {
    const imported = parsePixelArtJson(
      JSON.stringify({
        version: 1,
        size: 2,
        palette: ["#ffffff", "#12345678"],
        pixels: ["#ffffff", null, "#12345678", null],
      }),
    );

    expect(imported).toMatchObject({
      version: 2,
      width: 2,
      height: 2,
      palette: ["#FFFFFF", "#12345678"],
    });
    expect(imported.layers).toHaveLength(1);
    expect(imported.layers[0]).toMatchObject({
      name: "Layer 1",
      visible: true,
      locked: false,
      opacity: 1,
      pixels: ["#FFFFFF", null, "#12345678", null],
    });
  });

  it("accepts API-shaped data.pixel_art and resource-data pixel_art wrappers", () => {
    expect(parsePixelArtJsonValue({ data: { pixel_art: documentV2 } })).toEqual(documentV2);
    expect(parsePixelArtJsonValue({ pixel_art: documentV2 })).toEqual(documentV2);
  });

  it.each([
    ["malformed JSON", "{"],
    ["unrelated JSON", JSON.stringify({ width: 2, height: 2, pixels: [] })],
    ["unsupported version", JSON.stringify({ version: 3, width: 1, height: 1 })],
    [
      "wrong pixel count",
      JSON.stringify({
        ...documentV2,
        layers: [{ ...documentV2.layers[0], pixels: [] }],
      }),
    ],
    [
      "invalid pixel color",
      JSON.stringify({
        ...documentV2,
        layers: [{ ...documentV2.layers[0], pixels: ["red", null] }],
      }),
    ],
  ])("rejects %s", (_label, json) => {
    expect(() => parsePixelArtJson(json)).toThrow(PixelArtImportError);
  });
});

describe("raster import", () => {
  it("calculates proportional fit geometry for wide and tall rasters", () => {
    expect(calculateRasterFitDimensions(1024, 512)).toEqual({
      width: 256,
      height: 128,
      scale: 0.25,
    });
    expect(calculateRasterFitDimensions(200, 300)).toEqual({
      width: 171,
      height: 256,
      scale: 256 / 300,
    });
    expect(calculateRasterFitDimensions(1, 1000)).toEqual({
      width: 1,
      height: 256,
      scale: 0.256,
    });
  });

  it("does not upscale a raster that already fits", () => {
    const source = {
      width: 120,
      height: 80,
      data: new Uint8ClampedArray(120 * 80 * 4),
    };

    expect(calculateRasterFitDimensions(source.width, source.height)).toEqual({
      width: 120,
      height: 80,
      scale: 1,
    });
    expect(resizeDecodedRasterNearestNeighbor(source)).toBe(source);
  });

  it("resamples RGBA pixels with nearest-neighbor geometry", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let index = 0; index < 16; index += 1) {
      data[index * 4] = index;
      data[index * 4 + 1] = 100 + index;
      data[index * 4 + 2] = 200 + index;
      data[index * 4 + 3] = index === 10 ? 128 : 255;
    }

    const resized = resizeDecodedRasterNearestNeighbor(
      { data, width: 4, height: 4 },
      2,
    );

    expect(resized.width).toBe(2);
    expect(resized.height).toBe(2);
    expect(Array.from(resized.data)).toEqual([
      0, 100, 200, 255,
      2, 102, 202, 255,
      8, 108, 208, 255,
      10, 110, 210, 128,
    ]);
  });

  it("maps RGBA bytes to null, RGB, and RGBA pixel colors", () => {
    expect(
      rgbaBytesToPixelColors(
        new Uint8ClampedArray([
          8, 9, 10, 0,
          255, 0, 16, 255,
          18, 52, 86, 128,
        ]),
        3,
        1,
      ),
    ).toEqual([null, "#FF0010", "#12345680"]);
  });

  it("imports PNG/JPEG/WebP decoder output as a one-layer v2 document", async () => {
    for (const mimeType of ["image/png", "image/jpeg", "image/webp"]) {
      const decoder = vi.fn(async () => ({
        width: 2,
        height: 1,
        data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 64]),
      }));
      const imported = await importRasterImage(new Blob([mimeType], { type: mimeType }), {
        decoder,
        layerName: "Imported",
      });

      expect(decoder).toHaveBeenCalledOnce();
      expect(imported).toMatchObject({ version: 2, width: 2, height: 1, palette: [] });
      expect(imported.layers[0]).toMatchObject({
        name: "Imported",
        pixels: ["#FF0000", "#00FF0040"],
      });
    }
  });

  it("reports oversized images without silently resizing them", async () => {
    const decoder = vi.fn(async () => ({
      width: 257,
      height: 32,
      data: new Uint8ClampedArray(0),
    }));

    await expect(
      importRasterImage(new Blob([], { type: "image/png" }), { decoder }),
    ).rejects.toMatchObject({
      code: "image-too-large",
      width: 257,
      height: 32,
      maxDimension: 256,
    });
    await expect(
      importRasterImage(new Blob([], { type: "image/png" }), { decoder }),
    ).rejects.toBeInstanceOf(RasterImageTooLargeError);
  });

  it("imports an oversized raster through the explicit proportional reduction path", async () => {
    const data = new Uint8ClampedArray(300 * 150 * 4);
    data.set([17, 34, 51, 128], 0);
    const decoder = vi.fn(async () => ({ width: 300, height: 150, data }));

    const imported = await importRasterImageReduced(
      new Blob([], { type: "image/webp" }),
      { decoder, layerName: "Reduced image" },
    );

    expect(decoder).toHaveBeenCalledOnce();
    expect(imported.width).toBe(256);
    expect(imported.height).toBe(128);
    expect(imported.layers[0].name).toBe("Reduced image");
    expect(imported.layers[0].pixels).toHaveLength(256 * 128);
    expect(imported.layers[0].pixels[0]).toBe("#11223380");
  });

  it("rejects unsupported file types before decoding", async () => {
    const decoder = vi.fn();

    await expect(
      importRasterImage(new Blob([], { type: "image/gif" }), { decoder }),
    ).rejects.toMatchObject({ code: "unsupported-file-type" });
    expect(decoder).not.toHaveBeenCalled();
  });
});

describe("PNG export", () => {
  it("composites visible layers at integer scale with smoothing disabled", async () => {
    const fillCalls: Array<{ color: string; x: number; y: number; width: number; height: number }> = [];
    const context = {
      imageSmoothingEnabled: true,
      fillStyle: "",
      clearRect: vi.fn(),
      fillRect: vi.fn(function (
        this: { fillStyle: string },
        x: number,
        y: number,
        width: number,
        height: number,
      ) {
        fillCalls.push({ color: this.fillStyle, x, y, width, height });
      }),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback) => {
        callback(new Blob(["encoded"], { type: "image/png" }));
      }),
    };
    vi.stubGlobal("document", {
      createElement: vi.fn(() => canvas),
    });

    const blob = await exportPixelArtPng(documentV2, { scale: 4 });

    expect(canvas.width).toBe(8);
    expect(canvas.height).toBe(4);
    expect(context.imageSmoothingEnabled).toBe(false);
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 8, 4);
    expect(fillCalls).toEqual([{ color: "#FF0000", x: 0, y: 0, width: 4, height: 4 }]);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");
    expect(blob.type).toBe("image/png");
  });

  it("fills an opaque background before drawing composed pixels", async () => {
    const fillCalls: Array<{ color: string; width: number; height: number }> = [];
    const context = {
      imageSmoothingEnabled: true,
      fillStyle: "",
      clearRect: vi.fn(),
      fillRect: vi.fn(function (
        this: { fillStyle: string },
        _x: number,
        _y: number,
        width: number,
        height: number,
      ) {
        fillCalls.push({ color: this.fillStyle, width, height });
      }),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback) => callback(new Blob([], { type: "image/png" }))),
    };
    vi.stubGlobal("document", {
      createElement: vi.fn(() => canvas),
    });

    await exportPixelArtPng(documentV2, { backgroundColor: "#123456", scale: 2 });

    expect(fillCalls[0]).toEqual({ color: "#123456", width: 4, height: 2 });
    expect(fillCalls[1]).toEqual({ color: "#FF0000", width: 2, height: 2 });
  });

  it("rejects non-integer export scales and invalid background colors", async () => {
    await expect(
      exportPixelArtPng(documentV2, { scale: 3 as never }),
    ).rejects.toThrow(RangeError);
    await expect(
      exportPixelArtPng(documentV2, { backgroundColor: "red" }),
    ).rejects.toThrow(RangeError);
  });
});
