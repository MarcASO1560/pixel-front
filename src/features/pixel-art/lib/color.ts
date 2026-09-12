import { normalizePixelColor } from "./document";

export const normalizeImageColorDraft = (value: string) => {
  const hex = value.replace(/[^0-9a-f]/gi, "").slice(0, 8).toUpperCase();

  return `#${hex}`;
};

export const isCompleteImageColor = (value: string) => normalizePixelColor(value) !== null;

export const normalizeImageColor = (value: unknown, fallback: string) =>
  normalizePixelColor(value) || normalizePixelColor(fallback) || "#000000";

export const imageColorInputRgb = (value: string, fallback: string) =>
  normalizeImageColor(value, fallback).slice(0, 7);

export const replaceImageColorRgb = (value: string, currentColor: string, fallback: string) => {
  const rgb = imageColorInputRgb(value, fallback);
  const normalizedCurrentColor = normalizeImageColor(currentColor, fallback);
  const alpha = normalizedCurrentColor.length === 9 ? normalizedCurrentColor.slice(7) : "";

  return `${rgb}${alpha}`;
};

export const removeImagePaletteColor = (palette: readonly string[], color: string) => {
  const normalized = normalizePixelColor(color);
  if (!normalized) {
    return [...palette];
  }

  return palette.filter((paletteColor) => normalizePixelColor(paletteColor) !== normalized);
};
