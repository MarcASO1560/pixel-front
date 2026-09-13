<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, triggerRef, watch } from "vue";
import {
  Download,
  Layers3,
  Link2,
  Link2Off,
  MousePointer2,
  PanelRightOpen,
  Plus,
  Scaling,
  SlidersHorizontal,
  X,
} from "@lucide/vue";
import { Icon, type IconifyIcon } from "@iconify/vue";
import fileImageIcon from "@iconify-icons/mdi/file-image";
import filmstripIcon from "@iconify-icons/mdi/filmstrip";
import musicNoteIcon from "@iconify-icons/mdi/music-note";

import {
  fetchApi,
  patchCurrentUser,
  patchProjectResource,
  type PixelAvatarData,
  type ProjectPublic,
  type ProjectResourceDetail,
  type UserPublic,
  type WorkspaceBootstrap,
} from "../../../lib/api";
import StudioTopbar from "../../navigation/components/StudioTopbar.vue";
import {
  clonePixelArtDocument,
  compositeVisibleLayers,
  createPixelArtDocument,
  createPixelLayer,
  MAX_IMAGE_LAYERS,
  normalizePixelColor,
} from "../../pixel-art/lib/document";
import {
  isCompleteImageColor,
  normalizeImageColorDraft,
} from "../../pixel-art/lib/color";
import { createImageCanvasRenderPlan } from "../../pixel-art/lib/canvasRendering";
import {
  clearRect,
  constrainPointToEightDirections,
  ellipsePoints,
  extractBlock,
  flipBlock,
  linePoints,
  moveLayer,
  moveRegion,
  normalizeSelection,
  paintPixels,
  placeBlock,
  rectanglePoints,
  rotateBlock90,
  squareBrushPoints,
  strokePoints,
  type PixelBlock,
  type PixelBuffer,
  type Point,
} from "../../pixel-art/lib/drawing";
import { createHistory, type SnapshotHistory } from "../../pixel-art/lib/history";
import {
  createImageGridOverlayPlan,
  getImageGridKeylineColor,
  type ImageGridLineStyle,
} from "../../pixel-art/lib/gridOverlay";
import { graffitiBrushStamp } from "../../pixel-art/lib/graffitiBrush";
import {
  canMutateImageLayerPixels,
  isImagePixelMutationTool,
} from "../../pixel-art/lib/layerEditing";
import {
  getImagePixelIndexFromClientPoint,
  getImagePixelSegmentFromClientSegment,
} from "../../pixel-art/lib/hitTesting";
import { getImagePointerIntent } from "../../pixel-art/lib/pointerIntent";
import {
  applyImageTwoFingerTransformDelta,
  normalizeImageRotationRadians,
  rotateImageClientPoint,
  type ImageViewportTransform,
} from "../../pixel-art/lib/pinchZoom";
import {
  createTouchViewportGesture,
  type TouchViewportGesture,
  type TouchViewportGestureFrame,
} from "../../pixel-art/lib/touchViewportGesture";
import {
  getImagePointerColorChannel,
  getImageToolColorIntent,
  type ImageColorChannel,
} from "../../pixel-art/lib/pointerColorIntent";
import {
  calculateImagePreviewSize,
  clipImagePreviewPolygonToBounds,
  IMAGE_PREVIEW_MAX_SIZE,
} from "../../pixel-art/lib/previewSizing";
import {
  parsePixelArtResourceData,
  PixelArtMigrationError,
  serializePixelArtResourceData,
} from "../../pixel-art/lib/migrations";
import {
  addPinnedPaletteColor,
  deletePinnedPaletteColor,
  deriveUsedPaletteColors,
  editPinnedPaletteColor,
  normalizePinnedPaletteColors,
  PIXEL_ART_PALETTE,
  type PinnedPaletteColor,
} from "../../pixel-art/lib/palette";
import { resizePixelArtDocument } from "../../pixel-art/lib/resize";
import {
  exportPixelArtJsonBlob,
  exportPixelArtPng,
  importPixelArtJson,
  importRasterImage,
  importRasterImageReduced,
  RasterImageTooLargeError,
  sanitizeImageFileName,
  type PngExportScale,
} from "../../pixel-art/lib/importExport";
import { useImageAutosave } from "../../pixel-art/composables/useImageAutosave";
import { useImagePreferences } from "../../pixel-art/composables/useImagePreferences";
import {
  getImageKeyboardAction,
  isEditableKeyboardTarget,
  type ImageKeyboardAction,
} from "../../pixel-art/composables/useImageKeyboardShortcuts";
import type {
  ImageEditorSnapshot,
  ImageResizeAnchor,
  ImageSelection,
  ImageTool,
  PixelArtDocumentV2,
  PixelColor,
  PixelLayer,
} from "../../pixel-art/types";
import ImageImportExportPanel from "../../pixel-art/components/ImageImportExportPanel.vue";
import ImageLayersPanel from "../../pixel-art/components/ImageLayersPanel.vue";
import ImageSaveStatus from "../../pixel-art/components/ImageSaveStatus.vue";
import ImageToolbar from "../../pixel-art/components/ImageToolbar.vue";
import ImageToolOptions from "../../pixel-art/components/ImageToolOptions.vue";
import ImageTransformPanel from "../../pixel-art/components/ImageTransformPanel.vue";
import ImageZoomControls from "../../pixel-art/components/ImageZoomControls.vue";
import ImageColorSwatches from "../../pixel-art/components/ImageColorSwatches.vue";
import ImagePalettePanel from "../../pixel-art/components/ImagePalettePanel.vue";
import type {
  ImagePaletteEditRequest,
  ImagePalettePinRequest,
  ImagePaletteRemoveRequest,
} from "../../pixel-art/components/ImagePalettePanel.types";
import ImageEditorNotice from "../../pixel-art/components/ImageEditorNotice.vue";
import ImageConflictNotice from "../../pixel-art/components/ImageConflictNotice.vue";
import UserProfileDialog from "./UserProfileDialog.vue";

type ResourceRouteKind = "image" | "animation" | "melody";

type EditorMeta = {
  routeKind: ResourceRouteKind;
  label: string;
  icon: IconifyIcon;
  color: string;
};

type ImagePixelSnapshot = PixelColor[];
type ImageAnchorArrowDirection = "down" | "left" | "right" | "up";
type ImageInspectorPanel = "preferences" | "resize" | "transfer" | "transform";
type ImageZoomMode = "actual" | "custom" | "fit";
type ImageGridGap = 1 | 2 | 3;
type ImageGridSubdivisionThickness = 1 | 2 | 3;
type ImageSubdivisionLine = {
  index: number;
  style: Record<string, string>;
};
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
type ImageFloatingPreview = {
  size: number;
  visible: boolean;
};
type ImageConflictOperation =
  | { kind: "document" }
  | { kind: "rename"; name: string };
type ImageGraffitiPreviewGesture = Readonly<{
  inverted: boolean;
  primaryColor: string;
  secondaryColor: string;
}>;
type ImageTouchPointer = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startsOnArtboard: boolean;
};
type ImageTransformGesture = {
  initialStageCenter: Readonly<{ x: number; y: number }>;
  initialView: ImageViewportTransform;
  lastFrame: TouchViewportGestureFrame;
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
const MIN_IMAGE_ZOOM = 0.25;
const MAX_IMAGE_ZOOM = 64;
const IMAGE_ZOOM_WHEEL_STEP = 0.0018;
const IMAGE_TOUCH_COMMIT_THRESHOLD = 8;
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
const initialImageDocument = createPixelArtDocument(DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT);
const imageLayers = shallowRef<PixelLayer[]>(initialImageDocument.layers);
const activeImageLayerId = ref(initialImageDocument.layers[0]?.id || "");
const imageSelection = ref<ImageSelection | null>(null);
const selectedImageColor = ref(DEFAULT_PENCIL_COLOR);
const selectedImageColorDraft = ref(DEFAULT_PENCIL_COLOR.toUpperCase());
const secondaryImageColor = ref("#000000");
const personalImagePalette = ref<PinnedPaletteColor[]>([]);
const imagePaletteUserId = ref("");
const isPersonalImagePaletteSaving = ref(false);
const activeImageTool = ref<ImageTool>("pencil");
const imageBrushSize = ref(1);
const isImageShapeFilled = ref(false);
const imageShapePreviewPoints = shallowRef<Point[]>([]);
const imagePointerStart = ref<Point | null>(null);
const imagePointerEnd = ref<Point | null>(null);
const imageClipboard = ref<PixelBlock | null>(null);
const imageResizeAnchor = ref<ImageResizeAnchor>(DEFAULT_IMAGE_RESIZE_ANCHOR);
const activeImageInspectorPanel = ref<ImageInspectorPanel | null>(null);
const isImageMobileDockOpen = ref(false);
const isImageMobileColorControlsOpen = ref(false);
const isImageTabletLayersDialogOpen = ref(false);
const imageMobileDockCloseRef = ref<HTMLButtonElement | null>(null);
const imageMobileDockTriggerRef = ref<HTMLButtonElement | null>(null);
const imageMobileColorCloseRef = ref<HTMLButtonElement | null>(null);
const imageMobileColorTriggerRef = ref<HTMLButtonElement | null>(null);
const imageTabletLayersCloseRef = ref<HTMLButtonElement | null>(null);
const imageTabletLayersTriggerRef = ref<HTMLButtonElement | null>(null);
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
const imageZoomMode = ref<ImageZoomMode>("fit");
const imageRotationRadians = ref(0);
const selectedImageHue = ref(0);
const selectedImageSaturation = ref(0);
const selectedImageValue = ref(1);
const imagePanX = ref(0);
const imagePanY = ref(0);
const imageViewportWidth = ref(0);
const imageViewportHeight = ref(0);
const isImageMobileViewport = computed(
  () => imageViewportWidth.value > 0 && imageViewportWidth.value <= 768,
);
const isImageTabletViewport = computed(
  () => imageViewportWidth.value > 768 && imageViewportWidth.value <= 1120,
);
const isImageDockOverlayViewport = computed(
  () => imageViewportWidth.value > 0 && imageViewportWidth.value <= 1120,
);
const areImageLayersFloating = computed(() => imageViewportWidth.value > 768);
const imageLayersTeleportTarget = computed(() =>
  isImageTabletViewport.value
    ? "#image-editor-tablet-layers-dialog-host"
    : "#image-editor-floating-layers",
);
const imageStageWidth = ref(0);
const imageStageHeight = ref(0);
const areImageDimensionsLinked = ref(true);
const isPaintingImage = ref(false);
const isPanningImage = ref(false);
const isImagePinching = ref(false);
const isImageSpacePressed = ref(false);
const imageInteractionKind = ref<"paint" | "shape" | "select" | "move" | null>(null);
const hoveredImagePixelIndex = ref<number | null>(null);
const imageGraffitiPreviewGesture = ref<ImageGraffitiPreviewGesture | null>(null);
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
const imageFloatingPreview = ref<ImageFloatingPreview>({
  size: IMAGE_PREVIEW_MAX_SIZE,
  visible: false,
});
const imageHistory = shallowRef<SnapshotHistory<ImageEditorSnapshot> | null>(null);
const isImageTransferBusy = ref(false);
const imageTransferNotice = ref("");
const imageTransferNoticeTone = ref<"error" | "info" | "success">("info");
const isImageConflictOpen = ref(false);
const imageConflictRemoteRevision = ref<number | null>(null);
const imageConflictOperation = ref<ImageConflictOperation | null>(null);
const isImageConflictResolving = ref(false);
const isRenamingResource = ref(false);
const isResourceNameSaving = ref(false);
const resourceNameSaveError = ref("");
const resourceNameDraft = ref("");
let imageMoveSourceBuffer: PixelBuffer | null = null;
let imageMoveSourceSelection: ImageSelection | null = null;
let imageMoveDidChange = false;
let imagePanPointerId: number | null = null;
let imagePanPointerClientX = 0;
let imagePanPointerClientY = 0;
let imageViewportPaintPointerId: number | null = null;
let imageViewportPaintButtonMask = 0;
let imagePointerColorChannel: ImageColorChannel = "primary";
let imageInteractionColor: PixelColor = DEFAULT_PENCIL_COLOR;
let imageInteractionTool: ImageTool | null = null;
let imageInteractionPrimaryColor = DEFAULT_PENCIL_COLOR;
let imageInteractionSecondaryColor = "#000000";
let imageInteractionGraffitiInverted = false;
let isImageViewportPaintAwaitingArtboard = false;
let imageViewportPaintClientX = 0;
let imageViewportPaintClientY = 0;
const imageTouchPointers = new Map<number, ImageTouchPointer>();
let imagePendingTouchPointerId: number | null = null;
let imageTransformGesture: ImageTransformGesture | null = null;
let imageTouchNavigationActive = false;
let imageTouchViewportGesture: TouchViewportGesture | null = null;
let imageGestureView: ImageViewportTransform | null = null;
let imageSingleTouchStartSnapshot: ImageEditorSnapshot | null = null;
let imageSingleTouchStartHistory: SnapshotHistory<ImageEditorSnapshot> | null = null;
let imageSingleTouchStartTool: ImageTool | null = null;
let imageSingleTouchStartPrimaryColor: string | null = null;
let imageSingleTouchStartSecondaryColor: string | null = null;
let imagePreferencesController: ReturnType<typeof useImagePreferences> | null = null;
let isApplyingImagePreferences = false;
let imageAutosaveSequence = 0;
let resourceMutationQueue: Promise<void> = Promise.resolve();
let personalImagePaletteMutationQueue: Promise<void> = Promise.resolve();
let pendingPersonalImagePaletteMutations = 0;
let resourceNameCommitPromise: Promise<void> | null = null;
let allowImageUnload = false;
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
const activeImageLayer = computed(
  () =>
    imageLayers.value.find((layer) => layer.id === activeImageLayerId.value) ||
    imageLayers.value[imageLayers.value.length - 1] ||
    null,
);
const imagePixels = computed<PixelColor[]>({
  get: () =>
    activeImageLayer.value?.pixels ||
    Array<PixelColor>(imageGridWidth.value * imageGridHeight.value).fill(null),
  set: (pixels) => {
    const activeLayerId = activeImageLayer.value?.id;
    if (!activeLayerId) return;
    imageLayers.value = imageLayers.value.map((layer) =>
      layer.id === activeLayerId ? { ...layer, pixels } : layer,
    );
  },
});
const usedImagePaletteColors = computed(() => deriveUsedPaletteColors(imageLayers.value));
const canEditImage = computed(
  () =>
    isImageEditor.value &&
    (project.value?.access_role === "owner" || project.value?.access_role === "editor"),
);
const canManagePersonalImagePalette = computed(
  () => Boolean(imagePaletteUserId.value) && !isPersonalImagePaletteSaving.value,
);
const canMutateActiveImageLayerPixels = computed(
  () => canEditImage.value && canMutateImageLayerPixels(activeImageLayer.value),
);
const isActiveImagePixelMutationTool = computed(() =>
  isImagePixelMutationTool(activeImageTool.value),
);
const isImagePixelMutationBlocked = computed(
  () => isActiveImagePixelMutationTool.value && !canMutateActiveImageLayerPixels.value,
);
const canUndoImage = computed(() => Boolean(imageHistory.value?.canUndo) && canEditImage.value);
const canRedoImage = computed(() => Boolean(imageHistory.value?.canRedo) && canEditImage.value);
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
const normalizeHexColorInput = normalizeImageColorDraft;
const isCompleteHexColor = isCompleteImageColor;
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
  const alpha = selectedImageColor.value.length === 9 ? selectedImageColor.value.slice(7) : "";
  setSelectedImageColor(
    `${hsvToHexColor(
      selectedImageHue.value,
      selectedImageSaturation.value,
      selectedImageValue.value,
    )}${alpha}`,
    { syncHsv: false },
  );
};
const updateSelectedImageColorFromInput = (event: Event) => {
  if (!canEditImage.value) return;
  const input = event.currentTarget as HTMLInputElement;
  const normalized = normalizeHexColorInput(input.value);
  selectedImageColorDraft.value = normalized;
  input.value = normalized;

  if (isCompleteHexColor(normalized)) {
    setSelectedImageColor(normalized);
  }
};
const commitSelectedImageColorInput = () => {
  if (!canEditImage.value) {
    selectedImageColorDraft.value = selectedImageColor.value.toUpperCase();
    return;
  }
  if (isCompleteHexColor(selectedImageColorDraft.value)) {
    setSelectedImageColor(selectedImageColorDraft.value);
    return;
  }

  selectedImageColorDraft.value = selectedImageColor.value.toUpperCase();
};
const imagePinnedPalettesAreEqual = (
  left: readonly PinnedPaletteColor[],
  right: readonly PinnedPaletteColor[],
) =>
  left.length === right.length &&
  left.every(
    (entry, index) =>
      entry.id === right[index]?.id &&
      entry.color === right[index]?.color &&
      entry.name === right[index]?.name,
  );

const enqueuePersonalImagePaletteMutation = <T,>(mutation: () => Promise<T>) => {
  pendingPersonalImagePaletteMutations += 1;
  isPersonalImagePaletteSaving.value = true;

  const settleMutation = () => {
    pendingPersonalImagePaletteMutations = Math.max(
      0,
      pendingPersonalImagePaletteMutations - 1,
    );
    isPersonalImagePaletteSaving.value = pendingPersonalImagePaletteMutations > 0;
  };
  const operation = personalImagePaletteMutationQueue
    .then(mutation, mutation)
    .then(
      (result) => {
        settleMutation();
        return result;
      },
      (error: unknown) => {
        settleMutation();
        throw error;
      },
    );
  personalImagePaletteMutationQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
};

const waitForPersonalImagePaletteMutations = async () => {
  let pendingQueue = personalImagePaletteMutationQueue;
  await pendingQueue;

  while (pendingQueue !== personalImagePaletteMutationQueue) {
    pendingQueue = personalImagePaletteMutationQueue;
    await pendingQueue;
  }
};

const persistPersonalImagePalette = (
  nextPalette: readonly PinnedPaletteColor[],
  successMessage: string,
) => {
  if (!canManagePersonalImagePalette.value) {
    return false;
  }

  const normalized = normalizePinnedPaletteColors(nextPalette);
  if (imagePinnedPalettesAreEqual(normalized, personalImagePalette.value)) {
    return false;
  }

  const previousPalette = personalImagePalette.value;
  personalImagePalette.value = normalized;

  return enqueuePersonalImagePaletteMutation(async () => {
    try {
      const user = await patchCurrentUser({ pixel_art_palette: normalized });
      personalImagePalette.value = normalizePinnedPaletteColors(user.pixel_art_palette);
      showImageNotice(successMessage, "success");
      return true;
    } catch (error) {
      personalImagePalette.value = previousPalette;
      showImageNotice(
        error instanceof Error ? error.message : "Your personal palette could not be saved.",
        "error",
      );
      return false;
    }
  });
};

const pinImagePaletteColor = async (
  request: ImagePalettePinRequest = { color: selectedImageColor.value },
) => {
  const nextPalette = addPinnedPaletteColor(personalImagePalette.value, request);
  if (imagePinnedPalettesAreEqual(nextPalette, personalImagePalette.value)) {
    showImageNotice("That color is already pinned to your palette.", "info");
    return false;
  }
  return persistPersonalImagePalette(nextPalette, "Color pinned to your palette.");
};
const selectImagePaletteColor = (color: string) => {
  if (!canEditImage.value) return;
  setSelectedImageColor(color);
};
const selectSecondaryImagePaletteColor = (color: string) => {
  if (!canEditImage.value) return;
  setSecondaryImageColor(color);
};
const editImagePaletteColor = (request: ImagePaletteEditRequest) => {
  const normalizedColor = normalizePixelColor(request.color);
  const hasColorCollision = Boolean(
    request.id &&
      normalizedColor &&
      personalImagePalette.value.some(
        (entry) => entry.id !== request.id && entry.color === normalizedColor,
      ),
  );
  if (hasColorCollision) {
    showImageNotice(
      "That color is already pinned. Choose another color or edit its existing swatch.",
      "info",
    );
    return false;
  }

  const nextPalette = request.id
    ? editPinnedPaletteColor(personalImagePalette.value, request.id, request)
    : addPinnedPaletteColor(personalImagePalette.value, request);
  return persistPersonalImagePalette(nextPalette, "Saved color updated.");
};
const unpinImagePaletteColor = ({ id }: ImagePaletteRemoveRequest) =>
  persistPersonalImagePalette(
    deletePinnedPaletteColor(personalImagePalette.value, id),
    "Color unpinned. Pixels using it were not changed.",
  );
const getImageGridLineBackground = (color: string) => {
  const { blue, green, red } = getRgbFromHexColor(color);

  return `rgba(${red}, ${green}, ${blue}, var(--image-grid-line-opacity, 0.18))`;
};
const activeImageInspectorLabel = computed(() => {
  if (activeImageInspectorPanel.value === "resize") {
    return "Resize";
  }

  if (activeImageInspectorPanel.value === "preferences") {
    return "Preferences";
  }

  if (activeImageInspectorPanel.value === "transform") {
    return "Transform";
  }

  if (activeImageInspectorPanel.value === "transfer") {
    return "Import & export";
  }

  return "Options";
});
const imageArtboardMetricsForZoom = (zoom: number) => {
  const gridWidth = imageGridWidth.value;
  const gridHeight = imageGridHeight.value;
  const cellSize = clampImageZoom(zoom);
  const renderPlan = createImageCanvasRenderPlan({ cellSize, gridHeight, gridWidth });

  return {
    cellSize,
    height: renderPlan.cssHeight,
    width: renderPlan.cssWidth,
  };
};
const imageArtboardMetrics = computed(() => imageArtboardMetricsForZoom(imageZoom.value));
const imageArtboardWidth = computed(() => imageArtboardMetrics.value.width);
const imageArtboardHeight = computed(() => imageArtboardMetrics.value.height);
const getImageViewportTransform = (): ImageViewportTransform =>
  imageGestureView || {
    panX: imagePanX.value,
    panY: imagePanY.value,
    rotationRadians: imageRotationRadians.value,
    zoom: imageZoom.value,
  };
const imageArtboardCenterYRatio = computed(() =>
  imageViewportWidth.value <= 520 ? 0.46 : 0.5,
);
const getImageLiveGestureScale = () =>
  imageZoom.value > 0 && imageGestureView ? imageGestureView.zoom / imageZoom.value : 1;
const imageGridOverlayPlan = computed(() =>
  createImageGridOverlayPlan({
    cellSize: imageArtboardMetrics.value.cellSize,
    gridHeight: imageGridHeight.value,
    gridWidth: imageGridWidth.value,
    lineStyle: imageGridLineStyle.value,
  }),
);
const imageGridOverlayPath = computed(() =>
  [
    ...imageGridOverlayPlan.value.verticalLines,
    ...imageGridOverlayPlan.value.horizontalLines,
  ]
    .map(({ x1, x2, y1, y2 }) => `M ${x1} ${y1} L ${x2} ${y2}`)
    .join(" "),
);
const imageGridOverlayOpacity = computed(() => {
  if (!isImageGridVisible.value) {
    return 0;
  }

  const lowZoomVisibility = clamp01((imageGridOverlayPlan.value.step - 4) / 2);

  return clamp01(imageGridLineOpacity.value) * lowZoomVisibility;
});
const imageGridStrokeWidth = computed(() =>
  Math.min(imageGridGap.value, Math.max(0.75, imageGridOverlayPlan.value.step * 0.25)),
);
const imageGridDashArray = computed(() => {
  const step = imageGridOverlayPlan.value.step;
  const dashLength = Math.min(6, Math.max(3, step * 0.35));
  const gapLength = Math.min(4, Math.max(2, step * 0.25));

  return `${dashLength.toFixed(2)} ${gapLength.toFixed(2)}`;
});
const imageGridDotRadius = computed(() => Math.max(0.75, imageGridStrokeWidth.value / 2));
const imageGridDotPatternId = computed(
  () => `image-grid-dots-${props.resourceId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
);
const imageGridDotClipRect = computed(() => {
  const inset = imageGridDotRadius.value + 0.01;

  return {
    height: Math.max(0, imageGridOverlayPlan.value.cssHeight - inset * 2),
    width: Math.max(0, imageGridOverlayPlan.value.cssWidth - inset * 2),
    x: inset,
    y: inset,
  };
});
const hasImageGridDotIntersections = computed(
  () =>
    imageGridWidth.value > 1 &&
    imageGridHeight.value > 1 &&
    imageGridDotClipRect.value.width > 0 &&
    imageGridDotClipRect.value.height > 0,
);
const imageSubdivisionLinePosition = (lineIndex: number) => {
  const cellSize = imageArtboardMetrics.value.cellSize;
  const thickness = imageGridSubdivisionThickness.value;
  const lineCenter = lineIndex * cellSize;

  return Math.max(0, lineCenter - thickness / 2);
};
const createImageSubdivisionLines = (count: number, axis: "horizontal" | "vertical") => {
  if (imageGridOverlayOpacity.value <= 0 || imageGridSubdivision.value <= 1) {
    return [];
  }

  const lines: ImageSubdivisionLine[] = [];
  for (let lineIndex = imageGridSubdivision.value; lineIndex < count; lineIndex += imageGridSubdivision.value) {
    const position = imageSubdivisionLinePosition(lineIndex);
    lines.push({
      index: lineIndex,
      style:
        axis === "vertical"
          ? { left: `${position}px`, width: `${imageGridSubdivisionThickness.value}px` }
          : { height: `${imageGridSubdivisionThickness.value}px`, top: `${position}px` },
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

  return {
    height: `${cellSize}px`,
    left: `${column * cellSize}px`,
    top: `${row * cellSize}px`,
    width: `${cellSize}px`,
  };
});
const isImageGraffitiHoverPreview = computed(
  () =>
    hoveredImagePixelIndex.value !== null &&
    (imageGraffitiPreviewGesture.value !== null || activeImageTool.value === "graffiti"),
);
const imageGraffitiHoverCells = computed(() => {
  const hoveredIndex = hoveredImagePixelIndex.value;
  if (
    hoveredIndex === null ||
    !isImageGraffitiHoverPreview.value ||
    !canMutateActiveImageLayerPixels.value
  ) {
    return [];
  }

  const cellSize = imageArtboardMetrics.value.cellSize;
  const gesture = imageGraffitiPreviewGesture.value;
  const pixels = graffitiBrushStamp(
    {
      x: hoveredIndex % imageGridWidth.value,
      y: Math.floor(hoveredIndex / imageGridWidth.value),
    },
    {
      bounds: { width: imageGridWidth.value, height: imageGridHeight.value },
      brushSize: imageBrushSize.value,
      inverted: gesture?.inverted ?? false,
      primaryColor: gesture?.primaryColor ?? selectedImageColor.value,
      secondaryColor: gesture?.secondaryColor ?? secondaryImageColor.value,
    },
  );

  return pixels.map((pixel) => ({
    key: `${pixel.x}-${pixel.y}`,
    style: {
      backgroundColor: pixel.color,
      borderColor: getImageGridKeylineColor(pixel.color),
      borderWidth: cellSize >= 4 ? "1px" : "0",
      height: `${cellSize}px`,
      left: `${pixel.x * cellSize}px`,
      top: `${pixel.y * cellSize}px`,
      width: `${cellSize}px`,
    },
  }));
});
const imageArtboardAriaLabel = computed(() => {
  const base = `Pixel art drawing grid, ${imageGridWidth.value} by ${imageGridHeight.value} pixels. ${activeImageTool.value} tool on ${activeImageLayer.value?.name || "active layer"}, primary color ${selectedImageColor.value}, secondary color ${secondaryImageColor.value}.`;
  const toolDescription =
    activeImageTool.value === "graffiti"
      ? " Alternates both colors in a 1 by 1 checker pattern. The right button reverses the pattern."
      : "";
  const layerState =
    activeImageLayer.value && !activeImageLayer.value.visible
      ? " The active layer is hidden; show it to edit pixels."
      : activeImageLayer.value?.locked
        ? " The active layer is locked; unlock it to edit pixels."
        : "";

  return `${base}${toolDescription}${layerState}`;
});
const imageViewportAriaLabel = computed(() => {
  const navigation =
    "Hold Space to pan, use the mouse wheel to zoom, or use two fingers to move, zoom, and rotate.";
  if (isImagePixelMutationBlocked.value) {
    const reason =
      activeImageLayer.value && !activeImageLayer.value.visible
        ? "The active layer is hidden; show it to edit pixels."
        : activeImageLayer.value?.locked
          ? "The active layer is locked; unlock it to edit pixels."
          : "Pixel editing is unavailable.";
    return `Drawing workspace. ${reason} ${navigation}`;
  }

  return `Drawing workspace. Start a stroke here and move onto the canvas. ${navigation}`;
});
const imageSelectionStyle = computed(() => {
  const selection = imageSelection.value;
  if (!selection || selection.width <= 0 || selection.height <= 0) return {};
  const cellSize = imageArtboardMetrics.value.cellSize;

  return {
    height: `${selection.height * cellSize}px`,
    left: `${selection.x * cellSize}px`,
    top: `${selection.y * cellSize}px`,
    width: `${selection.width * cellSize}px`,
  };
});
const imageCanvasGridStyle = computed(() => {
  return {
    gap: "0px",
    gridTemplateColumns: `repeat(${imageGridWidth.value}, 1fr)`,
    gridTemplateRows: `repeat(${imageGridHeight.value}, 1fr)`,
    height: `${imageArtboardHeight.value}px`,
    "--image-grid-height": `${imageGridHeight.value}`,
    "--image-grid-line-opacity": `${imageGridOverlayOpacity.value}`,
    "--image-grid-subdivision-color": getImageGridLineBackground(customImageSubdivisionColor.value),
    "--image-grid-subdivision-thickness": `${imageGridSubdivisionThickness.value}px`,
    "--image-grid-width": `${imageGridWidth.value}`,
    "--image-artboard-height": `${imageArtboardHeight.value}px`,
    "--image-artboard-half-height": `${imageArtboardHeight.value / 2}px`,
    "--image-artboard-half-width": `${imageArtboardWidth.value / 2}px`,
    "--image-artboard-width": `${imageArtboardWidth.value}px`,
    "--image-artboard-center-x": "50%",
    "--image-artboard-center-y": `${imageArtboardCenterYRatio.value * 100}%`,
    "--image-pixel-background": customImageBackground.value,
    width: `${imageArtboardWidth.value}px`,
  };
});
const imageCanvasBitmapStyle = computed(() => ({
  height: `${imageGridOverlayPlan.value.cssHeight}px`,
  width: `${imageGridOverlayPlan.value.cssWidth}px`,
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
const imageFloatingPreviewStyle = computed(() => ({
  "--image-preview-size": `${imageFloatingPreview.value.size}px`,
  visibility: imageFloatingPreview.value.visible ? "visible" : "hidden",
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
  const width = imageGridWidth.value;
  const height = imageGridHeight.value;
  const renderPlan = createImageCanvasRenderPlan({
    cellSize,
    gridHeight: height,
    gridWidth: width,
  });
  canvas.width = Math.max(1, renderPlan.bitmapWidth);
  canvas.height = Math.max(1, renderPlan.bitmapHeight);
  canvas.style.width = `${renderPlan.cssWidth}px`;
  canvas.style.height = `${renderPlan.cssHeight}px`;

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const visiblePixels = compositeVisibleLayers(buildImageDocument());

  for (let index = 0; index < visiblePixels.length; index += 1) {
    const column = index % width;
    const row = Math.floor(index / width);
    context.fillStyle = customImageBackground.value;
    context.fillRect(
      column * renderPlan.cellStride,
      row * renderPlan.cellStride,
      renderPlan.cellSize,
      renderPlan.cellSize,
    );
    const color = visiblePixels[index];
    if (color) {
      context.fillStyle = color;
      context.fillRect(
        column * renderPlan.cellStride,
        row * renderPlan.cellStride,
        renderPlan.cellSize,
        renderPlan.cellSize,
      );
    }
  }

  if (imageShapePreviewPoints.value.length > 0) {
    context.save();
    context.globalAlpha = 0.72;
    context.fillStyle = imageInteractionColor || "transparent";
    for (const point of imageShapePreviewPoints.value) {
      context.fillRect(
        point.x * renderPlan.cellStride,
        point.y * renderPlan.cellStride,
        renderPlan.cellSize,
        renderPlan.cellSize,
      );
    }
    context.restore();
  }
};

const setSecondaryImageColor = (color: string) => {
  if (!canEditImage.value) return;
  const normalized = normalizeHexColorInput(color);
  if (isCompleteHexColor(normalized)) {
    secondaryImageColor.value = normalized;
  }
};

const swapImageColors = () => {
  if (!canEditImage.value) return;
  const previousPrimary = selectedImageColor.value;
  setSelectedImageColor(secondaryImageColor.value);
  secondaryImageColor.value = previousPrimary;
};

const resetImageColors = () => {
  if (!canEditImage.value) return;
  setSelectedImageColor("#FFFFFF");
  secondaryImageColor.value = "#000000";
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
  const visiblePixels = compositeVisibleLayers(buildImageDocument());

  for (let index = 0; index < visiblePixels.length; index += 1) {
    const color = visiblePixels[index];
    if (!color) {
      continue;
    }

    const column = index % width;
    const row = Math.floor(index / width);
    context.fillStyle = color;
    context.fillRect(column, row, 1, 1);
  }
};

watch(
  imagePreviewCanvasRef,
  (canvas) => {
    if (canvas) {
      renderImagePreviewCanvas();
    }
  },
  { flush: "post" },
);

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

const navigateAfterImageSave = async (path: string) => {
  if (isImageEditor.value && isRenamingResource.value) {
    await commitResourceName();
  }

  if (isImageEditor.value) {
    await imageAutosave.flush();
    await resourceMutationQueue;
    await waitForPersonalImagePaletteMutations();

    const hasUnsavedName =
      isRenamingResource.value &&
      Boolean(resourceNameDraft.value.trim()) &&
      resourceNameDraft.value.trim() !== resource.value?.name;
    if (
      imageAutosave.hasPendingChanges.value ||
      isResourceNameSaving.value ||
      isPersonalImagePaletteSaving.value ||
      hasUnsavedName ||
      imageConflictOperation.value !== null
    ) {
      const shouldLeave = window.confirm(
        "Your latest changes could not be saved. Leave the editor anyway? Unsaved changes may be lost.",
      );
      if (!shouldLeave) {
        showImageNotice(
          imageSaveError.value || "Save your pending changes before leaving the editor.",
          "error",
        );
        return;
      }
    }
  }

  allowImageUnload = true;
  window.location.assign(path);
};

const returnToStudio = () => navigateAfterImageSave("/studio");

const returnToProject = () => navigateAfterImageSave(projectPath.value);

const updateProfile = (user: UserPublic) => {
  profileUsername.value = user.username || "";
  profileUserName.value = user.username || user.email;
  profileAvatarUrl.value = user.avatar_url || "";
  profileEmail.value = user.email;
  profilePixelAvatar.value = user.avatar_pixel_art || null;
  imagePaletteUserId.value = user.id;
  personalImagePalette.value = normalizePinnedPaletteColors(user.pixel_art_palette);
  isProfileDialogOpen.value = false;
};

const emptyImagePixels = (width = imageGridWidth.value, height = imageGridHeight.value) =>
  Array<PixelColor>(width * height).fill(null);

const imagePixelsAreEqual = (
  left: ReadonlyArray<PixelColor>,
  right: ReadonlyArray<PixelColor>,
) =>
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

const readImagePixelsFromData = (data: Record<string, unknown>) => {
  const result = parsePixelArtResourceData(data);
  const legacyPixelArt =
    data.pixel_art && typeof data.pixel_art === "object"
      ? (data.pixel_art as Record<string, unknown>)
      : data;

  return {
    anchor: normalizeImageResizeAnchor(legacyPixelArt.anchor),
    document: result.document,
    migrated: result.migrated,
    warnings: result.warnings,
  };
};

const showImageNotice = (
  message: string,
  tone: "error" | "info" | "success" = "info",
) => {
  imageTransferNotice.value = message;
  imageTransferNoticeTone.value = tone;
};

const enqueueResourceMutation = <T,>(mutation: () => Promise<T>) => {
  const operation = resourceMutationQueue.then(mutation, mutation);
  resourceMutationQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
};

const markImageReadOnly = () => {
  if (project.value) {
    project.value = { ...project.value, access_role: "viewer" };
  }
};

const openImageConflict = (
  operation: ImageConflictOperation,
  remoteRevision: number | null,
) => {
  imageConflictOperation.value = operation;
  imageConflictRemoteRevision.value = remoteRevision;
  isImageConflictOpen.value = true;
};

const persistResourceName = async (name: string) => {
  isResourceNameSaving.value = true;
  try {
    await enqueueResourceMutation(async () => {
      const currentResource = resource.value;
      if (!currentResource || !canEditImage.value) {
        throw new Error("You no longer have permission to rename this image.");
      }

      const result = await patchProjectResource(props.projectId, props.resourceId, {
        name,
        base_revision: currentResource.revision,
      });

      if (!result.ok) {
        if (result.conflict) {
          openImageConflict(
            { kind: "rename", name },
            result.conflict.current_revision,
          );
          throw new Error("A newer version exists. Choose which name to keep.");
        }
        if (result.status === 403) {
          markImageReadOnly();
        }
        throw new Error(
          result.status === 403
            ? "You no longer have permission to rename this image."
            : `The image name could not be saved${result.status ? ` (${result.status})` : ""}.`,
        );
      }

      resource.value = {
        ...currentResource,
        ...result.resource,
        data: currentResource.data,
      };
    });
  } finally {
    isResourceNameSaving.value = false;
  }
};

const startRenamingResource = () => {
  if (!canEditImage.value || !resource.value) return;
  resourceNameSaveError.value = "";
  resourceNameDraft.value = resource.value.name;
  isRenamingResource.value = true;
};

const cancelRenamingResource = () => {
  isRenamingResource.value = false;
  resourceNameSaveError.value = "";
  resourceNameDraft.value = resource.value?.name || "";
};

const performResourceNameCommit = async () => {
  const currentResource = resource.value;
  const name = resourceNameDraft.value.trim();
  if (!currentResource || !canEditImage.value || !name || name === currentResource.name) {
    cancelRenamingResource();
    return;
  }

  await imageAutosave.flush();
  if (imageAutosave.hasPendingChanges.value) {
    showImageNotice(
      imageSaveError.value || "Save the pending image changes before renaming it.",
      "error",
    );
    return;
  }

  try {
    await persistResourceName(name);
    resourceNameSaveError.value = "";
    isRenamingResource.value = false;
    showImageNotice("Image name updated.", "success");
  } catch (error) {
    resourceNameSaveError.value =
      error instanceof Error ? error.message : "The image name could not be saved.";
    showImageNotice(resourceNameSaveError.value, "error");
  }
};

const commitResourceName = () => {
  if (resourceNameCommitPromise) {
    return resourceNameCommitPromise;
  }

  const operation = performResourceNameCommit();
  resourceNameCommitPromise = operation;
  void operation.finally(() => {
    if (resourceNameCommitPromise === operation) {
      resourceNameCommitPromise = null;
    }
  });
  return operation;
};

const buildImageDocument = (): PixelArtDocumentV2 => ({
  version: 2,
  width: imageGridWidth.value,
  height: imageGridHeight.value,
  palette: [...usedImagePaletteColors.value],
  // Pixel buffers are treated as immutable throughout the editor. Reusing them
  // here keeps rendering and history snapshots cheap even at the v1 limits.
  layers: imageLayers.value.map((layer) => ({ ...layer, pixels: layer.pixels })),
});

const createImageSnapshot = (): ImageEditorSnapshot => ({
  document: buildImageDocument(),
  activeLayerId: activeImageLayerId.value,
  selection: imageSelection.value ? { ...imageSelection.value } : null,
});

const imageSnapshotsAreEqual = (left: ImageEditorSnapshot, right: ImageEditorSnapshot) => {
  const leftDocument = left.document;
  const rightDocument = right.document;
  if (
    left.activeLayerId !== right.activeLayerId ||
    leftDocument.width !== rightDocument.width ||
    leftDocument.height !== rightDocument.height ||
    leftDocument.palette.length !== rightDocument.palette.length ||
    leftDocument.layers.length !== rightDocument.layers.length ||
    leftDocument.palette.some((color, index) => color !== rightDocument.palette[index])
  ) {
    return false;
  }

  const leftSelection = left.selection;
  const rightSelection = right.selection;
  if (
    Boolean(leftSelection) !== Boolean(rightSelection) ||
    (leftSelection &&
      rightSelection &&
      (leftSelection.x !== rightSelection.x ||
        leftSelection.y !== rightSelection.y ||
        leftSelection.width !== rightSelection.width ||
        leftSelection.height !== rightSelection.height))
  ) {
    return false;
  }

  return leftDocument.layers.every((layer, index) => {
    const other = rightDocument.layers[index];
    return (
      other !== undefined &&
      layer.id === other.id &&
      layer.name === other.name &&
      layer.visible === other.visible &&
      layer.locked === other.locked &&
      layer.opacity === other.opacity &&
      layer.pixels === other.pixels
    );
  });
};

const applyImageSnapshot = (snapshot: ImageEditorSnapshot) => {
  const document = snapshot.document;
  imageGridWidth.value = document.width;
  imageGridHeight.value = document.height;
  imageLayers.value = document.layers.map((layer) => ({
    ...layer,
    pixels: layer.pixels,
  }));
  activeImageLayerId.value =
    document.layers.some((layer) => layer.id === snapshot.activeLayerId)
      ? snapshot.activeLayerId
      : document.layers[document.layers.length - 1]?.id || "";
  imageSelection.value = snapshot.selection ? { ...snapshot.selection } : null;
  syncImageDimensionDrafts();
  scheduleImageCanvasRender();
  void nextTick(scheduleImagePreviewViewportUpdate);
};

const resetImageHistory = () => {
  imageHistory.value = createHistory(createImageSnapshot(), {
    equals: imageSnapshotsAreEqual,
    limit: 100,
  });
};

const commitImageHistory = () => {
  if (!imageHistory.value) {
    resetImageHistory();
    return;
  }

  imageHistory.value = imageHistory.value.push(createImageSnapshot());
};

const undoImage = () => {
  if (!imageHistory.value?.canUndo || !canEditImage.value) return;
  imageHistory.value = imageHistory.value.undo();
  applyImageSnapshot(imageHistory.value.current);
  scheduleImageAutosave();
};

const redoImage = () => {
  if (!imageHistory.value?.canRedo || !canEditImage.value) return;
  imageHistory.value = imageHistory.value.redo();
  applyImageSnapshot(imageHistory.value.current);
  scheduleImageAutosave();
};

const saveImageDocument = async (_sequence: number) => {
  // Capture one immutable view only when the debounced request actually starts;
  // pointermove events merely advance a tiny sequence token.
  const document = buildImageDocument();

  await enqueueResourceMutation(async () => {
    const currentResource = resource.value;
    if (!currentResource || !canEditImage.value) {
      throw new Error("You no longer have permission to save this image.");
    }

    const nextData = serializePixelArtResourceData(
      currentResource.data || {},
      document,
    );

    const result = await patchProjectResource(props.projectId, props.resourceId, {
      data: nextData,
      base_revision: currentResource.revision,
    });

    if (!result.ok) {
      if (result.conflict) {
        openImageConflict({ kind: "document" }, result.conflict.current_revision);
        throw new Error("A newer version exists. Choose which version to keep.");
      }
      if (result.status === 403) {
        markImageReadOnly();
      }
      throw new Error(
        result.status === 403
          ? "You no longer have permission to save this image."
          : `Save failed${result.status ? ` (${result.status})` : ""}. Your changes are still local.`,
      );
    }

    resource.value = {
      ...currentResource,
      ...result.resource,
      data: nextData,
    };
  });
};

const imageAutosave = useImageAutosave<number>(saveImageDocument, {
  debounceMs: IMAGE_AUTOSAVE_MS,
});
const imageSaveStatus = imageAutosave.status;
const imageSaveError = imageAutosave.errorMessage;
const imageLastSavedAt = imageAutosave.lastSavedAt;
const hasPendingImageNameChange = computed(() => {
  const nextName = resourceNameDraft.value.trim();
  return Boolean(
    isRenamingResource.value &&
      nextName &&
      nextName !== resource.value?.name,
  );
});
const displayedImageSaveStatus = computed(() =>
  isResourceNameSaving.value
    ? "saving"
    : resourceNameSaveError.value
      ? "error"
      : hasPendingImageNameChange.value
        ? "dirty"
        : imageSaveStatus.value,
);
const displayedImageSaveError = computed(
  () => resourceNameSaveError.value || imageSaveError.value,
);
const normalizeResourceUpdatedAt = (value: string | null | undefined) => {
  const timestamp = value?.trim();
  if (!timestamp) return null;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)) return timestamp;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timestamp)
    ? `${timestamp}Z`
    : timestamp;
};
const effectiveImageLastSavedAt = computed(
  () => imageLastSavedAt.value ?? normalizeResourceUpdatedAt(resource.value?.updated_at),
);
const isImageSaveClean = computed(
  () =>
    displayedImageSaveStatus.value === "saved" &&
    !imageAutosave.hasPendingChanges.value &&
    !hasPendingImageNameChange.value,
);
const retryImageSave = () => {
  if (!canEditImage.value) return;
  if (
    resourceNameSaveError.value &&
    isRenamingResource.value &&
    resourceNameDraft.value.trim()
  ) {
    void commitResourceName();
    return;
  }
  void imageAutosave.retry();
};

const saveImageNow = async () => {
  if (
    !canEditImage.value ||
    displayedImageSaveStatus.value === "saving" ||
    isImageSaveClean.value
  ) return;

  if (isRenamingResource.value) {
    await commitResourceName();
  }

  await imageAutosave.flush();
};

const reloadImageAfterConflict = async () => {
  await waitForPersonalImagePaletteMutations();
  allowImageUnload = true;
  window.location.reload();
};

const fetchLatestImageResource = () =>
  fetchApi<ProjectResourceDetail>(
    `/projects/${encodeURIComponent(props.projectId)}/resources/${encodeURIComponent(
      props.resourceId,
    )}`,
  );

const keepLocalImageAfterConflict = async () => {
  const operation = imageConflictOperation.value;
  if (!operation || isImageConflictResolving.value) return;

  isImageConflictResolving.value = true;
  try {
    const latestResource = await fetchLatestImageResource();
    if (!latestResource) {
      throw new Error("The latest remote version could not be loaded.");
    }

    const latestImageData =
      operation.kind === "rename"
        ? readImagePixelsFromData(latestResource.data || {})
        : null;

    // Keep all remote resource fields, then reapply only the local operation.
    resource.value = latestResource;
    imageConflictRemoteRevision.value = null;
    imageConflictOperation.value = null;
    isImageConflictOpen.value = false;

    if (operation.kind === "rename") {
      const remoteDocument = latestImageData?.document;
      if (!remoteDocument) {
        throw new Error("The latest remote image could not be loaded.");
      }

      const previousActiveLayerId = activeImageLayerId.value;
      imageGridWidth.value = remoteDocument.width;
      imageGridHeight.value = remoteDocument.height;
      imageLayers.value = remoteDocument.layers;
      activeImageLayerId.value = remoteDocument.layers.some(
        (layer) => layer.id === previousActiveLayerId,
      )
        ? previousActiveLayerId
        : remoteDocument.layers[remoteDocument.layers.length - 1]?.id || "";
      imageSelection.value = null;
      syncImageDimensionDrafts();
      resetImageHistory();
      scheduleImageCanvasRender();
      void nextTick(scheduleImagePreviewViewportUpdate);

      await persistResourceName(operation.name);
      resourceNameDraft.value = operation.name;
      resourceNameSaveError.value = "";
      isRenamingResource.value = false;
      showImageNotice("Local image name kept on top of the remote version.", "success");
      return;
    }

    imageAutosave.schedule(++imageAutosaveSequence);
    await imageAutosave.retry();
    if (!imageAutosave.hasPendingChanges.value) {
      showImageNotice("Local image changes kept on top of the remote version.", "success");
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The conflict could not be resolved.";
    if (operation.kind === "rename") {
      resourceNameSaveError.value = message;
    }
    showImageNotice(message, "error");
  } finally {
    isImageConflictResolving.value = false;
  }
};

const scheduleImageAutosave = () => {
  if (!canEditImage.value) {
    return;
  }

  imageAutosave.schedule(++imageAutosaveSequence);
};

const updateImagePixels = (nextPixels: ImagePixelSnapshot) => {
  if (!canMutateActiveImageLayerPixels.value) {
    return false;
  }

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

const getImageArtboardClientSpace = () => {
  const artboard = imageArtboardRef.value;
  if (!artboard) return null;

  const rect = artboard.getBoundingClientRect();
  const scale = getImageLiveGestureScale();
  const center = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  const width = imageArtboardWidth.value * scale;
  const height = imageArtboardHeight.value * scale;
  const clientWidth = imageGridOverlayPlan.value.cssWidth * scale;
  const clientHeight = imageGridOverlayPlan.value.cssHeight * scale;
  const borderLeft = Math.max(0, (width - clientWidth) / 2);
  const borderTop = Math.max(0, (height - clientHeight) / 2);

  return {
    center,
    clientHeight,
    clientWidth,
    borderLeft,
    borderTop,
    rectLeft: center.x - width / 2,
    rectTop: center.y - height / 2,
    rotationRadians: getImageViewportTransform().rotationRadians,
    scale,
  };
};

const mapImageClientPointToUnrotatedArtboard = (
  point: Readonly<{ x: number; y: number }>,
  clientSpace: NonNullable<ReturnType<typeof getImageArtboardClientSpace>>,
) =>
  rotateImageClientPoint({
    center: clientSpace.center,
    point,
    rotationRadians: -clientSpace.rotationRadians,
  });

const getImagePixelIndexFromClientCoordinates = (clientX: number, clientY: number) => {
  const clientSpace = getImageArtboardClientSpace();
  if (!clientSpace) return null;

  const point = mapImageClientPointToUnrotatedArtboard({ x: clientX, y: clientY }, clientSpace);
  return getImagePixelIndexFromClientPoint({
    borderLeft: clientSpace.borderLeft,
    borderTop: clientSpace.borderTop,
    cellSize: imageArtboardMetrics.value.cellSize * clientSpace.scale,
    clientHeight: clientSpace.clientHeight,
    clientWidth: clientSpace.clientWidth,
    clientX: point.x,
    clientY: point.y,
    gridHeight: imageGridHeight.value,
    gridWidth: imageGridWidth.value,
    rectLeft: clientSpace.rectLeft,
    rectTop: clientSpace.rectTop,
  });
};

const getImagePixelIndexFromPointer = (event: PointerEvent) =>
  getImagePixelIndexFromClientCoordinates(event.clientX, event.clientY);

const updateHoveredImagePixelFromPointer = (event: PointerEvent) => {
  const pixelIndex = getImagePixelIndexFromPointer(event);
  if (hoveredImagePixelIndex.value !== pixelIndex) {
    hoveredImagePixelIndex.value = pixelIndex;
  }
  return pixelIndex;
};

const focusAndCaptureImagePointer = (event: PointerEvent) => {
  const interactionTarget = event.currentTarget as HTMLElement;
  imageStageRef.value?.focus({ preventScroll: true });
  if (event.type !== "pointerup" && event.type !== "pointercancel") {
    interactionTarget.setPointerCapture?.(event.pointerId);
  }
};

const clampImageZoom = (zoom: number) => Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, zoom));
const clampPercentage = (value: number) => Math.min(100, Math.max(0, value));

const getImageStageCenter = () => {
  const stageRect = imageStageRef.value?.getBoundingClientRect();
  if (!stageRect || stageRect.width <= 0 || stageRect.height <= 0) return null;

  return {
    x: stageRect.left + stageRect.width / 2,
    y: stageRect.top + stageRect.height * imageArtboardCenterYRatio.value,
  };
};

const setImageZoom = (zoom: number, mode: ImageZoomMode = "custom") => {
  const nextZoom = clampImageZoom(zoom);
  imageZoomMode.value = mode;
  if (Math.abs(nextZoom - imageZoom.value) < 0.0001) return;
  imageZoom.value = nextZoom;
  scheduleImageCanvasRender();
  scheduleImagePreviewViewportUpdate();
};

const fitImageToScreen = () => {
  if (imageTouchNavigationActive) return;

  const stage = imageStageRef.value;
  const stageWidth = stage?.clientWidth || imageStageWidth.value || imageViewportWidth.value || 1024;
  const stageHeight = stage?.clientHeight || imageStageHeight.value || imageViewportHeight.value || 768;
  imageStageWidth.value = stageWidth;
  imageStageHeight.value = stageHeight;

  const usableWidth = Math.max(160, stageWidth - 64);
  const usableHeight = Math.max(180, stageHeight - 96);
  const fittedCellSize = Math.min(
    (usableWidth - 2) / Math.max(1, imageGridWidth.value),
    (usableHeight - 2) / Math.max(1, imageGridHeight.value),
  );
  imageGestureView = null;
  imagePanX.value = 0;
  imagePanY.value = 0;
  imageRotationRadians.value = 0;
  void nextTick(writeCommittedImageTransform);
  setImageZoom(fittedCellSize, "fit");
};

const showImageAtActualSize = () => {
  imageGestureView = null;
  imagePanX.value = 0;
  imagePanY.value = 0;
  imageRotationRadians.value = 0;
  void nextTick(writeCommittedImageTransform);
  setImageZoom(1, "actual");
};

const zoomImageIn = () => setImageZoom(imageZoom.value * 1.25, "custom");
const zoomImageOut = () => setImageZoom(imageZoom.value / 1.25, "custom");

let imagePreviewViewportFrame: number | null = null;

const updateImagePreviewViewport = () => {
  const stage = imageStageRef.value;
  const artboard = imageArtboardRef.value;

  if (!stage || !artboard || !isImageEditor.value) {
    imagePreviewViewport.value = { ...imagePreviewViewport.value, visible: false };
    imageFloatingPreview.value = { ...imageFloatingPreview.value, visible: false };
    return;
  }

  const stageRect = stage.getBoundingClientRect();
  const artboardRect = artboard.getBoundingClientRect();
  const clientSpace = getImageArtboardClientSpace();
  imageFloatingPreview.value = {
    size: calculateImagePreviewSize({
      documentHeight: imageGridHeight.value,
      documentWidth: imageGridWidth.value,
      stageHeight: stageRect.height,
      stageWidth: stageRect.width,
    }),
    visible: true,
  };
  if (
    !clientSpace ||
    artboardRect.width <= 0 ||
    artboardRect.height <= 0 ||
    Math.min(stageRect.right, artboardRect.right) <= Math.max(stageRect.left, artboardRect.left) ||
    Math.min(stageRect.bottom, artboardRect.bottom) <= Math.max(stageRect.top, artboardRect.top)
  ) {
    imagePreviewViewport.value = { ...imagePreviewViewport.value, visible: false };
    return;
  }

  const stageCorners = [
    { x: stageRect.left, y: stageRect.top },
    { x: stageRect.right, y: stageRect.top },
    { x: stageRect.right, y: stageRect.bottom },
    { x: stageRect.left, y: stageRect.bottom },
  ].map((point) => mapImageClientPointToUnrotatedArtboard(point, clientSpace));
  const contentLeft = clientSpace.rectLeft + clientSpace.borderLeft;
  const contentTop = clientSpace.rectTop + clientSpace.borderTop;
  const contentRight = contentLeft + clientSpace.clientWidth;
  const contentBottom = contentTop + clientSpace.clientHeight;
  const visiblePolygon = clipImagePreviewPolygonToBounds(stageCorners, {
    bottom: contentBottom,
    left: contentLeft,
    right: contentRight,
    top: contentTop,
  });

  if (visiblePolygon.length === 0) {
    imagePreviewViewport.value = { ...imagePreviewViewport.value, visible: false };
    return;
  }

  const visibleLeft = Math.min(...visiblePolygon.map((point) => point.x));
  const visibleTop = Math.min(...visiblePolygon.map((point) => point.y));
  const visibleRight = Math.max(...visiblePolygon.map((point) => point.x));
  const visibleBottom = Math.max(...visiblePolygon.map((point) => point.y));

  if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) {
    imagePreviewViewport.value = { ...imagePreviewViewport.value, visible: false };
    return;
  }

  const left = clampPercentage(
    ((visibleLeft - contentLeft) / clientSpace.clientWidth) * 100,
  );
  const top = clampPercentage(
    ((visibleTop - contentTop) / clientSpace.clientHeight) * 100,
  );
  const width = clampPercentage(
    ((visibleRight - visibleLeft) / clientSpace.clientWidth) * 100,
  );
  const height = clampPercentage(
    ((visibleBottom - visibleTop) / clientSpace.clientHeight) * 100,
  );
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

let imageFitFrame: number | null = null;
let imageStageResizeObserver: ResizeObserver | null = null;

const cancelScheduledImageFitToScreen = () => {
  if (imageFitFrame === null || typeof window === "undefined") return;
  window.cancelAnimationFrame(imageFitFrame);
  imageFitFrame = null;
};

const scheduleImageFitToScreen = () => {
  if (typeof window === "undefined") return;
  cancelScheduledImageFitToScreen();
  imageFitFrame = window.requestAnimationFrame(() => {
    imageFitFrame = null;
    if (imageZoomMode.value === "fit" && !imageTouchNavigationActive) fitImageToScreen();
  });
};

const syncImageStageSize = () => {
  const stage = imageStageRef.value;
  const nextWidth = stage?.clientWidth || 0;
  const nextHeight = stage?.clientHeight || 0;
  const didResize = nextWidth !== imageStageWidth.value || nextHeight !== imageStageHeight.value;
  imageStageWidth.value = nextWidth;
  imageStageHeight.value = nextHeight;

  if (didResize && imageZoomMode.value === "fit") {
    scheduleImageFitToScreen();
  }
  if (didResize && imageTransformGesture) {
    updateImageTransformGesture(imageTransformGesture.lastFrame);
  }
  scheduleImagePreviewViewportUpdate();
};

const observeImageStage = () => {
  imageStageResizeObserver?.disconnect();
  imageStageResizeObserver = null;
  bindImageTouchViewportGesture();

  const stage = imageStageRef.value;
  if (!stage) return;

  if (typeof ResizeObserver !== "undefined") {
    imageStageResizeObserver = new ResizeObserver(syncImageStageSize);
    imageStageResizeObserver.observe(stage);
  }
  syncImageStageSize();
};

const updateImageViewportSize = () => {
  if (typeof window === "undefined") {
    return;
  }

  imageViewportWidth.value = window.innerWidth;
  imageViewportHeight.value = window.innerHeight;
  syncImageStageSize();
};

const zoomImageFromWheel = (event: WheelEvent) => {
  if (!isImageEditor.value || imageTouchNavigationActive) {
    return;
  }

  const zoomDelta = -event.deltaY * IMAGE_ZOOM_WHEEL_STEP;
  const nextZoom = clampImageZoom(imageZoom.value * (1 + zoomDelta));
  if (nextZoom === imageZoom.value) {
    return;
  }

  const stageCenter = getImageStageCenter();
  if (stageCenter) {
    const anchor = { x: event.clientX, y: event.clientY };
    const nextView = applyImageTwoFingerTransformDelta({
      currentStageCenter: stageCenter,
      delta: {
        currentCentroid: anchor,
        previousCentroid: anchor,
        rotationRadians: 0,
        zoomFactor: nextZoom / imageZoom.value,
      },
      maximumZoom: MAX_IMAGE_ZOOM,
      minimumZoom: MIN_IMAGE_ZOOM,
      previousStageCenter: stageCenter,
      view: {
        panX: imagePanX.value,
        panY: imagePanY.value,
        rotationRadians: imageRotationRadians.value,
        zoom: imageZoom.value,
      },
    });
    imagePanX.value = nextView.panX;
    imagePanY.value = nextView.panY;
    writeCommittedImageTransform();
  }

  imageZoomMode.value = "custom";
  imageZoom.value = nextZoom;
  scheduleImageCanvasRender();
  scheduleImagePreviewViewportUpdate();
};

const getImagePointerEventIntent = (event: PointerEvent) =>
  getImagePointerIntent({
    button: event.button,
    buttons: event.buttons,
    spacePressed: isImageSpacePressed.value,
    startsOnArtboard: event.currentTarget === imageArtboardRef.value,
  });

const isImagePanButton = (event: PointerEvent) => getImagePointerEventIntent(event) === "pan";

const captureImagePointerInteractionIntent = (event: PointerEvent) => {
  imageInteractionTool = activeImageTool.value;
  imagePointerColorChannel =
    getImagePointerColorChannel({ button: event.button, buttons: event.buttons }) || "primary";
  imageInteractionPrimaryColor = selectedImageColor.value;
  imageInteractionSecondaryColor = secondaryImageColor.value;
  imageViewportPaintButtonMask = imagePointerColorChannel === "secondary" ? 2 : 1;
  const colorIntent = getImageToolColorIntent({
    tool: imageInteractionTool,
    channel: imagePointerColorChannel,
    primaryColor: selectedImageColor.value,
    secondaryColor: secondaryImageColor.value,
  });
  if (colorIntent.kind === "checker") {
    imageInteractionPrimaryColor = colorIntent.primaryColor;
    imageInteractionSecondaryColor = colorIntent.secondaryColor;
    imageInteractionGraffitiInverted = colorIntent.inverted;
  } else {
    imageInteractionGraffitiInverted = false;
  }
  imageGraffitiPreviewGesture.value =
    colorIntent.kind === "checker"
      ? {
          inverted: colorIntent.inverted,
          primaryColor: colorIntent.primaryColor,
          secondaryColor: colorIntent.secondaryColor,
        }
      : null;
  imageInteractionColor =
    colorIntent.kind === "paint"
      ? colorIntent.color
      : colorIntent.kind === "checker" && colorIntent.inverted
        ? colorIntent.secondaryColor
        : selectedImageColor.value;
};

const startPanningImageFromPointer = (event: PointerEvent) => {
  if (imagePanPointerId !== null || imageViewportPaintPointerId !== null) {
    return;
  }

  imagePanPointerId = event.pointerId;
  imagePanPointerClientX = event.clientX;
  imagePanPointerClientY = event.clientY;
  isPanningImage.value = true;
  hoveredImagePixelIndex.value = null;
  focusAndCaptureImagePointer(event);
};

const startImageViewportInteractionFromPointer = (
  event: PointerEvent,
  startPoint?: Readonly<{ x: number; y: number }>,
) => {
  const intent = getImagePointerEventIntent(event);
  if (intent === "pan") {
    startPanningImageFromPointer(event);
    return;
  }

  if (
    intent !== "paint" ||
    imagePanPointerId !== null ||
    imageViewportPaintPointerId !== null
  ) {
    return;
  }

  if (
    isImagePixelMutationTool(activeImageTool.value) &&
    !canMutateActiveImageLayerPixels.value
  ) {
    return;
  }

  imageViewportPaintPointerId = event.pointerId;
  captureImagePointerInteractionIntent(event);
  isImageViewportPaintAwaitingArtboard = true;
  imageViewportPaintClientX = startPoint?.x ?? event.clientX;
  imageViewportPaintClientY = startPoint?.y ?? event.clientY;
  hoveredImagePixelIndex.value = null;
  focusAndCaptureImagePointer(event);
};

const startImageArtboardInteractionFromPointer = (
  event: PointerEvent,
  startPoint?: Readonly<{ x: number; y: number }>,
) => {
  const intent = getImagePointerEventIntent(event);
  if (intent === "pan") {
    startPanningImageFromPointer(event);
    return;
  }

  if (
    intent !== "paint" ||
    imagePanPointerId !== null ||
    imageViewportPaintPointerId !== null
  ) {
    return;
  }

  if (
    isImagePixelMutationTool(activeImageTool.value) &&
    !canMutateActiveImageLayerPixels.value
  ) {
    return;
  }

  imageViewportPaintPointerId = event.pointerId;
  captureImagePointerInteractionIntent(event);
  const clientX = startPoint?.x ?? event.clientX;
  const clientY = startPoint?.y ?? event.clientY;
  imageViewportPaintClientX = clientX;
  imageViewportPaintClientY = clientY;
  const initialPixelIndex = getImagePixelIndexFromClientCoordinates(clientX, clientY);
  isImageViewportPaintAwaitingArtboard = initialPixelIndex === null;
  if (initialPixelIndex === null) {
    hoveredImagePixelIndex.value = null;
    focusAndCaptureImagePointer(event);
    return;
  }
  startPaintingImageFromPointer(event, false, initialPixelIndex);
};

const continuePanningImageFromPointer = (event: PointerEvent) => {
  if (!isPanningImage.value || imagePanPointerId !== event.pointerId) {
    return;
  }

  const deltaX = event.clientX - imagePanPointerClientX;
  const deltaY = event.clientY - imagePanPointerClientY;
  imagePanPointerClientX = event.clientX;
  imagePanPointerClientY = event.clientY;

  if (deltaX === 0 && deltaY === 0) {
    return;
  }

  imageZoomMode.value = "custom";
  imagePanX.value += deltaX;
  imagePanY.value += deltaY;
  writeCommittedImageTransform();
  scheduleImagePreviewViewportUpdate();
};

const processImagePointerSegment = (
  event: PointerEvent,
  to: Readonly<{ x: number; y: number }>,
) => {
  const clientSpace = getImageArtboardClientSpace();
  if (!clientSpace) return;

  const from = { x: imageViewportPaintClientX, y: imageViewportPaintClientY };
  imageViewportPaintClientX = to.x;
  imageViewportPaintClientY = to.y;
  const unrotatedFrom = mapImageClientPointToUnrotatedArtboard(from, clientSpace);
  const unrotatedTo = mapImageClientPointToUnrotatedArtboard(to, clientSpace);
  const contentLeft = clientSpace.rectLeft + clientSpace.borderLeft;
  const contentTop = clientSpace.rectTop + clientSpace.borderTop;
  const pixelSegment = getImagePixelSegmentFromClientSegment({
    borderLeft: clientSpace.borderLeft,
    borderTop: clientSpace.borderTop,
    bounds: {
      bottom: contentTop + clientSpace.clientHeight,
      left: contentLeft,
      right: contentLeft + clientSpace.clientWidth,
      top: contentTop,
    },
    cellSize: imageArtboardMetrics.value.cellSize * clientSpace.scale,
    clientHeight: clientSpace.clientHeight,
    clientWidth: clientSpace.clientWidth,
    from: unrotatedFrom,
    gridHeight: imageGridHeight.value,
    gridWidth: imageGridWidth.value,
    rectLeft: clientSpace.rectLeft,
    rectTop: clientSpace.rectTop,
    to: unrotatedTo,
  });

  if (!pixelSegment) {
    if (!isImageViewportPaintAwaitingArtboard && imageInteractionKind.value === "paint") {
      lastPaintedImagePixelIndex = null;
    }
    return;
  }

  const { startIndex: segmentStartIndex, endIndex: segmentEndIndex } = pixelSegment;

  if (isImageViewportPaintAwaitingArtboard) {
    isImageViewportPaintAwaitingArtboard = false;
    startPaintingImageFromPointer(event, false, segmentStartIndex);
    if (segmentEndIndex !== segmentStartIndex) {
      continuePaintingImageFromPointer(event, segmentEndIndex);
    }
    return;
  }

  if (
    imageInteractionKind.value === "paint" &&
    getImagePixelIndexFromClientCoordinates(from.x, from.y) === null
  ) {
    lastPaintedImagePixelIndex = segmentStartIndex;
  }
  continuePaintingImageFromPointer(event, segmentEndIndex);
};

const getImagePointerSamplePoints = (event: PointerEvent) => {
  const coalescedEvents =
    typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
  const points = coalescedEvents.map((sample) => ({ x: sample.clientX, y: sample.clientY }));
  const lastPoint = points[points.length - 1];
  if (!lastPoint || lastPoint.x !== event.clientX || lastPoint.y !== event.clientY) {
    points.push({ x: event.clientX, y: event.clientY });
  }
  return points;
};

const continueImageViewportInteractionFromPointer = (event: PointerEvent) => {
  if (isPanningImage.value) {
    continuePanningImageFromPointer(event);
    return;
  }

  if (imageViewportPaintPointerId !== event.pointerId) {
    return;
  }

  if (
    event.type === "pointermove" &&
    (event.buttons & imageViewportPaintButtonMask) !== imageViewportPaintButtonMask
  ) {
    stopPaintingImage(event);
    return;
  }

  for (const point of getImagePointerSamplePoints(event)) {
    processImagePointerSegment(event, point);
  }
  updateHoveredImagePixelFromPointer(event);
};

const finishImagePointerInteractionFromPointer = (event: PointerEvent) => {
  if (imagePanPointerId === event.pointerId) {
    continuePanningImageFromPointer(event);
    stopPaintingImage(event);
    return;
  }

  if (imageViewportPaintPointerId !== event.pointerId) {
    return;
  }

  for (const point of getImagePointerSamplePoints(event)) {
    processImagePointerSegment(event, point);
  }
  updateHoveredImagePixelFromPointer(event);
  stopPaintingImage(event);
};

const writeImageGestureTransform = (view: ImageViewportTransform) => {
  const artboard = imageArtboardRef.value;
  if (!artboard) return;

  const liveScale = imageZoom.value > 0 ? view.zoom / imageZoom.value : 1;
  artboard.style.setProperty("--image-pan-x", `${view.panX}px`);
  artboard.style.setProperty("--image-pan-y", `${view.panY}px`);
  artboard.style.setProperty("--image-rotation", `${view.rotationRadians}rad`);
  artboard.style.setProperty("--image-live-scale", `${liveScale}`);
};

const writeCommittedImageTransform = () => {
  const artboard = imageArtboardRef.value;
  if (!artboard) return;

  artboard.style.setProperty("--image-pan-x", `${imagePanX.value}px`);
  artboard.style.setProperty("--image-pan-y", `${imagePanY.value}px`);
  artboard.style.setProperty("--image-rotation", `${imageRotationRadians.value}rad`);
  artboard.style.setProperty("--image-live-scale", "1");
};

const commitImageGestureView = () => {
  const view = imageGestureView;
  if (!view) return;

  imagePanX.value = view.panX;
  imagePanY.value = view.panY;
  imageRotationRadians.value = normalizeImageRotationRadians(view.rotationRadians);
  imageZoom.value = view.zoom;
  imageZoomMode.value = "custom";
  imageGestureView = null;
  void nextTick(writeCommittedImageTransform);
  scheduleImageCanvasRender();
  scheduleImagePreviewViewportUpdate();
};

const resetImageTouchPointers = () => {
  commitImageGestureView();
  imageTouchPointers.clear();
  imagePendingTouchPointerId = null;
  imageTransformGesture = null;
  imageTouchNavigationActive = false;
  imageSingleTouchStartSnapshot = null;
  imageSingleTouchStartHistory = null;
  imageSingleTouchStartTool = null;
  imageSingleTouchStartPrimaryColor = null;
  imageSingleTouchStartSecondaryColor = null;
  isImagePinching.value = false;
};

const rollbackSingleTouchInteractionForTransform = () => {
  const snapshot = imageSingleTouchStartSnapshot;
  const history = imageSingleTouchStartHistory;
  const startTool = imageSingleTouchStartTool;
  const startPrimaryColor = imageSingleTouchStartPrimaryColor;
  const startSecondaryColor = imageSingleTouchStartSecondaryColor;
  const hadInteraction =
    imagePanPointerId !== null ||
    imageViewportPaintPointerId !== null ||
    imageInteractionKind.value !== null;
  const hadDocumentInteraction =
    imageInteractionKind.value !== null ||
    (imageViewportPaintPointerId !== null && imageInteractionTool === "fill");

  if (hadInteraction) cancelImageInteraction(undefined, { commitHistory: false });
  if (snapshot && hadDocumentInteraction) {
    if (history) imageHistory.value = history;
    applyImageSnapshot(snapshot);
    scheduleImageAutosave();
  }
  if (startTool) activeImageTool.value = startTool;
  if (startPrimaryColor) setSelectedImageColor(startPrimaryColor);
  if (startSecondaryColor) secondaryImageColor.value = startSecondaryColor;
  imageSingleTouchStartSnapshot = null;
  imageSingleTouchStartHistory = null;
  imageSingleTouchStartTool = null;
  imageSingleTouchStartPrimaryColor = null;
  imageSingleTouchStartSecondaryColor = null;
};

const finishImageTransformGesture = () => {
  commitImageGestureView();
  imageTransformGesture = null;
  isImagePinching.value = false;
  hoveredImagePixelIndex.value = null;
};

const updateImageTransformGesture = (frame: TouchViewportGestureFrame) => {
  if (!imageTouchNavigationActive || imageTouchPointers.size < 2) return false;

  const stageCenter = getImageStageCenter();
  if (!stageCenter) return false;

  if (!imageTransformGesture) {
    cancelScheduledImageFitToScreen();
    imageTransformGesture = {
      initialStageCenter: stageCenter,
      initialView: imageGestureView || {
        panX: imagePanX.value,
        panY: imagePanY.value,
        rotationRadians: imageRotationRadians.value,
        zoom: imageZoom.value,
      },
      lastFrame: frame,
    };
  }

  const gesture = imageTransformGesture;
  gesture.lastFrame = frame;
  const nextView = applyImageTwoFingerTransformDelta({
    currentStageCenter: stageCenter,
    delta: {
      currentCentroid: frame.centroid,
      previousCentroid: frame.initialCentroid,
      rotationRadians: frame.rotationRadians,
      zoomFactor: frame.scale,
    },
    maximumZoom: MAX_IMAGE_ZOOM,
    minimumZoom: MIN_IMAGE_ZOOM,
    previousStageCenter: gesture.initialStageCenter,
    view: gesture.initialView,
  });

  imageZoomMode.value = "custom";
  imageGestureView = nextView;
  writeImageGestureTransform(nextView);
  return true;
};

const bindImageTouchViewportGesture = () => {
  imageTouchViewportGesture?.destroy();
  imageTouchViewportGesture = null;

  const stage = imageStageRef.value;
  if (!stage) return;

  imageTouchViewportGesture = createTouchViewportGesture(stage, {
    onChange: updateImageTransformGesture,
    onEnd: finishImageTransformGesture,
    onStart: updateImageTransformGesture,
  });
};

const startImageTouchPointer = (event: PointerEvent, startsOnArtboard: boolean) => {
  if (imageTouchNavigationActive || imageTouchPointers.size >= 2) return;

  const existingTouch = [...imageTouchPointers.values()][0];
  const activePointerId = imagePanPointerId ?? imageViewportPaintPointerId;
  const canPromoteExistingTouch =
    Boolean(existingTouch) && activePointerId === existingTouch?.pointerId;
  if (
    imageTouchPointers.size === 0 &&
    (imagePanPointerId !== null ||
      imageViewportPaintPointerId !== null ||
      imageInteractionKind.value !== null)
  ) {
    return;
  }
  if (
    imageTouchPointers.size === 1 &&
    (imagePanPointerId !== null ||
      imageViewportPaintPointerId !== null ||
      imageInteractionKind.value !== null) &&
    !canPromoteExistingTouch
  ) {
    return;
  }

  focusAndCaptureImagePointer(event);
  imageTouchPointers.set(event.pointerId, {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startsOnArtboard,
  });

  if (imageTouchPointers.size === 1) {
    imagePendingTouchPointerId = event.pointerId;
    imageSingleTouchStartSnapshot = null;
    imageSingleTouchStartHistory = null;
    imageSingleTouchStartTool = null;
    imageSingleTouchStartPrimaryColor = null;
    imageSingleTouchStartSecondaryColor = null;
    hoveredImagePixelIndex.value = null;
    return;
  }

  if (imageTouchPointers.size === 2) {
    imageTouchNavigationActive = true;
    rollbackSingleTouchInteractionForTransform();
    cancelScheduledImageFitToScreen();
    imagePendingTouchPointerId = null;
    isImagePinching.value = true;
    hoveredImagePixelIndex.value = null;
  }
};

const continueCommittedImageTouch = (event: PointerEvent) => {
  if (imagePanPointerId === event.pointerId) {
    continuePanningImageFromPointer(event);
    return;
  }
  if (imageViewportPaintPointerId !== event.pointerId) return;

  for (const point of getImagePointerSamplePoints(event)) {
    processImagePointerSegment(event, point);
  }
  updateHoveredImagePixelFromPointer(event);
};

const beginPendingImageTouch = (event: PointerEvent, touch: ImageTouchPointer) => {
  imageSingleTouchStartSnapshot = createImageSnapshot();
  imageSingleTouchStartHistory = imageHistory.value;
  imageSingleTouchStartTool = activeImageTool.value;
  imageSingleTouchStartPrimaryColor = selectedImageColor.value;
  imageSingleTouchStartSecondaryColor = secondaryImageColor.value;
  imagePendingTouchPointerId = null;
  const startPoint = { x: touch.startClientX, y: touch.startClientY };
  if (touch.startsOnArtboard) {
    startImageArtboardInteractionFromPointer(event, startPoint);
  } else {
    startImageViewportInteractionFromPointer(event, startPoint);
  }
  continueCommittedImageTouch(event);
};

const continueImageTouchPointer = (event: PointerEvent) => {
  const touch = imageTouchPointers.get(event.pointerId);
  if (!touch) return;

  // @use-gesture owns every two-touch frame. Pointer Events arrive one finger
  // at a time, so using them here would reintroduce the scale/rotation noise
  // that the TouchEvent recognizer removes.
  if (imageTouchNavigationActive) return;

  if (imagePendingTouchPointerId === event.pointerId) {
    const distanceFromStart = Math.hypot(
      event.clientX - touch.startClientX,
      event.clientY - touch.startClientY,
    );
    if (distanceFromStart < IMAGE_TOUCH_COMMIT_THRESHOLD) return;
    beginPendingImageTouch(event, touch);
    return;
  }

  continueCommittedImageTouch(event);
};

const finishImageTouchPointer = (event: PointerEvent) => {
  const touch = imageTouchPointers.get(event.pointerId);
  if (!touch) return;

  if (imageTouchNavigationActive) {
    imageTouchPointers.delete(event.pointerId);
    finishImageTransformGesture();

    // Once a two-finger gesture has started, the remaining finger stays
    // blocked. A new drawing gesture can only begin after every finger lifts.
    if (imageTouchPointers.size === 0) {
      imageTouchNavigationActive = false;
      imageSingleTouchStartSnapshot = null;
      imageSingleTouchStartHistory = null;
      imageSingleTouchStartTool = null;
      imageSingleTouchStartPrimaryColor = null;
      imageSingleTouchStartSecondaryColor = null;
    }
    return;
  }

  if (imagePendingTouchPointerId === event.pointerId) {
    beginPendingImageTouch(event, touch);
  }
  imageTouchPointers.delete(event.pointerId);

  if (
    imagePanPointerId === event.pointerId ||
    imageViewportPaintPointerId === event.pointerId
  ) {
    finishImagePointerInteractionFromPointer(event);
  }
  imageSingleTouchStartSnapshot = null;
  imageSingleTouchStartHistory = null;
  imageSingleTouchStartTool = null;
  imageSingleTouchStartPrimaryColor = null;
  imageSingleTouchStartSecondaryColor = null;
};

const startImageViewportPointerInteraction = (event: PointerEvent) => {
  if (event.pointerType === "touch") {
    startImageTouchPointer(event, false);
    return;
  }
  startImageViewportInteractionFromPointer(event);
};

const startImageArtboardPointerInteraction = (event: PointerEvent) => {
  if (event.pointerType === "touch") {
    startImageTouchPointer(event, true);
    return;
  }
  startImageArtboardInteractionFromPointer(event);
};

const continueImagePointerInteraction = (event: PointerEvent) => {
  if (event.pointerType === "touch") {
    continueImageTouchPointer(event);
    return;
  }
  continueImageViewportInteractionFromPointer(event);
};

const finishImagePointerInteraction = (event: PointerEvent) => {
  if (event.pointerType === "touch") {
    finishImageTouchPointer(event);
    return;
  }
  finishImagePointerInteractionFromPointer(event);
};

let lastPaintedImagePixelIndex: number | null = null;
const paintImagePixels = (indexes: number[], color: PixelColor) => {
  if (!canMutateActiveImageLayerPixels.value) {
    return;
  }

  const nextColor = color;
  const centers = indexes
    .filter((index) => index >= 0 && index < imagePixelCount.value)
    .map((index) => ({
      x: index % imageGridWidth.value,
      y: Math.floor(index / imageGridWidth.value),
    }));
  const points = centers.flatMap((point) =>
    squareBrushPoints(point, imageBrushSize.value, {
      width: imageGridWidth.value,
      height: imageGridHeight.value,
    }),
  );
  const mutation = paintPixels(
    {
      width: imageGridWidth.value,
      height: imageGridHeight.value,
      pixels: imagePixels.value,
    },
    points,
    nextColor,
  );
  const didChange = mutation.changes.length > 0;

  if (!didChange) return;

  imagePixels.value = [...mutation.buffer.pixels];
  scheduleImageCanvasRender();
  scheduleImageAutosave();
};

const paintImageGraffitiPixels = (indexes: number[]) => {
  if (!canMutateActiveImageLayerPixels.value) {
    return;
  }

  const centers = indexes
    .filter((index) => index >= 0 && index < imagePixelCount.value)
    .map((index) => imagePointFromPixelIndex(index));
  const brushOptions = {
    bounds: { width: imageGridWidth.value, height: imageGridHeight.value },
    brushSize: imageBrushSize.value,
    inverted: imageInteractionGraffitiInverted,
    primaryColor: imageInteractionPrimaryColor,
    secondaryColor: imageInteractionSecondaryColor,
  };
  const pixelsByIndex = new Map<number, string>();
  for (const center of centers) {
    for (const pixel of graffitiBrushStamp(center, brushOptions)) {
      pixelsByIndex.set(pixel.y * imageGridWidth.value + pixel.x, pixel.color);
    }
  }

  if (pixelsByIndex.size === 0) return;

  const nextPixels = [...imagePixels.value];
  let didChange = false;
  for (const [index, color] of pixelsByIndex) {
    if (nextPixels[index] === color) continue;
    nextPixels[index] = color;
    didChange = true;
  }

  if (!didChange) return;

  imagePixels.value = nextPixels;
  scheduleImageCanvasRender();
  scheduleImageAutosave();
};

const fillImagePixelsFrom = (startIndex: number, replacementColor: PixelColor) => {
  if (
    !canMutateActiveImageLayerPixels.value ||
    startIndex < 0 ||
    startIndex >= imagePixelCount.value
  ) {
    return;
  }

  const targetColor = imagePixels.value[startIndex] || null;
  if (targetColor === replacementColor) return;

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

  updateImagePixels(nextPixels);
};

const pickImageColorFrom = (pixelIndex: number, channel: ImageColorChannel) => {
  const color = compositeVisibleLayers(buildImageDocument())[pixelIndex];

  if (!color) {
    return;
  }

  if (channel === "secondary") {
    setSecondaryImageColor(color);
    return;
  }

  setSelectedImageColor(color);
};

const updateImageHueFromPointer = (event: PointerEvent) => {
  if (!canEditImage.value) return;
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
  if (!canEditImage.value) return;
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
  if (!canEditImage.value) return;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  updateImageHueFromPointer(event);
};

const startImageColorTriangleSelection = (event: PointerEvent) => {
  if (!canEditImage.value) return;
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

const imagePointFromPixelIndex = (pixelIndex: number): Point => ({
  x: pixelIndex % imageGridWidth.value,
  y: Math.floor(pixelIndex / imageGridWidth.value),
});

const isImageShapeTool = (
  tool: ImageTool,
): tool is "line" | "rectangle" | "ellipse" =>
  tool === "line" || tool === "rectangle" || tool === "ellipse";

const constrainImageShapeEnd = (
  start: Point,
  end: Point,
  event: PointerEvent,
  tool: ImageTool,
) => {
  if (!event.shiftKey) return end;
  if (tool === "line") {
    return constrainPointToEightDirections(start, end);
  }

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const span = Math.max(Math.abs(deltaX), Math.abs(deltaY));
  return {
    x: start.x + (deltaX < 0 ? -span : span),
    y: start.y + (deltaY < 0 ? -span : span),
  };
};

const updateImageShapePreview = (end: Point, event: PointerEvent) => {
  const start = imagePointerStart.value;
  const tool = imageInteractionTool;
  if (!start || !tool || !isImageShapeTool(tool)) return;
  const constrainedEnd = constrainImageShapeEnd(start, end, event, tool);
  imagePointerEnd.value = constrainedEnd;
  const options = {
    bounds: { width: imageGridWidth.value, height: imageGridHeight.value },
    brushSize: imageBrushSize.value,
    filled: isImageShapeFilled.value,
  };
  imageShapePreviewPoints.value =
    tool === "line"
      ? strokePoints(linePoints(start, constrainedEnd), imageBrushSize.value, options.bounds)
      : tool === "rectangle"
        ? rectanglePoints(start, constrainedEnd, options)
        : ellipsePoints(start, constrainedEnd, options);
  scheduleImageCanvasRender();
};

const applyImagePoints = (points: Point[], color: PixelColor) => {
  if (!canMutateActiveImageLayerPixels.value) return false;
  const mutation = paintPixels(
    {
      width: imageGridWidth.value,
      height: imageGridHeight.value,
      pixels: imagePixels.value,
    },
    points,
    color,
  );
  if (mutation.changes.length === 0) return false;
  imagePixels.value = [...mutation.buffer.pixels];
  scheduleImageCanvasRender();
  scheduleImageAutosave();
  return true;
};

const startPaintingImageFromPointer = (
  event: PointerEvent,
  allowPan = true,
  initialPixelIndex?: number,
) => {
  if (allowPan && isImagePanButton(event)) {
    startPanningImageFromPointer(event);
    return;
  }

  const pointerPixelIndex = updateHoveredImagePixelFromPointer(event);
  const pixelIndex = initialPixelIndex ?? pointerPixelIndex;

  if (pixelIndex === null) {
    return;
  }

  const point = imagePointFromPixelIndex(pixelIndex);
  const tool = imageInteractionTool;
  if (!tool) return;

  if (tool === "picker") {
    focusAndCaptureImagePointer(event);
    pickImageColorFrom(pixelIndex, imagePointerColorChannel);
    activeImageTool.value = "pencil";
    return;
  }

  if (tool === "fill") {
    focusAndCaptureImagePointer(event);
    fillImagePixelsFrom(pixelIndex, imageInteractionColor);
    commitImageHistory();
    return;
  }

  if (tool === "select") {
    focusAndCaptureImagePointer(event);
    imagePointerStart.value = point;
    imagePointerEnd.value = point;
    imageSelection.value = normalizeSelection(point, point, {
      width: imageGridWidth.value,
      height: imageGridHeight.value,
    });
    imageInteractionKind.value = "select";
    return;
  }

  if (tool === "move") {
    if (!canMutateActiveImageLayerPixels.value) return;
    focusAndCaptureImagePointer(event);
    imagePointerStart.value = point;
    imagePointerEnd.value = point;
    imageMoveSourceBuffer = {
      width: imageGridWidth.value,
      height: imageGridHeight.value,
      pixels: [...imagePixels.value],
    };
    imageMoveSourceSelection = imageSelection.value ? { ...imageSelection.value } : null;
    imageMoveDidChange = false;
    imageInteractionKind.value = "move";
    isPaintingImage.value = true;
    return;
  }

  if (isImageShapeTool(tool)) {
    if (!canMutateActiveImageLayerPixels.value) return;
    focusAndCaptureImagePointer(event);
    imagePointerStart.value = point;
    imagePointerEnd.value = point;
    imageInteractionKind.value = "shape";
    isPaintingImage.value = true;
    updateImageShapePreview(point, event);
    return;
  }

  if (!canMutateActiveImageLayerPixels.value) {
    return;
  }

  isPaintingImage.value = true;
  imageInteractionKind.value = "paint";
  focusAndCaptureImagePointer(event);
  if (tool === "graffiti") {
    paintImageGraffitiPixels([pixelIndex]);
  } else {
    paintImagePixels([pixelIndex], imageInteractionColor);
  }
  lastPaintedImagePixelIndex = pixelIndex;
};

const continuePaintingImageFromPointer = (event: PointerEvent, forcedPixelIndex?: number) => {
  if (isPanningImage.value) {
    continuePanningImageFromPointer(event);
    return;
  }

  const pointerPixelIndex = updateHoveredImagePixelFromPointer(event);
  const pixelIndex = forcedPixelIndex ?? pointerPixelIndex;

  if (
    (imageInteractionKind.value === "paint" ||
      imageInteractionKind.value === "shape" ||
      imageInteractionKind.value === "move") &&
    !canMutateActiveImageLayerPixels.value
  ) {
    cancelImageInteraction(event);
    return;
  }

  if (imageInteractionKind.value === "select" && pixelIndex !== null && imagePointerStart.value) {
    const point = imagePointFromPixelIndex(pixelIndex);
    imagePointerEnd.value = point;
    imageSelection.value = normalizeSelection(imagePointerStart.value, point, {
      width: imageGridWidth.value,
      height: imageGridHeight.value,
    });
    return;
  }

  if (imageInteractionKind.value === "shape" && pixelIndex !== null) {
    updateImageShapePreview(imagePointFromPixelIndex(pixelIndex), event);
    return;
  }

  if (
    imageInteractionKind.value === "move" &&
    pixelIndex !== null &&
    imagePointerStart.value &&
    imageMoveSourceBuffer
  ) {
    if (!canMutateActiveImageLayerPixels.value) {
      cancelImageInteraction(event);
      return;
    }
    const point = imagePointFromPixelIndex(pixelIndex);
    const delta = {
      x: point.x - imagePointerStart.value.x,
      y: point.y - imagePointerStart.value.y,
    };
    const result = imageMoveSourceSelection
      ? moveRegion(imageMoveSourceBuffer, imageMoveSourceSelection, delta)
      : {
          mutation: moveLayer(imageMoveSourceBuffer, delta),
          selection: null,
        };
    imagePixels.value = [...result.mutation.buffer.pixels];
    imageSelection.value = result.selection;
    imagePointerEnd.value = point;
    imageMoveDidChange = !imagePixelsAreEqual(imageMoveSourceBuffer.pixels, imagePixels.value);
    scheduleImageCanvasRender();
    return;
  }

  if (!isPaintingImage.value || imageInteractionKind.value !== "paint") {
    return;
  }

  if (pixelIndex === null) {
    lastPaintedImagePixelIndex = null;
    return;
  }

  const strokePixels = imageLineBetweenPixels(
    lastPaintedImagePixelIndex ?? pixelIndex,
    pixelIndex,
  );
  if (imageInteractionTool === "graffiti") {
    paintImageGraffitiPixels(strokePixels);
  } else {
    paintImagePixels(strokePixels, imageInteractionColor);
  }
  lastPaintedImagePixelIndex = pixelIndex;
};

const stopPaintingImage = (event?: PointerEvent) => {
  const activePointerId = imagePanPointerId ?? imageViewportPaintPointerId;
  if (
    event &&
    activePointerId !== null &&
    event.pointerId !== activePointerId
  ) {
    return;
  }

  const interactionKind = imageInteractionKind.value;
  const shouldCommitHistory =
    interactionKind === "paint" ||
    interactionKind === "shape" ||
    (interactionKind === "move" && imageMoveDidChange);
  if (interactionKind === "shape" && imageShapePreviewPoints.value.length > 0) {
    applyImagePoints(imageShapePreviewPoints.value, imageInteractionColor);
  }
  isPaintingImage.value = false;
  isPanningImage.value = false;
  imagePanPointerId = null;
  imageViewportPaintPointerId = null;
  imageViewportPaintButtonMask = 0;
  imagePointerColorChannel = "primary";
  imageInteractionColor = selectedImageColor.value;
  imageInteractionTool = null;
  imageInteractionPrimaryColor = selectedImageColor.value;
  imageInteractionSecondaryColor = secondaryImageColor.value;
  imageInteractionGraffitiInverted = false;
  imageGraffitiPreviewGesture.value = null;
  isImageViewportPaintAwaitingArtboard = false;
  imageViewportPaintClientX = 0;
  imageViewportPaintClientY = 0;
  imageInteractionKind.value = null;
  imagePointerStart.value = null;
  imagePointerEnd.value = null;
  imageShapePreviewPoints.value = [];
  imageMoveSourceBuffer = null;
  imageMoveSourceSelection = null;
  imageMoveDidChange = false;
  lastPaintedImagePixelIndex = null;
  scheduleImageCanvasRender();
  if (shouldCommitHistory) {
    if (interactionKind === "move") scheduleImageAutosave();
    commitImageHistory();
  }
};

const leaveImageCanvas = () => {
  hoveredImagePixelIndex.value = null;
};

const cancelImageInteraction = (
  event?: PointerEvent,
  { commitHistory = true }: Readonly<{ commitHistory?: boolean }> = {},
) => {
  const activePointerId = imagePanPointerId ?? imageViewportPaintPointerId;
  if (
    event &&
    activePointerId !== null &&
    event.pointerId !== activePointerId
  ) {
    return;
  }

  const interactionKind = imageInteractionKind.value;
  const wasMoving = interactionKind === "move";
  hoveredImagePixelIndex.value = null;
  isPaintingImage.value = false;
  isPanningImage.value = false;
  imagePanPointerId = null;
  imageViewportPaintPointerId = null;
  imageViewportPaintButtonMask = 0;
  imagePointerColorChannel = "primary";
  imageInteractionColor = selectedImageColor.value;
  imageInteractionTool = null;
  imageInteractionPrimaryColor = selectedImageColor.value;
  imageInteractionSecondaryColor = secondaryImageColor.value;
  imageInteractionGraffitiInverted = false;
  imageGraffitiPreviewGesture.value = null;
  isImageViewportPaintAwaitingArtboard = false;
  imageViewportPaintClientX = 0;
  imageViewportPaintClientY = 0;
  imageInteractionKind.value = null;
  imagePointerStart.value = null;
  imagePointerEnd.value = null;
  imageShapePreviewPoints.value = [];
  if (wasMoving && imageMoveSourceBuffer) {
    imagePixels.value = [...imageMoveSourceBuffer.pixels];
    imageSelection.value = imageMoveSourceSelection ? { ...imageMoveSourceSelection } : null;
  }
  imageMoveSourceBuffer = null;
  imageMoveSourceSelection = null;
  imageMoveDidChange = false;
  lastPaintedImagePixelIndex = null;
  scheduleImageCanvasRender();
  if (interactionKind === "paint" && commitHistory) {
    commitImageHistory();
  }
};

const cancelImagePointerInteraction = (event: PointerEvent) => {
  if (event.pointerType !== "touch") {
    cancelImageInteraction(event);
    return;
  }

  const hadTrackedTouch = imageTouchPointers.has(event.pointerId);
  const hadActiveInteraction =
    imagePanPointerId === event.pointerId || imageViewportPaintPointerId === event.pointerId;
  if (!hadTrackedTouch && !hadActiveInteraction) return;

  resetImageTouchPointers();
  if (hadActiveInteraction) {
    cancelImageInteraction(event);
  }
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

const resizeImageWorkspace = (nextWidth: number, nextHeight: number) => {
  if (!canEditImage.value) {
    return;
  }

  const width = normalizeImageDimension(nextWidth, imageGridWidth.value);
  const height = normalizeImageDimension(nextHeight, imageGridHeight.value);

  if (width === imageGridWidth.value && height === imageGridHeight.value) {
    return;
  }

  const resizedDocument = resizePixelArtDocument(
    buildImageDocument(),
    width,
    height,
    imageResizeAnchor.value,
  );
  imageGridWidth.value = resizedDocument.width;
  imageGridHeight.value = resizedDocument.height;
  imageLayers.value = resizedDocument.layers;
  imageSelection.value = null;
  scheduleImageCanvasRender();
  imageGridWidthDraft.value = String(width);
  imageGridHeightDraft.value = String(height);
  hoveredImagePixelIndex.value = null;
  stopPaintingImage();
  scheduleImageAutosave();
  commitImageHistory();
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
    const width = Number(value);
    if (Number.isFinite(width) && width > 0) {
      imageGridHeightDraft.value = String(
        normalizeImageDimension(
          (width * imageGridHeight.value) / imageGridWidth.value,
          imageGridHeight.value,
        ),
      );
    }
  }
};

const updateImageHeightDraft = (event: Event) => {
  const value = (event.currentTarget as HTMLInputElement).value;
  imageGridHeightDraft.value = value;

  if (areImageDimensionsLinked.value) {
    const height = Number(value);
    if (Number.isFinite(height) && height > 0) {
      imageGridWidthDraft.value = String(
        normalizeImageDimension(
          (height * imageGridWidth.value) / imageGridHeight.value,
          imageGridWidth.value,
        ),
      );
    }
  }
};

const applyImageWidthDraft = () => {
  if (!imageGridWidthDraft.value.trim()) {
    syncImageDimensionDrafts();
    return;
  }

  const nextWidth = normalizeImageDimension(Number(imageGridWidthDraft.value), imageGridWidth.value);

  if (areImageDimensionsLinked.value) {
    const nextHeight = normalizeImageDimension(
      Number(imageGridHeightDraft.value),
      imageGridHeight.value,
    );
    resizeImageWorkspace(nextWidth, nextHeight);
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
    const nextWidth = normalizeImageDimension(
      Number(imageGridWidthDraft.value),
      imageGridWidth.value,
    );
    resizeImageWorkspace(nextWidth, nextHeight);
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
};

const finishImageLayerMutation = () => {
  triggerRef(imageLayers);
  scheduleImageCanvasRender();
  scheduleImageAutosave();
  commitImageHistory();
};

const cancelImageInteractionBeforeLayerChange = () => {
  if (
    imageInteractionKind.value !== null ||
    imagePanPointerId !== null ||
    imageViewportPaintPointerId !== null ||
    imageTouchPointers.size > 0 ||
    imageTransformGesture !== null
  ) {
    resetImageTouchPointers();
    cancelImageInteraction();
  }
};

const selectImageLayer = (layerId: string) => {
  if (
    layerId !== activeImageLayerId.value &&
    imageLayers.value.some((layer) => layer.id === layerId)
  ) {
    cancelImageInteractionBeforeLayerChange();
    activeImageLayerId.value = layerId;
    imageSelection.value = null;
  }
};

const addImageLayer = () => {
  if (!canEditImage.value || imageLayers.value.length >= MAX_IMAGE_LAYERS) return;
  cancelImageInteractionBeforeLayerChange();
  const layer = createPixelLayer(imageGridWidth.value, imageGridHeight.value, {
    name: `Layer ${imageLayers.value.length + 1}`,
  });
  imageLayers.value = [...imageLayers.value, layer];
  activeImageLayerId.value = layer.id;
  finishImageLayerMutation();
};

const duplicateImageLayer = (layerId: string) => {
  if (!canEditImage.value || imageLayers.value.length >= MAX_IMAGE_LAYERS) return;
  const index = imageLayers.value.findIndex((layer) => layer.id === layerId);
  if (index < 0) return;
  cancelImageInteractionBeforeLayerChange();
  const source = imageLayers.value[index]!;
  const duplicate = createPixelLayer(imageGridWidth.value, imageGridHeight.value, {
    ...source,
    id: undefined,
    name: `${source.name} copy`,
    pixels: source.pixels,
  });
  const layers = [...imageLayers.value];
  layers.splice(index + 1, 0, duplicate);
  imageLayers.value = layers;
  activeImageLayerId.value = duplicate.id;
  finishImageLayerMutation();
};

const removeImageLayer = (layerId: string) => {
  if (!canEditImage.value || imageLayers.value.length <= 1) return;
  const index = imageLayers.value.findIndex((layer) => layer.id === layerId);
  if (index < 0) return;
  if (activeImageLayerId.value === layerId) {
    cancelImageInteractionBeforeLayerChange();
  }
  const layers = imageLayers.value.filter((layer) => layer.id !== layerId);
  imageLayers.value = layers;
  if (activeImageLayerId.value === layerId) {
    activeImageLayerId.value = layers[Math.min(index, layers.length - 1)]?.id || "";
  }
  imageSelection.value = null;
  finishImageLayerMutation();
};

const renameImageLayer = ({ id, name }: { id: string; name: string }) => {
  if (!canEditImage.value) return;
  const normalizedName = name.trim();
  if (!normalizedName) return;
  const previousLayers = imageLayers.value;
  imageLayers.value = previousLayers.map((layer) =>
    layer.id === id ? { ...layer, name: normalizedName } : layer,
  );
  if (imageLayers.value.every((layer, index) => layer === previousLayers[index])) return;
  finishImageLayerMutation();
};

const toggleImageLayerVisibility = (layerId: string) => {
  if (!canEditImage.value) return;
  const layer = imageLayers.value.find((candidate) => candidate.id === layerId);
  if (layerId === activeImageLayerId.value && layer?.visible) {
    cancelImageInteractionBeforeLayerChange();
  }
  imageLayers.value = imageLayers.value.map((layer) =>
    layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
  );
  finishImageLayerMutation();
};

const toggleImageLayerLock = (layerId: string) => {
  if (!canEditImage.value) return;
  const layer = imageLayers.value.find((candidate) => candidate.id === layerId);
  if (layerId === activeImageLayerId.value && layer && !layer.locked) {
    cancelImageInteractionBeforeLayerChange();
  }
  imageLayers.value = imageLayers.value.map((layer) =>
    layer.id === layerId ? { ...layer, locked: !layer.locked } : layer,
  );
  finishImageLayerMutation();
};

const setImageLayerOpacity = ({ id, opacity }: { id: string; opacity: number }) => {
  if (!canEditImage.value) return;
  const normalizedOpacity = Math.min(1, Math.max(0, opacity));
  imageLayers.value = imageLayers.value.map((layer) =>
    layer.id === id ? { ...layer, opacity: normalizedOpacity } : layer,
  );
  finishImageLayerMutation();
};

const previewImageLayerOpacity = ({ id, opacity }: { id: string; opacity: number }) => {
  if (!canEditImage.value) return;
  const normalizedOpacity = Math.min(1, Math.max(0, opacity));
  imageLayers.value = imageLayers.value.map((layer) =>
    layer.id === id ? { ...layer, opacity: normalizedOpacity } : layer,
  );
  scheduleImageCanvasRender();
};

const moveImageLayer = ({
  id,
  direction,
}: {
  id: string;
  direction: "up" | "down";
}) => {
  if (!canEditImage.value) return;
  const index = imageLayers.value.findIndex((layer) => layer.id === id);
  const targetIndex = direction === "up" ? index + 1 : index - 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= imageLayers.value.length) return;
  const layers = [...imageLayers.value];
  [layers[index], layers[targetIndex]] = [layers[targetIndex]!, layers[index]!];
  imageLayers.value = layers;
  finishImageLayerMutation();
};

const activeImageBuffer = () => ({
  width: imageGridWidth.value,
  height: imageGridHeight.value,
  pixels: imagePixels.value,
});

const selectAllImagePixels = () => {
  imageSelection.value = {
    x: 0,
    y: 0,
    width: imageGridWidth.value,
    height: imageGridHeight.value,
  };
  activeImageTool.value = "select";
};

const deselectImagePixels = () => {
  imageSelection.value = null;
};

const applyImageMutationPixels = (
  pixels: ReadonlyArray<PixelColor>,
  options: { commitHistory?: boolean } = {},
) => {
  const didChange = updateImagePixels([...pixels]);
  if (didChange && options.commitHistory !== false) commitImageHistory();
  return didChange;
};

const deleteImageSelection = () => {
  if (!imageSelection.value || !canMutateActiveImageLayerPixels.value) return;
  const mutation = clearRect(activeImageBuffer(), imageSelection.value);
  applyImageMutationPixels(mutation.buffer.pixels);
};

const copyImageSelection = () => {
  if (!imageSelection.value) return;
  imageClipboard.value = extractBlock(activeImageBuffer(), imageSelection.value);
};

const cutImageSelection = () => {
  if (!canMutateActiveImageLayerPixels.value) return;
  copyImageSelection();
  deleteImageSelection();
};

const pasteImageSelection = () => {
  const block = imageClipboard.value;
  if (!block || !canMutateActiveImageLayerPixels.value) return;
  const origin = imageSelection.value
    ? { x: imageSelection.value.x, y: imageSelection.value.y }
    : {
        x: Math.floor((imageGridWidth.value - block.width) / 2),
        y: Math.floor((imageGridHeight.value - block.height) / 2),
      };
  const mutation = placeBlock(activeImageBuffer(), block, origin);
  if (applyImageMutationPixels(mutation.buffer.pixels, { commitHistory: false })) {
    imageSelection.value = normalizeSelection(
      origin,
      { x: origin.x + block.width - 1, y: origin.y + block.height - 1 },
      { width: imageGridWidth.value, height: imageGridHeight.value },
    );
    commitImageHistory();
  }
};

const nudgeImageSelection = ({ x, y }: { x: number; y: number }) => {
  if (!canMutateActiveImageLayerPixels.value) return;
  if (imageSelection.value) {
    const result = moveRegion(activeImageBuffer(), imageSelection.value, { x, y });
    const didChangePixels = applyImageMutationPixels(result.mutation.buffer.pixels, {
      commitHistory: false,
    });
    imageSelection.value = result.selection;
    if (didChangePixels) {
      commitImageHistory();
    }
    return;
  }

  const mutation = moveLayer(activeImageBuffer(), { x, y });
  applyImageMutationPixels(mutation.buffer.pixels);
};

const transformImagePixels = (
  transform: (block: PixelBlock) => PixelBlock,
) => {
  if (!canMutateActiveImageLayerPixels.value) return;
  const sourceRect = imageSelection.value || {
    x: 0,
    y: 0,
    width: imageGridWidth.value,
    height: imageGridHeight.value,
  };
  const sourceBuffer = activeImageBuffer();
  const block = transform(extractBlock(sourceBuffer, sourceRect));
  const cleared = clearRect(sourceBuffer, sourceRect);
  const origin = imageSelection.value
    ? { x: sourceRect.x, y: sourceRect.y }
    : {
        x: Math.floor((imageGridWidth.value - block.width) / 2),
        y: Math.floor((imageGridHeight.value - block.height) / 2),
      };
  const placed = placeBlock(cleared.buffer, block, origin, { transparent: "replace" });
  if (applyImageMutationPixels(placed.buffer.pixels, { commitHistory: false })) {
    if (imageSelection.value) {
      imageSelection.value = normalizeSelection(
        origin,
        { x: origin.x + block.width - 1, y: origin.y + block.height - 1 },
        { width: imageGridWidth.value, height: imageGridHeight.value },
      );
    }
    commitImageHistory();
  }
};

const flipImageHorizontally = () =>
  transformImagePixels((block) => flipBlock(block, "horizontal"));
const flipImageVertically = () =>
  transformImagePixels((block) => flipBlock(block, "vertical"));
const rotateImageClockwise = () =>
  transformImagePixels((block) => rotateBlock90(block, "clockwise"));
const rotateImageCounterclockwise = () =>
  transformImagePixels((block) => rotateBlock90(block, "counterclockwise"));

const downloadImageFile = (blob: Blob, extension: "json" | "png") => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${sanitizeImageFileName(resourceName.value)}.${extension}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

const applyImportedImageDocument = (document: PixelArtDocumentV2) => {
  const importedDocument = clonePixelArtDocument(document);
  imageGridWidth.value = importedDocument.width;
  imageGridHeight.value = importedDocument.height;
  imageLayers.value = importedDocument.layers;
  activeImageLayerId.value = importedDocument.layers[importedDocument.layers.length - 1]?.id || "";
  imageSelection.value = null;
  syncImageDimensionDrafts();
  scheduleImageCanvasRender();
  scheduleImageAutosave();
  commitImageHistory();
  void nextTick(scheduleImagePreviewViewportUpdate);
};

const importImageFile = async (file: File) => {
  if (!canEditImage.value || isImageTransferBusy.value) return;

  isImageTransferBusy.value = true;
  imageTransferNotice.value = "";
  try {
    const isJson = file.type === "application/json" || file.type === "text/json" || /\.json$/i.test(file.name);
    let importedDocument: PixelArtDocumentV2;
    if (isJson) {
      importedDocument = await importPixelArtJson(file);
    } else {
      const rasterOptions = { layerName: file.name.replace(/\.[^.]+$/, "") || "Layer 1" };
      try {
        importedDocument = await importRasterImage(file, rasterOptions);
      } catch (error) {
        if (!(error instanceof RasterImageTooLargeError)) throw error;
        const shouldReduce = window.confirm(
          `${error.width} × ${error.height} exceeds the 256 × 256 limit. Reduce it proportionally with pixel-perfect nearest-neighbor scaling?`,
        );
        if (!shouldReduce) return;
        importedDocument = await importRasterImageReduced(file, rasterOptions);
      }
    }

    if (!window.confirm("Importing this file will replace the current image. Continue?")) {
      return;
    }

    applyImportedImageDocument(importedDocument);
    showImageNotice(
      `Imported ${file.name} (${importedDocument.width} × ${importedDocument.height}).`,
      "success",
    );
  } catch (error) {
    showImageNotice(
      error instanceof Error ? error.message : "The selected file could not be imported.",
      "error",
    );
  } finally {
    isImageTransferBusy.value = false;
  }
};

const exportImagePng = async ({
  scale,
  backgroundColor,
}: {
  scale: PngExportScale;
  backgroundColor: string | null;
}) => {
  if (isImageTransferBusy.value) return;
  isImageTransferBusy.value = true;
  imageTransferNotice.value = "";
  try {
    const blob = await exportPixelArtPng(buildImageDocument(), { scale, backgroundColor });
    downloadImageFile(blob, "png");
    showImageNotice(`PNG exported at ${scale}×.`, "success");
  } catch (error) {
    showImageNotice(error instanceof Error ? error.message : "PNG export failed.", "error");
  } finally {
    isImageTransferBusy.value = false;
  }
};

const exportImageJson = () => {
  try {
    downloadImageFile(exportPixelArtJsonBlob(buildImageDocument()), "json");
    showImageNotice("Sefkira JSON exported.", "success");
  } catch (error) {
    showImageNotice(error instanceof Error ? error.message : "JSON export failed.", "error");
  }
};

const openGifAnimationCreation = (file: File) => {
  const suggestedName = file.name.replace(/\.gif$/i, "").trim() || "Untitled animation";
  showImageNotice("GIF files continue in the animation creation flow.", "info");
  return navigateAfterImageSave(
    `${projectPath.value}?create=pixel_animation&name=${encodeURIComponent(suggestedName)}`,
  );
};

const toggleImageInspectorPanel = (panel: ImageInspectorPanel) => {
  activeImageInspectorPanel.value =
    activeImageInspectorPanel.value === panel ? null : panel;
};

const closeImageInspectorPanel = () => {
  activeImageInspectorPanel.value = null;
};

const openImageTabletLayersDialog = () => {
  closeImageMobileColorControls(false);
  isImageMobileDockOpen.value = false;
  isImageTabletLayersDialogOpen.value = true;
  void nextTick(() => imageTabletLayersCloseRef.value?.focus({ preventScroll: true }));
};

const closeImageTabletLayersDialog = (restoreFocus = true) => {
  isImageTabletLayersDialogOpen.value = false;
  if (restoreFocus) {
    void nextTick(() => imageTabletLayersTriggerRef.value?.focus({ preventScroll: true }));
  }
};

const openImageMobileDock = () => {
  closeImageMobileColorControls(false);
  closeImageTabletLayersDialog(false);
  isImageMobileDockOpen.value = true;
  void nextTick(() => imageMobileDockCloseRef.value?.focus({ preventScroll: true }));
};

const closeImageMobileDock = (restoreFocus = true) => {
  isImageMobileDockOpen.value = false;
  if (restoreFocus) {
    void nextTick(() => imageMobileDockTriggerRef.value?.focus({ preventScroll: true }));
  }
};

function openImageMobileColorControls() {
  closeImageMobileDock(false);
  closeImageTabletLayersDialog(false);
  isImageMobileColorControlsOpen.value = true;
  void nextTick(() => imageMobileColorCloseRef.value?.focus({ preventScroll: true }));
}

function closeImageMobileColorControls(restoreFocus = true) {
  isImageMobileColorControlsOpen.value = false;
  if (restoreFocus) {
    void nextTick(() => imageMobileColorTriggerRef.value?.focus({ preventScroll: true }));
  }
}

watch(isImageTabletViewport, (isTablet) => {
  if (!isTablet && isImageTabletLayersDialogOpen.value) {
    closeImageTabletLayersDialog(false);
  }
});

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

const loadStoredImagePreferences = (userId: string) => {
  imagePreferencesController = useImagePreferences({
    userId,
    resourceId: props.resourceId,
    defaults: { resizeAnchor: imageResizeAnchor.value },
  });
  const preferences = imagePreferencesController.preferences;
  isApplyingImagePreferences = true;
  customImageBackground.value = preferences.background;
  isImageGridVisible.value = preferences.gridVisible;
  customImageGridColor.value = preferences.gridColor;
  imageGridLineStyle.value = preferences.gridLineStyle;
  imageGridLineOpacity.value = preferences.gridOpacity;
  imageGridLineOpacityDraft.value = preferences.gridOpacity.toFixed(2);
  imageGridGap.value = preferences.gridGap;
  imageGridSubdivision.value = preferences.subdivision;
  imageGridSubdivisionDraft.value = String(preferences.subdivision);
  customImageSubdivisionColor.value = preferences.subdivisionColor;
  imageGridSubdivisionThickness.value = preferences.subdivisionThickness;
  imageResizeAnchor.value = preferences.resizeAnchor;
  if (preferences.zoom !== undefined) {
    imageZoom.value = preferences.zoom;
    imageZoomMode.value = "custom";
  } else {
    imageZoomMode.value = "fit";
  }
  isApplyingImagePreferences = false;
};

const saveStoredImagePreferences = () => {
  if (!imagePreferencesController || isApplyingImagePreferences || isLoading.value) return;
  imagePreferencesController.save({
    background: customImageBackground.value,
    gridVisible: isImageGridVisible.value,
    gridColor: customImageGridColor.value,
    gridLineStyle: imageGridLineStyle.value,
    gridOpacity: imageGridLineOpacity.value,
    gridGap: imageGridGap.value,
    subdivision: imageGridSubdivision.value,
    subdivisionColor: customImageSubdivisionColor.value,
    subdivisionThickness: imageGridSubdivisionThickness.value,
    resizeAnchor: imageResizeAnchor.value,
    zoom: imageZoom.value,
  });
};

watch(
  [
    customImageBackground,
    isImageGridVisible,
    customImageGridColor,
    imageGridLineStyle,
    imageGridLineOpacity,
    imageGridGap,
    imageGridSubdivision,
    customImageSubdivisionColor,
    imageGridSubdivisionThickness,
    imageResizeAnchor,
    imageZoom,
  ],
  saveStoredImagePreferences,
);

watch([isImageGridVisible, imageGridLineStyle, imageGridGap], () => {
  scheduleImageCanvasRender();
  void nextTick(scheduleImagePreviewViewportUpdate);
});

watch([imageGridWidth, imageGridHeight], () => {
  if (imageZoomMode.value === "fit") {
    void nextTick(scheduleImageFitToScreen);
  }
  void nextTick(scheduleImagePreviewViewportUpdate);
});

const runImageKeyboardAction = (action: ImageKeyboardAction) => {
  switch (action.type) {
    case "select-tool":
      if (canEditImage.value) activeImageTool.value = action.tool;
      break;
    case "undo":
      undoImage();
      break;
    case "redo":
      redoImage();
      break;
    case "select-all":
      selectAllImagePixels();
      break;
    case "copy":
      copyImageSelection();
      break;
    case "cut":
      cutImageSelection();
      break;
    case "paste":
      pasteImageSelection();
      break;
    case "duplicate-layer":
      duplicateImageLayer(activeImageLayerId.value);
      break;
    case "delete-selection":
      deleteImageSelection();
      break;
    case "nudge-selection":
      nudgeImageSelection({ x: action.deltaX, y: action.deltaY });
      break;
    case "escape":
      if (isImageTabletLayersDialogOpen.value) closeImageTabletLayersDialog();
      else if (isImageMobileDockOpen.value) closeImageMobileDock();
      else if (isImageMobileColorControlsOpen.value) {
        closeImageMobileColorControls();
      } else if (imageSelection.value) deselectImagePixels();
      else closeImageInspectorPanel();
      break;
  }
};

const isImageControlKeyboardTarget = (target: EventTarget | null) => {
  const element = target instanceof Element ? target : null;
  return Boolean(
    element?.closest(
      'button, a[href], summary, [role="button"], [role="slider"], [role="menuitem"], [data-image-shortcuts="off"]',
    ),
  );
};

const handleResourceEditorKeydown = (event: KeyboardEvent) => {
  if (
    !isImageEditor.value ||
    event.defaultPrevented ||
    event.isComposing ||
    isImageConflictOpen.value ||
    isProfileDialogOpen.value ||
    isEditableKeyboardTarget(event.target) ||
    isImageControlKeyboardTarget(event.target)
  ) {
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void saveImageNow();
    return;
  }

  if (
    event.key === "Escape" &&
    (imagePanPointerId !== null ||
      imageViewportPaintPointerId !== null ||
      imageTouchPointers.size > 0 ||
      imageTransformGesture !== null)
  ) {
    event.preventDefault();
    resetImageTouchPointers();
    cancelImageInteraction();
    return;
  }

  if (event.code === "Space") {
    isImageSpacePressed.value = true;
    event.preventDefault();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey) {
    if (event.key === "[") {
      imageBrushSize.value = Math.max(1, imageBrushSize.value - 1);
      event.preventDefault();
      return;
    }
    if (event.key === "]") {
      imageBrushSize.value = Math.min(8, imageBrushSize.value + 1);
      event.preventDefault();
      return;
    }
    if (event.key === "1") {
      fitImageToScreen();
      event.preventDefault();
      return;
    }
    if (event.key === "2") {
      showImageAtActualSize();
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === "x") {
      swapImageColors();
      event.preventDefault();
      return;
    }
  }

  const action = getImageKeyboardAction(event);
  if (!action) return;
  event.preventDefault();
  runImageKeyboardAction(action);
};

const handleResourceEditorKeyup = (event: KeyboardEvent) => {
  if (event.code === "Space") isImageSpacePressed.value = false;
};

const clearImageTemporaryKeys = () => {
  isImageSpacePressed.value = false;
  if (
    imagePanPointerId !== null ||
    imageViewportPaintPointerId !== null ||
    imageTouchPointers.size > 0 ||
    imageTransformGesture !== null
  ) {
    resetImageTouchPointers();
    cancelImageInteraction();
  }
};

const hasImageUnloadRisk = () => {
  const hasUnsavedName =
    isRenamingResource.value &&
    Boolean(resourceNameDraft.value.trim()) &&
    resourceNameDraft.value.trim() !== resource.value?.name;
  return (
    isImageEditor.value &&
    (imageAutosave.hasPendingChanges.value ||
      isResourceNameSaving.value ||
      isPersonalImagePaletteSaving.value ||
      hasUnsavedName ||
      imageConflictOperation.value !== null)
  );
};

const warnBeforeImageUnload = (event: BeforeUnloadEvent) => {
  if (allowImageUnload || !hasImageUnloadRisk()) return;
  event.preventDefault();
  event.returnValue = "";
};

const flushImageBeforePageHide = () => {
  if (imageAutosave.hasPendingChanges.value) {
    void imageAutosave.flush();
  }
  if (isPersonalImagePaletteSaving.value) {
    void waitForPersonalImagePaletteMutations();
  }
};

const loadEditor = async () => {
  isLoading.value = true;
  errorMessage.value = "";
  let shouldFitImageAfterLoad = true;

  try {
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
      return;
    }

    imagePaletteUserId.value = workspace?.user.id || "";
    personalImagePalette.value = normalizePinnedPaletteColors(
      workspace?.user.pixel_art_palette,
    );

    resource.value = resourceDetail;
    if (editorMetaByType[resourceDetail.type]?.routeKind === "image") {
      let imageData: ReturnType<typeof readImagePixelsFromData>;
      try {
        imageData = readImagePixelsFromData(resourceDetail.data || {});
      } catch (error) {
        errorMessage.value =
          error instanceof PixelArtMigrationError
            ? `${error.message} This resource was left unchanged.`
            : "This image could not be opened safely.";
        return;
      }
      imageGridWidth.value = imageData.document.width;
      imageGridHeight.value = imageData.document.height;
      syncImageDimensionDrafts();
      imageResizeAnchor.value = imageData.anchor;
      imageLayers.value = imageData.document.layers;
      activeImageLayerId.value = imageData.document.layers[imageData.document.layers.length - 1]?.id || "";
      imageSelection.value = null;
      if (imageData.warnings.length > 0) {
        showImageNotice(imageData.warnings.join(" "), "info");
      }
      imageSaveStatus.value = "saved";
      imageSaveError.value = "";
      activeImageTool.value = "pencil";
      setSelectedImageColor(DEFAULT_PENCIL_COLOR);
    }
    project.value =
      workspace?.projects.find((workspaceProject) => workspaceProject.id === props.projectId) || null;
    if (editorMetaByType[resourceDetail.type]?.routeKind === "image") {
      loadStoredImagePreferences(workspace?.user.id || profileEmail.value || "local-user");
      shouldFitImageAfterLoad = imagePreferencesController?.preferences.zoom === undefined;
      resetImageHistory();
    }

    const routeKind = editorMetaByType[resourceDetail.type]?.routeKind;
    if (routeKind && props.resourceKind !== routeKind) {
      window.history.replaceState(null, "", canonicalResourcePath.value);
    }

  } catch {
    errorMessage.value =
      navigator.onLine === false
        ? "You appear to be offline. Reconnect and try again."
        : "The editor could not be loaded. Check your connection and try again.";
  } finally {
    isLoading.value = false;
  }

  if (
    errorMessage.value ||
    !resource.value ||
    editorMetaByType[resource.value.type]?.routeKind !== "image"
  ) {
    return;
  }

  await nextTick();
  observeImageStage();
  updateImageViewportSize();
  const imageStageBounds = imageStageRef.value?.getBoundingClientRect();
  const loadedArtboardMetrics = imageArtboardMetrics.value;
  const loadedZoomFitsStage = Boolean(
    imageStageBounds &&
    loadedArtboardMetrics.width <= Math.max(1, imageStageBounds.width - 72) &&
    loadedArtboardMetrics.height <= Math.max(1, imageStageBounds.height - 104),
  );
  imageGestureView = null;
  imagePanX.value = 0;
  imagePanY.value = 0;
  imageRotationRadians.value = 0;
  void nextTick(writeCommittedImageTransform);
  if (shouldFitImageAfterLoad || !loadedZoomFitsStage) {
    fitImageToScreen();
  } else {
    imageZoomMode.value = "custom";
  }
  scheduleImageCanvasRender();
  scheduleImagePreviewViewportUpdate();
  renderImageColorTriangleCanvas();
};

onMounted(() => {
  window.addEventListener("pointerup", finishImagePointerInteraction);
  window.addEventListener("pointercancel", cancelImagePointerInteraction);
  window.addEventListener("keydown", handleResourceEditorKeydown);
  window.addEventListener("keyup", handleResourceEditorKeyup);
  window.addEventListener("blur", clearImageTemporaryKeys);
  window.addEventListener("beforeunload", warnBeforeImageUnload);
  window.addEventListener("pagehide", flushImageBeforePageHide);
  window.addEventListener("resize", updateImageViewportSize);
  updateImageViewportSize();
  void loadEditor();
});

onUnmounted(() => {
  window.removeEventListener("pointerup", finishImagePointerInteraction);
  window.removeEventListener("pointercancel", cancelImagePointerInteraction);
  window.removeEventListener("keydown", handleResourceEditorKeydown);
  window.removeEventListener("keyup", handleResourceEditorKeyup);
  window.removeEventListener("blur", clearImageTemporaryKeys);
  window.removeEventListener("beforeunload", warnBeforeImageUnload);
  window.removeEventListener("pagehide", flushImageBeforePageHide);
  window.removeEventListener("resize", updateImageViewportSize);
  imageStageResizeObserver?.disconnect();
  imageStageResizeObserver = null;
  imageTouchViewportGesture?.destroy();
  imageTouchViewportGesture = null;
  resetImageTouchPointers();
  if (imageFitFrame !== null) {
    window.cancelAnimationFrame(imageFitFrame);
    imageFitFrame = null;
  }
  if (imagePreviewViewportFrame !== null) {
    window.cancelAnimationFrame(imagePreviewViewportFrame);
    imagePreviewViewportFrame = null;
  }
  if (imageCanvasRenderFrame !== null) {
    window.cancelAnimationFrame(imageCanvasRenderFrame);
    imageCanvasRenderFrame = null;
  }
  void imageAutosave.flush().finally(imageAutosave.dispose);
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
          <input
            v-if="isRenamingResource"
            v-model="resourceNameDraft"
            class="resource-editor-title__name-input"
            type="text"
            maxlength="120"
            aria-label="Image name"
            autofocus
            @blur="commitResourceName"
            @keydown.enter.prevent="($event.currentTarget as HTMLInputElement).blur()"
            @keydown.escape.prevent="cancelRenamingResource"
          />
          <button
            v-else
            type="button"
            class="resource-editor-title__name"
            :disabled="!canEditImage"
            :aria-label="canEditImage ? `Rename ${resourceName}` : resourceName"
            :title="canEditImage ? 'Rename image' : resourceName"
            @click="startRenamingResource"
          >
            {{ resourceName }}
          </button>
          <span class="resource-editor-title__kind">{{ editorMeta.label }}</span>
          <div v-if="isImageEditor && !isLoading" class="resource-editor-title__save-cluster">
            <ImageSaveStatus
              :status="displayedImageSaveStatus"
              :error="displayedImageSaveError"
              :last-saved-at="effectiveImageLastSavedAt"
              @retry="retryImageSave"
            />
          </div>
        </div>
      </template>
    </StudioTopbar>

    <main class="resource-editor-stage" aria-label="Resource editor">
      <div v-if="isLoading" class="resource-editor-loader" role="status" aria-label="Loading item">
        <span></span>
      </div>

      <div v-else-if="errorMessage" class="resource-editor-error">
        <p>{{ errorMessage }}</p>
        <button type="button" @click="loadEditor">Try again</button>
        <button type="button" @click="returnToProject">Back to project</button>
      </div>

      <div
        v-else
        class="resource-editor-canvas"
        :aria-label="`${editorMeta.label} editor in progress for ${resourceName}`"
      >
        <aside v-if="isImageEditor" class="image-editor-left-dock" aria-label="Drawing tools">
          <ImageToolbar
            class="image-editor-toolbar"
            :active-tool="activeImageTool"
            :can-edit="canEditImage"
            @select-tool="activeImageTool = $event"
          />
        </aside>

        <div
          v-if="isImageEditor"
          id="image-editor-floating-layers"
          class="image-editor-floating-layers"
        >
          <button
            v-if="isImageTabletViewport"
            ref="imageTabletLayersTriggerRef"
            type="button"
            class="image-editor-tablet-layers-trigger"
            aria-haspopup="dialog"
            :aria-expanded="isImageTabletLayersDialogOpen"
            aria-controls="image-editor-tablet-layers-dialog"
            @click="openImageTabletLayersDialog"
          >
            <Layers3 :size="17" :stroke-width="2" aria-hidden="true" />
            <span>Layers</span>
            <small>{{ imageLayers.length }}/{{ MAX_IMAGE_LAYERS }}</small>
          </button>

          <div
            v-if="isImageTabletViewport"
            class="image-editor-tablet-layers-dialog-layer"
            :class="{ 'is-open': isImageTabletLayersDialogOpen }"
            :aria-hidden="!isImageTabletLayersDialogOpen"
            :inert="!isImageTabletLayersDialogOpen"
            @pointerdown.self="closeImageTabletLayersDialog()"
          >
            <section
              id="image-editor-tablet-layers-dialog"
              class="image-editor-tablet-layers-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Layers"
              @keydown.esc.stop.prevent="closeImageTabletLayersDialog()"
            >
              <button
                ref="imageTabletLayersCloseRef"
                type="button"
                class="image-editor-tablet-layers-dialog__close"
                aria-label="Close layers"
                @click="closeImageTabletLayersDialog()"
              >
                <X :size="17" :stroke-width="2" aria-hidden="true" />
              </button>
              <div id="image-editor-tablet-layers-dialog-host"></div>
            </section>
          </div>
        </div>

        <aside
          v-if="isImageEditor"
          id="image-editor-properties"
          class="image-editor-right-dock"
          :class="{
            'has-active-inspector': activeImageInspectorPanel,
            'is-mobile-open': isImageMobileDockOpen,
          }"
          :aria-hidden="isImageDockOverlayViewport && !isImageMobileDockOpen"
          :inert="isImageDockOverlayViewport && !isImageMobileDockOpen"
          aria-label="Image properties"
        >
          <div class="image-editor-mobile-dock-header">
            <strong>{{ areImageLayersFloating ? "Image options" : "Layers & options" }}</strong>
            <button
              ref="imageMobileDockCloseRef"
              type="button"
              aria-label="Close image panels"
              @click="closeImageMobileDock()"
            >
              <X :size="20" :stroke-width="2" aria-hidden="true" />
            </button>
          </div>

          <Teleport
            :to="imageLayersTeleportTarget"
            :disabled="!areImageLayersFloating"
            defer
          >
            <div class="image-editor-layers-host">
              <ImageLayersPanel
                :layers="imageLayers"
                :active-layer-id="activeImageLayerId"
                :can-edit="canEditImage"
                :max-layers="MAX_IMAGE_LAYERS"
                @select="selectImageLayer"
                @add="addImageLayer"
                @duplicate="duplicateImageLayer"
                @remove="removeImageLayer"
                @rename="renameImageLayer"
                @toggle-visible="toggleImageLayerVisibility"
                @toggle-lock="toggleImageLayerLock"
                @preview-opacity="previewImageLayerOpacity"
                @set-opacity="setImageLayerOpacity"
                @move="moveImageLayer"
              />
            </div>
          </Teleport>

          <section
            class="image-editor-color-panel"
            :style="imageColorPickerStyle"
            aria-label="Drawing colors"
          >
            <h2 class="image-editor-color-heading">Colors</h2>

            <div class="image-editor-color-value" aria-label="Selected color">
              <span aria-hidden="true"></span>
              <input
                :value="selectedImageColorDraft"
                aria-label="Selected color hex value"
                inputmode="text"
                maxlength="9"
                spellcheck="false"
                :disabled="!canEditImage"
                @blur="commitSelectedImageColorInput"
                @input="updateSelectedImageColorFromInput"
              />
              <button
                type="button"
                class="image-editor-color-add"
                aria-label="Add selected color to palette"
                title="Pin color to your personal palette"
                :disabled="!canManagePersonalImagePalette"
                @click="pinImagePaletteColor()"
              >
                <Plus :size="15" :stroke-width="2.2" aria-hidden="true" />
              </button>
            </div>

            <ImageColorSwatches
              class="image-editor-color-swatches-host"
              :primary-color="selectedImageColor"
              :secondary-color="secondaryImageColor"
              :can-edit="canEditImage"
              @swap="swapImageColors"
              @reset="resetImageColors"
              @update:primary-color="setSelectedImageColor"
              @update:secondary-color="setSecondaryImageColor"
            />

          </section>

          <div class="image-editor-side-inspector" aria-label="Image options">
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
                <MousePointer2
                  v-else-if="activeImageInspectorPanel === 'transform'"
                  :size="15"
                  :stroke-width="2.2"
                  aria-hidden="true"
                />
                <Download
                  v-else-if="activeImageInspectorPanel === 'transfer'"
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
                    @blur="applyImageWidthDraft"
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
                    @blur="applyImageHeightDraft"
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
              v-else-if="activeImageInspectorPanel === 'preferences'"
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
                  <span class="image-editor-preference-label">Thickness</span>
                  <div class="image-editor-gap-list" aria-label="Grid line thickness">
                    <button
                      v-for="gap in IMAGE_GRID_GAP_OPTIONS"
                      :key="gap"
                      type="button"
                      class="image-editor-gap-button"
                      :class="{ 'is-active': imageGridGap === gap }"
                      :aria-label="`${gap} pixel grid line thickness`"
                      :aria-pressed="imageGridGap === gap"
                      :disabled="!isImageGridVisible"
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

            <ImageTransformPanel
              v-else-if="activeImageInspectorPanel === 'transform'"
              class="image-editor-transform-host"
              :selection="imageSelection"
              :can-edit="canMutateActiveImageLayerPixels"
              :has-clipboard="Boolean(imageClipboard)"
              @select-all="selectAllImagePixels"
              @deselect="deselectImagePixels"
              @delete="deleteImageSelection"
              @copy="copyImageSelection"
              @cut="cutImageSelection"
              @paste="pasteImageSelection"
              @flip-horizontal="flipImageHorizontally"
              @flip-vertical="flipImageVertically"
              @rotate-clockwise="rotateImageClockwise"
              @rotate-counterclockwise="rotateImageCounterclockwise"
              @nudge="nudgeImageSelection"
            />

            <ImageImportExportPanel
              v-else
              class="image-editor-transfer-host"
              :can-edit="canEditImage"
              :default-background-color="customImageBackground"
              :is-busy="isImageTransferBusy"
              @import-file="importImageFile"
              @create-animation="openGifAnimationCreation"
              @export-png="exportImagePng"
              @export-json="exportImageJson"
            />
          </section>

          <div class="image-editor-inspector-rail" role="group" aria-label="Image option panels">
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
              <span>Resize</span>
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
              <span>View</span>
            </button>
            <button
              type="button"
              class="image-editor-inspector-button"
              :class="{ 'is-active': activeImageInspectorPanel === 'transform' }"
              :aria-pressed="activeImageInspectorPanel === 'transform'"
              aria-label="Selection and transform options"
              title="Transform"
              @click="toggleImageInspectorPanel('transform')"
            >
              <MousePointer2 :size="19" :stroke-width="2.1" aria-hidden="true" />
              <span>Transform</span>
            </button>
            <button
              type="button"
              class="image-editor-inspector-button"
              :class="{ 'is-active': activeImageInspectorPanel === 'transfer' }"
              :aria-pressed="activeImageInspectorPanel === 'transfer'"
              aria-label="Import and export"
              title="Import & export"
              @click="toggleImageInspectorPanel('transfer')"
            >
              <Download :size="19" :stroke-width="2.1" aria-hidden="true" />
              <span>Files</span>
            </button>
          </div>
        </div>
        </aside>

        <ImageToolOptions
          v-if="isImageEditor"
          class="image-editor-context-host"
          :active-tool="activeImageTool"
          :brush-size="imageBrushSize"
          :shape-filled="isImageShapeFilled"
          :can-undo="canUndoImage"
          :can-redo="canRedoImage"
          :can-edit="canEditImage"
          @update:brush-size="imageBrushSize = $event"
          @update:shape-filled="isImageShapeFilled = $event"
          @undo="undoImage"
          @redo="redoImage"
        />

        <button
          v-if="isImageEditor"
          ref="imageMobileDockTriggerRef"
          type="button"
          class="image-editor-mobile-dock-trigger"
          aria-controls="image-editor-properties"
          :aria-expanded="isImageMobileDockOpen"
          :aria-label="
            areImageLayersFloating ? 'Open image options' : 'Open layers and image options'
          "
          @click="openImageMobileDock"
        >
          <PanelRightOpen :size="17" :stroke-width="2" aria-hidden="true" />
          <span>Panels</span>
        </button>

        <section
          v-if="isImageEditor"
          ref="imageStageRef"
          class="image-editor-viewport"
          :class="{
            'is-pan-ready':
              isImageSpacePressed &&
              !isPaintingImage &&
              !isImagePinching &&
              imageInteractionKind === null &&
              imageViewportPaintPointerId === null,
            'is-panning': isPanningImage,
            'is-pinching': isImagePinching,
            'is-pixel-mutation-blocked': isImagePixelMutationBlocked,
          }"
          :aria-label="imageViewportAriaLabel"
          tabindex="-1"
          @pointerdown.self.prevent="startImageViewportPointerInteraction"
          @pointermove.self.prevent="continueImagePointerInteraction"
          @pointerup.self="finishImagePointerInteraction"
          @pointercancel.self="cancelImagePointerInteraction"
          @lostpointercapture.self="cancelImagePointerInteraction"
          @wheel.stop.prevent="zoomImageFromWheel"
          @auxclick.self.prevent
          @contextmenu.self.prevent
        >
          <div
            class="image-editor-mobile-color-layer"
            :class="{ 'is-mobile-open': isImageMobileColorControlsOpen }"
            :aria-hidden="isImageMobileViewport && !isImageMobileColorControlsOpen"
            :inert="isImageMobileViewport && !isImageMobileColorControlsOpen"
          >
            <button
              type="button"
              class="image-editor-mobile-color-backdrop"
              aria-label="Close colors and palette"
              @click="closeImageMobileColorControls()"
            ></button>
            <section
              id="image-editor-mobile-colors"
              class="image-editor-mobile-color-sheet"
              :role="isImageMobileViewport ? 'dialog' : undefined"
              :aria-modal="isImageMobileViewport ? 'true' : undefined"
              aria-labelledby="image-editor-mobile-color-title"
              @keydown.esc.stop.prevent="closeImageMobileColorControls()"
            >
              <header class="image-editor-mobile-color-header">
                <strong id="image-editor-mobile-color-title">Colors &amp; palette</strong>
                <button
                  ref="imageMobileColorCloseRef"
                  type="button"
                  aria-label="Close colors and palette"
                  @click="closeImageMobileColorControls()"
                >
                  <X :size="20" :stroke-width="2" aria-hidden="true" />
                </button>
              </header>

              <div class="image-editor-mobile-color-content">
                <div
                  ref="imageColorPickerRef"
                  class="image-editor-floating-color-picker"
                  :style="imageColorPickerStyle"
                  role="group"
                  aria-label="Color picker"
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
                        <polygon points="98 0 0 184 196 184" fill="transparent" />
                      </svg>
                      <span
                        class="image-editor-color-triangle-handle"
                        :style="imageColorTriangleHandleStyle"
                        aria-hidden="true"
                      ></span>
                    </div>
                  </div>
                </div>

                <section
                  class="image-editor-mobile-color-panel"
                  :style="imageColorPickerStyle"
                  aria-label="Drawing colors"
                >
                  <div class="image-editor-color-value" aria-label="Selected color">
                    <span aria-hidden="true"></span>
                    <input
                      :value="selectedImageColorDraft"
                      aria-label="Selected color hex value"
                      inputmode="text"
                      maxlength="9"
                      spellcheck="false"
                      :disabled="!canEditImage"
                      @blur="commitSelectedImageColorInput"
                      @input="updateSelectedImageColorFromInput"
                    />
                    <button
                      type="button"
                      class="image-editor-color-add"
                      aria-label="Add selected color to palette"
                      title="Pin color to your personal palette"
                      :disabled="!canManagePersonalImagePalette"
                      @click="pinImagePaletteColor()"
                    >
                      <Plus :size="15" :stroke-width="2.2" aria-hidden="true" />
                    </button>
                  </div>

                  <ImageColorSwatches
                    class="image-editor-color-swatches-host"
                    :primary-color="selectedImageColor"
                    :secondary-color="secondaryImageColor"
                    :can-edit="canEditImage"
                    @swap="swapImageColors"
                    @reset="resetImageColors"
                    @update:primary-color="setSelectedImageColor"
                    @update:secondary-color="setSecondaryImageColor"
                  />
                </section>

                <div class="image-editor-floating-palette">
                  <ImagePalettePanel
                    :swatches="usedImagePaletteColors"
                    :pinned-colors="personalImagePalette"
                    :primary-color="selectedImageColor"
                    :secondary-color="secondaryImageColor"
                    :can-select="canEditImage"
                    :can-manage="canManagePersonalImagePalette"
                    @select-primary="selectImagePaletteColor"
                    @select-secondary="selectSecondaryImagePaletteColor"
                    @pin="pinImagePaletteColor"
                    @edit="editImagePaletteColor"
                    @remove="unpinImagePaletteColor"
                  />
                </div>
              </div>
            </section>
          </div>
          <div
            class="image-editor-preview"
            :style="imageFloatingPreviewStyle"
            aria-hidden="true"
          >
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
          </div>
          <ImageEditorNotice
            class="image-editor-notice-host"
            :message="imageTransferNotice"
            :tone="imageTransferNoticeTone"
            @dismiss="imageTransferNotice = ''"
          />
          <div
            ref="imageArtboardRef"
            class="image-editor-artboard"
            :class="{
              'is-panning': isPanningImage,
              'is-pinching': isImagePinching,
              'is-pixel-mutation-blocked': isImagePixelMutationBlocked,
            }"
            :style="imageCanvasGridStyle"
            :aria-label="imageArtboardAriaLabel"
            tabindex="0"
            @pointerdown.prevent="startImageArtboardPointerInteraction"
            @pointermove.prevent="continueImagePointerInteraction"
            @pointerup="finishImagePointerInteraction"
            @pointercancel="cancelImagePointerInteraction"
            @lostpointercapture="cancelImagePointerInteraction"
            @pointerleave="leaveImageCanvas"
            @auxclick.prevent
            @contextmenu.prevent
          >
            <canvas
              ref="imageCanvasRef"
              class="image-editor-canvas-bitmap"
              :style="imageCanvasBitmapStyle"
            >
              Pixel art preview. Use the editor tools and keyboard shortcuts to modify the image.
            </canvas>
            <svg
              v-if="imageGridOverlayOpacity > 0"
              class="image-editor-grid-overlay"
              :width="imageGridOverlayPlan.cssWidth"
              :height="imageGridOverlayPlan.cssHeight"
              :viewBox="`0 0 ${imageGridOverlayPlan.cssWidth} ${imageGridOverlayPlan.cssHeight}`"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <template v-if="imageGridLineStyle !== 'dots'">
                <path
                  v-if="imageGridOverlayPath"
                  :d="imageGridOverlayPath"
                  :stroke="customImageGridColor"
                  :stroke-width="imageGridStrokeWidth"
                  :stroke-opacity="imageGridOverlayOpacity"
                  :stroke-dasharray="imageGridLineStyle === 'dashed' ? imageGridDashArray : undefined"
                  fill="none"
                  shape-rendering="crispEdges"
                  stroke-linecap="butt"
                  vector-effect="non-scaling-stroke"
                />
              </template>
              <template v-else-if="hasImageGridDotIntersections">
                <defs>
                  <pattern
                    :id="imageGridDotPatternId"
                    :x="-imageGridOverlayPlan.step / 2"
                    :y="-imageGridOverlayPlan.step / 2"
                    :width="imageGridOverlayPlan.step"
                    :height="imageGridOverlayPlan.step"
                    patternUnits="userSpaceOnUse"
                    patternContentUnits="userSpaceOnUse"
                  >
                    <circle
                      :cx="imageGridOverlayPlan.step / 2"
                      :cy="imageGridOverlayPlan.step / 2"
                      :r="imageGridDotRadius"
                      :fill="customImageGridColor"
                      :fill-opacity="imageGridOverlayOpacity"
                    />
                  </pattern>
                </defs>
                <rect
                  :x="imageGridDotClipRect.x"
                  :y="imageGridDotClipRect.y"
                  :width="imageGridDotClipRect.width"
                  :height="imageGridDotClipRect.height"
                  :fill="`url(#${imageGridDotPatternId})`"
                />
              </template>
            </svg>
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
              v-if="
                hoveredImagePixelIndex !== null &&
                !isImageGraffitiHoverPreview &&
                (!isActiveImagePixelMutationTool || canMutateActiveImageLayerPixels)
              "
              class="image-editor-hover-cell"
              :style="imageHoverCellStyle"
              aria-hidden="true"
            ></span>
            <span
              v-for="cell in imageGraffitiHoverCells"
              :key="`image-graffiti-hover-${cell.key}`"
              class="image-editor-hover-cell is-graffiti"
              :style="cell.style"
              aria-hidden="true"
            ></span>
            <span
              v-if="imageSelection"
              class="image-editor-selection"
              :style="imageSelectionStyle"
              aria-hidden="true"
            ></span>
          </div>
        </section>

        <footer v-if="isImageEditor" class="image-editor-statusbar" aria-label="Canvas status">
          <span class="image-editor-statusbar__document">
            {{ imageGridWidth }} × {{ imageGridHeight }} px
          </span>
          <button
            ref="imageMobileColorTriggerRef"
            type="button"
            class="image-editor-mobile-color-trigger"
            aria-controls="image-editor-mobile-colors"
            :aria-expanded="isImageMobileColorControlsOpen"
            aria-label="Open colors and palette"
            title="Colors and palette"
            @click="openImageMobileColorControls"
          >
            <span class="image-editor-mobile-color-trigger__swatch" aria-hidden="true"></span>
          </button>
          <ImageZoomControls
            class="image-editor-zoom-host"
            :class="{
              'is-fit': imageZoomMode === 'fit',
              'is-actual': imageZoomMode === 'actual',
            }"
            :zoom="imageZoom"
            :min="MIN_IMAGE_ZOOM"
            :max="MAX_IMAGE_ZOOM"
            @zoom-in="zoomImageIn"
            @zoom-out="zoomImageOut"
            @fit="fitImageToScreen"
            @actual-size="showImageAtActualSize"
          />
        </footer>
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
    <ImageConflictNotice
      :open="isImageConflictOpen"
      :local-revision="resource?.revision ?? null"
      :remote-revision="imageConflictRemoteRevision"
      :operation="imageConflictOperation?.kind || 'document'"
      :busy="isImageConflictResolving"
      @reload="reloadImageAfterConflict"
      @keep-local="keepLocalImageAfterConflict"
      @close="isImageConflictOpen = false"
    />
  </section>
</template>

<style scoped>
  .resource-editor {
    --editor-bg: #080808;
    --editor-panel: #111111;
    --editor-surface: #1c1c1c;
    --editor-hover: #242424;
    --editor-selected: #f2f2f2;
    --editor-selected-ink: #0a0a0a;
    --editor-border: #2b2b2b;
    --editor-border-strong: #666666;
    --editor-text: #f2f2f2;
    --editor-muted: #b8b8b8;
    --editor-quiet: #8a8a8a;
    --editor-focus: #ffffff;
    --editor-radius-xs: 4px;
    --editor-radius-sm: 6px;
    --editor-radius-md: 8px;
    --editor-radius-pill: 999px;
    --surface: var(--editor-panel);
    --surface-soft: var(--editor-surface);
    --line: var(--editor-border);
    --line-strong: var(--editor-border-strong);
    --text: var(--editor-text);
    --muted: var(--editor-muted);
    --quiet: var(--editor-quiet);
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

  /* Pixel editor workbench --------------------------------------------------
     Static chrome is flat and neutral. Color is reserved for document content,
     the user-selected file icon, and genuine semantic states. */
  .resource-editor-title {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    min-width: 0;
    max-width: 100%;
    height: 36px;
    padding: 0 10px;
    color: var(--editor-text);
    background: var(--editor-panel);
    border: 1px solid var(--editor-border);
    border-radius: var(--editor-radius-md);
    box-shadow: none;
  }

  .resource-editor-title.is-loading {
    opacity: 0.66;
  }

  .resource-editor-title__icon {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 22px;
    height: 22px;
    color: var(--resource-editor-color);
  }

  .resource-editor-title__icon svg {
    display: block;
    color: inherit;
  }

  .resource-editor-title__name {
    min-width: 0;
    max-width: min(240px, 24vw);
    padding: 4px;
    overflow: hidden;
    color: var(--editor-text);
    font-size: 13px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--editor-radius-sm);
    outline: none;
  }

  .resource-editor-title__name:hover:not(:disabled) {
    background: var(--editor-surface);
  }

  .resource-editor-title__name:focus-visible {
    border-color: var(--editor-focus);
  }

  .resource-editor-title__name:disabled {
    cursor: default;
  }

  .resource-editor-title__name-input {
    width: min(220px, 23vw);
    height: 28px;
    padding: 0 6px;
    box-sizing: border-box;
    color: var(--editor-text);
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    background: var(--editor-surface);
    border: 1px solid var(--editor-border-strong);
    border-radius: var(--editor-radius-sm);
    outline: 1px solid var(--editor-focus);
    outline-offset: 1px;
  }

  .resource-editor-title__kind {
    flex: 0 0 auto;
    color: var(--editor-quiet);
    font-size: 11px;
    font-weight: 500;
  }

  .resource-editor-title__save-cluster {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    padding-left: 8px;
    border-left: 1px solid var(--editor-border);
  }

  .resource-editor :deep(.studio-topbar) {
    min-height: 56px;
    padding: 6px 16px;
    background: #0b0b0b;
    border-bottom-color: var(--editor-border);
    backdrop-filter: none;
  }

  .resource-editor :deep(.studio-topbar__logo) {
    width: 26px;
    height: 26px;
    filter: none;
  }

  .resource-editor :deep(.studio-topbar__project-logo),
  .resource-editor :deep(.studio-topbar__project-logo-loader) {
    width: 34px;
    height: 34px;
    border-color: var(--editor-border-strong);
    border-radius: var(--editor-radius-md);
  }

  .resource-editor :deep(.studio-topbar__brand-trail.has-logo) {
    width: 36px;
    height: 36px;
  }

  .resource-editor :deep(.studio-topbar__avatar) {
    width: 34px;
    height: 34px;
    border-color: var(--editor-border-strong);
  }

  .resource-editor :deep(.studio-topbar__user-label) {
    color: var(--editor-muted);
    font-size: 12px;
    font-weight: 550;
  }

  .resource-editor-stage {
    position: relative;
    flex: 1;
    min-height: 0;
    background: var(--editor-bg);
  }

  .resource-editor-canvas {
    --editor-left-dock: 48px;
    --editor-right-dock: clamp(360px, 24vw, 400px);
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: var(--editor-left-dock) minmax(0, 1fr) var(--editor-right-dock);
    grid-template-rows: 36px minmax(0, 1fr) 30px;
    place-items: stretch;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    isolation: isolate;
    background: var(--editor-bg);
  }

  .resource-editor-canvas::after {
    display: none;
    content: none;
  }

  .image-editor-left-dock {
    position: relative;
    z-index: 4;
    grid-column: 1;
    grid-row: 1 / 4;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    min-width: 0;
    min-height: 0;
    padding: 6px 5px;
    overflow-x: hidden;
    overflow-y: auto;
    box-sizing: border-box;
    background: var(--editor-panel);
    border-right: 1px solid var(--editor-border);
    box-shadow: none;
    scrollbar-color: var(--editor-border-strong) transparent;
    scrollbar-width: thin;
  }

  .image-editor-left-dock::before,
  .image-editor-left-dock::after {
    display: none;
    content: none;
  }

  .image-editor-floating-layers {
    position: relative;
    z-index: 6;
    grid-column: 2;
    grid-row: 2;
    min-width: 0;
    min-height: 0;
    pointer-events: none;
  }

  .image-editor-tablet-layers-trigger {
    position: absolute;
    right: 12px;
    bottom: 12px;
    z-index: 7;
    display: inline-flex;
    gap: 7px;
    align-items: center;
    min-height: 38px;
    padding: 0 12px;
    color: var(--editor-text);
    font: inherit;
    font-size: 12px;
    font-weight: 680;
    cursor: pointer;
    background: var(--editor-panel);
    border: 1px solid var(--editor-border-strong);
    border-radius: var(--editor-radius-md);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.34);
    pointer-events: auto;
  }

  .image-editor-tablet-layers-trigger small {
    color: var(--editor-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .image-editor-tablet-layers-trigger:hover,
  .image-editor-tablet-layers-trigger:focus-visible,
  .image-editor-tablet-layers-trigger[aria-expanded="true"] {
    color: var(--editor-selected-ink);
    background: var(--editor-selected);
    border-color: var(--editor-selected);
    outline: none;
  }

  .image-editor-tablet-layers-trigger:hover small,
  .image-editor-tablet-layers-trigger:focus-visible small,
  .image-editor-tablet-layers-trigger[aria-expanded="true"] small {
    color: currentColor;
    opacity: 0.66;
  }

  .image-editor-tablet-layers-dialog-layer {
    position: absolute;
    inset: 0;
    z-index: 18;
    display: grid;
    place-items: center;
    padding: 16px;
    box-sizing: border-box;
    visibility: hidden;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 180ms ease-out,
      visibility 0s linear 180ms;
  }

  .image-editor-tablet-layers-dialog-layer.is-open {
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
    transition-delay: 0s;
  }

  .image-editor-tablet-layers-dialog {
    position: relative;
    width: min(430px, calc(100% - 32px));
    max-height: calc(100% - 32px);
    overflow: hidden;
    border-radius: var(--editor-radius-md);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.48);
    pointer-events: auto;
  }

  .image-editor-tablet-layers-dialog__close {
    position: absolute;
    top: 7px;
    right: 48px;
    z-index: 3;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    color: var(--editor-muted);
    cursor: pointer;
    background: var(--editor-surface);
    border: 1px solid var(--editor-border-strong);
    border-radius: var(--editor-radius-sm);
  }

  .image-editor-tablet-layers-dialog__close:hover,
  .image-editor-tablet-layers-dialog__close:focus-visible {
    color: var(--editor-text);
    background: var(--editor-hover);
    outline: 1px solid var(--editor-focus);
    outline-offset: 1px;
  }

  #image-editor-tablet-layers-dialog-host .image-editor-layers-host {
    position: static;
    display: block;
    width: 100%;
    height: auto;
    max-height: none;
    overflow: hidden;
    border: 0;
    pointer-events: auto;
  }

  .image-editor-floating-layers .image-editor-tablet-layers-dialog :deep(.image-layers-panel) {
    max-height: calc(100dvh - 160px);
  }

  .image-editor-floating-layers
    .image-editor-tablet-layers-dialog
    :deep(.image-layers-panel__list) {
    max-height: min(46dvh, 328px);
  }

  .image-editor-toolbar {
    position: static;
    width: 32px;
    min-width: 32px;
  }

  .image-editor-context-host {
    position: relative;
    z-index: 3;
    grid-column: 2;
    grid-row: 1;
    width: auto;
    min-width: 0;
  }

  .image-editor-viewport {
    position: relative;
    z-index: 1;
    grid-column: 2;
    grid-row: 2;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    overscroll-behavior: none;
    cursor: crosshair;
    background: var(--editor-bg);
    outline: none;
    touch-action: none;
    user-select: none;
  }

  .image-editor-viewport.is-pixel-mutation-blocked,
  .image-editor-viewport.is-pixel-mutation-blocked .image-editor-artboard,
  .image-editor-artboard.is-pixel-mutation-blocked {
    cursor: not-allowed;
  }

  .image-editor-viewport.is-pan-ready {
    cursor: grab;
  }

  .image-editor-viewport.is-panning,
  .image-editor-viewport.is-pinching {
    cursor: grabbing;
  }

  .image-editor-viewport.is-pan-ready .image-editor-artboard {
    cursor: grab;
  }

  .image-editor-viewport.is-panning .image-editor-artboard,
  .image-editor-viewport.is-pinching .image-editor-artboard {
    cursor: grabbing;
  }

  .image-editor-viewport::before,
  .image-editor-viewport::after {
    display: none;
    content: none;
  }

  .image-editor-statusbar {
    position: relative;
    z-index: 3;
    grid-column: 2;
    grid-row: 3;
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    min-height: 30px;
    padding: 0 6px 0 10px;
    box-sizing: border-box;
    color: var(--editor-quiet);
    background: var(--editor-panel);
    border-top: 1px solid var(--editor-border);
  }

  .image-editor-statusbar__document {
    min-width: 0;
    overflow: hidden;
    font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .image-editor-mobile-dock-trigger,
  .image-editor-mobile-dock-header,
  .image-editor-mobile-color-trigger {
    display: none;
  }

  .image-editor-mobile-dock-trigger {
    position: absolute;
    top: 5px;
    right: 6px;
    z-index: 6;
    flex: 0 0 auto;
    gap: 5px;
    align-items: center;
    justify-content: center;
    color: var(--editor-muted);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: var(--editor-radius-sm);
  }

  .image-editor-mobile-dock-trigger:hover,
  .image-editor-mobile-dock-trigger:focus-visible,
  .image-editor-mobile-dock-trigger[aria-expanded="true"] {
    color: var(--editor-text);
    background: var(--editor-hover);
    outline: none;
  }

  .image-editor-mobile-dock-header {
    position: sticky;
    top: 0;
    z-index: 4;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    min-height: 48px;
    padding: 0 8px 0 14px;
    box-sizing: border-box;
    color: var(--editor-text);
    background: var(--editor-panel);
    border-bottom: 1px solid var(--editor-border);
  }

  .image-editor-mobile-dock-header strong {
    overflow: hidden;
    font-size: 13px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .image-editor-mobile-dock-header button {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    color: var(--editor-muted);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: var(--editor-radius-sm);
  }

  .image-editor-mobile-dock-header button:hover,
  .image-editor-mobile-dock-header button:focus-visible {
    color: var(--editor-text);
    background: var(--editor-hover);
    outline: none;
  }

  .image-editor-mobile-color-trigger {
    flex: 0 0 auto;
    place-items: center;
    width: 36px;
    min-width: 36px;
    height: 36px;
    min-height: 36px;
    padding: 0;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: var(--editor-radius-sm);
    outline: none;
  }

  .image-editor-mobile-color-trigger__swatch {
    display: block;
    width: 26px;
    height: 26px;
    background:
      radial-gradient(
        circle at center,
        rgba(255, 255, 255, 0.78) 0,
        rgba(255, 255, 255, 0.48) 32%,
        rgba(255, 255, 255, 0.14) 56%,
        rgba(255, 255, 255, 0) 72%
      ),
      conic-gradient(
        from 45deg,
        #ff453a 0deg,
        #ff9f0a 45deg,
        #ffd60a 90deg,
        #32d74b 145deg,
        #64d2ff 200deg,
        #0a84ff 245deg,
        #5e5ce6 285deg,
        #bf5af2 325deg,
        #ff453a 360deg
      );
    border: 1px solid #777777;
    border-radius: 6px;
    box-shadow: 0 0 0 1px #080808;
  }

  .image-editor-mobile-color-trigger:hover,
  .image-editor-mobile-color-trigger:focus-visible,
  .image-editor-mobile-color-trigger[aria-expanded="true"] {
    background: var(--editor-hover);
  }

  .image-editor-mobile-color-trigger:focus-visible {
    outline: 1px solid var(--editor-focus);
    outline-offset: -2px;
  }

  .image-editor-mobile-color-trigger[aria-expanded="true"]
    .image-editor-mobile-color-trigger__swatch {
    border-color: #ffffff;
    box-shadow:
      0 0 0 1px #080808,
      0 0 0 2px #ffffff;
  }

  .image-editor-mobile-color-layer,
  .image-editor-mobile-color-sheet,
  .image-editor-mobile-color-content {
    display: contents;
  }

  .image-editor-mobile-color-backdrop,
  .image-editor-mobile-color-header,
  .image-editor-mobile-color-panel {
    display: none;
  }

  .image-editor-zoom-host {
    position: static;
    flex: 0 0 auto;
    transform: none;
  }

  .image-editor-notice-host {
    position: absolute;
    top: 10px;
    left: 50%;
    z-index: 7;
    max-width: min(460px, calc(100% - 28px));
    transform: translateX(-50%);
  }

  .image-editor-right-dock {
    position: relative;
    z-index: 4;
    grid-column: 3;
    grid-row: 1 / 4;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;
    background: var(--editor-panel);
    border-left: 1px solid var(--editor-border);
    box-shadow: none;
  }

  .image-editor-preview {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 6;
    display: grid;
    place-items: start end;
    width: var(--image-preview-size, 176px);
    height: var(--image-preview-size, 176px);
    padding: 0;
    box-sizing: border-box;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    pointer-events: none;
  }

  .image-editor-preview__grid {
    position: relative;
    display: block;
    align-self: start;
    justify-self: end;
    max-width: 100%;
    max-height: 100%;
    overflow: hidden;
    image-rendering: pixelated;
    background: var(--image-preview-empty-pixel, #101010);
    border: 0;
    border-radius: var(--editor-radius-sm);
    box-shadow: inset 0 0 0 1px var(--editor-border-strong);
  }

  .image-editor-preview__grid canvas {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .image-editor-preview__viewport {
    position: absolute;
    z-index: 2;
    min-width: 6px;
    min-height: 6px;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.14);
    border: 1px solid var(--editor-text);
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px var(--editor-selected-ink);
    pointer-events: none;
  }

  .image-editor-layers-host {
    position: static;
    flex: 0 1 auto;
    width: 100%;
    min-width: 0;
    min-height: 0;
    max-height: min(250px, 28vh);
    overflow: hidden;
    border-bottom: 1px solid var(--editor-border);
  }

  .image-editor-floating-layers > .image-editor-layers-host {
    position: absolute;
    right: 12px;
    bottom: 12px;
    display: flex;
    align-items: flex-end;
    width: min(420px, calc(100% - 244px));
    height: min(360px, calc(100% - 220px));
    max-height: none;
    overflow: visible;
    border: 0;
    pointer-events: none;
  }

  .image-editor-floating-layers :deep(.image-layers-panel) {
    grid-template-rows: auto minmax(0, 1fr) auto;
    width: 100%;
    max-height: 100%;
    overflow: hidden;
    background: var(--editor-panel);
    border: 1px solid var(--editor-border-strong);
    border-radius: var(--editor-radius-md);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.38);
    pointer-events: auto;
  }

  .image-editor-floating-layers :deep(.image-layers-panel__list) {
    min-height: 0;
    max-height: none;
  }

  .image-editor-color-panel {
    position: static;
    display: grid;
    flex: 0 0 auto;
    grid-template-areas:
      "value"
      "swatches";
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    align-items: start;
    width: 100%;
    min-width: 0;
    padding: 12px;
    box-sizing: border-box;
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--editor-border);
    border-radius: 0;
    box-shadow: none;
    transform: none;
  }

  .image-editor-color-heading,
  .image-editor-inspector-button span {
    display: none;
  }

  .image-editor-color-picker-stage {
    position: relative;
    width: 292px;
    height: 292px;
    transform: scale(var(--image-color-picker-scale, 0.5));
    transform-origin: top left;
  }

  .image-editor-floating-color-picker {
    --image-color-picker-scale: 0.67;
    position: absolute;
    bottom: 12px;
    left: 12px;
    z-index: 6;
    width: 196px;
    height: 196px;
    overflow: hidden;
    pointer-events: auto;
    touch-action: none;
  }

  .image-editor-floating-palette {
    --image-palette-safe-bottom: 220px;
    --image-palette-safe-right: 220px;
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 6;
    width: calc(100% - var(--image-palette-safe-right));
    height: calc(100% - var(--image-palette-safe-bottom) - 12px);
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    pointer-events: none;
    scrollbar-color: var(--editor-border-strong) transparent;
    scrollbar-width: thin;
  }

  @media (min-width: 769px) {
    .image-editor-floating-palette :deep(.image-palette-panel) {
      height: 100%;
    }

    .image-editor-floating-palette :deep(.image-palette-panel__swatches) {
      grid-auto-flow: column;
      grid-auto-columns: var(--image-palette-swatch-size, 32px);
      grid-template-rows: repeat(auto-fit, var(--image-palette-swatch-size, 32px));
      grid-template-columns: none;
      width: max-content;
      max-width: none;
      height: 100%;
      max-height: 100%;
      margin-inline: 0;
      pointer-events: auto;
      touch-action: manipulation;
    }
  }

  .image-editor-color-wheel {
    position: absolute;
    inset: 0;
    width: 292px;
    height: 292px;
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
    border: 1px solid #565656;
    border-radius: 50%;
    box-shadow: none;
  }

  .image-editor-color-wheel::after {
    position: absolute;
    inset: 28px;
    content: "";
    background: #101010;
    border: 1px solid #3a3a3a;
    border-radius: 50%;
    box-shadow: none;
    pointer-events: none;
  }

  .image-editor-color-hue-handle,
  .image-editor-color-triangle-handle {
    position: absolute;
    z-index: 3;
    width: 12px;
    height: 12px;
    box-sizing: border-box;
    background: transparent;
    border: 2px solid #ffffff;
    border-radius: 50%;
    outline: 1px solid #000000;
    pointer-events: none;
    transform: translate(-50%, -50%);
  }

  .image-editor-color-hue-handle {
    width: 28px;
    height: 8px;
    background: #ffffff;
    border: 1px solid #000000;
    border-radius: 4px;
    outline: 1px solid #ffffff;
  }

  .image-editor-color-triangle {
    position: absolute;
    top: 28px;
    left: 48px;
    z-index: 2;
    width: 196px;
    height: 184px;
    overflow: visible;
    cursor: crosshair;
    filter: none;
    pointer-events: none;
  }

  .image-editor-color-triangle::after {
    display: none;
    content: none;
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
    grid-area: value;
    grid-template-columns: 34px minmax(0, 1fr) 34px;
    gap: 6px;
    align-items: center;
    width: 100%;
    min-width: 0;
    margin: 0;
    transform: none;
  }

  .image-editor-color-value > span {
    width: 34px;
    height: 34px;
    box-sizing: border-box;
    background: var(--selected-image-color, #ffffff);
    border: 1px solid var(--editor-border-strong);
    border-radius: var(--editor-radius-sm);
    box-shadow: none;
  }

  .image-editor-color-value input {
    width: 100%;
    min-width: 0;
    height: 34px;
    padding: 0 8px;
    box-sizing: border-box;
    color: var(--editor-muted);
    font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
    font-size: 12px;
    font-weight: 550;
    text-transform: uppercase;
    background: var(--editor-surface);
    border: 1px solid var(--editor-border);
    border-radius: var(--editor-radius-sm);
    outline: none;
  }

  .image-editor-color-value input:hover {
    border-color: var(--editor-border-strong);
  }

  .image-editor-color-value input:focus-visible {
    border-color: var(--editor-focus);
  }

  .image-editor-color-add {
    display: grid;
    place-items: center;
    width: 34px;
    min-width: 34px;
    height: 34px;
    padding: 0;
    color: var(--editor-muted);
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--editor-border);
    border-radius: var(--editor-radius-sm);
    box-shadow: none;
    outline: none;
  }

  .image-editor-color-add:hover:not(:disabled) {
    color: var(--editor-text);
    background: var(--editor-hover);
    border-color: var(--editor-border-strong);
  }

  .image-editor-color-add:focus-visible {
    outline: 1px solid var(--editor-focus);
    outline-offset: -2px;
  }

  .image-editor-color-add:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }

  .image-editor-color-swatches-host {
    grid-area: swatches;
    width: 100%;
    min-width: 0;
    margin: 0;
    transform: none;
  }

  .image-editor-side-inspector {
    position: static;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    min-height: 36px;
    overflow: hidden;
    pointer-events: auto;
    transform: none;
  }

  .image-editor-inspector-rail {
    position: static;
    z-index: 2;
    order: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2px;
    width: 100%;
    min-height: 42px;
    padding: 3px;
    box-sizing: border-box;
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--editor-border);
    border-radius: 0;
    pointer-events: auto;
  }

  .image-editor-inspector-button {
    display: grid;
    place-items: center;
    width: 100%;
    min-width: 0;
    height: 36px;
    padding: 0;
    color: var(--editor-quiet);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-right: 0;
    border-radius: var(--editor-radius-sm);
    box-shadow: none;
    outline: none;
  }

  .image-editor-inspector-button:last-child {
    border-right: 0;
  }

  .image-editor-inspector-button:hover {
    color: var(--editor-text);
    background: var(--editor-hover);
  }

  .image-editor-inspector-button:focus-visible {
    outline: 1px solid var(--editor-focus);
    outline-offset: -2px;
  }

  .image-editor-inspector-button.is-active {
    color: var(--editor-selected-ink);
    background: var(--editor-selected);
  }

  .image-editor-inspector-panel {
    position: static;
    order: 1;
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    min-height: 0;
    max-height: none;
    padding: 0;
    overflow-x: hidden;
    overflow-y: auto;
    box-sizing: border-box;
    color: var(--editor-text);
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    pointer-events: auto;
    transform: none;
    scrollbar-color: var(--editor-border-strong) transparent;
    scrollbar-width: thin;
  }

  .image-editor-inspector-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    min-height: 40px;
    padding: 7px 12px;
    box-sizing: border-box;
    border-bottom: 1px solid var(--editor-border);
  }

  .image-editor-inspector-title {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    gap: 7px;
    align-items: center;
    min-width: 0;
    color: var(--editor-text);
    font-size: 13px;
    font-weight: 600;
  }

  .image-editor-inspector-title span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .image-editor-inspector-close {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    color: var(--editor-quiet);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: var(--editor-radius-sm);
    outline: none;
  }

  .image-editor-inspector-close:hover {
    color: var(--editor-text);
    background: var(--editor-hover);
  }

  .image-editor-inspector-close:focus-visible {
    outline: 1px solid var(--editor-focus);
    outline-offset: -2px;
  }

  .image-editor-settings-page,
  .image-editor-dimensions,
  .image-editor-anchor-field,
  .image-editor-preference-group {
    display: grid;
    min-width: 0;
  }

  .image-editor-settings-page {
    gap: 16px;
    padding: 12px;
  }

  .image-editor-dimensions,
  .image-editor-anchor-field {
    gap: 8px;
  }

  .image-editor-preference-group {
    gap: 9px;
  }

  .image-editor-preference-group + .image-editor-preference-group {
    padding-top: 14px;
    border-top: 1px solid var(--editor-border);
  }

  .image-editor-control-heading {
    color: var(--editor-muted);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    text-transform: none;
  }

  .image-editor-control-heading::after {
    display: none;
    content: none;
  }

  .image-editor-grid-subheading {
    padding-top: 3px;
    color: var(--editor-quiet);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .image-editor-size-row,
  .image-editor-preference-row,
  .image-editor-range-row,
  .image-editor-toggle-row {
    display: grid;
    gap: 8px;
    align-items: center;
    min-width: 0;
    min-height: 34px;
  }

  .image-editor-size-row {
    grid-template-columns: minmax(0, 1fr) 84px;
  }

  .image-editor-preference-row {
    grid-template-columns: 112px minmax(0, 1fr);
  }

  .image-editor-range-row {
    grid-template-columns: 84px minmax(72px, 1fr) 64px;
  }

  .image-editor-toggle-row {
    grid-template-columns: minmax(0, 1fr) 32px;
  }

  .image-editor-size-field,
  .image-editor-preference-label,
  .image-editor-range-row > label,
  .image-editor-toggle-row > span {
    color: var(--editor-muted);
    font-size: 12px;
    font-weight: 500;
  }

  .image-editor-size-input,
  .image-editor-opacity-input,
  .image-editor-preference-number-input {
    width: 100%;
    min-width: 0;
    height: 34px;
    padding: 0 8px;
    box-sizing: border-box;
    color: var(--editor-text);
    font: inherit;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    text-align: right;
    background: var(--editor-surface);
    border: 1px solid var(--editor-border);
    border-radius: 5px;
    outline: none;
  }

  .image-editor-size-input:hover,
  .image-editor-opacity-input:hover,
  .image-editor-preference-number-input:hover {
    border-color: var(--editor-border-strong);
  }

  .image-editor-size-input:focus-visible,
  .image-editor-opacity-input:focus-visible,
  .image-editor-preference-number-input:focus-visible {
    border-color: var(--editor-focus);
  }

  .image-editor-size-input:disabled,
  .image-editor-opacity-input:disabled,
  .image-editor-preference-number-input:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .image-editor-dimension-link-row {
    display: flex;
    gap: 7px;
    align-items: center;
    min-height: 34px;
  }

  .image-editor-dimension-link {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    color: var(--editor-quiet);
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--editor-border);
    border-radius: 5px;
    outline: none;
  }

  .image-editor-dimension-link:hover {
    color: var(--editor-text);
    background: var(--editor-hover);
    border-color: var(--editor-border-strong);
  }

  .image-editor-dimension-link:focus-visible {
    outline: 1px solid var(--editor-focus);
    outline-offset: -2px;
  }

  .image-editor-dimension-link.is-active {
    color: var(--editor-selected-ink);
    background: var(--editor-selected);
    border-color: var(--editor-selected);
  }

  .image-editor-dimension-link-label {
    color: var(--editor-quiet);
    font-size: 12px;
  }

  .image-editor-anchor-grid {
    display: grid;
    grid-template-columns: repeat(3, 32px);
    gap: 6px;
  }

  .image-editor-anchor-grid button,
  .image-editor-gap-button,
  .image-editor-segment-button {
    display: grid;
    place-items: center;
    min-width: 32px;
    height: 32px;
    padding: 0 7px;
    color: var(--editor-muted);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--editor-border);
    border-radius: 5px;
    box-shadow: none;
    outline: none;
  }

  .image-editor-anchor-grid button {
    width: 32px;
  }

  .image-editor-anchor-grid button:hover:not(:disabled),
  .image-editor-gap-button:hover:not(:disabled),
  .image-editor-segment-button:hover:not(:disabled) {
    color: var(--editor-text);
    background: var(--editor-hover);
    border-color: var(--editor-border-strong);
  }

  .image-editor-anchor-grid button:focus-visible,
  .image-editor-gap-button:focus-visible,
  .image-editor-segment-button:focus-visible {
    outline: 1px solid var(--editor-focus);
    outline-offset: -2px;
  }

  .image-editor-anchor-grid button.is-active,
  .image-editor-gap-button.is-active,
  .image-editor-segment-button.is-active {
    color: var(--editor-selected-ink);
    background: var(--editor-selected);
    border-color: var(--editor-selected);
  }

  .image-editor-anchor-grid button:disabled,
  .image-editor-gap-button:disabled,
  .image-editor-segment-button:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }

  .image-editor-anchor-grid button span {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
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
    background: var(--editor-selected-ink);
    border-radius: 50%;
  }

  .image-editor-anchor-grid button i.is-up {
    border-right: 4px solid transparent;
    border-bottom: 6px solid currentColor;
    border-left: 4px solid transparent;
  }

  .image-editor-anchor-grid button i.is-right {
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    border-left: 6px solid currentColor;
  }

  .image-editor-anchor-grid button i.is-down {
    border-top: 6px solid currentColor;
    border-right: 4px solid transparent;
    border-left: 4px solid transparent;
  }

  .image-editor-anchor-grid button i.is-left {
    border-top: 4px solid transparent;
    border-right: 6px solid currentColor;
    border-bottom: 4px solid transparent;
  }

  .image-editor-gap-list,
  .image-editor-segment-list,
  .image-editor-grid-color-list {
    display: flex;
    gap: 4px;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
  }

  .image-editor-segment-list {
    flex-wrap: wrap;
  }

  .image-editor-background-color-picker,
  .image-editor-grid-color-picker,
  .image-editor-subdivision-color-picker {
    position: relative;
    display: block;
    width: 32px;
    height: 32px;
    overflow: hidden;
    background: var(--custom-background-color, var(--custom-grid-color, var(--custom-subdivision-color, #ffffff)));
    border: 1px solid var(--editor-border-strong);
    border-radius: 5px;
    cursor: pointer;
    outline: none;
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

  .image-editor-background-color-picker:focus-within,
  .image-editor-grid-color-picker:focus-within,
  .image-editor-subdivision-color-picker:focus-within {
    outline: 1px solid var(--editor-focus);
    outline-offset: 1px;
  }

  .image-editor-grid-color-picker:has(input:disabled),
  .image-editor-subdivision-color-picker:has(input:disabled) {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .image-editor-toggle-row input {
    justify-self: end;
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--editor-selected);
  }

  .image-editor-range-row input[type="range"] {
    width: 100%;
    min-width: 0;
    min-height: 32px;
    margin: 0;
    accent-color: var(--editor-selected);
  }

  .image-editor-transform-host,
  .image-editor-transfer-host {
    width: 100%;
    margin-top: 0;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .image-editor-artboard {
    position: absolute;
    top: calc(var(--image-artboard-center-y, 50%) - var(--image-artboard-half-height, 0px));
    left: calc(var(--image-artboard-center-x, 50%) - var(--image-artboard-half-width, 0px));
    z-index: 2;
    display: grid;
    overflow: hidden;
    box-sizing: border-box;
    cursor: crosshair;
    background-color: var(--image-pixel-background, #101010);
    border: 0;
    border-radius: var(--editor-radius-md);
    box-shadow: 0 0 0 1px var(--editor-border-strong);
    outline: none;
    touch-action: none;
    transform: translate3d(var(--image-pan-x, 0px), var(--image-pan-y, 0px), 0)
      rotate(var(--image-rotation, 0rad)) scale(var(--image-live-scale, 1));
    transform-origin: center;
    user-select: none;
  }

  .image-editor-artboard:focus-visible {
    outline: 1px solid var(--editor-focus);
    outline-offset: 1px;
  }

  .image-editor-artboard.is-panning,
  .image-editor-artboard.is-pinching {
    cursor: grabbing;
  }

  .image-editor-artboard.is-pinching {
    will-change: transform;
  }

  .image-editor-canvas-bitmap {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    display: block;
    image-rendering: pixelated;
    pointer-events: none;
  }

  .image-editor-grid-overlay {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 2;
    display: block;
    overflow: hidden;
    pointer-events: none;
  }

  .image-editor-subdivision-line {
    position: absolute;
    z-index: 3;
    background: var(--image-grid-subdivision-color, rgba(242, 242, 242, 0.18));
    pointer-events: none;
  }

  .image-editor-subdivision-line.is-vertical {
    top: 0;
    bottom: 0;
  }

  .image-editor-subdivision-line.is-horizontal {
    right: 0;
    left: 0;
  }

  .image-editor-hover-cell {
    position: absolute;
    z-index: 4;
    box-sizing: border-box;
    border: 1px solid #ffffff;
    outline: 1px solid #000000;
    pointer-events: none;
  }

  .image-editor-hover-cell.is-graffiti {
    border-width: 1px;
    outline: 0;
    opacity: 0.72;
  }

  .image-editor-selection {
    position: absolute;
    z-index: 5;
    box-sizing: border-box;
    border: 1px solid #ffffff;
    outline: 1px dashed #111111;
    pointer-events: none;
    animation: image-selection-pulse 900ms steps(2, end) infinite;
  }

  @keyframes image-selection-pulse {
    50% {
      border-color: #111111;
      outline-color: #ffffff;
    }
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
    border: 2px solid #3a3a3a;
    border-top-color: var(--editor-text);
    border-radius: 50%;
    animation: resource-editor-loader 820ms linear infinite;
  }

  .resource-editor-error {
    gap: 12px;
    align-content: center;
  }

  .resource-editor-error p {
    margin: 0;
    color: var(--editor-muted);
    font-weight: 600;
  }

  .resource-editor-error button {
    min-height: 32px;
    padding: 0 12px;
    color: var(--editor-selected-ink);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    background: var(--editor-selected);
    border: 1px solid var(--editor-selected);
    border-radius: var(--editor-radius-sm);
  }

  @keyframes resource-editor-loader {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1120px) {
    .resource-editor-canvas {
      --editor-right-dock: 320px;
      grid-template-columns: var(--editor-left-dock) minmax(0, 1fr);
    }

    .image-editor-context-host,
    .image-editor-viewport,
    .image-editor-statusbar,
    .image-editor-floating-layers {
      grid-column: 2;
    }

    .image-editor-context-host {
      padding-right: 86px;
      box-sizing: border-box;
    }

    .image-editor-color-panel {
      grid-template-areas:
        "value"
        "swatches";
      grid-template-columns: minmax(0, 1fr);
    }

    .image-editor-right-dock {
      position: absolute;
      inset: 0 0 0 auto;
      z-index: 20;
      grid-column: 2;
      grid-row: 1 / -1;
      width: min(360px, calc(100% - var(--editor-left-dock)));
      max-width: none;
      padding-bottom: env(safe-area-inset-bottom, 0);
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      visibility: hidden;
      opacity: 0.86;
      pointer-events: none;
      backface-visibility: hidden;
      transform: translate3d(100%, 0, 0);
      will-change: transform, opacity;
      box-shadow: -18px 0 40px rgba(0, 0, 0, 0.38);
      transition:
        transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity 220ms ease-out,
        visibility 0s linear 320ms;
    }

    .image-editor-right-dock.is-mobile-open {
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
      transform: translate3d(0, 0, 0);
      transition-delay: 0s;
    }

    .image-editor-mobile-dock-header {
      display: flex;
    }

    .image-editor-mobile-dock-trigger {
      display: inline-flex;
      min-width: 74px;
      height: 26px;
      padding: 0 8px;
    }
  }

  @media (max-width: 820px) {
    .resource-editor-canvas {
      --editor-left-dock: 44px;
      --editor-right-dock: 292px;
    }

    .image-editor-left-dock {
      padding-right: 4px;
      padding-left: 4px;
    }

    .image-editor-color-panel {
      grid-template-areas:
        "value"
        "swatches";
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 768px) {
    .resource-editor {
      width: 100%;
      height: 100dvh;
      min-height: 0;
      max-height: none;
    }

    .resource-editor :deep(.studio-topbar) {
      grid-template-areas: "brand center user";
      grid-template-columns: max-content minmax(0, 1fr) max-content;
      row-gap: 0;
      column-gap: 6px;
      padding-right: 6px;
      padding-left: 6px;
    }

    .resource-editor :deep(.studio-topbar__center) {
      justify-self: stretch;
      width: 100%;
      min-width: 0;
    }

    .resource-editor :deep(.studio-topbar__brand-name),
    .resource-editor :deep(.studio-topbar__brand-separator),
    .resource-editor :deep(.studio-topbar__user-label),
    .resource-editor :deep(.studio-topbar__brand-trail > :not(.studio-topbar__project-logo)) {
      display: none;
    }

    .resource-editor-title__kind {
      display: none;
    }

    .resource-editor-title {
      gap: 5px;
      width: 100%;
      padding-right: 7px;
      padding-left: 7px;
      box-sizing: border-box;
    }

    .resource-editor-title__name {
      max-width: 104px;
    }

    .resource-editor-title__save-cluster {
      padding-left: 5px;
    }

    .resource-editor-canvas {
      --editor-left-dock: 48px;
      grid-template-columns: var(--editor-left-dock) minmax(0, 1fr);
      grid-template-rows: 44px minmax(0, 1fr) 44px;
    }

    .image-editor-floating-layers {
      display: none;
    }

    .image-editor-right-dock {
      inset: 0;
      grid-column: 1 / -1;
      width: 100%;
      border-left: 0;
      box-shadow: none;
    }

    .image-editor-mobile-dock-header {
      display: flex;
    }

    .image-editor-layers-host {
      flex: 0 0 auto;
      max-height: none;
      overflow: visible;
    }

    .image-editor-layers-host :deep(.image-layers-panel__list) {
      max-height: clamp(96px, 24dvh, 180px);
    }

    .image-editor-right-dock > .image-editor-color-panel {
      display: none;
    }

    .image-editor-mobile-color-layer {
      position: absolute;
      inset: 0;
      z-index: 16;
      display: block;
      visibility: hidden;
      pointer-events: none;
      transition: visibility 0s linear 280ms;
    }

    .image-editor-mobile-color-layer.is-mobile-open {
      visibility: visible;
      pointer-events: auto;
      transition-delay: 0s;
    }

    .image-editor-mobile-color-backdrop {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      padding: 0;
      cursor: default;
      background: rgba(0, 0, 0, 0.46);
      border: 0;
      opacity: 0;
      transition: opacity 180ms ease-out;
    }

    .image-editor-mobile-color-layer.is-mobile-open .image-editor-mobile-color-backdrop {
      opacity: 1;
    }

    .image-editor-mobile-color-sheet {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: none;
      overflow: hidden;
      color: var(--editor-text);
      background: var(--editor-panel);
      border-top: 0;
      border-radius: 0;
      box-shadow: 0 -14px 36px rgba(0, 0, 0, 0.34);
      transform: translate3d(0, 100%, 0);
      transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .image-editor-mobile-color-layer.is-mobile-open .image-editor-mobile-color-sheet {
      transform: translate3d(0, 0, 0);
    }

    .image-editor-mobile-color-header {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: space-between;
      min-height: 48px;
      padding: 0 8px 0 14px;
      box-sizing: border-box;
      border-bottom: 1px solid var(--editor-border);
    }

    .image-editor-mobile-color-header strong {
      overflow: hidden;
      font-size: 13px;
      font-weight: 680;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .image-editor-mobile-color-header button {
      display: grid;
      flex: 0 0 auto;
      place-items: center;
      width: 40px;
      height: 40px;
      padding: 0;
      color: var(--editor-muted);
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: var(--editor-radius-sm);
    }

    .image-editor-mobile-color-header button:hover,
    .image-editor-mobile-color-header button:focus-visible {
      color: var(--editor-text);
      background: var(--editor-hover);
      outline: none;
    }

    .image-editor-mobile-color-content {
      display: grid;
      flex: 1 1 auto;
      grid-template-areas:
        "picker"
        "controls"
        "palette";
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
      align-content: start;
      min-height: 0;
      padding: 12px 12px max(14px, env(safe-area-inset-bottom, 0px));
      overflow-x: hidden;
      overflow-y: auto;
      box-sizing: border-box;
      overscroll-behavior: contain;
    }

    .image-editor-mobile-color-panel {
      display: grid;
      grid-area: controls;
      gap: 10px;
      align-content: start;
      min-width: 0;
    }

    .image-editor-mobile-color-panel .image-editor-color-value {
      grid-area: auto;
      grid-template-columns: 34px minmax(0, 1fr) 34px;
    }

    .image-editor-mobile-color-panel .image-editor-color-swatches-host {
      grid-area: auto;
    }

    .image-editor-mobile-color-panel :deep(.image-color-swatches) {
      grid-template-areas:
        "primary primary-value secondary secondary-value"
        "actions actions actions actions";
      grid-template-columns: 34px minmax(0, 1fr) 34px minmax(0, 1fr);
      column-gap: 8px;
    }

    .image-editor-floating-color-picker {
      --image-color-picker-scale: 0.67;
      position: static;
      z-index: auto;
      grid-area: picker;
      justify-self: center;
      width: 196px;
      height: 196px;
      overflow: hidden;
      pointer-events: auto;
      transform: none;
    }

    .image-editor-floating-palette {
      --image-palette-swatch-gap: clamp(5px, 1.5vw, 7px);
      position: static;
      z-index: auto;
      grid-area: palette;
      width: 100%;
      max-width: none;
      height: auto;
      min-width: 0;
      padding-top: 10px;
      overflow: visible;
      border-top: 1px solid var(--editor-border);
      pointer-events: auto;
    }

    .image-editor-floating-palette :deep(.image-palette-panel__swatches) {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      width: 100%;
    }

    .image-editor-floating-palette :deep(.image-palette-panel__swatch) {
      width: 100%;
      height: auto;
      aspect-ratio: 1;
    }

    .image-editor-inspector-button {
      display: inline-flex;
      gap: 3px;
      font-size: 10px;
      font-weight: 650;
    }

    .image-editor-inspector-button svg {
      width: 16px;
      height: 16px;
    }

    .image-editor-inspector-button span {
      display: inline;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .image-editor-side-inspector {
      flex: 0 0 auto;
      min-height: 0;
      overflow: visible;
    }

    .image-editor-inspector-rail {
      position: sticky;
      top: 48px;
      background: var(--editor-panel);
    }

    .image-editor-inspector-panel {
      flex: 0 0 auto;
      max-height: none;
      overflow: visible;
    }

    .image-editor-context-host,
    .image-editor-viewport,
    .image-editor-statusbar {
      grid-column: 2;
    }

    .image-editor-context-host {
      padding-right: 46px;
      box-sizing: border-box;
    }

    .image-editor-left-dock {
      padding: 4px;
    }

    .image-editor-toolbar {
      width: 40px;
      min-width: 40px;
    }

    .image-editor-statusbar {
      gap: 4px;
      justify-content: center;
      min-height: 44px;
      padding-right: 4px;
      padding-left: 8px;
    }

    .image-editor-statusbar__document,
    .image-editor-mobile-dock-trigger span {
      display: none;
    }

    .image-editor-mobile-color-trigger {
      display: inline-grid;
    }

    .image-editor-mobile-dock-trigger {
      display: inline-flex;
      min-width: 40px;
      height: 34px;
      padding: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .image-editor-right-dock,
    .image-editor-tablet-layers-dialog-layer {
      transition: none;
    }

    .image-editor-mobile-color-layer,
    .image-editor-mobile-color-backdrop,
    .image-editor-mobile-color-sheet {
      transition: none;
    }

    .image-editor-selection,
    .resource-editor-loader span {
      animation: none;
    }
  }

  @media (forced-colors: active) {
    .image-editor-artboard,
    .image-editor-preview__grid,
    .image-editor-color-value input,
    .image-editor-color-add,
    .image-editor-inspector-button,
    .image-editor-inspector-close,
    .image-editor-size-input,
    .image-editor-opacity-input,
    .image-editor-preference-number-input,
    .image-editor-dimension-link,
    .image-editor-anchor-grid button,
    .image-editor-gap-button,
    .image-editor-segment-button {
      border-color: ButtonBorder;
    }

    .image-editor-inspector-button.is-active,
    .image-editor-dimension-link.is-active,
    .image-editor-anchor-grid button.is-active,
    .image-editor-gap-button.is-active,
    .image-editor-segment-button.is-active {
      color: HighlightText;
      background: Highlight;
    }
  }
</style>
