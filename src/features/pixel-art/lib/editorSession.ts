import type { BrushShape } from "./drawing";
import {
  DEFAULT_IMAGE_PREFERENCES,
  normalizeImagePreferences,
  type ImagePreferences,
} from "../composables/useImagePreferences";
import type { ImageTool } from "../types";

export const IMAGE_EDITOR_SESSION_VERSION = 1;

export type ImageInspectorPanel = "preferences" | "resize" | "transfer" | "transform";
export type ImageZoomMode = "actual" | "custom" | "fit";

export type ImageEditorSession = {
  activeLayerId: string | null;
  primaryColor: string;
  secondaryColor: string;
  activeTool: ImageTool;
  brushSize: number;
  brushShape: BrushShape;
  shapeFilled: boolean;
  lastInspectorPanel: ImageInspectorPanel;
  preferences: ImagePreferences;
  viewport: {
    mode: ImageZoomMode;
    panX: number;
    panY: number;
    rotationRadians: number;
  };
  canvasModes: {
    horizontalMirror: boolean;
    verticalMirror: boolean;
    wrapAround: boolean;
    horizontalAxisY: number;
    verticalAxisX: number;
    horizontalLineVisible: boolean;
    verticalLineVisible: boolean;
    horizontalLineLocked: boolean;
    verticalLineLocked: boolean;
  };
};

const IMAGE_TOOLS: ReadonlySet<ImageTool> = new Set([
  "pencil",
  "graffiti",
  "erase",
  "fill",
  "picker",
  "line",
  "rectangle",
  "ellipse",
  "select",
  "move",
]);
const BRUSH_SHAPES: ReadonlySet<BrushShape> = new Set(["square", "circle", "diamond"]);
const INSPECTOR_PANELS: ReadonlySet<ImageInspectorPanel> = new Set([
  "preferences",
  "resize",
  "transfer",
  "transform",
]);
const ZOOM_MODES: ReadonlySet<ImageZoomMode> = new Set(["actual", "custom", "fit"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const booleanValue = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const boundedNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const normalizedColor = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const color = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}(?:[0-9A-F]{2})?$/.test(color) ? color : fallback;
};

const normalizedRotation = (value: unknown, fallback: number) => {
  const rotation = boundedNumber(value, fallback, -1_000_000, 1_000_000);
  const fullTurn = Math.PI * 2;
  const normalized = ((rotation + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
  return Object.is(normalized, -0) ? 0 : normalized;
};

const defaultImageEditorSession: ImageEditorSession = {
  activeLayerId: null,
  primaryColor: "#FFFFFF",
  secondaryColor: "#000000",
  activeTool: "pencil",
  brushSize: 1,
  brushShape: "square",
  shapeFilled: false,
  lastInspectorPanel: "resize",
  preferences: DEFAULT_IMAGE_PREFERENCES,
  viewport: {
    mode: "fit",
    panX: 0,
    panY: 0,
    rotationRadians: 0,
  },
  canvasModes: {
    horizontalMirror: false,
    verticalMirror: false,
    wrapAround: false,
    horizontalAxisY: 16,
    verticalAxisX: 16,
    horizontalLineVisible: true,
    verticalLineVisible: true,
    horizontalLineLocked: false,
    verticalLineLocked: false,
  },
};

export const DEFAULT_IMAGE_EDITOR_SESSION: Readonly<ImageEditorSession> = Object.freeze(
  defaultImageEditorSession,
);

export const normalizeImageEditorSession = (
  value: unknown,
  fallback: ImageEditorSession = DEFAULT_IMAGE_EDITOR_SESSION,
): ImageEditorSession => {
  const source = isRecord(value) ? value : {};
  const viewport = isRecord(source.viewport) ? source.viewport : {};
  const canvasModes = isRecord(source.canvasModes) ? source.canvasModes : {};
  const activeLayerId =
    typeof source.activeLayerId === "string" && source.activeLayerId.trim()
      ? source.activeLayerId
      : fallback.activeLayerId;

  return {
    activeLayerId,
    primaryColor: normalizedColor(source.primaryColor, fallback.primaryColor),
    secondaryColor: normalizedColor(source.secondaryColor, fallback.secondaryColor),
    activeTool: IMAGE_TOOLS.has(source.activeTool as ImageTool)
      ? (source.activeTool as ImageTool)
      : fallback.activeTool,
    brushSize: Math.round(boundedNumber(source.brushSize, fallback.brushSize, 1, 8)),
    brushShape: BRUSH_SHAPES.has(source.brushShape as BrushShape)
      ? (source.brushShape as BrushShape)
      : fallback.brushShape,
    shapeFilled: booleanValue(source.shapeFilled, fallback.shapeFilled),
    lastInspectorPanel: INSPECTOR_PANELS.has(
      source.lastInspectorPanel as ImageInspectorPanel,
    )
      ? (source.lastInspectorPanel as ImageInspectorPanel)
      : fallback.lastInspectorPanel,
    preferences: normalizeImagePreferences(source.preferences, fallback.preferences),
    viewport: {
      mode: ZOOM_MODES.has(viewport.mode as ImageZoomMode)
        ? (viewport.mode as ImageZoomMode)
        : fallback.viewport.mode,
      panX: boundedNumber(viewport.panX, fallback.viewport.panX, -1_000_000, 1_000_000),
      panY: boundedNumber(viewport.panY, fallback.viewport.panY, -1_000_000, 1_000_000),
      rotationRadians: normalizedRotation(
        viewport.rotationRadians,
        fallback.viewport.rotationRadians,
      ),
    },
    canvasModes: {
      horizontalMirror: booleanValue(
        canvasModes.horizontalMirror,
        fallback.canvasModes.horizontalMirror,
      ),
      verticalMirror: booleanValue(
        canvasModes.verticalMirror,
        fallback.canvasModes.verticalMirror,
      ),
      wrapAround: booleanValue(canvasModes.wrapAround, fallback.canvasModes.wrapAround),
      horizontalAxisY: boundedNumber(
        canvasModes.horizontalAxisY,
        fallback.canvasModes.horizontalAxisY,
        0,
        1_000_000,
      ),
      verticalAxisX: boundedNumber(
        canvasModes.verticalAxisX,
        fallback.canvasModes.verticalAxisX,
        0,
        1_000_000,
      ),
      horizontalLineVisible: booleanValue(
        canvasModes.horizontalLineVisible,
        fallback.canvasModes.horizontalLineVisible,
      ),
      verticalLineVisible: booleanValue(
        canvasModes.verticalLineVisible,
        fallback.canvasModes.verticalLineVisible,
      ),
      horizontalLineLocked: booleanValue(
        canvasModes.horizontalLineLocked,
        fallback.canvasModes.horizontalLineLocked,
      ),
      verticalLineLocked: booleanValue(
        canvasModes.verticalLineLocked,
        fallback.canvasModes.verticalLineLocked,
      ),
    },
  };
};
