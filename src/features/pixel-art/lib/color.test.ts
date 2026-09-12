import { describe, expect, it } from "vitest";

import {
  imageColorInputRgb,
  isCompleteImageColor,
  normalizeImageColor,
  normalizeImageColorDraft,
  removeImagePaletteColor,
  replaceImageColorRgb,
} from "./color";

describe("pixel-art UI colors", () => {
  it("accepts and normalizes complete RGB and RGBA values", () => {
    expect(normalizeImageColorDraft(" #aabbcc80 ")).toBe("#AABBCC80");
    expect(isCompleteImageColor("#AABBCC")).toBe(true);
    expect(isCompleteImageColor("#AABBCC80")).toBe(true);
    expect(isCompleteImageColor("#AABBCC8")).toBe(false);
    expect(normalizeImageColor("#aabbcc80", "#FFFFFF")).toBe("#AABBCC80");
  });

  it("uses the RGB portion in native color inputs and preserves the current alpha", () => {
    expect(imageColorInputRgb("#11223380", "#FFFFFF")).toBe("#112233");
    expect(replaceImageColorRgb("#445566", "#11223380", "#FFFFFF")).toBe("#44556680");
    expect(replaceImageColorRgb("#445566", "#112233", "#FFFFFF")).toBe("#445566");
  });

  it("removes an RGBA palette entry without removing the matching opaque RGB color", () => {
    expect(removeImagePaletteColor(["#112233", "#11223380", "#AABBCCFF"], "#11223380")).toEqual([
      "#112233",
      "#AABBCCFF",
    ]);
    expect(removeImagePaletteColor(["#11223380"], "not-a-color")).toEqual(["#11223380"]);
  });
});
