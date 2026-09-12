export type PixelColor = string | null;

export type ImageResizeAnchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export type ImageTool =
  | "pencil"
  | "graffiti"
  | "erase"
  | "fill"
  | "picker"
  | "line"
  | "rectangle"
  | "ellipse"
  | "select"
  | "move";

export type SaveStatus = "saved" | "saving" | "dirty" | "error" | "offline";

export type PixelLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  pixels: PixelColor[];
};

export type PixelArtDocumentV2 = {
  version: 2;
  width: number;
  height: number;
  palette: string[];
  layers: PixelLayer[];
};

export type ImageSelection = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageEditorSnapshot = {
  document: PixelArtDocumentV2;
  activeLayerId: string;
  selection: ImageSelection | null;
};
