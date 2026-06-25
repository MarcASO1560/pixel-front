<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, triggerRef, watch } from "vue";
import { Eraser, Link2, Link2Off, PaintBucket, Palette, Pencil, Pipette, Plus, Scaling, SlidersHorizontal, X } from "@lucide/vue";
import { Icon, type IconifyIcon } from "@iconify/vue";
import fileImageIcon from "@iconify-icons/mdi/file-image";
import filmstripIcon from "@iconify-icons/mdi/filmstrip";
import musicNoteIcon from "@iconify-icons/mdi/music-note";

import {
  fetchApi,
  type PixelAvatarData,
  type ProjectPublic,
  type ProjectResourceDetail,
  type ProjectResourcePublic,
  type UserPublic,
  type WorkspaceBootstrap,
} from "../../../lib/api";
import StudioTopbar from "../../navigation/components/StudioTopbar.vue";
import { PIXEL_ART_PALETTE } from "../../pixel-art/lib/palette";
import UserProfileDialog from "./UserProfileDialog.vue";

type ResourceRouteKind = "image" | "animation" | "melody";

type EditorMeta = {
  routeKind: ResourceRouteKind;
  label: string;
  icon: IconifyIcon;
  color: string;
};

type PixelColor = string | null;
type ImagePaintTool = "pencil" | "erase";
type ImageTool = ImagePaintTool | "fill" | "picker";
type ImagePixelSnapshot = PixelColor[];
type ImageAnchorArrowDirection = "down" | "left" | "right" | "up";
type ImageInspectorPanel = "preferences" | "resize";
type ImageGridGap = 1 | 2 | 3;
type ImageGridLineStyle = "solid" | "dashed" | "dots";
type ImageGridSubdivisionThickness = 1 | 2 | 3;
type ImageSubdivisionLine = {
  index: number;
  style: Record<string, string>;
};
type ImageResizeAnchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";
type ImageResizeAnchorOption = {
  arrows: ImageAnchorArrowDirection[];
  column: number;
  label: string;
  row: number;
  value: ImageResizeAnchor;
};
type ImagePreviewViewport = {
  height: number;
  left: number;
  top: number;
  visible: boolean;
  width: number;
};

type ImageResourceData = {
  version: 1;
  width: number;
  height: number;
  anchor: ImageResizeAnchor;
  palette?: string[];
  pixels: PixelColor[];
};

const props = defineProps<{
  projectId: string;
  resourceId: string;
  resourceKind: string;
  userName?: string;
  userUsername?: string | null;
  userAvatarUrl?: string;
  userEmail?: string;
  userPixelAvatar?: PixelAvatarData | null;
}>();

const editorMetaByType: Record<string, EditorMeta> = {
  pixel_art: {
    routeKind: "image",
    label: "Image",
    icon: fileImageIcon,
    color: "#79b8ff",
  },
  pixel_animation: {
    routeKind: "animation",
    label: "Animation",
    icon: filmstripIcon,
    color: "#ff6fae",
  },
  sound_effect: {
    routeKind: "melody",
    label: "Melody",
    icon: musicNoteIcon,
    color: "#ffd76f",
  },
};

const fallbackEditorMeta: EditorMeta = {
  routeKind: "image",
  label: "Item",
  icon: fileImageIcon,
  color: "#f7f1e7",
};

const DEFAULT_IMAGE_WIDTH = 32;
const DEFAULT_IMAGE_HEIGHT = 32;
const MIN_IMAGE_DIMENSION = 1;
const MAX_IMAGE_DIMENSION = 256;
const MIN_IMAGE_ZOOM = 0.35;
const MAX_IMAGE_ZOOM = 16;
const IMAGE_ZOOM_WHEEL_STEP = 0.0018;
const IMAGE_AUTOSAVE_MS = 420;
const IMAGE_PALETTE = PIXEL_ART_PALETTE;
const DEFAULT_PENCIL_COLOR = IMAGE_PALETTE[0] || "#ffffff";
const IMAGE_COLOR_PICKER_SIZE = 292;
const IMAGE_COLOR_PICKER_CENTER = IMAGE_COLOR_PICKER_SIZE / 2;
const IMAGE_COLOR_PICKER_RADIUS = 136;
const IMAGE_COLOR_PICKER_RING_WIDTH = 28;
const IMAGE_COLOR_TRIANGLE_TOP = { x: 146, y: 28 };
const IMAGE_COLOR_TRIANGLE_LEFT = { x: 48, y: 212 };
const IMAGE_COLOR_TRIANGLE_RIGHT = { x: 244, y: 212 };
const DEFAULT_CUSTOM_IMAGE_BACKGROUND = "#101111";
const DEFAULT_CUSTOM_IMAGE_GRID_COLOR = "#f7f1e7";
const DEFAULT_CUSTOM_IMAGE_SUBDIVISION_COLOR = "#ff4d4d";
const MIN_IMAGE_GRID_SUBDIVISION = 1;
const MAX_IMAGE_GRID_SUBDIVISION = 64;
const DEFAULT_IMAGE_RESIZE_ANCHOR: ImageResizeAnchor = "center";
const IMAGE_RESIZE_ANCHORS: ImageResizeAnchorOption[] = [
  { arrows: ["right", "down"], column: 0, label: "Top left", row: 0, value: "top-left" },
  { arrows: ["left", "right", "down"], column: 1, label: "Top", row: 0, value: "top" },
  { arrows: ["left", "down"], column: 2, label: "Top right", row: 0, value: "top-right" },
  { arrows: ["right", "up", "down"], column: 0, label: "Left", row: 1, value: "left" },
  { arrows: ["left", "right", "up", "down"], column: 1, label: "Center", row: 1, value: "center" },
  { arrows: ["left", "up", "down"], column: 2, label: "Right", row: 1, value: "right" },
  { arrows: ["right", "up"], column: 0, label: "Bottom left", row: 2, value: "bottom-left" },
  { arrows: ["left", "right", "up"], column: 1, label: "Bottom", row: 2, value: "bottom" },
  { arrows: ["left", "up"], column: 2, label: "Bottom right", row: 2, value: "bottom-right" },
];
const IMAGE_GRID_GAP_OPTIONS: ImageGridGap[] = [1, 2, 3];
const IMAGE_GRID_LINE_STYLE_OPTIONS: { label: string; value: ImageGridLineStyle }[] = [
  { label: "Solid", value: "solid" },
  { label: "Dash", value: "dashed" },
  { label: "Dots", value: "dots" },
];
const IMAGE_GRID_SUBDIVISION_THICKNESS_OPTIONS: ImageGridSubdivisionThickness[] = [1, 2, 3];

const isLoading = ref(true);
const errorMessage = ref("");
const project = ref<ProjectPublic | null>(null);
const resource = ref<ProjectResourceDetail | null>(null);
const imageGridWidth = ref(DEFAULT_IMAGE_WIDTH);
const imageGridHeight = ref(DEFAULT_IMAGE_HEIGHT);
const imageGridWidthDraft = ref(String(DEFAULT_IMAGE_WIDTH));
const imageGridHeightDraft = ref(String(DEFAULT_IMAGE_HEIGHT));
const imagePixels = shallowRef<PixelColor[]>(
  Array(DEFAULT_IMAGE_WIDTH * DEFAULT_IMAGE_HEIGHT).fill(null),
);
const selectedImageColor = ref(DEFAULT_PENCIL_COLOR);
const selectedImageColorDraft = ref(DEFAULT_PENCIL_COLOR.toUpperCase());
const imageColorPalette = ref<string[]>([]);
const activeImageTool = ref<ImageTool>("pencil");
const imageResizeAnchor = ref<ImageResizeAnchor>(DEFAULT_IMAGE_RESIZE_ANCHOR);
const activeImageInspectorPanel = ref<ImageInspectorPanel | null>(null);
const customImageBackground = ref(DEFAULT_CUSTOM_IMAGE_BACKGROUND);
const isImageGridVisible = ref(true);
const customImageGridColor = ref(DEFAULT_CUSTOM_IMAGE_GRID_COLOR);
const customImageSubdivisionColor = ref(DEFAULT_CUSTOM_IMAGE_SUBDIVISION_COLOR);
const imageGridLineStyle = ref<ImageGridLineStyle>("solid");
const imageGridSubdivision = ref(1);
const imageGridSubdivisionDraft = ref("1");
const imageGridSubdivisionThickness = ref<ImageGridSubdivisionThickness>(1);
const imageGridGap = ref<ImageGridGap>(1);
const imageGridLineOpacity = ref(0.18);
const imageGridLineOpacityDraft = ref("0.18");
const imageZoom = ref(1);
const selectedImageHue = ref(0);
const selectedImageSaturation = ref(0);
const selectedImageValue = ref(1);
const imagePanX = ref(0);
const imagePanY = ref(0);
const imageViewportWidth = ref(0);
const imageViewportHeight = ref(0);
const areImageDimensionsLinked = ref(true);
const isPaintingImage = ref(false);
const isPanningImage = ref(false);
const hoveredImagePixelIndex = ref<number | null>(null);
const imageStageRef = ref<HTMLElement | null>(null);
const imageArtboardRef = ref<HTMLElement | null>(null);
const imageCanvasRef = ref<HTMLCanvasElement | null>(null);
const imagePreviewCanvasRef = ref<HTMLCanvasElement | null>(null);
const imageColorTriangleCanvasRef = ref<HTMLCanvasElement | null>(null);
const imageColorPickerRef = ref<HTMLElement | null>(null);
const imagePreviewViewport = ref<ImagePreviewViewport>({
  height: 100,
  left: 0,
  top: 0,
  visible: false,
  width: 100,
});
const imageAutosaveTimeout = ref<number | null>(null);
const imageAutosaveVersion = ref(0);
const isProfileDialogOpen = ref(false);
const profileUserName = ref(props.userName || "");
const profileUsername = ref(props.userUsername || "");
const profileAvatarUrl = ref(props.userAvatarUrl || "");
const profileEmail = ref(props.userEmail || "");
const profilePixelAvatar = ref<PixelAvatarData | null>(props.userPixelAvatar || null);

const editorMeta = computed(() =>
  resource.value ? editorMetaByType[resource.value.type] || fallbackEditorMeta : fallbackEditorMeta,
);
const isImageEditor = computed(() => editorMeta.value.routeKind === "image");
const projectName = computed(() => project.value?.name || "Project");
const resourceName = computed(() => resource.value?.name || "Loading item");
const resourceColor = computed(() => resource.value?.color || editorMeta.value.color);
const projectPixelArt = computed<PixelAvatarData | null>(() => {
  const pixelArt = project.value?.settings?.project_pixel_art;
  if (!pixelArt || typeof pixelArt !== "object") {
    return null;
  }

  return pixelArt as PixelAvatarData;
});

const editorStyle = computed(() => ({
  "--resource-editor-color": resourceColor.value,
}));

const imagePixelCount = computed(() => imageGridWidth.value * imageGridHeight.value);
const getRgbFromHexColor = (color: string) => {
  const hex = color.replace("#", "");

  return {
    blue: Number.parseInt(hex.slice(4, 6), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    red: Number.parseInt(hex.slice(0, 2), 16),
  };
};
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const colorComponentToHex = (value: number) =>
  Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
const normalizeHexColorInput = (value: string) => {
  const hex = value.replace(/[^0-9a-f]/gi, "").slice(0, 6).toUpperCase();

  return `#${hex}`;
};
const isCompleteHexColor = (value: string) => /^#[0-9A-F]{6}$/.test(value);
const normalizeImagePalette = (palette: unknown) => {
  if (!Array.isArray(palette)) {
    return [];
  }

  const colors: string[] = [];
  for (const color of palette) {
    if (typeof color !== "string") {
      continue;
    }

    const normalized = normalizeHexColorInput(color);
    if (isCompleteHexColor(normalized) && !colors.includes(normalized)) {
      colors.push(normalized);
    }
  }

  return colors;
};
const hsvToHexColor = (hue: number, saturation: number, value: number) => {
  const chroma = value * saturation;
  const huePrime = ((hue % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = value - chroma;
  const [red, green, blue] =
    huePrime < 1
      ? [chroma, x, 0]
      : huePrime < 2
        ? [x, chroma, 0]
        : huePrime < 3
          ? [0, chroma, x]
          : huePrime < 4
            ? [0, x, chroma]
            : huePrime < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return `#${colorComponentToHex((red + match) * 255)}${colorComponentToHex(
    (green + match) * 255,
  )}${colorComponentToHex((blue + match) * 255)}`;
};
const hexColorToHsv = (color: string) => {
  const { blue, green, red } = getRgbFromHexColor(color);
  const normalizedRed = red / 255;
  const normalizedGreen = green / 255;
  const normalizedBlue = blue / 255;
  const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
  const delta = max - min;
  let hue = selectedImageHue.value;

  if (delta > 0) {
    if (max === normalizedRed) {
      hue = 60 * (((normalizedGreen - normalizedBlue) / delta) % 6);
    } else if (max === normalizedGreen) {
      hue = 60 * ((normalizedBlue - normalizedRed) / delta + 2);
    } else {
      hue = 60 * ((normalizedRed - normalizedGreen) / delta + 4);
    }
  }

  return {
    hue: (hue + 360) % 360,
    saturation: max === 0 ? 0 : delta / max,
    value: max,
  };
};
const syncSelectedImageHsvFromColor = (color: string) => {
  const hsv = hexColorToHsv(color);
  selectedImageHue.value = hsv.hue;
  selectedImageSaturation.value = hsv.saturation;
  selectedImageValue.value = hsv.value;
};
const setSelectedImageColor = (color: string, options: { syncHsv?: boolean } = {}) => {
  selectedImageColor.value = color;
  selectedImageColorDraft.value = color.toUpperCase();

  if (options.syncHsv !== false) {
    syncSelectedImageHsvFromColor(color);
  }
};
const applySelectedImageHsv = () => {
  setSelectedImageColor(
    hsvToHexColor(
      selectedImageHue.value,
      selectedImageSaturation.value,
      selectedImageValue.value,
    ),
    { syncHsv: false },
  );
};
const updateSelectedImageColorFromInput = (event: Event) => {
  const input = event.currentTarget as HTMLInputElement;
  const normalized = normalizeHexColorInput(input.value);
  selectedImageColorDraft.value = normalized;
  input.value = normalized;

  if (isCompleteHexColor(normalized)) {
    setSelectedImageColor(normalized);
  }
};
const commitSelectedImageColorInput = () => {
  if (isCompleteHexColor(selectedImageColorDraft.value)) {
    setSelectedImageColor(selectedImageColorDraft.value);
    return;
  }

  selectedImageColorDraft.value = selectedImageColor.value.toUpperCase();
};
const addImagePaletteColor = (color = selectedImageColor.value, options: { autosave?: boolean } = {}) => {
  const normalized = normalizeHexColorInput(color);
  if (!isCompleteHexColor(normalized) || imageColorPalette.value.includes(normalized)) {
    return false;
  }

  imageColorPalette.value = [...imageColorPalette.value, normalized];
  if (options.autosave !== false) {
    scheduleImageAutosave();
  }
  return true;
};
const selectImagePaletteColor = (color: string) => {
  setSelectedImageColor(color);
};
const removeImagePaletteColor = (color: string) => {
  const normalized = normalizeHexColorInput(color);
  const nextPalette = imageColorPalette.value.filter((paletteColor) => paletteColor !== normalized);

  if (nextPalette.length === imageColorPalette.value.length) {
    return;
  }

  imageColorPalette.value = nextPalette;
  scheduleImageAutosave();
};
const getImageGridLineBackground = (color: string) => {
  const { blue, green, red } = getRgbFromHexColor(color);

  return `rgba(${red}, ${green}, ${blue}, var(--image-grid-line-opacity, 0.18))`;
};
const getImageGridDashImage = (color: string) => {
  if (!isImageGridVisible.value || imageGridLineStyle.value !== "dashed") {
    return "none";
  }

  const { blue, green, red } = getRgbFromHexColor(color);
  const step = Math.max(4, imageArtboardMetrics.value.cellSize + imageGridLineGap.value);
  const dashLength = 8;
  const gapLength = 6;
  const opacity = Math.max(0, Math.min(1, imageGridLineOpacity.value));
  const dashArray = step < dashLength + gapLength ? `${Math.max(2, step * 0.45)} ${Math.max(2, step * 0.55)}` : `${dashLength} ${gapLength}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${step}" height="${step}" viewBox="0 0 ${step} ${step}"><g stroke="rgb(${red},${green},${blue})" stroke-opacity="${opacity}" stroke-width="1" stroke-dasharray="${dashArray}" stroke-linecap="butt"><line x1="0.5" y1="0" x2="0.5" y2="${step}"/><line x1="0" y1="0.5" x2="${step}" y2="0.5"/></g></svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};
const getImageGridBackground = (color: string) => {
  const lineColor = getImageGridLineBackground(color);

  if (imageGridLineStyle.value === "dots" || imageGridLineStyle.value === "dashed") {
    return "transparent";
  }

  return lineColor;
};
const activeImageGridLineBackground = computed(() =>
  getImageGridBackground(customImageGridColor.value),
);
const activeImageInspectorLabel = computed(() => {
  if (activeImageInspectorPanel.value === "resize") {
    return "Resize";
  }

  if (activeImageInspectorPanel.value === "preferences") {
    return "Preferences";
  }

  return "Options";
});
const imageArtboardBaseSize = computed(() => {
  const viewportWidth = imageViewportWidth.value || 1024;
  const viewportHeight = imageViewportHeight.value || 768;
  if (viewportWidth <= 520) {
    const availableWidth = Math.max(180, viewportWidth - 28);
    const availableHeight = Math.max(220, viewportHeight - 420);

    return Math.min(availableWidth, availableHeight, 310);
  }

  const viewportMin = Math.min(viewportWidth, viewportHeight);
  const aspectRatio = imageGridWidth.value / imageGridHeight.value;

  return Math.min(viewportMin * 0.62, 620, viewportHeight * 0.68 * aspectRatio);
});
const imageGridLineGap = computed(() =>
  isImageGridVisible.value && imageGridLineStyle.value === "solid" ? imageGridGap.value : 0,
);
const imageArtboardMetricsForZoom = (zoom: number) => {
  const gridWidth = imageGridWidth.value;
  const gridHeight = imageGridHeight.value;
  const gap = imageGridLineGap.value;
  const borderSize = 2;
  const horizontalGapSize = Math.max(0, gridWidth - 1) * gap;
  const verticalGapSize = Math.max(0, gridHeight - 1) * gap;
  const availableWidth = Math.max(
    gridWidth,
    imageArtboardBaseSize.value * zoom - horizontalGapSize - borderSize,
  );
  const cellSize = Math.max(1, Math.round(availableWidth / gridWidth));

  return {
    cellSize,
    height: gridHeight * cellSize + verticalGapSize + borderSize,
    width: gridWidth * cellSize + horizontalGapSize + borderSize,
  };
};
const imageArtboardMetrics = computed(() => imageArtboardMetricsForZoom(imageZoom.value));
const imageArtboardWidth = computed(() => imageArtboardMetrics.value.width);
const imageArtboardHeight = computed(() => imageArtboardMetrics.value.height);
const imageSubdivisionLinePosition = (lineIndex: number) => {
  const cellSize = imageArtboardMetrics.value.cellSize;
  const gap = imageGridLineGap.value;
  const thickness = imageGridSubdivisionThickness.value;
  const gapCenter = lineIndex * cellSize + Math.max(0, lineIndex - 1) * gap + gap / 2;

  return Math.max(0, gapCenter - thickness / 2);
};
const createImageSubdivisionLines = (count: number, axis: "horizontal" | "vertical") => {
  if (!isImageGridVisible.value || imageGridSubdivision.value <= 1) {
    return [];
  }

  const lines: ImageSubdivisionLine[] = [];
  for (let lineIndex = imageGridSubdivision.value; lineIndex < count; lineIndex += imageGridSubdivision.value) {
    const position = imageSubdivisionLinePosition(lineIndex);
    lines.push({
      index: lineIndex,
      style:
        axis === "vertical"
          ? { left: `${1 + position}px`, width: `${imageGridSubdivisionThickness.value}px` }
          : { height: `${imageGridSubdivisionThickness.value}px`, top: `${1 + position}px` },
    });
  }

  return lines;
};
const imageSubdivisionVerticalLines = computed(() =>
  createImageSubdivisionLines(imageGridWidth.value, "vertical"),
);
const imageSubdivisionHorizontalLines = computed(() =>
  createImageSubdivisionLines(imageGridHeight.value, "horizontal"),
);
const imageHoverCellStyle = computed(() => {
  if (hoveredImagePixelIndex.value === null) {
    return {};
  }

  const column = hoveredImagePixelIndex.value % imageGridWidth.value;
  const row = Math.floor(hoveredImagePixelIndex.value / imageGridWidth.value);
  const cellSize = imageArtboardMetrics.value.cellSize;
  const gap = imageGridLineGap.value;

  return {
    height: `${cellSize}px`,
    left: `${1 + column * (cellSize + gap)}px`,
    top: `${1 + row * (cellSize + gap)}px`,
    width: `${cellSize}px`,
  };
});
const imageCanvasGridStyle = computed(() => ({
  background: activeImageGridLineBackground.value,
  gap: `${imageGridLineGap.value}px`,
  gridTemplateColumns: `repeat(${imageGridWidth.value}, 1fr)`,
  gridTemplateRows: `repeat(${imageGridHeight.value}, 1fr)`,
  height: `${imageArtboardHeight.value}px`,
  "--image-grid-height": `${imageGridHeight.value}`,
  "--image-grid-line-opacity": isImageGridVisible.value ? `${imageGridLineOpacity.value}` : "0",
  "--image-grid-dash-image": getImageGridDashImage(customImageGridColor.value),
  "--image-grid-dash-opacity": isImageGridVisible.value && imageGridLineStyle.value === "dashed" ? "1" : "0",
  "--image-grid-dot-color":
    imageGridLineStyle.value === "dots"
      ? getImageGridLineBackground(customImageGridColor.value)
      : "transparent",
  "--image-grid-dot-opacity": isImageGridVisible.value && imageGridLineStyle.value === "dots" ? "1" : "0",
  "--image-grid-dot-size": `${Math.max(2, Math.min(4, imageArtboardMetrics.value.cellSize * 0.16))}px`,
  "--image-grid-step": `${imageArtboardMetrics.value.cellSize + imageGridLineGap.value}px`,
  "--image-grid-subdivision-color": getImageGridLineBackground(customImageSubdivisionColor.value),
  "--image-grid-subdivision-thickness": `${imageGridSubdivisionThickness.value}px`,
  "--image-grid-width": `${imageGridWidth.value}`,
  "--image-artboard-height": `${imageArtboardHeight.value}px`,
  "--image-artboard-half-height": `${imageArtboardHeight.value / 2}px`,
  "--image-artboard-half-width": `${imageArtboardWidth.value / 2}px`,
  "--image-artboard-width": `${imageArtboardWidth.value}px`,
  "--image-artboard-center-x": "50%",
  "--image-artboard-center-y": imageViewportWidth.value <= 520 ? "46%" : "50%",
  "--image-pan-x": `${imagePanX.value}px`,
  "--image-pan-y": `${imagePanY.value}px`,
  "--image-zoom": `${imageZoom.value}`,
  "--image-pixel-background": customImageBackground.value,
  width: `${imageArtboardWidth.value}px`,
}));
const imagePreviewGridStyle = computed(() => ({
  aspectRatio: `${imageGridWidth.value} / ${imageGridHeight.value}`,
  gridTemplateColumns: `repeat(${imageGridWidth.value}, 1fr)`,
  gridTemplateRows: `repeat(${imageGridHeight.value}, 1fr)`,
  height:
    imageGridWidth.value >= imageGridHeight.value
      ? `${(imageGridHeight.value / imageGridWidth.value) * 100}%`
      : "100%",
  "--image-preview-empty-pixel": customImageBackground.value,
  width:
    imageGridWidth.value >= imageGridHeight.value
      ? "100%"
      : `${(imageGridWidth.value / imageGridHeight.value) * 100}%`,
}));
const imagePreviewViewportStyle = computed(() => ({
  height: `${imagePreviewViewport.value.height}%`,
  left: `${imagePreviewViewport.value.left}%`,
  top: `${imagePreviewViewport.value.top}%`,
  width: `${imagePreviewViewport.value.width}%`,
}));
const selectedImageHueColor = computed(() =>
  hsvToHexColor(selectedImageHue.value, 1, 1),
);
const imageColorHueHandleStyle = computed(() => {
  const angleDegrees = selectedImageHue.value - 180;
  const angle = (angleDegrees * Math.PI) / 180;
  const radius = IMAGE_COLOR_PICKER_RADIUS - IMAGE_COLOR_PICKER_RING_WIDTH * 0.14;

  return {
    left: `${IMAGE_COLOR_PICKER_CENTER + Math.cos(angle) * radius}px`,
    top: `${IMAGE_COLOR_PICKER_CENTER + Math.sin(angle) * radius}px`,
    transform: `translate(-50%, -50%) rotate(${angleDegrees}deg)`,
  };
});
const imageColorTriangleHandleStyle = computed(() => {
  const hueWeight = selectedImageSaturation.value * selectedImageValue.value;
  const whiteWeight = (1 - selectedImageSaturation.value) * selectedImageValue.value;
  const blackWeight = 1 - selectedImageValue.value;
  const x =
    IMAGE_COLOR_TRIANGLE_TOP.x * blackWeight +
    IMAGE_COLOR_TRIANGLE_LEFT.x * whiteWeight +
    IMAGE_COLOR_TRIANGLE_RIGHT.x * hueWeight;
  const y =
    IMAGE_COLOR_TRIANGLE_TOP.y * blackWeight +
    IMAGE_COLOR_TRIANGLE_LEFT.y * whiteWeight +
    IMAGE_COLOR_TRIANGLE_RIGHT.y * hueWeight;

  return {
    left: `${x - IMAGE_COLOR_TRIANGLE_LEFT.x}px`,
    top: `${y - IMAGE_COLOR_TRIANGLE_TOP.y}px`,
  };
});
const imageColorPickerStyle = computed(() => ({
  "--selected-image-color": selectedImageColor.value,
  "--selected-image-hue-color": selectedImageHueColor.value,
}));

const renderImageCanvas = () => {
  const canvas = imageCanvasRef.value;
  if (!canvas) {
    return;
  }

  const cellSize = imageArtboardMetrics.value.cellSize;
  const gap = imageGridLineGap.value;
  const width = imageGridWidth.value;
  const height = imageGridHeight.value;
  const canvasWidth = width * cellSize + Math.max(0, width - 1) * gap;
  const canvasHeight = height * cellSize + Math.max(0, height - 1) * gap;
  canvas.width = Math.max(1, canvasWidth);
  canvas.height = Math.max(1, canvasHeight);
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < imagePixels.value.length; index += 1) {
    const column = index % width;
    const row = Math.floor(index / width);
    context.fillStyle = imagePixels.value[index] || customImageBackground.value;
    context.fillRect(column * (cellSize + gap), row * (cellSize + gap), cellSize, cellSize);
  }
};

const renderImagePreviewCanvas = () => {
  const canvas = imagePreviewCanvasRef.value;
  if (!canvas) {
    return;
  }

  const width = imageGridWidth.value;
  const height = imageGridHeight.value;
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.imageSmoothingEnabled = false;
  context.fillStyle = customImageBackground.value;
  context.fillRect(0, 0, width, height);

  for (let index = 0; index < imagePixels.value.length; index += 1) {
    const color = imagePixels.value[index];
    if (!color) {
      continue;
    }

    const column = index % width;
    const row = Math.floor(index / width);
    context.fillStyle = color;
    context.fillRect(column, row, 1, 1);
  }
};

const getImageColorTriangleWeights = (x: number, y: number) => {
  const denominator =
    (IMAGE_COLOR_TRIANGLE_LEFT.y - IMAGE_COLOR_TRIANGLE_RIGHT.y) *
      (IMAGE_COLOR_TRIANGLE_TOP.x - IMAGE_COLOR_TRIANGLE_RIGHT.x) +
    (IMAGE_COLOR_TRIANGLE_RIGHT.x - IMAGE_COLOR_TRIANGLE_LEFT.x) *
      (IMAGE_COLOR_TRIANGLE_TOP.y - IMAGE_COLOR_TRIANGLE_RIGHT.y);
  const black =
    ((IMAGE_COLOR_TRIANGLE_LEFT.y - IMAGE_COLOR_TRIANGLE_RIGHT.y) *
      (x - IMAGE_COLOR_TRIANGLE_RIGHT.x) +
      (IMAGE_COLOR_TRIANGLE_RIGHT.x - IMAGE_COLOR_TRIANGLE_LEFT.x) *
        (y - IMAGE_COLOR_TRIANGLE_RIGHT.y)) /
    denominator;
  const white =
    ((IMAGE_COLOR_TRIANGLE_RIGHT.y - IMAGE_COLOR_TRIANGLE_TOP.y) *
      (x - IMAGE_COLOR_TRIANGLE_RIGHT.x) +
      (IMAGE_COLOR_TRIANGLE_TOP.x - IMAGE_COLOR_TRIANGLE_RIGHT.x) *
        (y - IMAGE_COLOR_TRIANGLE_RIGHT.y)) /
    denominator;
  const hue = 1 - black - white;

  return { black, hue, white };
};

const renderImageColorTriangleCanvas = () => {
  const canvas = imageColorTriangleCanvasRef.value;
  if (!canvas) {
    return;
  }

  const cssWidth = IMAGE_COLOR_TRIANGLE_RIGHT.x - IMAGE_COLOR_TRIANGLE_LEFT.x;
  const cssHeight = IMAGE_COLOR_TRIANGLE_LEFT.y - IMAGE_COLOR_TRIANGLE_TOP.y;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(cssWidth * pixelRatio);
  const height = Math.round(cssHeight * pixelRatio);
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const imageData = context.createImageData(width, height);
  const hueRgb = getRgbFromHexColor(selectedImageHueColor.value);

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const weights = getImageColorTriangleWeights(
        IMAGE_COLOR_TRIANGLE_LEFT.x + (column + 0.5) / pixelRatio,
        IMAGE_COLOR_TRIANGLE_TOP.y + (row + 0.5) / pixelRatio,
      );
      const dataIndex = (row * width + column) * 4;
      const black = Math.max(0, weights.black);
      const white = Math.max(0, weights.white);
      const hue = Math.max(0, weights.hue);
      const total = black + white + hue || 1;
      const normalizedWhite = white / total;
      const normalizedHue = hue / total;

      imageData.data[dataIndex] = Math.round(255 * normalizedWhite + hueRgb.red * normalizedHue);
      imageData.data[dataIndex + 1] = Math.round(255 * normalizedWhite + hueRgb.green * normalizedHue);
      imageData.data[dataIndex + 2] = Math.round(255 * normalizedWhite + hueRgb.blue * normalizedHue);
      imageData.data[dataIndex + 3] = 255;
    }
  }

  context.putImageData(imageData, 0, 0);
};

let imageCanvasRenderFrame: number | null = null;
const scheduleImageCanvasRender = () => {
  if (typeof window === "undefined") {
    return;
  }

  if (imageCanvasRenderFrame !== null) {
    window.cancelAnimationFrame(imageCanvasRenderFrame);
  }

  imageCanvasRenderFrame = window.requestAnimationFrame(() => {
    imageCanvasRenderFrame = null;
    renderImageCanvas();
    renderImagePreviewCanvas();
  });
};

const projectPath = computed(() => `/studio/${encodeURIComponent(props.projectId)}`);
const canonicalResourcePath = computed(
  () =>
    `/studio/${encodeURIComponent(props.projectId)}/${editorMeta.value.routeKind}/${encodeURIComponent(
      props.resourceId,
    )}`,
);

const returnToStudio = () => {
  window.location.assign("/studio");
};

const returnToProject = () => {
  window.location.assign(projectPath.value);
};

const updateProfile = (user: UserPublic) => {
  profileUsername.value = user.username || "";
  profileUserName.value = user.username || user.email;
  profileAvatarUrl.value = user.avatar_url || "";
  profileEmail.value = user.email;
  profilePixelAvatar.value = user.avatar_pixel_art || null;
  isProfileDialogOpen.value = false;
};

const emptyImagePixels = (width = imageGridWidth.value, height = imageGridHeight.value) =>
  Array<PixelColor>(width * height).fill(null);

const imagePixelsAreEqual = (left: ImagePixelSnapshot, right: ImagePixelSnapshot) =>
  left.length === right.length && left.every((pixel, index) => pixel === right[index]);

const normalizeImageDimension = (value: unknown, fallback: number) => {
  const dimension = Number(value);

  if (!Number.isFinite(dimension)) {
    return fallback;
  }

  return Math.min(
    MAX_IMAGE_DIMENSION,
    Math.max(MIN_IMAGE_DIMENSION, Math.round(dimension)),
  );
};

const normalizeImageResizeAnchor = (value: unknown): ImageResizeAnchor =>
  IMAGE_RESIZE_ANCHORS.some((anchor) => anchor.value === value)
    ? (value as ImageResizeAnchor)
    : DEFAULT_IMAGE_RESIZE_ANCHOR;

const normalizeImagePixels = (pixels: unknown, width = imageGridWidth.value, height = imageGridHeight.value) => {
  if (!Array.isArray(pixels)) {
    return emptyImagePixels(width, height);
  }

  return Array.from({ length: width * height }, (_, index) => {
    const pixel = pixels[index];
    return typeof pixel === "string" && pixel.trim() ? pixel : null;
  });
};

const readImagePixelsFromData = (data: Record<string, unknown>) => {
  const pixelArtData = data.pixel_art;
  if (
    pixelArtData &&
    typeof pixelArtData === "object" &&
    "pixels" in pixelArtData
  ) {
    const imageData = pixelArtData as {
      anchor?: unknown;
      height?: unknown;
      palette?: unknown;
      pixels?: unknown;
      size?: unknown;
      width?: unknown;
    };
    const width = normalizeImageDimension(imageData.width ?? imageData.size, DEFAULT_IMAGE_WIDTH);
    const height = normalizeImageDimension(imageData.height ?? imageData.size, DEFAULT_IMAGE_HEIGHT);

    return {
      anchor: normalizeImageResizeAnchor(imageData.anchor),
      height,
      palette: normalizeImagePalette(imageData.palette),
      pixels: normalizeImagePixels(imageData.pixels, width, height),
      width,
    };
  }

  const width = normalizeImageDimension(data.width ?? data.size, DEFAULT_IMAGE_WIDTH);
  const height = normalizeImageDimension(data.height ?? data.size, DEFAULT_IMAGE_HEIGHT);

  return {
    anchor: normalizeImageResizeAnchor(data.anchor),
    height,
    palette: normalizeImagePalette(data.palette),
    pixels: normalizeImagePixels(data.pixels, width, height),
    width,
  };
};

const buildImageResourceData = (): ImageResourceData => ({
  version: 1,
  width: imageGridWidth.value,
  height: imageGridHeight.value,
  anchor: imageResizeAnchor.value,
  palette: [...imageColorPalette.value],
  pixels: [...imagePixels.value],
});

const saveImagePixels = async (version: number) => {
  const currentResource = resource.value;
  if (!currentResource || !isImageEditor.value) {
    return;
  }

  const nextData = {
    ...(currentResource.data || {}),
    pixel_art: buildImageResourceData(),
  };

  const savedResource = await fetchApi<ProjectResourcePublic>(
    `/projects/${encodeURIComponent(props.projectId)}/resources/${encodeURIComponent(
      props.resourceId,
    )}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: nextData }),
    },
  );

  if (savedResource && version === imageAutosaveVersion.value) {
    resource.value = {
      ...currentResource,
      ...savedResource,
      data: nextData,
    };
  }
};

const scheduleImageAutosave = () => {
  if (!isImageEditor.value) {
    return;
  }

  imageAutosaveVersion.value += 1;
  const version = imageAutosaveVersion.value;

  if (imageAutosaveTimeout.value !== null) {
    window.clearTimeout(imageAutosaveTimeout.value);
  }

  imageAutosaveTimeout.value = window.setTimeout(() => {
    imageAutosaveTimeout.value = null;
    void saveImagePixels(version);
  }, IMAGE_AUTOSAVE_MS);
};

const updateImagePixels = (nextPixels: ImagePixelSnapshot) => {
  const normalizedPixels = emptyImagePixels().map((_, index) => nextPixels[index] || null);

  if (imagePixelsAreEqual(imagePixels.value, normalizedPixels)) {
    return false;
  }

  imagePixels.value = normalizedPixels;
  scheduleImageCanvasRender();
  scheduleImageAutosave();
  return true;
};

const imagePixelPosition = (index: number) => ({
  column: index % imageGridWidth.value,
  row: Math.floor(index / imageGridWidth.value),
});

const imagePixelIndexFor = (row: number, column: number) => row * imageGridWidth.value + column;

const imageLineBetweenPixels = (fromIndex: number, toIndex: number) => {
  const from = imagePixelPosition(fromIndex);
  const to = imagePixelPosition(toIndex);
  const pixels: number[] = [];

  let column = from.column;
  let row = from.row;
  const columnStep = column < to.column ? 1 : -1;
  const rowStep = row < to.row ? 1 : -1;
  const columnDelta = Math.abs(to.column - column);
  const rowDelta = -Math.abs(to.row - row);
  let error = columnDelta + rowDelta;

  while (true) {
    pixels.push(imagePixelIndexFor(row, column));

    if (column === to.column && row === to.row) {
      break;
    }

    const doubledError = error * 2;

    if (doubledError >= rowDelta) {
      error += rowDelta;
      column += columnStep;
    }

    if (doubledError <= columnDelta) {
      error += columnDelta;
      row += rowStep;
    }
  }

  return pixels;
};

const getImagePixelIndexFromPointer = (event: PointerEvent) => {
  const canvas = event.currentTarget as HTMLElement;
  const rect = canvas.getBoundingClientRect();
  const borderLeft = canvas.clientLeft;
  const borderTop = canvas.clientTop;
  const contentWidth = Math.max(1, canvas.clientWidth - borderLeft * 2);
  const contentHeight = Math.max(1, canvas.clientHeight - borderTop * 2);
  const x = event.clientX - rect.left - borderLeft;
  const y = event.clientY - rect.top - borderTop;

  if (x < 0 || y < 0 || x > contentWidth || y > contentHeight) {
    return null;
  }

  const step = imageArtboardMetrics.value.cellSize + imageGridLineGap.value;
  const column = Math.min(imageGridWidth.value - 1, Math.floor(x / step));
  const row = Math.min(imageGridHeight.value - 1, Math.floor(y / step));
  return imagePixelIndexFor(row, column);
};

const updateHoveredImagePixelFromPointer = (event: PointerEvent) => {
  const pixelIndex = getImagePixelIndexFromPointer(event);
  if (hoveredImagePixelIndex.value !== pixelIndex) {
    hoveredImagePixelIndex.value = pixelIndex;
  }
  return pixelIndex;
};

const isImageErasePointer = (event: PointerEvent) =>
  event.button === 2 || (event.buttons & 2) === 2;

const getImagePointerTool = (event: PointerEvent): ImagePaintTool => {
  if (!isImageErasePointer(event)) {
    return activeImageTool.value === "erase" ? "erase" : "pencil";
  }

  return activeImageTool.value === "erase" ? "pencil" : "erase";
};

const focusAndCaptureImagePointer = (event: PointerEvent) => {
  const canvas = event.currentTarget as HTMLElement;
  canvas.focus();
  canvas.setPointerCapture?.(event.pointerId);
};

const clampImageZoom = (zoom: number) => Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, zoom));
const clampPercentage = (value: number) => Math.min(100, Math.max(0, value));

let imagePreviewViewportFrame: number | null = null;

const updateImagePreviewViewport = () => {
  const stage = imageStageRef.value;
  const artboard = imageArtboardRef.value;

  if (!stage || !artboard || !isImageEditor.value) {
    imagePreviewViewport.value = { ...imagePreviewViewport.value, visible: false };
    return;
  }

  const stageRect = stage.getBoundingClientRect();
  const artboardRect = artboard.getBoundingClientRect();
  const intersectionLeft = Math.max(stageRect.left, artboardRect.left);
  const intersectionTop = Math.max(stageRect.top, artboardRect.top);
  const intersectionRight = Math.min(stageRect.right, artboardRect.right);
  const intersectionBottom = Math.min(stageRect.bottom, artboardRect.bottom);
  const intersectionWidth = intersectionRight - intersectionLeft;
  const intersectionHeight = intersectionBottom - intersectionTop;

  if (
    artboardRect.width <= 0 ||
    artboardRect.height <= 0 ||
    intersectionWidth <= 0 ||
    intersectionHeight <= 0
  ) {
    imagePreviewViewport.value = { ...imagePreviewViewport.value, visible: false };
    return;
  }

  const left = clampPercentage(((intersectionLeft - artboardRect.left) / artboardRect.width) * 100);
  const top = clampPercentage(((intersectionTop - artboardRect.top) / artboardRect.height) * 100);
  const width = clampPercentage((intersectionWidth / artboardRect.width) * 100);
  const height = clampPercentage((intersectionHeight / artboardRect.height) * 100);
  const coversFullImage = left <= 0.2 && top <= 0.2 && width >= 99.6 && height >= 99.6;

  imagePreviewViewport.value = {
    height,
    left,
    top,
    visible: !coversFullImage,
    width,
  };
};

const scheduleImagePreviewViewportUpdate = () => {
  if (imagePreviewViewportFrame !== null) {
    window.cancelAnimationFrame(imagePreviewViewportFrame);
  }

  imagePreviewViewportFrame = window.requestAnimationFrame(() => {
    imagePreviewViewportFrame = null;
    updateImagePreviewViewport();
  });
};

const updateImageViewportSize = () => {
  if (typeof window === "undefined") {
    return;
  }

  imageViewportWidth.value = window.innerWidth;
  imageViewportHeight.value = window.innerHeight;
  scheduleImagePreviewViewportUpdate();
};

const zoomImageFromWheel = (event: WheelEvent) => {
  if (!isImageEditor.value) {
    return;
  }

  const zoomDelta = -event.deltaY * IMAGE_ZOOM_WHEEL_STEP;
  const nextZoom = clampImageZoom(imageZoom.value * (1 + zoomDelta));
  if (nextZoom === imageZoom.value) {
    return;
  }

  const stage = imageStageRef.value;
  const artboard = imageArtboardRef.value;
  const stageRect = stage?.getBoundingClientRect();
  const artboardRect = artboard?.getBoundingClientRect();

  if (stageRect && artboardRect && artboardRect.width > 0 && artboardRect.height > 0) {
    const anchorClientX = Math.min(artboardRect.right, Math.max(artboardRect.left, event.clientX));
    const anchorClientY = Math.min(artboardRect.bottom, Math.max(artboardRect.top, event.clientY));
    const relativeX = (anchorClientX - artboardRect.left) / artboardRect.width;
    const relativeY = (anchorClientY - artboardRect.top) / artboardRect.height;
    const nextMetrics = imageArtboardMetricsForZoom(nextZoom);
    const centeredLeft = stageRect.left + (stageRect.width - nextMetrics.width) / 2;
    const centeredTop = stageRect.top + (stageRect.height - nextMetrics.height) / 2;

    imagePanX.value = anchorClientX - centeredLeft - relativeX * nextMetrics.width;
    imagePanY.value = anchorClientY - centeredTop - relativeY * nextMetrics.height;
  }

  imageZoom.value = nextZoom;
  scheduleImageCanvasRender();
  scheduleImagePreviewViewportUpdate();
};

const isImagePanButton = (event: PointerEvent) => event.button === 1 || (event.buttons & 4) === 4;

const startPanningImageFromPointer = (event: PointerEvent) => {
  isPanningImage.value = true;
  hoveredImagePixelIndex.value = null;
  focusAndCaptureImagePointer(event);
};

const continuePanningImageFromPointer = (event: PointerEvent) => {
  if (!isPanningImage.value) {
    return;
  }

  imagePanX.value += event.movementX;
  imagePanY.value += event.movementY;
  scheduleImagePreviewViewportUpdate();
};

let lastPaintedImagePixelIndex: number | null = null;
let imageResizeCenterColumnRemainder = 0;
let imageResizeCenterRowRemainder = 0;

const paintImagePixels = (indexes: number[], forcedTool?: ImagePaintTool) => {
  if (!isImageEditor.value) {
    return;
  }

  const tool = forcedTool || activeImageTool.value;
  const nextColor = tool === "erase" ? null : selectedImageColor.value;
  const didAddPaletteColor = nextColor
    ? addImagePaletteColor(nextColor, { autosave: false })
    : false;
  let didChange = false;

  for (const index of indexes) {
    if (index < 0 || index >= imagePixelCount.value) {
      continue;
    }

    if (imagePixels.value[index] === nextColor) {
      continue;
    }

    imagePixels.value[index] = nextColor;
    didChange = true;
  }

  if (!didChange) {
    if (didAddPaletteColor) {
      scheduleImageAutosave();
    }
    return;
  }

  triggerRef(imagePixels);
  scheduleImageCanvasRender();
  scheduleImageAutosave();
};

const fillImagePixelsFrom = (startIndex: number, replacementColor: PixelColor) => {
  if (!isImageEditor.value || startIndex < 0 || startIndex >= imagePixelCount.value) {
    return;
  }

  const targetColor = imagePixels.value[startIndex] || null;
  const didAddPaletteColor = replacementColor
    ? addImagePaletteColor(replacementColor, { autosave: false })
    : false;

  if (targetColor === replacementColor) {
    if (didAddPaletteColor) {
      scheduleImageAutosave();
    }
    return;
  }

  const nextPixels = [...imagePixels.value];
  const pending = [startIndex];
  const visited = new Set<number>();

  while (pending.length > 0) {
    const index = pending.pop();

    if (index === undefined || visited.has(index) || nextPixels[index] !== targetColor) {
      continue;
    }

    visited.add(index);
    nextPixels[index] = replacementColor;

    const row = Math.floor(index / imageGridWidth.value);
    const column = index % imageGridWidth.value;

    if (row > 0) pending.push(index - imageGridWidth.value);
    if (row < imageGridHeight.value - 1) pending.push(index + imageGridWidth.value);
    if (column > 0) pending.push(index - 1);
    if (column < imageGridWidth.value - 1) pending.push(index + 1);
  }

  const didChange = updateImagePixels(nextPixels);
  if (replacementColor && didChange) {
    addImagePaletteColor(replacementColor, { autosave: false });
  }
};

const pickImageColorFrom = (pixelIndex: number) => {
  const color = imagePixels.value[pixelIndex];

  if (!color) {
    return;
  }

  setSelectedImageColor(color);
};

const updateImageHueFromPointer = (event: PointerEvent) => {
  if (event.type === "pointermove" && event.buttons === 0) {
    return;
  }

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  selectedImageHue.value = (Math.atan2(y, x) * 180) / Math.PI + 180;
  selectedImageHue.value = (selectedImageHue.value + 360) % 360;
  applySelectedImageHsv();
};

const getImageTriangleWeightsFromPointer = (event: PointerEvent) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const scaleX = rect.width / (IMAGE_COLOR_TRIANGLE_RIGHT.x - IMAGE_COLOR_TRIANGLE_LEFT.x);
  const scaleY = rect.height / (IMAGE_COLOR_TRIANGLE_LEFT.y - IMAGE_COLOR_TRIANGLE_TOP.y);
  const x = IMAGE_COLOR_TRIANGLE_LEFT.x + (event.clientX - rect.left) / scaleX;
  const y = IMAGE_COLOR_TRIANGLE_TOP.y + (event.clientY - rect.top) / scaleY;
  const weights = getImageColorTriangleWeights(x, y);
  const clampedBlack = Math.max(0, weights.black);
  const clampedWhite = Math.max(0, weights.white);
  const clampedHue = Math.max(0, weights.hue);
  const total = clampedBlack + clampedWhite + clampedHue || 1;

  return {
    black: clampedBlack / total,
    hue: clampedHue / total,
    white: clampedWhite / total,
  };
};

const updateImageColorTriangleFromPointer = (event: PointerEvent) => {
  if (event.type === "pointermove" && event.buttons === 0) {
    return;
  }

  const weights = getImageTriangleWeightsFromPointer(event);
  const value = 1 - weights.black;
  selectedImageValue.value = clamp01(value);
  selectedImageSaturation.value = value <= 0 ? 0 : clamp01(weights.hue / value);
  applySelectedImageHsv();
};

const startImageHueSelection = (event: PointerEvent) => {
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  updateImageHueFromPointer(event);
};

const startImageColorTriangleSelection = (event: PointerEvent) => {
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  updateImageColorTriangleFromPointer(event);
};

watch(
  selectedImageHue,
  () => {
    void nextTick(renderImageColorTriangleCanvas);
  },
  { immediate: true },
);

const startPaintingImageFromPointer = (event: PointerEvent) => {
  if (isImagePanButton(event)) {
    startPanningImageFromPointer(event);
    return;
  }

  const pixelIndex = updateHoveredImagePixelFromPointer(event);

  if (pixelIndex === null) {
    return;
  }

  const pointerTool = getImagePointerTool(event);

  if (activeImageTool.value === "picker") {
    focusAndCaptureImagePointer(event);
    pickImageColorFrom(pixelIndex);
    return;
  }

  if (activeImageTool.value === "fill") {
    focusAndCaptureImagePointer(event);
    fillImagePixelsFrom(pixelIndex, isImageErasePointer(event) ? null : selectedImageColor.value);
    return;
  }

  isPaintingImage.value = true;
  focusAndCaptureImagePointer(event);
  paintImagePixels([pixelIndex], pointerTool);
  lastPaintedImagePixelIndex = pixelIndex;
};

const continuePaintingImageFromPointer = (event: PointerEvent) => {
  if (isPanningImage.value) {
    continuePanningImageFromPointer(event);
    return;
  }

  const pixelIndex = updateHoveredImagePixelFromPointer(event);

  const pointerTool = getImagePointerTool(event);

  if (!isPaintingImage.value) {
    return;
  }

  if (pixelIndex === null) {
    lastPaintedImagePixelIndex = null;
    return;
  }

  paintImagePixels(
    imageLineBetweenPixels(lastPaintedImagePixelIndex ?? pixelIndex, pixelIndex),
    pointerTool,
  );
  lastPaintedImagePixelIndex = pixelIndex;
};

const stopPaintingImage = () => {
  isPaintingImage.value = false;
  isPanningImage.value = false;
  lastPaintedImagePixelIndex = null;
};

const leaveImageCanvas = () => {
  hoveredImagePixelIndex.value = null;
  stopPaintingImage();
};

const cancelImageInteraction = () => {
  hoveredImagePixelIndex.value = null;
  stopPaintingImage();
};

const imageAnchorAlignment = (anchor: ImageResizeAnchor) => {
  const row = anchor.startsWith("top")
    ? "start"
    : anchor.startsWith("bottom")
      ? "end"
      : "center";
  const column = anchor.endsWith("left")
    ? "start"
    : anchor.endsWith("right")
      ? "end"
      : "center";

  return { column, row };
};

const imageResizeAnchorOptionByValue = (anchorValue: ImageResizeAnchor) =>
  IMAGE_RESIZE_ANCHORS.find((anchor) => anchor.value === anchorValue) ||
  IMAGE_RESIZE_ANCHORS.find((anchor) => anchor.value === DEFAULT_IMAGE_RESIZE_ANCHOR)!;

const activeImageResizeAnchorOption = computed(
  () => imageResizeAnchorOptionByValue(imageResizeAnchor.value),
);

const imageAnchorExpansionDirection = (anchorValue: ImageResizeAnchor) => {
  const activeAnchor = activeImageResizeAnchorOption.value;
  const targetAnchor = imageResizeAnchorOptionByValue(anchorValue);

  if (activeAnchor.value === targetAnchor.value) {
    return null;
  }

  for (const direction of activeAnchor.arrows) {
    const rowDelta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
    const columnDelta = direction === "left" ? -1 : direction === "right" ? 1 : 0;

    if (
      activeAnchor.row + rowDelta === targetAnchor.row &&
      activeAnchor.column + columnDelta === targetAnchor.column
    ) {
      return direction;
    }
  }

  return null;
};

const imageResizeOffset = (
  previousDimension: number,
  nextDimension: number,
  alignment: "center" | "end" | "start",
  axis: "column" | "row",
) => {
  if (alignment === "start") {
    if (axis === "column") {
      imageResizeCenterColumnRemainder = 0;
    } else {
      imageResizeCenterRowRemainder = 0;
    }

    return 0;
  }

  if (alignment === "end") {
    if (axis === "column") {
      imageResizeCenterColumnRemainder = 0;
    } else {
      imageResizeCenterRowRemainder = 0;
    }

    return nextDimension - previousDimension;
  }

  const remainder =
    axis === "column" ? imageResizeCenterColumnRemainder : imageResizeCenterRowRemainder;
  const exactOffset = (nextDimension - previousDimension) / 2 + remainder;
  const offset = Math.floor(exactOffset);
  const nextRemainder = exactOffset - offset;

  if (axis === "column") {
    imageResizeCenterColumnRemainder = nextRemainder;
  } else {
    imageResizeCenterRowRemainder = nextRemainder;
  }

  return offset;
};

const resizeImageWorkspace = (nextWidth: number, nextHeight: number) => {
  const width = normalizeImageDimension(nextWidth, imageGridWidth.value);
  const height = normalizeImageDimension(nextHeight, imageGridHeight.value);

  if (width === imageGridWidth.value && height === imageGridHeight.value) {
    return;
  }

  const previousWidth = imageGridWidth.value;
  const previousHeight = imageGridHeight.value;
  const previousPixels = [...imagePixels.value];
  const nextPixels = emptyImagePixels(width, height);
  const alignment = imageAnchorAlignment(imageResizeAnchor.value);
  const rowOffset = imageResizeOffset(previousHeight, height, alignment.row, "row");
  const columnOffset = imageResizeOffset(previousWidth, width, alignment.column, "column");

  for (let row = 0; row < previousHeight; row += 1) {
    const nextRow = row + rowOffset;

    if (nextRow < 0 || nextRow >= height) {
      continue;
    }

    for (let column = 0; column < previousWidth; column += 1) {
      const nextColumn = column + columnOffset;

      if (nextColumn < 0 || nextColumn >= width) {
        continue;
      }

      nextPixels[nextRow * width + nextColumn] = previousPixels[row * previousWidth + column] || null;
    }
  }

  imageGridWidth.value = width;
  imageGridHeight.value = height;
  imagePixels.value = nextPixels;
  scheduleImageCanvasRender();
  imageGridWidthDraft.value = String(width);
  imageGridHeightDraft.value = String(height);
  hoveredImagePixelIndex.value = null;
  stopPaintingImage();
  scheduleImageAutosave();
  void nextTick(scheduleImagePreviewViewportUpdate);
};

const syncImageDimensionDrafts = () => {
  imageGridWidthDraft.value = String(imageGridWidth.value);
  imageGridHeightDraft.value = String(imageGridHeight.value);
};

const updateImageWidthDraft = (event: Event) => {
  const value = (event.currentTarget as HTMLInputElement).value;
  imageGridWidthDraft.value = value;

  if (areImageDimensionsLinked.value) {
    imageGridHeightDraft.value = value;
  }
};

const updateImageHeightDraft = (event: Event) => {
  const value = (event.currentTarget as HTMLInputElement).value;
  imageGridHeightDraft.value = value;

  if (areImageDimensionsLinked.value) {
    imageGridWidthDraft.value = value;
  }
};

const applyImageWidthDraft = () => {
  if (!imageGridWidthDraft.value.trim()) {
    syncImageDimensionDrafts();
    return;
  }

  const nextWidth = normalizeImageDimension(Number(imageGridWidthDraft.value), imageGridWidth.value);

  if (areImageDimensionsLinked.value) {
    resizeImageWorkspace(nextWidth, nextWidth);
  } else {
    resizeImageWorkspace(nextWidth, imageGridHeight.value);
  }

  syncImageDimensionDrafts();
};

const applyImageHeightDraft = () => {
  if (!imageGridHeightDraft.value.trim()) {
    syncImageDimensionDrafts();
    return;
  }

  const nextHeight = normalizeImageDimension(Number(imageGridHeightDraft.value), imageGridHeight.value);

  if (areImageDimensionsLinked.value) {
    resizeImageWorkspace(nextHeight, nextHeight);
  } else {
    resizeImageWorkspace(imageGridWidth.value, nextHeight);
  }

  syncImageDimensionDrafts();
};

const selectImageResizeAnchor = (anchor: ImageResizeAnchor) => {
  if (imageResizeAnchor.value === anchor) {
    return;
  }

  imageResizeAnchor.value = anchor;
  imageResizeCenterColumnRemainder = 0;
  imageResizeCenterRowRemainder = 0;
  scheduleImageAutosave();
};

const toggleImageInspectorPanel = (panel: ImageInspectorPanel) => {
  activeImageInspectorPanel.value =
    activeImageInspectorPanel.value === panel ? null : panel;
};

const closeImageInspectorPanel = () => {
  activeImageInspectorPanel.value = null;
};

const selectCustomImageBackground = (event: Event) => {
  const input = event.currentTarget as HTMLInputElement;
  customImageBackground.value = input.value;
  scheduleImageCanvasRender();
};

const selectCustomImageGridColor = (event: Event) => {
  const input = event.currentTarget as HTMLInputElement;
  customImageGridColor.value = input.value;
};

const selectCustomImageSubdivisionColor = (event: Event) => {
  const input = event.currentTarget as HTMLInputElement;
  customImageSubdivisionColor.value = input.value;
};

const selectImageGridLineStyle = (style: ImageGridLineStyle) => {
  imageGridLineStyle.value = style;
  scheduleImageCanvasRender();
};

const selectImageGridSubdivisionThickness = (thickness: ImageGridSubdivisionThickness) => {
  imageGridSubdivisionThickness.value = thickness;
};

const commitImageGridSubdivision = () => {
  const value = Number(imageGridSubdivisionDraft.value);
  const normalized = Math.min(
    MAX_IMAGE_GRID_SUBDIVISION,
    Math.max(MIN_IMAGE_GRID_SUBDIVISION, Number.isFinite(value) ? Math.round(value) : 1),
  );

  imageGridSubdivision.value = normalized;
  imageGridSubdivisionDraft.value = String(normalized);
};

const updateImageGridSubdivisionDraft = (event: Event) => {
  const input = event.currentTarget as HTMLInputElement;
  imageGridSubdivisionDraft.value = input.value;

  if (input.value === "") {
    return;
  }

  commitImageGridSubdivision();
};

const selectImageGridGap = (gap: ImageGridGap) => {
  imageGridGap.value = gap;
  scheduleImageCanvasRender();
};

const updateImageGridLineOpacity = (event: Event) => {
  const input = event.currentTarget as HTMLInputElement;
  const value = Number(input.value);
  imageGridLineOpacity.value = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.18));
  imageGridLineOpacityDraft.value = imageGridLineOpacity.value.toFixed(2);
};

const commitImageGridLineOpacityDraft = () => {
  const value = Number(imageGridLineOpacityDraft.value);
  const normalized = Math.min(1, Math.max(0, Number.isFinite(value) ? value : imageGridLineOpacity.value));
  imageGridLineOpacity.value = normalized;
  imageGridLineOpacityDraft.value = normalized.toFixed(2);
};

const updateImageGridLineOpacityDraft = (event: Event) => {
  const input = event.currentTarget as HTMLInputElement;
  imageGridLineOpacityDraft.value = input.value;

  if (input.value === "") {
    return;
  }

  const value = Number(input.value);
  if (Number.isFinite(value)) {
    imageGridLineOpacity.value = Math.min(1, Math.max(0, value));
  }
};

const toggleImageDimensionLink = () => {
  areImageDimensionsLinked.value = !areImageDimensionsLinked.value;
};

const handleResourceEditorKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    closeImageInspectorPanel();
  }
};

const loadEditor = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  const [workspace, resourceDetail] = await Promise.all([
    fetchApi<WorkspaceBootstrap>("/workspace/"),
    fetchApi<ProjectResourceDetail>(
      `/projects/${encodeURIComponent(props.projectId)}/resources/${encodeURIComponent(
        props.resourceId,
      )}`,
    ),
  ]);

  if (!resourceDetail) {
    errorMessage.value = "This item is no longer available.";
    isLoading.value = false;
    return;
  }

  resource.value = resourceDetail;
  if (editorMetaByType[resourceDetail.type]?.routeKind === "image") {
    const imageData = readImagePixelsFromData(resourceDetail.data || {});
    imageGridWidth.value = imageData.width;
    imageGridHeight.value = imageData.height;
    syncImageDimensionDrafts();
    imageResizeAnchor.value = imageData.anchor;
    imagePixels.value = imageData.pixels;
    imageColorPalette.value = imageData.palette;
    imageResizeCenterColumnRemainder = 0;
    imageResizeCenterRowRemainder = 0;
    activeImageTool.value = "pencil";
    setSelectedImageColor(DEFAULT_PENCIL_COLOR);
  }
  project.value =
    workspace?.projects.find((workspaceProject) => workspaceProject.id === props.projectId) || null;

  const routeKind = editorMetaByType[resourceDetail.type]?.routeKind;
  if (routeKind && props.resourceKind !== routeKind) {
    window.history.replaceState(null, "", canonicalResourcePath.value);
  }

  isLoading.value = false;
  void nextTick(() => {
    scheduleImageCanvasRender();
    scheduleImagePreviewViewportUpdate();
    renderImageColorTriangleCanvas();
  });
};

onMounted(() => {
  window.addEventListener("pointerup", stopPaintingImage);
  window.addEventListener("keydown", handleResourceEditorKeydown);
  window.addEventListener("resize", updateImageViewportSize);
  updateImageViewportSize();
  void loadEditor();
  void nextTick(renderImageColorTriangleCanvas);
});

onUnmounted(() => {
  window.removeEventListener("pointerup", stopPaintingImage);
  window.removeEventListener("keydown", handleResourceEditorKeydown);
  window.removeEventListener("resize", updateImageViewportSize);
  if (imagePreviewViewportFrame !== null) {
    window.cancelAnimationFrame(imagePreviewViewportFrame);
    imagePreviewViewportFrame = null;
  }
  if (imageCanvasRenderFrame !== null) {
    window.cancelAnimationFrame(imageCanvasRenderFrame);
    imageCanvasRenderFrame = null;
  }
  if (imageAutosaveTimeout.value !== null) {
    window.clearTimeout(imageAutosaveTimeout.value);
    imageAutosaveTimeout.value = null;
    void saveImagePixels(imageAutosaveVersion.value);
  }
});
</script>

<template>
  <section class="resource-editor" :style="editorStyle">
    <StudioTopbar
      mode="project"
      center-max-width="min(520px, 38vw)"
      brand-interactive
      brand-aria-label="Back to studio"
      :brand-trail="projectName"
      :brand-trail-pixel-art="projectPixelArt"
      :brand-trail-loading="isLoading"
      brand-trail-interactive
      brand-trail-aria-label="Back to project"
      user-interactive
      :user-name="profileUserName"
      :user-username="profileUsername"
      :user-avatar-url="profileAvatarUrl"
      :user-email="profileEmail"
      :user-pixel-avatar="profilePixelAvatar"
      :user-label="profileEmail || profileUserName"
      @brand-click="returnToStudio"
      @brand-trail-click="returnToProject"
      @user-click="isProfileDialogOpen = true"
    >
      <template #center>
        <div class="resource-editor-title" :class="{ 'is-loading': isLoading }">
          <span class="resource-editor-title__icon" aria-hidden="true">
            <Icon :icon="editorMeta.icon" width="22" height="22" />
          </span>
          <span class="resource-editor-title__name">{{ resourceName }}</span>
          <span class="resource-editor-title__kind">{{ editorMeta.label }}</span>
        </div>
      </template>
    </StudioTopbar>

    <main class="resource-editor-stage" aria-label="Resource editor">
      <div v-if="isLoading" class="resource-editor-loader" role="status" aria-label="Loading item">
        <span></span>
      </div>

      <div v-else-if="errorMessage" class="resource-editor-error">
        <p>{{ errorMessage }}</p>
        <button type="button" @click="returnToProject">Back to project</button>
      </div>

      <div
        v-else
        ref="imageStageRef"
        class="resource-editor-canvas"
        :aria-label="`${editorMeta.label} editor in progress for ${resourceName}`"
        @wheel.prevent="zoomImageFromWheel"
      >
        <div v-if="isImageEditor" class="image-editor-toolbar" aria-label="Image tools">
          <button
            type="button"
            class="image-editor-tool"
            :class="{ 'is-active': activeImageTool === 'pencil' }"
            aria-label="Pencil"
            :aria-pressed="activeImageTool === 'pencil'"
            title="Pencil"
            @click="activeImageTool = 'pencil'"
          >
            <Pencil :size="19" :stroke-width="2.2" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="image-editor-tool"
            :class="{ 'is-active': activeImageTool === 'fill' }"
            aria-label="Fill"
            :aria-pressed="activeImageTool === 'fill'"
            title="Fill"
            @click="activeImageTool = 'fill'"
          >
            <PaintBucket :size="19" :stroke-width="2.2" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="image-editor-tool"
            :class="{ 'is-active': activeImageTool === 'erase' }"
            aria-label="Eraser"
            :aria-pressed="activeImageTool === 'erase'"
            title="Eraser"
            @click="activeImageTool = 'erase'"
          >
            <Eraser :size="19" :stroke-width="2.2" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="image-editor-tool"
            :class="{ 'is-active': activeImageTool === 'picker' }"
            aria-label="Color picker"
            :aria-pressed="activeImageTool === 'picker'"
            title="Color picker"
            @click="activeImageTool = 'picker'"
          >
            <Pipette :size="19" :stroke-width="2.2" aria-hidden="true" />
          </button>
        </div>
        <section
          v-if="isImageEditor"
          ref="imageColorPickerRef"
          class="image-editor-color-panel"
          :style="imageColorPickerStyle"
          aria-label="Drawing color picker"
        >
          <div class="image-editor-color-picker-stage">
              <div
                class="image-editor-color-wheel"
                aria-label="Hue"
                @pointerdown.prevent="startImageHueSelection"
                @pointermove.prevent="updateImageHueFromPointer"
              >
                <span
                  class="image-editor-color-hue-handle"
                  :style="imageColorHueHandleStyle"
                  aria-hidden="true"
                ></span>
              </div>
              <div
                class="image-editor-color-triangle"
                aria-label="Saturation and brightness"
                @pointerdown.prevent="startImageColorTriangleSelection"
                @pointermove.prevent="updateImageColorTriangleFromPointer"
              >
                <canvas ref="imageColorTriangleCanvasRef" aria-hidden="true"></canvas>
                <svg viewBox="0 0 196 184" aria-hidden="true" focusable="false">
                  <polygon
                    points="98 0 0 184 196 184"
                    fill="transparent"
                  />
                </svg>
                <span
                  class="image-editor-color-triangle-handle"
                  :style="imageColorTriangleHandleStyle"
                  aria-hidden="true"
                ></span>
              </div>
          </div>
          <div class="image-editor-color-value" aria-label="Selected color">
            <span aria-hidden="true"></span>
            <input
              :value="selectedImageColorDraft"
              aria-label="Selected color hex value"
              inputmode="text"
              maxlength="7"
              spellcheck="false"
              @blur="commitSelectedImageColorInput"
              @input="updateSelectedImageColorFromInput"
            />
            <button
              type="button"
              class="image-editor-color-add"
              aria-label="Add selected color to palette"
              title="Add color to palette"
              @click="addImagePaletteColor()"
            >
              <Plus :size="15" :stroke-width="2.4" aria-hidden="true" />
            </button>
          </div>
        </section>
        <div
          v-if="isImageEditor && imageColorPalette.length"
          class="image-editor-color-palette"
          aria-label="Drawing color palette"
        >
          <span class="image-editor-color-palette__title">
            <Palette :size="13" :stroke-width="2.3" aria-hidden="true" />
            Palette
          </span>
          <div class="image-editor-color-palette__swatches">
            <button
              v-for="color in imageColorPalette"
              :key="color"
              type="button"
              class="image-editor-color-swatch"
              :class="{ 'is-active': selectedImageColor.toUpperCase() === color }"
              :style="{ '--palette-color': color }"
              :aria-label="`Use ${color}`"
              :title="`${color} - right click to remove`"
              @click="selectImagePaletteColor(color)"
              @contextmenu.prevent="removeImagePaletteColor(color)"
            ></button>
          </div>
        </div>
        <aside v-if="isImageEditor" class="image-editor-preview" aria-label="Image preview">
          <div
            class="image-editor-preview__grid"
            :style="imagePreviewGridStyle"
            aria-hidden="true"
          >
            <canvas ref="imagePreviewCanvasRef"></canvas>
            <span
              v-if="imagePreviewViewport.visible"
              class="image-editor-preview__viewport"
              :style="imagePreviewViewportStyle"
            ></span>
          </div>
        </aside>
        <div v-if="isImageEditor" class="image-editor-side-inspector" aria-label="Image options">
          <section
            v-if="activeImageInspectorPanel"
            class="image-editor-inspector-panel"
            :aria-label="`${activeImageInspectorLabel} options`"
          >
            <div class="image-editor-inspector-header">
              <div class="image-editor-inspector-title">
                <Scaling
                  v-if="activeImageInspectorPanel === 'resize'"
                  :size="15"
                  :stroke-width="2.2"
                  aria-hidden="true"
                />
                <SlidersHorizontal
                  v-else
                  :size="15"
                  :stroke-width="2.2"
                  aria-hidden="true"
                />
                <span>{{ activeImageInspectorLabel }}</span>
              </div>
              <button
                type="button"
                class="image-editor-inspector-close"
                aria-label="Close image options"
                title="Close"
                @click="closeImageInspectorPanel"
              >
                <X :size="14" :stroke-width="2.4" aria-hidden="true" />
              </button>
            </div>

            <div
              v-if="activeImageInspectorPanel === 'resize'"
              class="image-editor-settings-page"
              aria-label="Resize options"
            >
              <div class="image-editor-dimensions">
                <div class="image-editor-control-heading">Size</div>
                <div class="image-editor-size-row">
                  <label class="image-editor-size-field" for="image-editor-width-input">Width:</label>
                  <input
                    id="image-editor-width-input"
                    class="image-editor-size-input"
                    type="number"
                    inputmode="numeric"
                    :min="MIN_IMAGE_DIMENSION"
                    :max="MAX_IMAGE_DIMENSION"
                    step="1"
                    :value="imageGridWidthDraft"
                    aria-label="Workspace width"
                    @input="updateImageWidthDraft"
                    @keydown.enter.prevent="applyImageWidthDraft"
                    @blur="syncImageDimensionDrafts"
                  />
                </div>
                <div class="image-editor-size-row">
                  <label class="image-editor-size-field" for="image-editor-height-input">Height:</label>
                  <input
                    id="image-editor-height-input"
                    class="image-editor-size-input"
                    type="number"
                    inputmode="numeric"
                    :min="MIN_IMAGE_DIMENSION"
                    :max="MAX_IMAGE_DIMENSION"
                    step="1"
                    :value="imageGridHeightDraft"
                    aria-label="Workspace height"
                    @input="updateImageHeightDraft"
                    @keydown.enter.prevent="applyImageHeightDraft"
                    @blur="syncImageDimensionDrafts"
                  />
                </div>
                <div class="image-editor-dimension-link-row">
                  <button
                    type="button"
                    class="image-editor-dimension-link"
                    :class="{ 'is-active': areImageDimensionsLinked }"
                    :aria-pressed="areImageDimensionsLinked"
                    :aria-label="areImageDimensionsLinked ? 'Unlink width and height' : 'Link width and height'"
                    :title="areImageDimensionsLinked ? 'Unlink size' : 'Link size'"
                    @click="toggleImageDimensionLink"
                  >
                    <Link2 v-if="areImageDimensionsLinked" :size="13" :stroke-width="2.2" aria-hidden="true" />
                    <Link2Off v-else :size="13" :stroke-width="2.2" aria-hidden="true" />
                  </button>
                  <span class="image-editor-dimension-link-label">
                    {{ areImageDimensionsLinked ? "Linked" : "Unlinked" }}
                  </span>
                </div>
              </div>
              <div class="image-editor-anchor-field" aria-label="Resize anchor">
                <div class="image-editor-control-heading">Anchor</div>
                <div class="image-editor-anchor-grid">
                  <button
                    v-for="anchor in IMAGE_RESIZE_ANCHORS"
                    :key="anchor.value"
                    type="button"
                    :class="{
                      'is-active': imageResizeAnchor === anchor.value,
                      'has-expansion-arrow': imageAnchorExpansionDirection(anchor.value),
                    }"
                    :aria-label="`Anchor ${anchor.label}`"
                    :aria-pressed="imageResizeAnchor === anchor.value"
                    :title="anchor.label"
                    @click="selectImageResizeAnchor(anchor.value)"
                  >
                    <span aria-hidden="true">
                      <i
                        v-if="imageResizeAnchor === anchor.value"
                        class="is-anchor"
                        aria-hidden="true"
                      ></i>
                      <i
                        v-else-if="imageAnchorExpansionDirection(anchor.value)"
                        class="is-arrow"
                        :class="`is-${imageAnchorExpansionDirection(anchor.value)}`"
                        aria-hidden="true"
                      ></i>
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div
              v-else
              class="image-editor-settings-page image-editor-preferences"
              aria-label="Preference options"
            >
              <div class="image-editor-preference-group">
                <div class="image-editor-control-heading">View</div>
                <div class="image-editor-preference-row">
                  <span class="image-editor-preference-label">Background</span>
                  <div class="image-editor-grid-color-list" aria-label="Canvas background">
                    <label
                      class="image-editor-background-color-picker"
                      aria-label="Use custom background color"
                      title="Background color"
                      :style="{ '--custom-background-color': customImageBackground }"
                    >
                      <input
                        type="color"
                        :value="customImageBackground"
                        @input="selectCustomImageBackground"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div class="image-editor-preference-group">
                <div class="image-editor-control-heading">Grid</div>
                <label class="image-editor-toggle-row">
                  <span>Show grid</span>
                  <input v-model="isImageGridVisible" type="checkbox" />
                </label>
                <div class="image-editor-grid-subheading">Main lines</div>
                <div class="image-editor-preference-row">
                  <span class="image-editor-preference-label">Color</span>
                  <div class="image-editor-grid-color-list" aria-label="Grid color">
                    <label
                      class="image-editor-grid-color-picker"
                      aria-label="Choose grid color"
                      title="Grid color"
                      :style="{ '--custom-grid-color': customImageGridColor }"
                    >
                      <input
                        type="color"
                        :value="customImageGridColor"
                        :disabled="!isImageGridVisible"
                        @input="selectCustomImageGridColor"
                      />
                    </label>
                  </div>
                </div>
                <div class="image-editor-preference-row">
                  <span class="image-editor-preference-label">Style</span>
                  <div class="image-editor-segment-list" aria-label="Grid line style">
                    <button
                      v-for="option in IMAGE_GRID_LINE_STYLE_OPTIONS"
                      :key="option.value"
                      type="button"
                      class="image-editor-segment-button"
                      :class="{ 'is-active': imageGridLineStyle === option.value }"
                      :aria-pressed="imageGridLineStyle === option.value"
                      :disabled="!isImageGridVisible"
                      @click="selectImageGridLineStyle(option.value)"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </div>
                <div class="image-editor-range-row">
                  <label for="image-grid-opacity-input">Opacity</label>
                  <input
                    id="image-grid-opacity-input"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    :disabled="!isImageGridVisible"
                    :value="imageGridLineOpacity"
                    @input="updateImageGridLineOpacity"
                  />
                  <input
                    class="image-editor-opacity-input"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    max="1"
                    step="0.01"
                    :disabled="!isImageGridVisible"
                    :value="imageGridLineOpacityDraft"
                    aria-label="Grid opacity value"
                    @input="updateImageGridLineOpacityDraft"
                    @blur="commitImageGridLineOpacityDraft"
                  />
                </div>
                <div class="image-editor-preference-row">
                  <span class="image-editor-preference-label">Spacing</span>
                  <div class="image-editor-gap-list" aria-label="Grid spacing">
                    <button
                      v-for="gap in IMAGE_GRID_GAP_OPTIONS"
                      :key="gap"
                      type="button"
                      class="image-editor-gap-button"
                      :class="{ 'is-active': imageGridGap === gap }"
                      :aria-label="`${gap} pixel grid spacing`"
                      :aria-pressed="imageGridGap === gap"
                      :disabled="!isImageGridVisible || imageGridLineStyle !== 'solid'"
                      @click="selectImageGridGap(gap)"
                    >
                      {{ gap }}
                    </button>
                  </div>
                </div>
                <div class="image-editor-grid-subheading">Subdivisions</div>
                <div class="image-editor-preference-row">
                  <span class="image-editor-preference-label">Every</span>
                  <input
                    class="image-editor-preference-number-input"
                    type="number"
                    inputmode="numeric"
                    :min="MIN_IMAGE_GRID_SUBDIVISION"
                    :max="MAX_IMAGE_GRID_SUBDIVISION"
                    step="1"
                    :disabled="!isImageGridVisible"
                    :value="imageGridSubdivisionDraft"
                    aria-label="Subdivision interval"
                    @input="updateImageGridSubdivisionDraft"
                    @blur="commitImageGridSubdivision"
                  />
                </div>
                <div class="image-editor-preference-row">
                  <span class="image-editor-preference-label">Color</span>
                  <div class="image-editor-grid-color-list" aria-label="Subdivision color">
                    <label
                      class="image-editor-subdivision-color-picker"
                      aria-label="Choose subdivision color"
                      title="Subdivision color"
                      :style="{ '--custom-subdivision-color': customImageSubdivisionColor }"
                    >
                      <input
                        type="color"
                        :value="customImageSubdivisionColor"
                        :disabled="!isImageGridVisible || imageGridSubdivision === 1"
                        @input="selectCustomImageSubdivisionColor"
                      />
                    </label>
                  </div>
                </div>
                <div class="image-editor-preference-row">
                  <span class="image-editor-preference-label">Thickness</span>
                  <div class="image-editor-gap-list" aria-label="Subdivision thickness">
                    <button
                      v-for="thickness in IMAGE_GRID_SUBDIVISION_THICKNESS_OPTIONS"
                      :key="thickness"
                      type="button"
                      class="image-editor-gap-button"
                      :class="{ 'is-active': imageGridSubdivisionThickness === thickness }"
                      :aria-label="`${thickness} pixel subdivision thickness`"
                      :aria-pressed="imageGridSubdivisionThickness === thickness"
                      :disabled="!isImageGridVisible || imageGridSubdivision === 1"
                      @click="selectImageGridSubdivisionThickness(thickness)"
                    >
                      {{ thickness }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div class="image-editor-inspector-rail" role="toolbar" aria-label="Image option panels">
            <button
              type="button"
              class="image-editor-inspector-button"
              :class="{ 'is-active': activeImageInspectorPanel === 'resize' }"
              :aria-pressed="activeImageInspectorPanel === 'resize'"
              aria-label="Resize options"
              title="Resize"
              @click="toggleImageInspectorPanel('resize')"
            >
              <Scaling :size="19" :stroke-width="2.1" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="image-editor-inspector-button"
              :class="{ 'is-active': activeImageInspectorPanel === 'preferences' }"
              :aria-pressed="activeImageInspectorPanel === 'preferences'"
              aria-label="Preference options"
              title="Preferences"
              @click="toggleImageInspectorPanel('preferences')"
            >
              <SlidersHorizontal :size="19" :stroke-width="2.1" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div
          v-if="isImageEditor"
          ref="imageArtboardRef"
          class="image-editor-artboard"
          :class="{ 'is-panning': isPanningImage }"
          :style="imageCanvasGridStyle"
          aria-label="Pixel art drawing grid"
          tabindex="0"
          @pointerdown.prevent="startPaintingImageFromPointer"
          @pointermove.prevent="continuePaintingImageFromPointer"
          @pointerup="stopPaintingImage"
          @pointercancel="cancelImageInteraction"
          @pointerleave="leaveImageCanvas"
          @auxclick.prevent
          @contextmenu.prevent
        >
          <canvas ref="imageCanvasRef" class="image-editor-canvas-bitmap"></canvas>
          <span
            v-for="line in imageSubdivisionVerticalLines"
            :key="`image-subdivision-column-${line.index}`"
            class="image-editor-subdivision-line is-vertical"
            :style="line.style"
            aria-hidden="true"
          ></span>
          <span
            v-for="line in imageSubdivisionHorizontalLines"
            :key="`image-subdivision-row-${line.index}`"
            class="image-editor-subdivision-line is-horizontal"
            :style="line.style"
            aria-hidden="true"
          ></span>
          <span
            v-if="hoveredImagePixelIndex !== null"
            class="image-editor-hover-cell"
            :style="imageHoverCellStyle"
            aria-hidden="true"
          ></span>
        </div>
      </div>
    </main>

    <UserProfileDialog
      :open="isProfileDialogOpen"
      :user-name="profileUserName"
      :user-username="profileUsername"
      :user-avatar-url="profileAvatarUrl"
      :user-email="profileEmail"
      :user-pixel-avatar="profilePixelAvatar"
      @close="isProfileDialogOpen = false"
      @saved="updateProfile"
    />
  </section>
</template>

<style scoped>
  .resource-editor {
    --surface: rgba(12, 13, 13, 0.88);
    --surface-soft: rgba(255, 252, 244, 0.055);
    --line: rgba(255, 252, 244, 0.14);
    --line-strong: rgba(255, 252, 244, 0.22);
    --text: #f7f1e7;
    --muted: rgba(247, 241, 231, 0.62);
    --quiet: rgba(247, 241, 231, 0.42);
    position: relative;
    z-index: 5;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    max-height: 100dvh;
    color: var(--text);
  }

  button {
    font: inherit;
    color: inherit;
  }

  .resource-editor-title {
    display: inline-grid;
    grid-template-columns: auto minmax(0, auto) auto;
    gap: 10px;
    align-items: center;
    justify-content: center;
    min-width: 0;
    max-width: 100%;
    height: 38px;
    padding: 0 12px;
    color: var(--text);
    background: rgba(255, 252, 244, 0.045);
    border: 1px solid rgba(255, 252, 244, 0.12);
    border-radius: 8px;
  }

  .resource-editor-title.is-loading {
    opacity: 0.72;
  }

  .resource-editor-title__icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    color: var(--resource-editor-color);
  }

  .resource-editor-title__icon svg {
    display: block;
    color: inherit;
  }

  .resource-editor-title__name {
    min-width: 0;
    overflow: hidden;
    font-size: 0.86rem;
    font-weight: 760;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .resource-editor-title__kind {
    flex: 0 0 auto;
    color: var(--quiet);
    font-size: 0.68rem;
    font-weight: 760;
  }

  .resource-editor-stage {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .resource-editor-canvas {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    background:
      linear-gradient(rgba(247, 241, 231, 0.055) 1px, transparent 1px),
      linear-gradient(90deg, rgba(247, 241, 231, 0.055) 1px, transparent 1px),
      #020303;
    background-size: 28px 28px;
  }

  .resource-editor-canvas::after {
    position: absolute;
    inset: 0;
    z-index: 0;
    content: "";
    background:
      radial-gradient(circle at 50% 44%, transparent 0, rgba(0, 0, 0, 0.18) 54%, rgba(0, 0, 0, 0.5) 100%),
      linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.34));
    pointer-events: none;
  }

  .image-editor-toolbar {
    position: absolute;
    top: 18px;
    left: 22px;
    z-index: 3;
    display: grid;
    grid-template-columns: repeat(2, 40px);
    gap: 8px;
  }

  .image-editor-tool {
    display: inline-grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    color: rgba(247, 241, 231, 0.74);
    cursor: pointer;
    background: rgba(16, 17, 17, 0.72);
    border: 1px solid rgba(247, 241, 231, 0.16);
    border-radius: 8px;
    outline: none;
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.34);
    transition:
      background 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .image-editor-tool:hover,
  .image-editor-tool:focus-visible,
  .image-editor-tool.is-active {
    color: #101111;
    background: #f7f1e7;
    border-color: #f7f1e7;
  }

  .image-editor-tool:hover,
  .image-editor-tool:focus-visible {
    transform: translateY(-1px);
  }

  .image-editor-color-panel {
    position: absolute;
    bottom: 28px;
    left: 22px;
    z-index: 3;
    display: grid;
    place-items: center;
    width: 292px;
    padding: 0;
    box-sizing: border-box;
    background: transparent;
    border: 0;
    box-shadow: none;
    backdrop-filter: none;
    transform: scale(0.82);
    transform-origin: bottom left;
  }

  .image-editor-color-picker-stage {
    position: relative;
    width: 292px;
    height: 292px;
  }

  .image-editor-color-wheel {
    position: absolute;
    inset: 0;
    width: 292px;
    height: 292px;
    border-radius: 50%;
    cursor: crosshair;
    background: conic-gradient(
      from -90deg,
      #f00,
      #ff0,
      #0f0,
      #0ff,
      #00f,
      #f0f,
      #f00
    );
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.6),
      inset 0 0 0 1px rgba(255, 255, 255, 0.16);
  }

  .image-editor-color-wheel::after {
    position: absolute;
    inset: 28px;
    content: "";
    background: rgba(16, 17, 17, 0.96);
    border-radius: 50%;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.6),
      inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    pointer-events: none;
  }

  .image-editor-color-hue-handle,
  .image-editor-color-triangle-handle {
    position: absolute;
    z-index: 3;
    width: 12px;
    height: 12px;
    box-sizing: border-box;
    border: 2px solid #f7f1e7;
    border-radius: 999px;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.72),
      0 2px 8px rgba(0, 0, 0, 0.42);
    pointer-events: none;
    transform: translate(-50%, -50%);
  }

  .image-editor-color-hue-handle {
    width: 28px;
    height: 8px;
    background: #f7f1e7;
    border: 1px solid rgba(16, 17, 17, 0.72);
    border-radius: 999px;
    box-shadow:
      0 0 0 1px rgba(247, 241, 231, 0.78),
      0 2px 8px rgba(0, 0, 0, 0.44);
  }

  .image-editor-color-triangle {
    position: absolute;
    top: 28px;
    left: 48px;
    z-index: 2;
    width: 196px;
    height: 184px;
    cursor: crosshair;
    overflow: visible;
    filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.34));
    pointer-events: none;
  }

  .image-editor-color-triangle::after {
    position: absolute;
    inset: 0;
    z-index: 1;
    content: "";
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.22), transparent 34%),
      radial-gradient(circle at 50% 62%, transparent 0 48%, rgba(0, 0, 0, 0.2) 78%);
    clip-path: polygon(50% 0, 0 100%, 100% 100%);
    mix-blend-mode: soft-light;
    pointer-events: none;
  }

  .image-editor-color-triangle canvas,
  .image-editor-color-triangle svg {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .image-editor-color-triangle svg {
    z-index: 2;
  }

  .image-editor-color-triangle polygon {
    pointer-events: fill;
  }

  .image-editor-color-triangle canvas {
    clip-path: polygon(50% 0, 0 100%, 100% 100%);
    image-rendering: auto;
  }

  .image-editor-color-triangle-handle {
    width: 13px;
    height: 13px;
  }

  .image-editor-color-value {
    display: grid;
    grid-template-columns: 32px 118px 34px;
    gap: 9px;
    align-items: center;
    width: max-content;
    margin-top: 14px;
    transform: scale(1.16);
    transform-origin: top center;
  }

  .image-editor-color-value span {
    width: 32px;
    height: 32px;
    background: var(--selected-image-color, #ffffff);
    border: 1px solid rgba(247, 241, 231, 0.58);
    border-radius: 6px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.38);
  }

  .image-editor-color-value input {
    min-width: 0;
    width: 100%;
    height: 34px;
    padding: 0 8px;
    background: rgba(5, 5, 5, 0.42);
    border: 1px solid transparent;
    border-radius: 6px;
    outline: none;
    color: rgba(247, 241, 231, 0.76);
    font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
    font-size: 0.82rem;
    font-weight: 760;
    line-height: 1;
    text-transform: uppercase;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      color 160ms ease;
  }

  .image-editor-color-value input:hover,
  .image-editor-color-value input:focus-visible {
    background: rgba(5, 5, 5, 0.64);
    border-color: rgba(247, 241, 231, 0.36);
    color: rgba(247, 241, 231, 0.96);
  }

  .image-editor-color-add {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    color: rgba(247, 241, 231, 0.82);
    background: rgba(5, 5, 5, 0.42);
    border: 1px solid rgba(247, 241, 231, 0.22);
    border-radius: 6px;
    cursor: pointer;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .image-editor-color-add:hover,
  .image-editor-color-add:focus-visible {
    color: rgba(247, 241, 231, 0.98);
    background: rgba(5, 5, 5, 0.66);
    border-color: rgba(247, 241, 231, 0.42);
    outline: none;
    transform: translateY(-1px);
  }

  .image-editor-color-palette {
    position: absolute;
    right: 22px;
    bottom: 22px;
    z-index: 3;
    display: grid;
    gap: 10px;
    width: 260px;
    max-width: min(260px, calc(100vw - 360px));
    padding: 12px;
    background: rgba(12, 13, 13, 0.82);
    border: 1px solid rgba(247, 241, 231, 0.14);
    border-radius: 8px;
    box-shadow:
      0 18px 40px rgba(0, 0, 0, 0.34),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
  }

  .image-editor-color-palette__title {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    color: rgba(247, 241, 231, 0.72);
    font-size: 0.72rem;
    font-weight: 760;
    line-height: 1;
    text-transform: uppercase;
  }

  .image-editor-color-palette__swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    justify-content: flex-start;
    width: 210px;
    justify-self: center;
  }

  .image-editor-color-swatch {
    width: 24px;
    height: 24px;
    padding: 0;
    background: var(--palette-color, #ffffff);
    border: 1px solid rgba(247, 241, 231, 0.28);
    border-radius: 6px;
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.3),
      0 4px 12px rgba(0, 0, 0, 0.24);
    cursor: pointer;
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      transform 160ms ease;
  }

  .image-editor-color-swatch:hover,
  .image-editor-color-swatch:focus-visible {
    border-color: rgba(247, 241, 231, 0.72);
    outline: none;
    transform: translateY(-1px);
  }

  .image-editor-color-swatch.is-active {
    border-color: rgba(247, 241, 231, 0.92);
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.38),
      0 0 0 2px rgba(247, 241, 231, 0.18),
      0 4px 12px rgba(0, 0, 0, 0.26);
  }

  .image-editor-preview {
    position: absolute;
    top: 18px;
    right: 22px;
    z-index: 3;
    width: clamp(138px, 13vw, 204px);
    aspect-ratio: 1;
    display: grid;
    align-items: start;
    box-sizing: border-box;
    justify-items: end;
    pointer-events: none;
  }

  .image-editor-preview__grid {
    position: relative;
    display: block;
    width: 100%;
    overflow: hidden;
    background: var(--image-preview-empty-pixel, #101111);
    border: 1px solid rgba(247, 241, 231, 0.34);
    border-radius: 5px;
    box-shadow:
      0 14px 34px rgba(0, 0, 0, 0.28),
      0 0 0 1px rgba(0, 0, 0, 0.5);
    image-rendering: pixelated;
  }

  .image-editor-preview__grid canvas {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .image-editor-preview__grid .image-editor-preview__viewport {
    position: absolute;
    z-index: 2;
    box-sizing: border-box;
    min-width: 8px;
    min-height: 8px;
    background: rgba(247, 241, 231, 0.08);
    border: 2px solid #f7f1e7;
    border-radius: 3px;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.68),
      0 0 12px rgba(247, 241, 231, 0.24);
    pointer-events: none;
  }

  .image-editor-side-inspector {
    position: absolute;
    top: 50%;
    right: 14px;
    z-index: 4;
    width: 40px;
    pointer-events: none;
    transform: translateY(-50%);
  }

  .image-editor-inspector-panel {
    position: absolute;
    top: 50%;
    right: calc(100% + 8px);
    display: block;
    gap: 14px;
    width: 284px;
    max-height: calc(100dvh - 118px);
    padding: 13px;
    overflow-x: hidden;
    overflow-y: auto;
    box-sizing: border-box;
    background:
      linear-gradient(180deg, rgba(255, 252, 244, 0.045), rgba(255, 252, 244, 0.015)),
      rgba(16, 17, 17, 0.92);
    border: 1px solid rgba(247, 241, 231, 0.18);
    border-radius: 8px;
    box-shadow:
      0 18px 42px rgba(0, 0, 0, 0.34),
      inset 0 1px 0 rgba(255, 252, 244, 0.06);
    pointer-events: auto;
    transform: translateY(-50%);
  }

  .image-editor-inspector-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
  }

  .image-editor-inspector-title {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 7px;
    align-items: center;
    min-width: 0;
    color: #f7f1e7;
    font-size: 0.72rem;
    font-weight: 820;
    letter-spacing: 0;
    line-height: 1;
  }

  .image-editor-inspector-title span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .image-editor-inspector-close {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: rgba(247, 241, 231, 0.54);
    cursor: pointer;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 5px;
    outline: none;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      color 160ms ease;
  }

  .image-editor-inspector-close:hover,
  .image-editor-inspector-close:focus-visible {
    color: #f7f1e7;
    background: rgba(255, 252, 244, 0.055);
    border-color: rgba(247, 241, 231, 0.14);
  }

  .image-editor-inspector-rail {
    display: grid;
    gap: 8px;
    width: 40px;
    box-sizing: border-box;
    justify-items: center;
    pointer-events: auto;
  }

  .image-editor-inspector-button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    color: rgba(247, 241, 231, 0.58);
    cursor: pointer;
    background:
      linear-gradient(180deg, rgba(255, 252, 244, 0.055), rgba(255, 252, 244, 0.018)),
      rgba(16, 17, 17, 0.9);
    border: 1px solid rgba(247, 241, 231, 0.16);
    border-radius: 8px;
    outline: none;
    box-shadow:
      0 12px 28px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 252, 244, 0.055);
    transition:
      background 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .image-editor-inspector-button:hover,
  .image-editor-inspector-button:focus-visible {
    color: rgba(247, 241, 231, 0.9);
    background:
      linear-gradient(180deg, rgba(255, 252, 244, 0.09), rgba(255, 252, 244, 0.035)),
      rgba(16, 17, 17, 0.94);
    border-color: rgba(247, 241, 231, 0.2);
  }

  .image-editor-inspector-button.is-active {
    color: #101111;
    background: #f7f1e7;
    border-color: #f7f1e7;
    box-shadow: 0 0 0 1px rgba(247, 241, 231, 0.2);
  }

  .image-editor-settings-page {
    display: grid;
    gap: 15px;
    min-width: 0;
  }

  .image-editor-dimensions {
    display: grid;
    gap: 9px;
    justify-items: stretch;
    width: 100%;
  }

  .image-editor-control-heading {
    width: 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 9px;
    align-items: center;
    color: rgba(247, 241, 231, 0.48);
    font-size: 0.65rem;
    font-weight: 820;
    letter-spacing: 0.02em;
    line-height: 1;
    text-transform: uppercase;
  }

  .image-editor-control-heading::after {
    display: block;
    height: 1px;
    content: "";
    background: linear-gradient(90deg, rgba(247, 241, 231, 0.16), transparent);
  }

  .image-editor-size-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 62px;
    gap: 10px;
    align-items: center;
    width: 100%;
  }

  .image-editor-size-field {
    justify-self: start;
    color: rgba(247, 241, 231, 0.68);
    font-size: 0.74rem;
    font-weight: 760;
    line-height: 1;
  }

  .image-editor-dimension-link-row {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    width: 100%;
    min-height: 22px;
    padding: 1px 0 0;
    box-sizing: border-box;
  }

  .image-editor-dimension-link {
    display: grid;
    justify-self: start;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    color: rgba(247, 241, 231, 0.52);
    cursor: pointer;
    background: rgba(255, 252, 244, 0.035);
    border: 1px solid rgba(247, 241, 231, 0.14);
    border-radius: 5px;
    outline: none;
    transition:
      background 160ms ease,
      border-color 160ms ease,
    color 160ms ease;
  }

  .image-editor-dimension-link-label {
    justify-self: start;
    min-width: 0;
    color: rgba(247, 241, 231, 0.68);
    font-size: 0.72rem;
    font-weight: 760;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .image-editor-dimension-link:hover,
  .image-editor-dimension-link:focus-visible {
    color: rgba(247, 241, 231, 0.86);
    background: rgba(255, 252, 244, 0.08);
    border-color: rgba(247, 241, 231, 0.24);
  }

  .image-editor-dimension-link.is-active {
    color: #101111;
    background: #f7f1e7;
    border-color: #f7f1e7;
  }

  .image-editor-size-input {
    width: 62px;
    height: 34px;
    padding: 0 7px;
    box-sizing: border-box;
    color: #f7f1e7;
    background: rgba(255, 252, 244, 0.045);
    border: 1px solid rgba(247, 241, 231, 0.18);
    border-radius: 7px;
    outline: none;
    font: inherit;
    font-size: 0.82rem;
    text-align: center;
  }

  .image-editor-size-input:focus {
    border-color: rgba(247, 241, 231, 0.36);
    background: rgba(255, 252, 244, 0.075);
  }

  .image-editor-preferences {
    gap: 16px;
  }

  .image-editor-preference-group {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .image-editor-preference-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, auto);
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  .image-editor-preferences .image-editor-preference-row {
    grid-template-columns: 92px minmax(136px, 1fr);
    min-height: 34px;
  }

  .image-editor-grid-subheading {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    padding-top: 4px;
    color: rgba(247, 241, 231, 0.46);
    font-size: 0.62rem;
    font-weight: 820;
    line-height: 1;
    text-transform: uppercase;
  }

  .image-editor-grid-subheading::after {
    height: 1px;
    content: "";
    background: rgba(247, 241, 231, 0.09);
  }

  .image-editor-preference-label,
  .image-editor-toggle-row span,
  .image-editor-range-row label {
    color: rgba(247, 241, 231, 0.72);
    font-size: 0.74rem;
    font-weight: 760;
    line-height: 1;
  }

  .image-editor-gap-list,
  .image-editor-grid-color-list,
  .image-editor-segment-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    justify-content: end;
    min-width: 0;
  }

  .image-editor-preferences .image-editor-gap-list,
  .image-editor-preferences .image-editor-grid-color-list,
  .image-editor-preferences .image-editor-segment-list {
    justify-content: end;
  }

  .image-editor-preferences .image-editor-segment-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    justify-self: end;
    width: 136px;
  }

  .image-editor-background-color-picker,
  .image-editor-grid-color-picker,
  .image-editor-subdivision-color-picker,
  .image-editor-gap-button,
  .image-editor-segment-button {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: rgba(247, 241, 231, 0.72);
    cursor: pointer;
    border: 1px solid rgba(247, 241, 231, 0.18);
    border-radius: 6px;
    outline: none;
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.3),
      0 1px 0 rgba(255, 252, 244, 0.04);
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .image-editor-background-color-picker {
    position: relative;
    overflow: hidden;
    background: var(--custom-background-color, #101111);
  }

  .image-editor-grid-color-picker,
  .image-editor-subdivision-color-picker {
    position: relative;
    overflow: hidden;
    background: var(--custom-grid-color, #f7f1e7);
  }

  .image-editor-subdivision-color-picker {
    margin-left: 3px;
    background: var(--custom-subdivision-color, #ff4d4d);
  }

  .image-editor-background-color-picker::after,
  .image-editor-grid-color-picker::after,
  .image-editor-subdivision-color-picker::after {
    position: absolute;
    right: 3px;
    bottom: 3px;
    width: 6px;
    height: 6px;
    content: "";
    background: #f7f1e7;
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.56);
    pointer-events: none;
  }

  .image-editor-background-color-picker input,
  .image-editor-grid-color-picker input,
  .image-editor-subdivision-color-picker input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    cursor: pointer;
    opacity: 0;
  }

  .image-editor-grid-color-picker:has(input:disabled),
  .image-editor-subdivision-color-picker:has(input:disabled) {
    cursor: default;
    opacity: 0.46;
  }

  .image-editor-background-color-picker:hover,
  .image-editor-background-color-picker:focus-within,
  .image-editor-grid-color-picker:hover,
  .image-editor-grid-color-picker:focus-within,
  .image-editor-subdivision-color-picker:hover,
  .image-editor-subdivision-color-picker:focus-within,
  .image-editor-gap-button:hover,
  .image-editor-gap-button:focus-visible,
  .image-editor-segment-button:hover,
  .image-editor-segment-button:focus-visible {
    border-color: rgba(247, 241, 231, 0.48);
    transform: translateY(-1px);
  }

  .image-editor-grid-color-picker:focus-within,
  .image-editor-subdivision-color-picker:focus-within,
  .image-editor-gap-button.is-active,
  .image-editor-segment-button.is-active {
    color: #101111;
    border-color: #f7f1e7;
    box-shadow:
      0 0 0 1px rgba(247, 241, 231, 0.24),
      0 6px 14px rgba(0, 0, 0, 0.22),
      inset 0 0 0 1px rgba(0, 0, 0, 0.36);
  }

  .image-editor-gap-button {
    width: 24px;
    height: 24px;
    background: rgba(255, 252, 244, 0.045);
    font: inherit;
    font-size: 0.7rem;
    font-weight: 800;
  }

  .image-editor-gap-button.is-active {
    background: #f7f1e7;
  }

  .image-editor-preference-number-input {
    justify-self: end;
    width: 62px;
    height: 34px;
    padding: 0 8px;
    box-sizing: border-box;
    color: #f7f1e7;
    background: rgba(255, 252, 244, 0.045);
    border: 1px solid rgba(247, 241, 231, 0.18);
    border-radius: 7px;
    outline: none;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 800;
    text-align: center;
  }

  .image-editor-preference-number-input:focus {
    border-color: rgba(247, 241, 231, 0.36);
    background: rgba(255, 252, 244, 0.075);
  }

  .image-editor-preference-number-input:disabled {
    cursor: default;
    opacity: 0.42;
  }

  .image-editor-segment-button {
    width: auto;
    min-width: 0;
    padding: 0 5px;
    background: rgba(255, 252, 244, 0.045);
    font: inherit;
    font-size: 0.66rem;
    font-weight: 800;
  }

  .image-editor-segment-button.is-active {
    color: #101111;
    background: #f7f1e7;
  }

  .image-editor-gap-button:disabled,
  .image-editor-segment-button:disabled {
    cursor: default;
    opacity: 0.42;
    transform: none;
  }

  .image-editor-toggle-row {
    display: grid;
    grid-template-columns: 92px minmax(136px, 1fr);
    gap: 10px;
    align-items: center;
    min-height: 26px;
  }

  .image-editor-toggle-row input {
    justify-self: end;
    width: 20px;
    height: 20px;
    margin: 0;
    cursor: pointer;
    appearance: none;
    background: rgba(255, 252, 244, 0.04);
    border: 1px solid rgba(247, 241, 231, 0.2);
    border-radius: 5px;
    outline: none;
  }

  .image-editor-toggle-row input:checked {
    background:
      radial-gradient(circle at center, #101111 0 3px, transparent 4px),
      #f7f1e7;
    border-color: #f7f1e7;
  }

  .image-editor-toggle-row input:focus-visible {
    border-color: rgba(247, 241, 231, 0.48);
  }

  .image-editor-range-row {
    display: grid;
    grid-template-columns: 92px minmax(76px, 1fr) 58px;
    gap: 8px;
    align-items: center;
    min-width: 0;
    min-height: 26px;
  }

  .image-editor-range-row input {
    width: 100%;
    min-width: 0;
    accent-color: #f7f1e7;
  }

  .image-editor-range-row input:disabled {
    opacity: 0.36;
  }

  .image-editor-opacity-input {
    min-width: 0;
    width: 100%;
    height: 24px;
    padding: 0 8px;
    box-sizing: border-box;
    color: rgba(247, 241, 231, 0.78);
    background: rgba(255, 252, 244, 0.04);
    border: 1px solid rgba(247, 241, 231, 0.16);
    border-radius: 5px;
    outline: none;
    font: inherit;
    font-size: 0.7rem;
    font-weight: 780;
    line-height: 1;
    text-align: center;
  }

  .image-editor-opacity-input::-webkit-outer-spin-button,
  .image-editor-opacity-input::-webkit-inner-spin-button {
    margin: 0;
    appearance: none;
  }

  .image-editor-opacity-input[type="number"] {
    appearance: textfield;
  }

  .image-editor-opacity-input:focus {
    border-color: rgba(247, 241, 231, 0.42);
    background: rgba(255, 252, 244, 0.075);
  }

  .image-editor-anchor-field {
    display: grid;
    width: 100%;
    gap: 11px;
    justify-items: start;
    align-content: center;
  }

  .image-editor-anchor-grid {
    display: grid;
    grid-template-columns: repeat(3, 22px);
    gap: 5px;
    justify-self: center;
  }

  .image-editor-anchor-grid button {
    position: relative;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    cursor: pointer;
    background: rgba(247, 241, 231, 0.05);
    border: 1px solid rgba(247, 241, 231, 0.14);
    border-radius: 5px;
    outline: none;
  }

  .image-editor-anchor-grid button:hover,
  .image-editor-anchor-grid button:focus-visible {
    background: rgba(247, 241, 231, 0.14);
    border-color: rgba(247, 241, 231, 0.3);
  }

  .image-editor-anchor-grid button.is-active {
    background: #f7f1e7;
    border-color: #f7f1e7;
  }

  .image-editor-anchor-grid button.has-expansion-arrow {
    background: rgba(247, 241, 231, 0.1);
    border-color: rgba(247, 241, 231, 0.24);
  }

  .image-editor-anchor-grid button span {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
  }

  .image-editor-anchor-grid button.is-active span {
    background: transparent;
  }

  .image-editor-anchor-grid button i {
    display: block;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .image-editor-anchor-grid button i.is-anchor {
    width: 6px;
    height: 6px;
    background: #101111;
    border-radius: 999px;
  }

  .image-editor-anchor-grid button i.is-up {
    border-right: 4px solid transparent;
    border-bottom: 6px solid #f7f1e7;
    border-left: 4px solid transparent;
  }

  .image-editor-anchor-grid button i.is-right {
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    border-left: 6px solid #f7f1e7;
  }

  .image-editor-anchor-grid button i.is-down {
    border-top: 6px solid #f7f1e7;
    border-right: 4px solid transparent;
    border-left: 4px solid transparent;
  }

  .image-editor-anchor-grid button i.is-left {
    border-top: 4px solid transparent;
    border-right: 6px solid #f7f1e7;
    border-bottom: 4px solid transparent;
  }

  .image-editor-artboard {
    position: absolute;
    top: calc(var(--image-artboard-center-y, 50%) - var(--image-artboard-half-height, 0px) + var(--image-pan-y, 0px));
    left: calc(var(--image-artboard-center-x, 50%) - var(--image-artboard-half-width, 0px) + var(--image-pan-x, 0px));
    z-index: 2;
    display: grid;
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid rgba(247, 241, 231, 0.36);
    border-radius: 8px;
    cursor: crosshair;
    outline: none;
    box-shadow:
      0 32px 90px rgba(0, 0, 0, 0.62),
      0 0 0 1px rgba(0, 0, 0, 0.72),
      inset 0 0 0 1px rgba(255, 252, 244, 0.035);
    touch-action: none;
    user-select: none;
  }

  .image-editor-artboard.is-panning {
    cursor: grabbing;
  }

  .image-editor-canvas-bitmap {
    position: absolute;
    inset: 1px;
    z-index: 1;
    display: block;
    image-rendering: pixelated;
    pointer-events: none;
  }

  .image-editor-artboard::before {
    position: absolute;
    inset: 1px;
    content: "";
    pointer-events: none;
  }

  .image-editor-artboard::before {
    z-index: 2;
    background-image:
      var(--image-grid-dash-image, none),
      radial-gradient(
        circle at 0 0,
        var(--image-grid-dot-color, rgba(247, 241, 231, 0.18)) 0 var(--image-grid-dot-size, 2px),
        transparent calc(var(--image-grid-dot-size, 2px) + 0.45px)
      );
    background-position: 0 0;
    background-size:
      var(--image-grid-step, 16px) var(--image-grid-step, 16px),
      var(--image-grid-step, 16px) var(--image-grid-step, 16px);
    opacity: max(var(--image-grid-dot-opacity, 0), var(--image-grid-dash-opacity, 0));
  }

  .image-editor-subdivision-line {
    position: absolute;
    z-index: 3;
    background: var(--image-grid-subdivision-color, rgba(247, 241, 231, 0.18));
    pointer-events: none;
  }

  .image-editor-subdivision-line.is-vertical {
    top: 1px;
    bottom: 1px;
  }

  .image-editor-subdivision-line.is-horizontal {
    right: 1px;
    left: 1px;
  }

  .image-editor-hover-cell {
    position: absolute;
    z-index: 4;
    box-sizing: border-box;
    border: 2px solid rgba(255, 255, 255, 0.92);
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.54),
      0 0 0 1px rgba(0, 0, 0, 0.32);
    pointer-events: none;
  }

  .resource-editor-loader,
  .resource-editor-error {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  .resource-editor-loader span {
    width: 26px;
    height: 26px;
    border: 2px solid rgba(247, 241, 231, 0.18);
    border-top-color: rgba(247, 241, 231, 0.84);
    border-radius: 999px;
    animation: resource-editor-loader 820ms linear infinite;
  }

  .resource-editor-error {
    gap: 14px;
    align-content: center;
  }

  .resource-editor-error p {
    margin: 0;
    color: var(--muted);
    font-weight: 700;
  }

  .resource-editor-error button {
    min-height: 40px;
    padding: 0 16px;
    cursor: pointer;
    background: #f7f1e7;
    border: 1px solid #f7f1e7;
    border-radius: 8px;
    color: #111;
    font-size: 0.84rem;
    font-weight: 760;
  }

  @keyframes resource-editor-loader {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 760px) {
    .resource-editor-title {
      max-width: min(100%, 270px);
      padding: 0 10px;
    }

    .resource-editor-title__kind {
      display: none;
    }
  }

  @media (max-width: 520px) {
    .resource-editor {
      min-height: 100dvh;
    }

    .resource-editor :deep(.studio-topbar) {
      gap: 11px 10px;
      padding: 12px 10px 10px;
    }

    .resource-editor :deep(.studio-topbar__brand-name) {
      max-width: 142px;
    }

    .resource-editor-title {
      justify-self: center;
      width: min(100%, 270px);
      height: 36px;
      border-radius: 7px;
    }

    .resource-editor-stage {
      min-height: 0;
    }

    .resource-editor-canvas {
      place-items: start center;
      overflow: hidden;
      padding: 128px 12px 226px;
      box-sizing: border-box;
    }

    .image-editor-toolbar {
      top: 18px;
      left: 20px;
      grid-template-columns: repeat(2, 38px);
    }

    .image-editor-tool,
    .image-editor-inspector-button {
      width: 38px;
      height: 38px;
      border-radius: 8px;
    }

    .image-editor-color-panel {
      bottom: 16px;
      left: 20px;
      width: 292px;
      padding: 0;
      transform: scale(0.5);
      transform-origin: bottom left;
    }

    .image-editor-preview {
      top: 18px;
      right: 20px;
      width: clamp(82px, 24vw, 100px);
    }

    .image-editor-color-palette {
      bottom: 16px;
      right: 20px;
      width: 124px;
      max-width: 124px;
      padding: 9px;
    }

    .image-editor-color-palette__swatches {
      width: 86px;
    }

    .image-editor-preview__grid {
      border-radius: 4px;
      box-shadow:
        0 10px 24px rgba(0, 0, 0, 0.34),
        0 0 0 1px rgba(0, 0, 0, 0.54);
    }

    .image-editor-preview__grid .image-editor-preview__viewport {
      min-width: 6px;
      min-height: 6px;
      border-width: 2px;
      border-radius: 2px;
    }

    .image-editor-side-inspector {
      top: auto;
      right: 20px;
      bottom: 142px;
      width: 38px;
      transform: none;
    }

    .image-editor-inspector-rail {
      gap: 7px;
      width: 38px;
    }

    .image-editor-inspector-panel {
      right: 0;
      bottom: calc(100% + 8px);
      top: auto;
      width: min(284px, calc(100vw - 72px));
      max-height: calc(100dvh - 220px);
      padding: 12px;
      border-radius: 8px;
      transform: none;
    }

    .image-editor-artboard {
      border-radius: 6px;
    }
  }

  @media (max-width: 380px) {
    .resource-editor :deep(.studio-topbar__brand-name) {
      max-width: 118px;
    }

    .image-editor-toolbar {
      left: 14px;
    }

    .resource-editor-canvas {
      padding-right: 10px;
      padding-left: 10px;
    }

    .image-editor-color-panel {
      left: 14px;
      transform: scale(0.46);
    }

    .image-editor-preview {
      right: 14px;
      width: 82px;
    }

    .image-editor-color-palette {
      right: 14px;
      width: 98px;
      max-width: 98px;
    }

    .image-editor-color-palette__swatches {
      width: 55px;
    }

    .image-editor-side-inspector {
      right: 14px;
    }
  }
</style>
