import { describe, expect, it } from "vitest";

import type { PixelLayer } from "../types";
import {
  addPinnedPaletteColor,
  createPixelArtPaletteModel,
  deletePinnedPaletteColor,
  deriveUsedPaletteColors,
  editPinnedPaletteColor,
  migrateLegacyPalette,
  normalizePinnedPaletteColors,
  type PinnedPaletteColor,
} from "./palette";

describe("deriveUsedPaletteColors", () => {
  it("derives normalized unique colors from every layer in stable document order", () => {
    const layers: PixelLayer[] = [
      {
        id: "visible",
        name: "Visible",
        visible: true,
        locked: false,
        opacity: 1,
        pixels: ["#ffffff", null, "#112233", "#FFFFFF"],
      },
      {
        id: "hidden",
        name: "Hidden",
        visible: false,
        locked: true,
        opacity: 0,
        pixels: ["#11223380", "#112233", "invalid", null],
      },
    ];

    expect(deriveUsedPaletteColors(layers)).toEqual([
      "#FFFFFF",
      "#112233",
      "#11223380",
    ]);
  });

  it("returns an empty palette for layers without valid stored colors", () => {
    expect(deriveUsedPaletteColors([{ pixels: [null, "nope"] }])).toEqual([]);
  });
});

describe("personal pinned palette colors", () => {
  it("normalizes persisted entries, optional names, duplicate colors and ids", () => {
    expect(
      normalizePinnedPaletteColors([
        { id: " first ", color: "#aabbcc", name: "  Ocean  " },
        { id: "first", color: "#001122" },
        { id: "duplicate-color", color: "#AABBCC", name: "Ignored" },
        { id: "blank-name", color: "#123456", name: "   " },
        { id: "invalid", color: "red" },
        null,
      ]),
    ).toEqual([
      { id: "first", color: "#AABBCC", name: "Ocean" },
      { id: "color-001122", color: "#001122" },
      { id: "blank-name", color: "#123456" },
    ]);
  });

  it("adds a color with a deterministic id and refuses color duplicates", () => {
    const source: PinnedPaletteColor[] = [
      { id: "favorite", color: "#FFFFFF", name: "Paper" },
    ];

    const added = addPinnedPaletteColor(source, {
      color: "#00000080",
      name: "  Shadow  ",
    });
    const duplicate = addPinnedPaletteColor(added, {
      id: "another-white",
      color: "#ffffff",
    });

    expect(added).toEqual([
      { id: "favorite", color: "#FFFFFF", name: "Paper" },
      { id: "color-00000080", color: "#00000080", name: "Shadow" },
    ]);
    expect(duplicate).toEqual(added);
    expect(source).toEqual([{ id: "favorite", color: "#FFFFFF", name: "Paper" }]);
  });

  it("keeps both saved entries and rejects an edit that collides with another color", () => {
    const source: PinnedPaletteColor[] = [
      { id: "red", color: "#FF0000", name: "Red" },
      { id: "blue", color: "#0000FF", name: "Blue" },
    ];

    expect(
      editPinnedPaletteColor(source, "blue", {
        color: "#ff0000",
        name: "  Merged  ",
      }),
    ).toEqual(source);
    expect(source).toEqual([
      { id: "red", color: "#FF0000", name: "Red" },
      { id: "blue", color: "#0000FF", name: "Blue" },
    ]);
    expect(editPinnedPaletteColor(source, "red", { name: "" })).toEqual([
      { id: "red", color: "#FF0000" },
      { id: "blue", color: "#0000FF", name: "Blue" },
    ]);
    expect(
      editPinnedPaletteColor(source, "blue", {
        color: "#00ff00",
        name: "  Green  ",
      }),
    ).toEqual([
      { id: "red", color: "#FF0000", name: "Red" },
      { id: "blue", color: "#00FF00", name: "Green" },
    ]);
    expect(editPinnedPaletteColor(source, "missing", { color: "#00FF00" })).toEqual(
      source,
    );
    expect(editPinnedPaletteColor(source, "red", { color: "invalid" })).toEqual(source);
  });

  it("deletes by stable identity without mutating the source", () => {
    const source: PinnedPaletteColor[] = [
      { id: "white", color: "#FFFFFF" },
      { id: "black", color: "#000000" },
    ];

    expect(deletePinnedPaletteColor(source, " white ")).toEqual([
      { id: "black", color: "#000000" },
    ]);
    expect(source).toHaveLength(2);
  });
});

describe("legacy document palette migration", () => {
  it("merges legacy strings into personal pins while existing pins win", () => {
    const result = migrateLegacyPalette({
      pinnedColors: [
        { id: "favorite", color: "#FFFFFF", name: "Paper" },
        { id: "color-000000", color: "#123456" },
      ],
      legacyPalette: [
        "#ffffff",
        "#000000",
        "#000000",
        "invalid",
        "#ff00ff80",
      ],
    });

    expect(result).toEqual({
      pinnedColors: [
        { id: "favorite", color: "#FFFFFF", name: "Paper" },
        { id: "color-000000", color: "#123456" },
        { id: "color-000000-2", color: "#000000" },
        { id: "color-ff00ff80", color: "#FF00FF80" },
      ],
      importedColors: [
        { id: "color-000000-2", color: "#000000" },
        { id: "color-ff00ff80", color: "#FF00FF80" },
      ],
      changed: true,
    });
  });

  it("is idempotent and reports no change when legacy colors are already pinned", () => {
    const first = migrateLegacyPalette({
      legacyPalette: ["#abcdef", "#123456"],
    });
    const second = migrateLegacyPalette({
      pinnedColors: first.pinnedColors,
      legacyPalette: ["#ABCDEF", "#123456"],
    });

    expect(second.pinnedColors).toEqual(first.pinnedColors);
    expect(second.importedColors).toEqual([]);
    expect(second.changed).toBe(false);
  });

  it("does not treat malformed legacy data as a migration", () => {
    expect(
      migrateLegacyPalette({
        pinnedColors: [{ id: "white", color: "#ffffff" }],
        legacyPalette: { color: "#000000" },
      }),
    ).toEqual({
      pinnedColors: [{ id: "white", color: "#FFFFFF" }],
      importedColors: [],
      changed: false,
    });
  });
});

describe("createPixelArtPaletteModel", () => {
  it("keeps derived document colors separate from personal pinned colors", () => {
    expect(
      createPixelArtPaletteModel({
        layers: [{ pixels: ["#112233", "#ffffff", "#112233"] }],
        pinnedColors: [
          { id: "white", color: "#FFFFFF", name: "Paper" },
          { id: "accent", color: "#abcdef" },
        ],
      }),
    ).toEqual({
      usedColors: ["#112233", "#FFFFFF"],
      pinnedColors: [
        { id: "white", color: "#FFFFFF", name: "Paper" },
        { id: "accent", color: "#ABCDEF" },
      ],
    });
  });
});
