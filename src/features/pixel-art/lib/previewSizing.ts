export const IMAGE_PREVIEW_MIN_SIZE = 88;
export const IMAGE_PREVIEW_MAX_SIZE = 176;

const IMAGE_PREVIEW_CONSTRAINED_MIN_SIZE = 64;
const IMAGE_PREVIEW_PIXEL_SCALE = 5;
const IMAGE_PREVIEW_STAGE_WIDTH_RATIO = 0.2;
const IMAGE_PREVIEW_STAGE_HEIGHT_RATIO = 0.24;

type ImagePreviewSizeOptions = {
  documentHeight: number;
  documentWidth: number;
  stageHeight: number;
  stageWidth: number;
};

export type ImagePreviewPoint = Readonly<{ x: number; y: number }>;
export type ImagePreviewBounds = Readonly<{
  bottom: number;
  left: number;
  right: number;
  top: number;
}>;

const finitePositiveValue = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export const calculateImagePreviewSize = ({
  documentHeight,
  documentWidth,
  stageHeight,
  stageWidth,
}: ImagePreviewSizeOptions) => {
  const longestDocumentSide = Math.max(
    1,
    finitePositiveValue(documentWidth),
    finitePositiveValue(documentHeight),
  );
  const desiredSize = Math.max(
    IMAGE_PREVIEW_MIN_SIZE,
    longestDocumentSide * IMAGE_PREVIEW_PIXEL_SCALE,
  );
  const availableSize = Math.max(
    IMAGE_PREVIEW_CONSTRAINED_MIN_SIZE,
    Math.min(
      finitePositiveValue(stageWidth) * IMAGE_PREVIEW_STAGE_WIDTH_RATIO,
      finitePositiveValue(stageHeight) * IMAGE_PREVIEW_STAGE_HEIGHT_RATIO,
    ),
  );

  return Math.round(Math.min(IMAGE_PREVIEW_MAX_SIZE, desiredSize, availableSize));
};

const clipImagePreviewPolygonEdge = (
  polygon: readonly ImagePreviewPoint[],
  isInside: (point: ImagePreviewPoint) => boolean,
  intersection: (from: ImagePreviewPoint, to: ImagePreviewPoint) => ImagePreviewPoint,
) => {
  if (polygon.length === 0) return [];

  const clipped: ImagePreviewPoint[] = [];
  let previous = polygon[polygon.length - 1]!;
  let wasInside = isInside(previous);

  for (const current of polygon) {
    const isCurrentInside = isInside(current);
    if (isCurrentInside !== wasInside) {
      clipped.push(intersection(previous, current));
    }
    if (isCurrentInside) clipped.push(current);
    previous = current;
    wasInside = isCurrentInside;
  }

  return clipped;
};

const intersectionAtX = (
  from: ImagePreviewPoint,
  to: ImagePreviewPoint,
  x: number,
): ImagePreviewPoint => {
  const width = to.x - from.x;
  const progress = Math.abs(width) < Number.EPSILON ? 0 : (x - from.x) / width;
  return { x, y: from.y + (to.y - from.y) * progress };
};

const intersectionAtY = (
  from: ImagePreviewPoint,
  to: ImagePreviewPoint,
  y: number,
): ImagePreviewPoint => {
  const height = to.y - from.y;
  const progress = Math.abs(height) < Number.EPSILON ? 0 : (y - from.y) / height;
  return { x: from.x + (to.x - from.x) * progress, y };
};

const deduplicateImagePreviewPolygon = (polygon: readonly ImagePreviewPoint[]) => {
  const unique: ImagePreviewPoint[] = [];
  const isSamePoint = (left: ImagePreviewPoint, right: ImagePreviewPoint) =>
    Math.abs(left.x - right.x) < 1e-9 && Math.abs(left.y - right.y) < 1e-9;

  for (const point of polygon) {
    if (!unique.length || !isSamePoint(unique[unique.length - 1]!, point)) {
      unique.push(point);
    }
  }
  if (unique.length > 1 && isSamePoint(unique[0]!, unique[unique.length - 1]!)) {
    unique.pop();
  }

  return unique;
};

/** Clips a transformed viewport polygon to the unrotated image bounds. */
export const clipImagePreviewPolygonToBounds = (
  polygon: readonly ImagePreviewPoint[],
  bounds: ImagePreviewBounds,
) => {
  if (
    bounds.right <= bounds.left ||
    bounds.bottom <= bounds.top ||
    polygon.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))
  ) {
    return [];
  }

  const left = clipImagePreviewPolygonEdge(
    polygon,
    (point) => point.x >= bounds.left,
    (from, to) => intersectionAtX(from, to, bounds.left),
  );
  const right = clipImagePreviewPolygonEdge(
    left,
    (point) => point.x <= bounds.right,
    (from, to) => intersectionAtX(from, to, bounds.right),
  );
  const top = clipImagePreviewPolygonEdge(
    right,
    (point) => point.y >= bounds.top,
    (from, to) => intersectionAtY(from, to, bounds.top),
  );

  return deduplicateImagePreviewPolygon(
    clipImagePreviewPolygonEdge(
      top,
      (point) => point.y <= bounds.bottom,
      (from, to) => intersectionAtY(from, to, bounds.bottom),
    ),
  );
};
