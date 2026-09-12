import { describe, expect, it } from "vitest";

import type { ImageTool } from "../types";
import {
  canMutateImageLayerPixels,
  isImagePixelMutationTool,
} from "./layerEditing";

const PIXEL_PAINTING_TOOLS: ImageTool[] = [
  "pencil",
  "erase",
  "fill",
  "graffiti",
  "line",
  "rectangle",
  "ellipse",
  "move",
];

const NON_MUTATING_TOOLS: ImageTool[] = ["picker", "select"];

describe("image layer painting policy", () => {
  it.each(PIXEL_PAINTING_TOOLS)("classifies %s as a pixel mutation tool", (tool) => {
    expect(isImagePixelMutationTool(tool)).toBe(true);
  });

  it.each(NON_MUTATING_TOOLS)("keeps %s available without pixel mutation", (tool) => {
    expect(isImagePixelMutationTool(tool)).toBe(false);
  });

  it.each(PIXEL_PAINTING_TOOLS)(
    "prevents %s from painting an invisible active layer",
    () => {
      expect(canMutateImageLayerPixels({ visible: false, locked: false })).toBe(false);
    },
  );

  it.each(PIXEL_PAINTING_TOOLS)(
    "allows %s on a visible, unlocked active layer",
    () => {
      expect(canMutateImageLayerPixels({ visible: true, locked: false })).toBe(true);
    },
  );

  it("also prevents painting a locked layer, regardless of visibility", () => {
    expect(canMutateImageLayerPixels({ visible: true, locked: true })).toBe(false);
    expect(canMutateImageLayerPixels({ visible: false, locked: true })).toBe(false);
  });

  it("fails closed when there is no active layer", () => {
    expect(canMutateImageLayerPixels(null)).toBe(false);
    expect(canMutateImageLayerPixels(undefined)).toBe(false);
  });

  it("does not require mutating a hidden layer before it can become paintable", () => {
    const layer = { visible: false, locked: false };

    expect(canMutateImageLayerPixels(layer)).toBe(false);

    // Selecting the layer and toggling its panel control remain separate actions.
    const madeVisible = { ...layer, visible: true };
    expect(canMutateImageLayerPixels(madeVisible)).toBe(true);
  });
});
