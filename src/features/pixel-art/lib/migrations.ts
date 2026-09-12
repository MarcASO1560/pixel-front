import {
  createPixelArtDocument,
  createPixelLayer,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_LAYERS,
  MIN_IMAGE_DIMENSION,
  normalizePixelColor,
  normalizePalette,
} from "./document";
import type { PixelArtDocumentV2 } from "../types";

export type PixelArtParseResult = {
  document: PixelArtDocumentV2;
  migrated: boolean;
  warnings: string[];
};

export type PixelArtMigrationErrorCode =
  | "invalid-document"
  | "unsupported-version";

/**
 * Signals resource data that cannot be migrated without risking data loss.
 * Callers should stop editing and surface this error instead of substituting a
 * blank document.
 */
export class PixelArtMigrationError extends Error {
  readonly code: PixelArtMigrationErrorCode;
  readonly version: unknown;

  constructor(
    code: PixelArtMigrationErrorCode,
    message: string,
    options: { version?: unknown } = {},
  ) {
    super(message);
    this.name = "PixelArtMigrationError";
    this.code = code;
    this.version = options.version;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const readPayload = (value: unknown) => {
  if (!isRecord(value)) {
    return {};
  }

  if (!hasOwn(value, "pixel_art")) {
    return value;
  }

  if (!isRecord(value.pixel_art)) {
    throw new PixelArtMigrationError(
      "invalid-document",
      "Stored pixel-art data must be an object.",
    );
  }

  return value.pixel_art;
};

const isValidDimension = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= MIN_IMAGE_DIMENSION &&
  value <= MAX_IMAGE_DIMENSION;

const isValidPixelColor = (value: unknown) =>
  value === null || normalizePixelColor(value) !== null;

const isValidPaletteColor = (value: unknown) =>
  typeof value === "string" && normalizePixelColor(value) !== null;

const assertValidV2Document = (payload: Record<string, unknown>) => {
  if (!isValidDimension(payload.width) || !isValidDimension(payload.height)) {
    throw new PixelArtMigrationError(
      "invalid-document",
      `Stored pixel-art v2 dimensions must be integers between ${MIN_IMAGE_DIMENSION} and ${MAX_IMAGE_DIMENSION}.`,
      { version: 2 },
    );
  }

  if (!Array.isArray(payload.palette) || !payload.palette.every(isValidPaletteColor)) {
    throw new PixelArtMigrationError(
      "invalid-document",
      "Stored pixel-art v2 palette is invalid.",
      { version: 2 },
    );
  }

  if (
    !Array.isArray(payload.layers) ||
    payload.layers.length < 1 ||
    payload.layers.length > MAX_IMAGE_LAYERS
  ) {
    throw new PixelArtMigrationError(
      "invalid-document",
      `Stored pixel-art v2 must contain between 1 and ${MAX_IMAGE_LAYERS} layers.`,
      { version: 2 },
    );
  }

  const expectedPixelCount = payload.width * payload.height;
  const layerIds = new Set<string>();
  for (const [index, layer] of payload.layers.entries()) {
    if (!isRecord(layer)) {
      throw new PixelArtMigrationError(
        "invalid-document",
        `Stored pixel-art v2 layer ${index + 1} must be an object.`,
        { version: 2 },
      );
    }

    if (
      typeof layer.id !== "string" ||
      !layer.id.trim() ||
      layerIds.has(layer.id) ||
      typeof layer.name !== "string" ||
      !layer.name.trim() ||
      typeof layer.visible !== "boolean" ||
      typeof layer.locked !== "boolean" ||
      typeof layer.opacity !== "number" ||
      !Number.isFinite(layer.opacity) ||
      layer.opacity < 0 ||
      layer.opacity > 1 ||
      !Array.isArray(layer.pixels) ||
      layer.pixels.length !== expectedPixelCount ||
      !layer.pixels.every(isValidPixelColor)
    ) {
      throw new PixelArtMigrationError(
        "invalid-document",
        `Stored pixel-art v2 layer ${index + 1} is invalid.`,
        { version: 2 },
      );
    }

    layerIds.add(layer.id);
  }
};

export const parsePixelArtResourceData = (value: unknown): PixelArtParseResult => {
  const payload = readPayload(value);
  const warnings: string[] = [];

  if (payload.version !== undefined && payload.version !== 1 && payload.version !== 2) {
    throw new PixelArtMigrationError(
      "unsupported-version",
      `Unsupported stored pixel-art version: ${String(payload.version)}.`,
      { version: payload.version },
    );
  }

  if (payload.version === 2) {
    assertValidV2Document(payload);
    const document = createPixelArtDocument(Number(payload.width), Number(payload.height), {
      palette: normalizePalette(payload.palette),
      layers: (payload.layers as Record<string, unknown>[]).map((layer, index) =>
        createPixelLayer(Number(payload.width), Number(payload.height), {
          id: typeof layer.id === "string" ? layer.id : undefined,
          name: typeof layer.name === "string" ? layer.name : `Layer ${index + 1}`,
          visible: layer.visible !== false,
          locked: layer.locked === true,
          opacity: typeof layer.opacity === "number" ? layer.opacity : 1,
          pixels: layer.pixels,
        }),
      ),
    });

    return { document, migrated: false, warnings };
  }

  const width = Number(payload.width ?? payload.size);
  const height = Number(payload.height ?? payload.size);
  const document = createPixelArtDocument(width, height, {
    palette: normalizePalette(payload.palette),
    layers: [
      createPixelLayer(width, height, {
        name: "Layer 1",
        pixels: payload.pixels,
      }),
    ],
  });

  if (Object.keys(payload).length > 0) {
    warnings.push("Legacy pixel-art data was migrated in memory.");
  }

  return { document, migrated: true, warnings };
};

export const serializePixelArtResourceData = (
  existingData: Record<string, unknown>,
  document: PixelArtDocumentV2,
) => ({
  ...existingData,
  pixel_art: {
    version: 2 as const,
    width: document.width,
    height: document.height,
    palette: [...document.palette],
    layers: document.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      pixels: [...layer.pixels],
    })),
  },
});
