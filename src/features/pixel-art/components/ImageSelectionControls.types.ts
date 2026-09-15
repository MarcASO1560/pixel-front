import type {
  ImageSelectionKind,
  ImageSelectionMode as SharedImageSelectionMode,
} from "../types";

export const IMAGE_SELECTION_TOOLS = [
  "rectangle",
  "lasso",
  "wand",
] as const satisfies ReadonlyArray<ImageSelectionKind>;

export type ImageSelectionTool = ImageSelectionKind;

export const IMAGE_SELECTION_MODES = [
  "replace",
  "add",
  "subtract",
  "intersect",
] as const satisfies ReadonlyArray<SharedImageSelectionMode>;

export type ImageSelectionMode = SharedImageSelectionMode;
