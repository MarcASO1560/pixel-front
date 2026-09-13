<script setup lang="ts">
import {
  computed,
  nextTick,
  onUnmounted,
  ref,
  useId,
  watch,
  type ComponentPublicInstance,
} from "vue";

import type { ImageLayerDropPosition } from "../lib/layerEditing";
import type { PixelLayer } from "../types";
import ImageLayerThumbnail from "./ImageLayerThumbnail.vue";

const props = defineProps<{
  layers: PixelLayer[];
  activeLayerId: string;
  canEdit: boolean;
  imageWidth: number;
  imageHeight: number;
}>();

const emit = defineEmits<{
  select: [id: string];
  add: [];
  duplicate: [id: string];
  remove: [id: string];
  rename: [payload: { id: string; name: string }];
  "toggle-visible": [id: string];
  "toggle-lock": [id: string];
  "preview-opacity": [payload: { id: string; opacity: number }];
  "set-opacity": [payload: { id: string; opacity: number }];
  move: [payload: { id: string; direction: "up" | "down" }];
  reorder: [payload: { id: string; targetId: string; position: ImageLayerDropPosition }];
}>();

const renamingLayerId = ref<string | null>(null);
const renameDraft = ref("");
const renameInputRef = ref<HTMLInputElement | null>(null);
const layersListRef = ref<HTMLOListElement | null>(null);
const layerNameButtonRefs = new Map<string, HTMLButtonElement>();
const layerRowRefs = new Map<string, HTMLLIElement>();
const titleId = useId();
const layerDragStatus = ref("");
const draggedLayerId = ref<string | null>(null);
const isLayerDragActive = ref(false);
const isLayerDragSettling = ref(false);
const layerDragOffsetY = ref(0);
const layerDropTarget = ref<{
  id: string;
  position: ImageLayerDropPosition;
} | null>(null);
let layerDragPointerId: number | null = null;
let layerDragStartY = 0;
let layerDragCaptureTarget: HTMLElement | null = null;
let layerDropSettleTimer: ReturnType<typeof setTimeout> | null = null;
const LAYER_DRAG_ACTIVATION_DISTANCE = 4;
const LAYER_ROW_PITCH = 47;

const canAddLayer = computed(() => props.canEdit);
// Documents are composed bottom-to-top, while layer panels conventionally show
// the topmost layer first.
const displayedLayers = computed(() => [...props.layers].reverse());

const sourceIndexOf = (id: string) => props.layers.findIndex((layer) => layer.id === id);
const canMoveUp = (id: string) => {
  const index = sourceIndexOf(id);
  return props.canEdit && index >= 0 && index < props.layers.length - 1;
};
const canMoveDown = (id: string) => props.canEdit && sourceIndexOf(id) > 0;

const setRenameInputRef = (element: Element | ComponentPublicInstance | null) => {
  renameInputRef.value = element instanceof HTMLInputElement ? element : null;
};

const setLayerNameButtonRef = (
  id: string,
  element: Element | ComponentPublicInstance | null,
) => {
  if (element instanceof HTMLButtonElement) {
    layerNameButtonRefs.set(id, element);
  } else {
    layerNameButtonRefs.delete(id);
  }
};

const setLayerRowRef = (
  id: string,
  element: Element | ComponentPublicInstance | null,
) => {
  if (element instanceof HTMLLIElement) {
    layerRowRefs.set(id, element);
  } else {
    layerRowRefs.delete(id);
  }
};

const selectLayer = (id: string) => {
  emit("select", id);
};

const displayedDropIndex = () => {
  const draggedId = draggedLayerId.value;
  const target = layerDropTarget.value;
  if (!draggedId || !target) return -1;

  const sourceIndex = displayedLayers.value.findIndex((layer) => layer.id === draggedId);
  const targetIndex = displayedLayers.value.findIndex((layer) => layer.id === target.id);
  if (sourceIndex < 0 || targetIndex < 0) return -1;

  const insertionIndex = targetIndex + (target.position === "after" ? 1 : 0);
  return insertionIndex > sourceIndex ? insertionIndex - 1 : insertionIndex;
};

const layerDropPreviewOffset = (id: string) => {
  if (!isLayerDragActive.value || id === draggedLayerId.value) return 0;

  const sourceIndex = displayedLayers.value.findIndex(
    (layer) => layer.id === draggedLayerId.value,
  );
  const rowIndex = displayedLayers.value.findIndex((layer) => layer.id === id);
  const dropIndex = displayedDropIndex();
  if (sourceIndex < 0 || rowIndex < 0 || dropIndex < 0 || dropIndex === sourceIndex) {
    return 0;
  }

  if (dropIndex > sourceIndex && rowIndex > sourceIndex && rowIndex <= dropIndex) {
    return -LAYER_ROW_PITCH;
  }
  if (dropIndex < sourceIndex && rowIndex >= dropIndex && rowIndex < sourceIndex) {
    return LAYER_ROW_PITCH;
  }
  return 0;
};

const layerDragStyle = (id: string) => {
  if (!isLayerDragActive.value) return undefined;
  if (draggedLayerId.value === id) {
    return {
      transform: `translate3d(0, ${layerDragOffsetY.value}px, 0) scale(1.018)`,
    };
  }

  const previewOffset = layerDropPreviewOffset(id);
  return previewOffset
    ? { transform: `translate3d(0, ${previewOffset}px, 0)` }
    : undefined;
};

const opacityThumbPosition = (opacity: number) => {
  const normalizedOpacity = Math.min(1, Math.max(0, opacity));
  const percentage = normalizedOpacity * 100;
  const edgeCorrection = 17 - normalizedOpacity * 34;

  return `calc(${percentage}% + ${edgeCorrection}px)`;
};

const updateLayerDropTarget = (clientY: number) => {
  const candidates = displayedLayers.value
    .filter((layer) => layer.id !== draggedLayerId.value)
    .map((layer) => {
      const bounds = layerRowRefs.get(layer.id)?.getBoundingClientRect();
      const previewOffset = layerDropPreviewOffset(layer.id);
      return bounds
        ? {
            layer,
            bounds: {
              bottom: bounds.bottom - previewOffset,
              height: bounds.height,
              top: bounds.top - previewOffset,
            },
          }
        : { layer, bounds: undefined };
    })
    .filter(
      (candidate): candidate is {
        layer: PixelLayer;
        bounds: { bottom: number; height: number; top: number };
      } =>
        Boolean(candidate.bounds),
    );

  if (candidates.length === 0) {
    layerDropTarget.value = null;
    return;
  }

  for (const candidate of candidates) {
    if (clientY < candidate.bounds.top) {
      layerDropTarget.value = { id: candidate.layer.id, position: "before" };
      return;
    }
    if (clientY <= candidate.bounds.bottom) {
      layerDropTarget.value = {
        id: candidate.layer.id,
        position: clientY < candidate.bounds.top + candidate.bounds.height / 2 ? "before" : "after",
      };
      return;
    }
  }

  layerDropTarget.value = {
    id: candidates[candidates.length - 1]!.layer.id,
    position: "after",
  };
};

const scrollLayerListNearEdge = (clientY: number) => {
  const list = layersListRef.value;
  if (!list) return;
  const bounds = list.getBoundingClientRect();
  const edgeSize = Math.min(36, bounds.height * 0.22);
  if (clientY < bounds.top + edgeSize) {
    list.scrollTop -= 10;
  } else if (clientY > bounds.bottom - edgeSize) {
    list.scrollTop += 10;
  }
};

const resetLayerDrag = () => {
  if (layerDropSettleTimer !== null) {
    clearTimeout(layerDropSettleTimer);
    layerDropSettleTimer = null;
  }
  draggedLayerId.value = null;
  isLayerDragActive.value = false;
  isLayerDragSettling.value = false;
  layerDragOffsetY.value = 0;
  layerDropTarget.value = null;
  layerDragPointerId = null;
  layerDragCaptureTarget = null;
};

const startLayerDrag = (event: PointerEvent, layer: PixelLayer) => {
  if (
    !props.canEdit ||
    props.layers.length < 2 ||
    event.button !== 0 ||
    isLayerDragSettling.value
  ) {
    return;
  }
  selectLayer(layer.id);
  draggedLayerId.value = layer.id;
  layerDragPointerId = event.pointerId;
  layerDragCaptureTarget = event.currentTarget as HTMLElement;
  layerDragStartY = event.clientY;
  layerDragOffsetY.value = 0;
  layerDropTarget.value = null;
};

const continueLayerDrag = (event: PointerEvent) => {
  if (event.pointerId !== layerDragPointerId || !draggedLayerId.value) return;
  const offsetY = event.clientY - layerDragStartY;
  if (!isLayerDragActive.value && Math.abs(offsetY) < LAYER_DRAG_ACTIVATION_DISTANCE) {
    return;
  }

  event.preventDefault();
  if (!isLayerDragActive.value) {
    layerDragCaptureTarget?.setPointerCapture(event.pointerId);
  }
  isLayerDragActive.value = true;
  layerDragOffsetY.value = offsetY;
  scrollLayerListNearEdge(event.clientY);
  updateLayerDropTarget(event.clientY);
};

const finishLayerDrag = (event: PointerEvent) => {
  if (event.pointerId !== layerDragPointerId) return;
  const draggedId = draggedLayerId.value;
  const target = layerDropTarget.value;
  const draggedLayer = props.layers.find((layer) => layer.id === draggedId);
  const targetLayer = props.layers.find((layer) => layer.id === target?.id);

  const captureTarget = layerDragCaptureTarget;
  layerDragPointerId = null;
  layerDragCaptureTarget = null;
  if (captureTarget?.hasPointerCapture(event.pointerId)) {
    captureTarget.releasePointerCapture(event.pointerId);
  }

  if (isLayerDragActive.value && draggedId && target && targetLayer) {
    const sourceIndex = displayedLayers.value.findIndex(
      (layer) => layer.id === draggedId,
    );
    const dropIndex = displayedDropIndex();
    const shouldReorder =
      sourceIndex >= 0 && dropIndex >= 0 && sourceIndex !== dropIndex;
    layerDragOffsetY.value = shouldReorder
      ? (dropIndex - sourceIndex) * LAYER_ROW_PITCH
      : 0;
    isLayerDragSettling.value = true;
    layerDropSettleTimer = setTimeout(() => {
      layerDropSettleTimer = null;
      if (shouldReorder) {
        emit("reorder", {
          id: draggedId,
          targetId: target.id,
          position: target.position,
        });
        layerDragStatus.value = `${draggedLayer?.name || "Layer"} moved ${target.position} ${targetLayer.name}.`;
      }
      resetLayerDrag();
    }, 170);
    return;
  }

  resetLayerDrag();
};

const cancelLayerDrag = (event: PointerEvent) => {
  if (event.pointerId !== layerDragPointerId) return;
  resetLayerDrag();
};

const moveLayerWithKeyboard = (layer: PixelLayer, direction: "up" | "down") => {
  if (direction === "up" ? !canMoveUp(layer.id) : !canMoveDown(layer.id)) return;
  emit("move", { id: layer.id, direction });
  layerDragStatus.value = `${layer.name} moved ${direction}.`;
};

const startRename = async (layer: PixelLayer) => {
  if (!props.canEdit) {
    return;
  }

  selectLayer(layer.id);
  renamingLayerId.value = layer.id;
  renameDraft.value = layer.name;
  await nextTick();
  renameInputRef.value?.focus();
  renameInputRef.value?.select();
};

const cancelRename = async (restoreFocus = false) => {
  const layerId = renamingLayerId.value;
  renamingLayerId.value = null;
  renameDraft.value = "";
  renameInputRef.value = null;

  if (restoreFocus && layerId) {
    await nextTick();
    layerNameButtonRefs.get(layerId)?.focus();
  }
};

const commitRename = (layer: PixelLayer) => {
  if (renamingLayerId.value !== layer.id) {
    return;
  }

  const name = renameDraft.value.trim();
  void cancelRename();
  if (name && name !== layer.name) {
    emit("rename", { id: layer.id, name });
  }
};

const emitOpacity = (
  event: Event,
  layer: PixelLayer,
  mode: "preview" | "commit",
) => {
  if (!props.canEdit) {
    return;
  }

  const input = event.currentTarget as HTMLInputElement;
  const percentage = Number(input.value);
  if (!Number.isFinite(percentage)) {
    return;
  }

  emit(mode === "preview" ? "preview-opacity" : "set-opacity", {
    id: layer.id,
    opacity: Math.min(1, Math.max(0, percentage / 100)),
  });
};

watch(
  () => props.layers,
  (layers) => {
    if (
      renamingLayerId.value &&
      !layers.some((layer) => layer.id === renamingLayerId.value)
    ) {
      void cancelRename();
    }
    if (draggedLayerId.value && !layers.some((layer) => layer.id === draggedLayerId.value)) {
      resetLayerDrag();
    }
  },
  { deep: false },
);

onUnmounted(resetLayerDrag);
</script>

<template>
  <section class="image-layers-panel" :aria-labelledby="titleId">
    <header class="image-layers-panel__header">
      <button
        type="button"
        class="layer-icon-button layer-icon-button--add"
        :disabled="!canAddLayer"
        :title="canEdit ? 'Add layer' : 'Editing is unavailable'"
        aria-label="Add layer"
        @click="emit('add')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <div class="image-layers-panel__heading">
        <h2 :id="titleId">Layers</h2>
        <span :aria-label="`${layers.length} layers`">
          {{ layers.length }}
        </span>
      </div>
    </header>

    <p v-if="layers.length === 0" class="image-layers-panel__empty">
      No layers available.
    </p>

    <ol
      v-else
      ref="layersListRef"
      class="image-layers-panel__list"
      :class="{ 'is-reordering': isLayerDragActive }"
      aria-label="Image layers"
    >
      <li
        v-for="layer in displayedLayers"
        :key="layer.id"
        :ref="(element) => setLayerRowRef(layer.id, element)"
        class="image-layer-row"
        :class="{
          'is-active': layer.id === activeLayerId,
          'is-hidden': !layer.visible,
          'is-dragging': isLayerDragActive && draggedLayerId === layer.id,
          'is-drag-settling': isLayerDragSettling && draggedLayerId === layer.id,
          'is-drop-before':
            isLayerDragActive &&
            layerDropTarget?.id === layer.id &&
            layerDropTarget.position === 'before',
          'is-drop-after':
            isLayerDragActive &&
            layerDropTarget?.id === layer.id &&
            layerDropTarget.position === 'after',
        }"
        :style="layerDragStyle(layer.id)"
        :aria-current="layer.id === activeLayerId ? 'true' : undefined"
        :title="canEdit && layers.length > 1 ? 'Drag to reorder' : undefined"
        @click="selectLayer(layer.id)"
        @pointerdown="startLayerDrag($event, layer)"
        @pointermove="continueLayerDrag"
        @pointerup="finishLayerDrag"
        @pointercancel="cancelLayerDrag"
        @lostpointercapture="cancelLayerDrag"
      >
        <div class="image-layer-row__main">
          <span
            class="image-layer-row__thumbnail"
            role="img"
            :aria-label="`${layer.name} preview`"
          >
            <ImageLayerThumbnail
              :pixels="layer.pixels"
              :width="imageWidth"
              :height="imageHeight"
              :opacity="layer.opacity"
            />
          </span>

          <button
            type="button"
            class="layer-icon-button"
            :disabled="!canEdit"
            :aria-label="layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`"
            :title="layer.visible ? 'Hide layer' : 'Show layer'"
            @pointerdown.stop
            @click.stop="emit('toggle-visible', layer.id)"
          >
            <svg v-if="layer.visible" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" />
              <circle cx="12" cy="12" r="2.3" />
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path d="m4 4 16 16" />
              <path d="M9.8 7.3A9.8 9.8 0 0 1 12 7c6.1 0 9.5 5 9.5 5a14 14 0 0 1-2.1 2.5M6.4 8.4A14.8 14.8 0 0 0 2.5 12s3.4 5 9.5 5c.8 0 1.5-.1 2.2-.2" />
            </svg>
          </button>

          <button
            type="button"
            class="layer-icon-button"
            :disabled="!canEdit"
            :aria-label="layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`"
            :title="layer.locked ? 'Unlock layer' : 'Lock layer'"
            @pointerdown.stop
            @click.stop="emit('toggle-lock', layer.id)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="10" width="14" height="10" rx="2" />
              <path v-if="layer.locked" d="M8 10V7a4 4 0 0 1 8 0v3" />
              <path v-else d="M9 10V7a4 4 0 0 1 7.7-1.5" />
            </svg>
          </button>

          <input
            v-if="renamingLayerId === layer.id"
            :ref="setRenameInputRef"
            v-model="renameDraft"
            class="image-layer-row__name-input"
            type="text"
            maxlength="80"
            :aria-label="`Rename ${layer.name}`"
            @pointerdown.stop
            @click.stop
            @dblclick.stop
            @blur="commitRename(layer)"
            @keydown.enter.prevent.stop="commitRename(layer)"
            @keydown.escape.prevent.stop="cancelRename(true)"
          />
          <button
            v-else
            :ref="(element) => setLayerNameButtonRef(layer.id, element)"
            type="button"
            class="image-layer-row__name"
            :title="canEdit ? `${layer.name} — double-click to rename` : layer.name"
            @click.stop="selectLayer(layer.id)"
            @dblclick.stop="startRename(layer)"
            @keydown.enter.prevent.stop="startRename(layer)"
          >
            <span>{{ layer.name }}</span>
            <small v-if="layer.locked">Locked</small>
          </button>

          <label
            class="image-layer-row__opacity"
            :title="`${Math.round(layer.opacity * 100)}% opacity`"
            @click.stop
            @pointerdown.stop
          >
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              :value="Math.round(layer.opacity * 100)"
              :disabled="!canEdit"
              :aria-label="`Opacity for ${layer.name}`"
              @input="emitOpacity($event, layer, 'preview')"
              @change="emitOpacity($event, layer, 'commit')"
            />
            <output :style="{ left: opacityThumbPosition(layer.opacity) }">
              {{ Math.round(layer.opacity * 100) }}%
            </output>
          </label>
        </div>

        <div class="image-layer-row__actions" role="group" :aria-label="`Actions for ${layer.name}`">
          <button
            type="button"
            class="layer-icon-button layer-drag-handle"
            :disabled="!canEdit || layers.length < 2"
            :aria-label="`Reorder ${layer.name}. Drag or use arrow keys.`"
            aria-keyshortcuts="ArrowUp ArrowDown"
            title="Drag to reorder · Arrow keys also work"
            @click.stop.prevent
            @pointerdown.stop="startLayerDrag($event, layer)"
            @pointermove.stop="continueLayerDrag"
            @pointerup.stop="finishLayerDrag"
            @pointercancel.stop="cancelLayerDrag"
            @lostpointercapture.stop="cancelLayerDrag"
            @keydown.up.prevent.stop="moveLayerWithKeyboard(layer, 'up')"
            @keydown.down.prevent.stop="moveLayerWithKeyboard(layer, 'down')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9" cy="7" r="1" />
              <circle cx="15" cy="7" r="1" />
              <circle cx="9" cy="12" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="9" cy="17" r="1" />
              <circle cx="15" cy="17" r="1" />
            </svg>
          </button>
          <button
            type="button"
            class="layer-icon-button"
            :disabled="!canEdit"
            :aria-label="`Duplicate ${layer.name}`"
            title="Duplicate layer"
            @pointerdown.stop
            @click.stop="emit('duplicate', layer.id)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="8" y="8" width="11" height="11" rx="2" />
              <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
            </svg>
          </button>
          <button
            type="button"
            class="layer-icon-button layer-icon-button--danger"
            :disabled="!canEdit || layers.length <= 1"
            :aria-label="`Delete ${layer.name}`"
            title="Delete layer"
            @pointerdown.stop
            @click.stop="emit('remove', layer.id)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h14M9 7V4h6v3M8 10v8M12 10v8M16 10v8M7 7l1 14h8l1-14" />
            </svg>
          </button>
        </div>
      </li>
    </ol>

    <p class="image-layers-panel__drag-status" aria-live="polite">
      {{ layerDragStatus }}
    </p>

  </section>
</template>

<style scoped>
  .image-layers-panel {
    --layers-ink: #f2f2f2;
    --layers-muted: #a8a8a8;
    --layers-line: #2d2d2d;
    --layers-control: #171717;
    --layers-control-hover: #262626;
    --layers-focus: #ffffff;
    display: grid;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    color: var(--layers-ink);
    background: transparent;
  }

  .image-layers-panel__header {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-start;
    min-height: 42px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--layers-line);
  }

  .image-layers-panel__heading {
    display: flex;
    gap: 8px;
    align-items: baseline;
    min-width: 0;
  }

  .image-layers-panel__heading h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 760;
    line-height: 1;
    letter-spacing: 0;
  }

  .image-layers-panel__heading span {
    min-width: 0;
    padding: 0;
    color: var(--layers-muted);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .image-layers-panel__list {
    display: grid;
    grid-auto-rows: 44px;
    gap: 3px;
    align-content: start;
    max-height: min(36vh, 328px);
    padding: 4px;
    margin: 0;
    overflow-x: hidden;
    overflow-y: auto;
    list-style: none;
    scrollbar-color: #4a4a4a transparent;
    scrollbar-width: thin;
  }

  .image-layer-row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px;
    align-items: center;
    min-width: 0;
    padding: 0 8px 0 0;
    overflow: hidden;
    border: 0;
    border-radius: 6px;
    background: #151515;
    box-shadow: inset 0 0 0 1px var(--layers-line);
    cursor: grab;
    touch-action: none;
    transform-origin: center;
    transition:
      transform 190ms cubic-bezier(0.2, 0.82, 0.2, 1),
      background-color 120ms ease,
      box-shadow 160ms ease,
      filter 160ms ease,
      opacity 160ms ease;
  }

  .image-layer-row:hover {
    background: #1d1d1d;
  }

  .image-layer-row.is-dragging {
    z-index: 8;
    opacity: 0.98;
    filter: brightness(1.08) saturate(1.04);
    box-shadow:
      0 14px 30px rgba(0, 0, 0, 0.58),
      0 0 0 2px rgba(255, 255, 255, 0.8),
      0 0 18px rgba(255, 255, 255, 0.22);
    cursor: grabbing;
    transition:
      box-shadow 140ms ease,
      filter 140ms ease,
      opacity 140ms ease;
    will-change: transform;
  }

  .image-layer-row.is-dragging.is-drag-settling {
    transition:
      transform 170ms cubic-bezier(0.22, 1, 0.36, 1),
      box-shadow 170ms ease,
      filter 170ms ease;
  }

  .image-layers-panel__list.is-reordering .image-layer-row:not(.is-dragging) {
    filter: brightness(0.92);
  }

  .image-layer-row.is-drop-before::before,
  .image-layer-row.is-drop-after::after {
    position: absolute;
    right: 0;
    left: 0;
    z-index: 6;
    height: 3px;
    pointer-events: none;
    background: linear-gradient(90deg, transparent 0, #ffffff 12%, #ffffff 88%, transparent 100%);
    border-radius: 999px;
    box-shadow: 0 0 0 1px #111111, 0 0 14px rgba(255, 255, 255, 0.92);
    content: "";
    animation: layer-drop-pulse 680ms ease-in-out infinite;
  }

  .image-layer-row.is-drop-before::before {
    top: 0;
  }

  .image-layer-row.is-drop-after::after {
    bottom: 0;
  }

  .image-layer-row.is-active {
    --layers-focus: #111111;
    color: #111111;
    background: #e6e6e6;
    box-shadow: inset 0 0 0 1px #e6e6e6;
  }

  .image-layer-row.is-active .image-layer-row__name small {
    color: #555555;
  }

  .image-layer-row.is-active .image-layer-row__thumbnail {
    border-color: #9a9a9a;
  }

  .image-layer-row.is-active .layer-icon-button {
    color: #222222;
  }

  .image-layer-row.is-active .layer-icon-button:hover:not(:disabled) {
    color: #000000;
    background: #c9c9c9;
    border-color: #9a9a9a;
  }

  .image-layer-row.is-hidden .image-layer-row__thumbnail,
  .image-layer-row.is-hidden .image-layer-row__name {
    opacity: 0.5;
  }

  .image-layer-row__main {
    display: grid;
    grid-template-columns: 44px 30px 30px minmax(0, 1fr) 72px;
    gap: 3px;
    align-items: center;
    min-width: 0;
  }

  .image-layer-row__thumbnail {
    align-self: center;
    width: 44px;
    height: 44px;
    overflow: hidden;
    background-color: #141414;
    background-image:
      linear-gradient(45deg, #252525 25%, transparent 25%),
      linear-gradient(-45deg, #252525 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #252525 75%),
      linear-gradient(-45deg, transparent 75%, #252525 75%);
    background-position:
      0 0,
      0 4px,
      4px -4px,
      -4px 0;
    background-size: 8px 8px;
    border: 0;
    border-right: 1px solid #3a3a3a;
    border-radius: 4px 0 0 4px;
  }

  .image-layer-row__name,
  .image-layer-row__name-input {
    min-width: 0;
    height: 32px;
    padding: 0 7px;
    color: inherit;
    font: inherit;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
  }

  .image-layer-row__opacity {
    --opacity-track: #6f6f6f;
    --opacity-thumb: #f2f2f2;
    --opacity-thumb-ink: #111111;
    position: relative;
    display: block;
    width: 72px;
    height: 32px;
    min-width: 0;
    color: var(--layers-muted);
    cursor: pointer;
  }

  .image-layer-row__opacity output {
    position: absolute;
    top: 50%;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 34px;
    height: 24px;
    color: var(--opacity-thumb-ink);
    font-size: 9px;
    font-weight: 750;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    background: var(--opacity-thumb);
    border: 1px solid #8b8b8b;
    border-radius: 999px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    pointer-events: none;
    transform: translate(-50%, -50%);
  }

  .image-layer-row__opacity input {
    position: absolute;
    inset: 0;
    appearance: none;
    width: 100%;
    height: 32px;
    padding: 0;
    margin: 0;
    cursor: pointer;
    background: transparent;
  }

  .image-layer-row__opacity input::-webkit-slider-runnable-track {
    height: 4px;
    background: var(--opacity-track);
    border-radius: 999px;
  }

  .image-layer-row__opacity input::-webkit-slider-thumb {
    width: 34px;
    height: 24px;
    appearance: none;
    background: transparent;
    border: 0;
  }

  .image-layer-row__opacity input::-moz-range-track {
    height: 4px;
    background: var(--opacity-track);
    border: 0;
    border-radius: 999px;
  }

  .image-layer-row__opacity input::-moz-range-thumb {
    width: 34px;
    height: 24px;
    background: transparent;
    border: 0;
  }

  .image-layer-row__opacity input:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .image-layer-row.is-active .image-layer-row__opacity {
    --opacity-track: #767676;
    --opacity-thumb: #242424;
    --opacity-thumb-ink: #ffffff;
  }

  .image-layer-row__name {
    display: grid;
    align-content: center;
    cursor: grab;
  }

  .image-layer-row.is-dragging .image-layer-row__name {
    cursor: grabbing;
  }

  .image-layer-row__name span {
    overflow: hidden;
    font-size: 14px;
    font-weight: 680;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .image-layer-row__name small {
    color: var(--layers-muted);
    font-size: 12px;
    line-height: 1.2;
  }

  .image-layer-row__name-input {
    outline: none;
    color: #f2f2f2;
    background: #101010;
    border-color: #7a7a7a;
  }

  .image-layer-row__actions {
    display: flex;
    gap: 2px;
    align-items: center;
    min-height: 30px;
    padding-left: 0;
  }

  .layer-icon-button {
    display: inline-grid;
    flex: 0 0 auto;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    color: #c8c8c8;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 5px;
    cursor: pointer;
  }

  .layer-icon-button:hover:not(:disabled) {
    color: #ffffff;
    background: var(--layers-control-hover);
    border-color: #454545;
  }

  .layer-icon-button:focus-visible,
  .image-layer-row__name:focus-visible,
  .image-layer-row__name-input:focus-visible,
  .image-layer-row__opacity input:focus-visible {
    outline: 2px solid var(--layers-focus);
    outline-offset: 1px;
  }

  .layer-icon-button:disabled {
    cursor: not-allowed;
    opacity: 0.24;
  }

  .layer-icon-button svg {
    width: 19px;
    height: 19px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.8;
  }

  .layer-icon-button--add {
    color: #f2f2f2;
    background: var(--layers-control);
    border-color: #454545;
  }

  .layer-drag-handle {
    cursor: grab;
    touch-action: none;
  }

  .layer-drag-handle:active {
    cursor: grabbing;
  }

  .layer-drag-handle svg circle {
    fill: currentColor;
    stroke: none;
  }

  .image-layer-row.is-dragging .layer-drag-handle svg {
    animation: layer-grip-pulse 520ms ease-in-out infinite alternate;
  }

  .layer-icon-button--danger:hover:not(:disabled),
  .image-layer-row.is-active .layer-icon-button--danger:hover:not(:disabled) {
    color: #ffffff;
    background: #752c2c;
    border-color: #a94b4b;
  }

  .image-layers-panel__empty {
    padding: 20px 12px;
    margin: 0;
    color: var(--layers-muted);
    font-size: 12px;
    text-align: center;
  }

  .image-layers-panel__drag-status {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @keyframes layer-drop-pulse {
    0%,
    100% {
      opacity: 0.55;
      transform: scaleX(0.92);
    }

    50% {
      opacity: 1;
      transform: scaleX(1);
    }
  }

  @keyframes layer-grip-pulse {
    from {
      opacity: 0.62;
      transform: scale(0.88);
    }

    to {
      opacity: 1;
      transform: scale(1.08);
    }
  }

  @media (max-width: 640px) {
    .image-layers-panel {
      width: 100%;
    }

    .image-layers-panel__list {
      max-height: 32vh;
    }
  }

  @media (forced-colors: active) {
    .image-layer-row.is-active {
      color: HighlightText;
      background: Highlight;
      border-color: Highlight;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .image-layer-row,
    .image-layer-row.is-dragging,
    .image-layer-row.is-dragging.is-drag-settling {
      transition: none;
    }

    .image-layer-row.is-drop-before::before,
    .image-layer-row.is-drop-after::after,
    .image-layer-row.is-dragging .layer-drag-handle svg {
      animation: none;
    }
  }
</style>
