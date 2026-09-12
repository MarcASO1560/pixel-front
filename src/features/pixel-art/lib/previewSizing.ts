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
