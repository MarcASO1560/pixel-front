import type { PixelLayer } from "../types";
import { normalizePixelColor } from "./document";

export const PIXEL_ART_WHITE = "#ffffff";
export const PIXEL_ART_GOLD = "#e8ca7a";
export const PIXEL_ART_CORAL = "#e18464";

export const PIXEL_ART_PASTEL_PALETTE = [
  PIXEL_ART_WHITE,
  "#f7f1e7",
  "#e8dcc3",
  PIXEL_ART_GOLD,
  "#f6d56f",
  "#ffc6a5",
  PIXEL_ART_CORAL,
  "#f7b7c8",
  "#ef9fc8",
  "#e4a8e8",
  "#d7b9f3",
  "#9c79bb",
  "#b8d8ff",
  "#afe7ef",
  "#bdebd7",
  "#c9e7b8",
] as const;

export const PIXEL_ART_PALETTE = [
  ...PIXEL_ART_PASTEL_PALETTE,
  "#5c6461",
  "#1b1d1c",
];

export type PinnedPaletteColor = Readonly<{
  id: string;
  color: string;
  name?: string;
}>;

export type PixelArtPaletteModel = Readonly<{
  usedColors: readonly string[];
  pinnedColors: readonly PinnedPaletteColor[];
}>;

export type LegacyPaletteMigrationResult = Readonly<{
  pinnedColors: readonly PinnedPaletteColor[];
  importedColors: readonly PinnedPaletteColor[];
  changed: boolean;
}>;

export type PinnedPaletteColorInput = Readonly<{
  id?: string;
  color: string;
  name?: string | null;
}>;

export type PinnedPaletteColorPatch = Readonly<{
  color?: string;
  name?: string | null;
}>;

type UntrustedPinnedPaletteColorInput = Readonly<{
  id?: unknown;
  color: unknown;
  name?: unknown;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizePinnedPaletteColorName = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim() || undefined;
};

const normalizePinnedPaletteColorId = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const createPinnedPaletteColorId = (color: string, usedIds: ReadonlySet<string>) => {
  const baseId = `color-${color.slice(1).toLowerCase()}`;
  let id = baseId;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return id;
};

const buildPinnedPaletteColor = (
  input: UntrustedPinnedPaletteColorInput,
  usedIds: ReadonlySet<string>,
): PinnedPaletteColor | null => {
  const color = normalizePixelColor(input.color);
  if (!color) {
    return null;
  }

  const requestedId = normalizePinnedPaletteColorId(input.id);
  const id =
    requestedId && !usedIds.has(requestedId)
      ? requestedId
      : createPinnedPaletteColorId(color, usedIds);
  const name = normalizePinnedPaletteColorName(input.name);

  return name ? { id, color, name } : { id, color };
};

/**
 * Returns every color stored by the document, irrespective of layer visibility,
 * lock state or opacity. Order is stable: layer order first, then pixel order.
 */
export const deriveUsedPaletteColors = (
  layers: readonly Pick<PixelLayer, "pixels">[],
) => {
  const colors: string[] = [];
  const seen = new Set<string>();

  for (const layer of layers) {
    for (const pixel of layer.pixels) {
      const color = normalizePixelColor(pixel);
      if (color && !seen.has(color)) {
        seen.add(color);
        colors.push(color);
      }
    }
  }

  return colors;
};

/**
 * Repairs persisted personal colors without mutating the source. Invalid colors
 * are ignored, duplicate colors keep their first occurrence and duplicate ids
 * receive a deterministic replacement.
 */
export const normalizePinnedPaletteColors = (value: unknown): PinnedPaletteColor[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const colors: PinnedPaletteColor[] = [];
  const seenColors = new Set<string>();
  const usedIds = new Set<string>();

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const normalized = buildPinnedPaletteColor(
      { id: entry.id, color: entry.color, name: entry.name },
      usedIds,
    );
    if (!normalized || seenColors.has(normalized.color)) {
      continue;
    }

    seenColors.add(normalized.color);
    usedIds.add(normalized.id);
    colors.push(normalized);
  }

  return colors;
};

export const addPinnedPaletteColor = (
  palette: readonly PinnedPaletteColor[],
  input: PinnedPaletteColorInput,
) => {
  const colors = normalizePinnedPaletteColors(palette);
  const seenColors = new Set(colors.map(({ color }) => color));
  const usedIds = new Set(colors.map(({ id }) => id));
  const candidate = buildPinnedPaletteColor(input, usedIds);

  if (!candidate || seenColors.has(candidate.color)) {
    return colors;
  }

  return [...colors, candidate];
};

export const editPinnedPaletteColor = (
  palette: readonly PinnedPaletteColor[],
  id: string,
  patch: PinnedPaletteColorPatch,
) => {
  const colors = normalizePinnedPaletteColors(palette);
  const normalizedId = normalizePinnedPaletteColorId(id);
  const target = colors.find((entry) => entry.id === normalizedId);
  if (!target) {
    return colors;
  }

  const hasColorPatch = Object.prototype.hasOwnProperty.call(patch, "color");
  const color = hasColorPatch ? normalizePixelColor(patch.color) : target.color;
  if (!color) {
    return colors;
  }

  // A personal palette cannot contain the same color twice. Editing one saved
  // entry must never resolve that conflict by silently deleting the other one.
  if (
    hasColorPatch &&
    colors.some((entry) => entry.id !== target.id && entry.color === color)
  ) {
    return colors;
  }

  const hasNamePatch = Object.prototype.hasOwnProperty.call(patch, "name");
  const name = hasNamePatch ? normalizePinnedPaletteColorName(patch.name) : target.name;
  const edited: PinnedPaletteColor = name
    ? { id: target.id, color, name }
    : { id: target.id, color };

  return colors.map((entry) => (entry.id === target.id ? edited : entry));
};

export const deletePinnedPaletteColor = (
  palette: readonly PinnedPaletteColor[],
  id: string,
) => {
  const normalizedId = normalizePinnedPaletteColorId(id);

  return normalizePinnedPaletteColors(palette).filter(
    (entry) => entry.id !== normalizedId,
  );
};

export const createPixelArtPaletteModel = ({
  layers,
  pinnedColors,
}: {
  layers: readonly Pick<PixelLayer, "pixels">[];
  pinnedColors: unknown;
}): PixelArtPaletteModel => ({
  usedColors: deriveUsedPaletteColors(layers),
  pinnedColors: normalizePinnedPaletteColors(pinnedColors),
});

/**
 * Promotes the old document-level `palette: string[]` into personal pinned
 * entries. Existing personal entries win on duplicates and generated ids are
 * deterministic, making repeated migrations idempotent.
 */
export const migrateLegacyPalette = ({
  legacyPalette,
  pinnedColors = [],
}: {
  legacyPalette: unknown;
  pinnedColors?: unknown;
}): LegacyPaletteMigrationResult => {
  const existing = normalizePinnedPaletteColors(pinnedColors);
  if (!Array.isArray(legacyPalette)) {
    return { pinnedColors: existing, importedColors: [], changed: false };
  }

  let merged = existing;
  const importedColors: PinnedPaletteColor[] = [];

  for (const legacyColor of legacyPalette) {
    const color = normalizePixelColor(legacyColor);
    if (!color) {
      continue;
    }

    const beforeIds = new Set(merged.map(({ id }) => id));
    const next = addPinnedPaletteColor(merged, { color });
    const imported = next.find(({ id }) => !beforeIds.has(id));
    if (imported) {
      importedColors.push(imported);
      merged = next;
    }
  }

  return {
    pinnedColors: merged,
    importedColors,
    changed: importedColors.length > 0,
  };
};
