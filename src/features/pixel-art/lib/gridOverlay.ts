import { normalizeImageColor } from "./color";

export const IMAGE_GRID_LINE_STYLES = ["solid", "dashed", "dots"] as const;

export type ImageGridLineStyle = (typeof IMAGE_GRID_LINE_STYLES)[number];

export type ImageGridLineSegment = Readonly<{
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}>;

export type ImageGridOverlayPlan = Readonly<{
  cssHeight: number;
  cssWidth: number;
  horizontalLines: readonly ImageGridLineSegment[];
  lineStyle: ImageGridLineStyle;
  step: number;
  verticalLines: readonly ImageGridLineSegment[];
}>;

/**
 * Keeps every grid treatment on the same, non-layout-affecting geometry.
 *
 * The returned segments describe complete grid lines instead of one segment
 * per cell. That distinction matters for dashed strokes: SVG/CSS restarts a
 * dash sequence for every segment, so a full-height/full-width segment keeps
 * the rhythm continuous along a line.
 */
export const createImageGridOverlayPlan = ({
  cellSize,
  gridHeight,
  gridWidth,
  lineStyle,
}: {
  cellSize: number;
  gridHeight: number;
  gridWidth: number;
  lineStyle: ImageGridLineStyle;
}): ImageGridOverlayPlan => {
  const cssHeight = gridHeight * cellSize;
  const cssWidth = gridWidth * cellSize;
  const verticalLines = Array.from({ length: Math.max(0, gridWidth - 1) }, (_, index) => {
    const x = (index + 1) * cellSize;

    return { x1: x, x2: x, y1: 0, y2: cssHeight };
  });
  const horizontalLines = Array.from(
    { length: Math.max(0, gridHeight - 1) },
    (_, index) => {
      const y = (index + 1) * cellSize;

      return { x1: 0, x2: cssWidth, y1: y, y2: y };
    },
  );

  return {
    cssHeight,
    cssWidth,
    horizontalLines,
    lineStyle,
    step: cellSize,
    verticalLines,
  };
};

const toLinearSrgb = (channel: number) => {
  const normalized = channel / 255;

  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

export const getImageGridKeylineColor = (color: string) => {
  const normalized = normalizeImageColor(color, "#FFFFFF");
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  const luminance =
    0.2126 * toLinearSrgb(red) +
    0.7152 * toLinearSrgb(green) +
    0.0722 * toLinearSrgb(blue);

  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);

  return contrastWithBlack >= contrastWithWhite ? "#000000" : "#FFFFFF";
};
