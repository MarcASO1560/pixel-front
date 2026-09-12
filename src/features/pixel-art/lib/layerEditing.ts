import type { ImageTool, PixelLayer } from "../types";

export type ImageLayerPixelState = Pick<PixelLayer, "locked" | "visible">;

const IMAGE_PIXEL_MUTATION_TOOLS: ReadonlySet<ImageTool> = new Set([
  "pencil",
  "graffiti",
  "erase",
  "fill",
  "line",
  "rectangle",
  "ellipse",
  "move",
]);

export const isImagePixelMutationTool = (tool: ImageTool) =>
  IMAGE_PIXEL_MUTATION_TOOLS.has(tool);

/**
 * Pixel-producing tools may only mutate a layer that the user can currently see.
 *
 * Layer-panel actions deliberately do not use this guard: a hidden layer must
 * remain selectable so the user can make it visible again.
 */
export const canMutateImageLayerPixels = (
  layer: ImageLayerPixelState | null | undefined,
): boolean => Boolean(layer?.visible && !layer.locked);
