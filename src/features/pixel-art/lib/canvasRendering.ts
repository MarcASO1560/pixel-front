export type ImageCanvasRenderPlan = {
  bitmapHeight: number;
  bitmapWidth: number;
  cellSize: number;
  cellStride: number;
  cssHeight: number;
  cssWidth: number;
};

export const createImageCanvasRenderPlan = ({
  cellSize,
  gridHeight,
  gridWidth,
}: {
  cellSize: number;
  gridHeight: number;
  gridWidth: number;
}): ImageCanvasRenderPlan => {
  return {
    bitmapHeight: gridHeight,
    bitmapWidth: gridWidth,
    cellSize: 1,
    cellStride: 1,
    cssHeight: gridHeight * cellSize,
    cssWidth: gridWidth * cellSize,
  };
};
