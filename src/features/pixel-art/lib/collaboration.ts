import type { ProjectEditorActivity } from "../../../lib/realtime";
import type { ImageSelection, PixelArtDocumentV2, PixelColor, PixelLayer } from "../types";
import { parsePixelArtResourceData, PixelArtMigrationError } from "./migrations";
import { PIXEL_ART_PASTEL_PALETTE } from "./palette";

export type CollaborativeCursor = Readonly<{
  height: number;
  tool: string;
  visible: boolean;
  width: number;
  x: number;
  y: number;
}>;

export type CollaborativePixelPatch = Readonly<{
  changes: ReadonlyArray<readonly [number, PixelColor]>;
  height: number;
  layerId: string;
  width: number;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isDimension = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 256;

const isPixelColor = (value: unknown): value is PixelColor =>
  value === null || (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value));

export const readCollaborativeCursor = (
  activity: ProjectEditorActivity,
): CollaborativeCursor | null => {
  const payload = activity.payload;
  if (
    activity.kind !== "cursor" ||
    !isDimension(payload.width) ||
    !isDimension(payload.height) ||
    typeof payload.visible !== "boolean" ||
    typeof payload.tool !== "string"
  ) {
    return null;
  }

  if (!payload.visible) {
    return {
      height: payload.height,
      tool: payload.tool,
      visible: false,
      width: payload.width,
      x: 0,
      y: 0,
    };
  }

  if (
    typeof payload.x !== "number" ||
    !Number.isFinite(payload.x) ||
    typeof payload.y !== "number" ||
    !Number.isFinite(payload.y) ||
    Math.abs(payload.x) > 100000 ||
    Math.abs(payload.y) > 100000
  ) {
    return null;
  }

  return {
    height: payload.height,
    tool: payload.tool,
    visible: true,
    width: payload.width,
    x: payload.x,
    y: payload.y,
  };
};

export const readCollaborativePixelPatch = (
  activity: ProjectEditorActivity,
): CollaborativePixelPatch | null => {
  const payload = activity.payload;
  if (
    activity.kind !== "pixels" ||
    typeof payload.layer_id !== "string" ||
    !payload.layer_id ||
    !isDimension(payload.width) ||
    !isDimension(payload.height) ||
    !Array.isArray(payload.changes)
  ) {
    return null;
  }

  const pixelCount = payload.width * payload.height;
  const changes: Array<readonly [number, PixelColor]> = [];
  for (const change of payload.changes) {
    if (
      !Array.isArray(change) ||
      change.length !== 2 ||
      typeof change[0] !== "number" ||
      !Number.isInteger(change[0]) ||
      change[0] < 0 ||
      change[0] >= pixelCount ||
      !isPixelColor(change[1])
    ) {
      return null;
    }
    changes.push([change[0], change[1]]);
  }

  return {
    changes,
    height: payload.height,
    layerId: payload.layer_id,
    width: payload.width,
  };
};

export const applyCollaborativePixelPatch = (
  layers: ReadonlyArray<PixelLayer>,
  patch: CollaborativePixelPatch,
  width: number,
  height: number,
): PixelLayer[] | null => {
  if (patch.width !== width || patch.height !== height || patch.changes.length === 0) {
    return null;
  }

  const layerIndex = layers.findIndex((layer) => layer.id === patch.layerId);
  if (layerIndex < 0) return null;

  const layer = layers[layerIndex];
  if (!layer) return null;
  const pixels = [...layer.pixels];
  let changed = false;
  for (const [index, color] of patch.changes) {
    if (pixels[index] === color) continue;
    pixels[index] = color;
    changed = true;
  }
  if (!changed) return null;

  const nextLayers = [...layers];
  nextLayers[layerIndex] = { ...layer, pixels };
  return nextLayers;
};

export const readCollaborativeDocument = (
  activity: ProjectEditorActivity,
): PixelArtDocumentV2 | null => {
  if (activity.kind !== "document" || !isRecord(activity.payload.document)) {
    return null;
  }

  try {
    return parsePixelArtResourceData({ pixel_art: activity.payload.document }).document;
  } catch (error) {
    if (error instanceof PixelArtMigrationError) return null;
    throw error;
  }
};

export const readCollaborativeSelection = (
  activity: ProjectEditorActivity,
): ImageSelection | null | undefined => {
  if (activity.kind !== "selection") return undefined;
  const selection = activity.payload.selection;
  if (selection === null) return null;
  if (
    !isRecord(selection) ||
    ![selection.x, selection.y, selection.width, selection.height].every(
      (value) => typeof value === "number" && Number.isInteger(value),
    ) ||
    (selection.width as number) <= 0 ||
    (selection.height as number) <= 0
  ) {
    return undefined;
  }

  return {
    height: selection.height as number,
    width: selection.width as number,
    x: selection.x as number,
    y: selection.y as number,
  };
};

export const collaboratorColor = (identity: string) => {
  let hash = 0;
  for (const character of identity) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return (
    PIXEL_ART_PASTEL_PALETTE[hash % PIXEL_ART_PASTEL_PALETTE.length] ||
    PIXEL_ART_PASTEL_PALETTE[0]
  );
};
