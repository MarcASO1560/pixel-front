<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, type ComponentPublicInstance } from "vue";

import type { ImageLayerDropPosition } from "../lib/layerEditing";
import type { PixelLayer } from "../types";
import ImageLayerThumbnail from "./ImageLayerThumbnail.vue";

const props = withDefaults(
  defineProps<{
    layers: PixelLayer[];
    activeLayerId: string;
    canEdit: boolean;
    imageWidth: number;
    imageHeight: number;
    maxLayers?: number;
  }>(),
  {
    maxLayers: 64,
  },
);

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
const opacityInputId = useId();
const layerDragStatus = ref("");
const draggedLayerId = ref<string | null>(null);
const isLayerDragActive = ref(false);
const layerDragOffsetY = ref(0);
const layerDropTarget = ref<{
  id: string;
  position: ImageLayerDropPosition;
} | null>(null);
let layerDragPointerId: number | null = null;
let layerDragStartY = 0;
const LAYER_DRAG_ACTIVATION_DISTANCE = 4;

const layerLimit = computed(() =>
  Number.isFinite(props.maxLayers) ? Math.max(1, Math.floor(props.maxLayers)) : 64,
);
const canAddLayer = computed(
  () => props.canEdit && props.layers.length < layerLimit.value,
);
const activeLayer = computed(
  () => props.layers.find((layer) => layer.id === props.activeLayerId) ?? null,
);

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

const layerDragStyle = (id: string) =>
  isLayerDragActive.value && draggedLayerId.value === id
    ? { transform: `translate3d(0, ${layerDragOffsetY.value}px, 0)` }
    : undefined;

const updateLayerDropTarget = (clientY: number) => {
  const candidates = displayedLayers.value
    .filter((layer) => layer.id !== draggedLayerId.value)
    .map((layer) => ({ layer, bounds: layerRowRefs.get(layer.id)?.getBoundingClientRect() }))
    .filter(
      (candidate): candidate is { layer: PixelLayer; bounds: DOMRect } =>
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
  draggedLayerId.value = null;
  isLayerDragActive.value = false;
  layerDragOffsetY.value = 0;
  layerDropTarget.value = null;
  layerDragPointerId = null;
};

const startLayerDrag = (event: PointerEvent, layer: PixelLayer) => {
  if (!props.canEdit || props.layers.length < 2 || event.button !== 0) return;
  const handle = event.currentTarget as HTMLElement;
  selectLayer(layer.id);
  draggedLayerId.value = layer.id;
  layerDragPointerId = event.pointerId;
  layerDragStartY = event.clientY;
  layerDragOffsetY.value = 0;
  layerDropTarget.value = null;
  handle.setPointerCapture(event.pointerId);
};

const continueLayerDrag = (event: PointerEvent) => {
  if (event.pointerId !== layerDragPointerId || !draggedLayerId.value) return;
  const offsetY = event.clientY - layerDragStartY;
  if (!isLayerDragActive.value && Math.abs(offsetY) < LAYER_DRAG_ACTIVATION_DISTANCE) {
    return;
  }

  event.preventDefault();
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

  if (isLayerDragActive.value && draggedId && target && targetLayer) {
    emit("reorder", { id: draggedId, targetId: target.id, position: target.position });
    layerDragStatus.value = `${draggedLayer?.name || "Layer"} moved ${target.position} ${targetLayer.name}.`;
  }

  const handle = event.currentTarget as HTMLElement;
  if (handle.hasPointerCapture(event.pointerId)) {
    handle.releasePointerCapture(event.pointerId);
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

const emitOpacity = (event: Event, mode: "preview" | "commit") => {
  const layer = activeLayer.value;
  if (!layer || !props.canEdit) {
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
</script>

<template>
  <section class="image-layers-panel" :aria-labelledby="titleId">
    <header class="image-layers-panel__header">
      <div class="image-layers-panel__heading">
        <h2 :id="titleId">Layers</h2>
        <span :aria-label="`${layers.length} of ${layerLimit} layers`">
          {{ layers.length }}/{{ layerLimit }}
        </span>
      </div>

      <button
        type="button"
        class="layer-icon-button layer-icon-button--add"
        :disabled="!canAddLayer"
        :title="
          !canEdit
            ? 'Editing is unavailable'
            : canAddLayer
              ? 'Add layer'
              : `Layer limit reached (${layerLimit})`
        "
        aria-label="Add layer"
        @click="emit('add')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </header>

    <p v-if="layers.length === 0" class="image-layers-panel__empty">
      No layers available.
    </p>

    <ol v-else ref="layersListRef" class="image-layers-panel__list" aria-label="Image layers">
      <li
        v-for="layer in displayedLayers"
        :key="layer.id"
        :ref="(element) => setLayerRowRef(layer.id, element)"
        class="image-layer-row"
        :class="{
          'is-active': layer.id === activeLayerId,
          'is-hidden': !layer.visible,
          'is-dragging': isLayerDragActive && draggedLayerId === layer.id,
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
        @click="selectLayer(layer.id)"
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
            :disabled="!canEdit || layers.length >= layerLimit"
            :aria-label="`Duplicate ${layer.name}`"
            title="Duplicate layer"
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

    <div v-if="activeLayer" class="image-layers-panel__opacity">
      <label :for="opacityInputId">
        <span>Opacity</span>
        <output>{{ Math.round(activeLayer.opacity * 100) }}%</output>
      </label>
      <input
        :id="opacityInputId"
        type="range"
        min="0"
        max="100"
        step="1"
        :value="Math.round(activeLayer.opacity * 100)"
        :disabled="!canEdit"
        :aria-label="`Opacity for ${activeLayer.name}`"
        @input="emitOpacity($event, 'preview')"
        @change="emitOpacity($event, 'commit')"
      />
    </div>
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
    gap: 12px;
    align-items: center;
    justify-content: space-between;
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
    font-size: 12px;
    font-weight: 760;
    line-height: 1;
    letter-spacing: 0;
  }

  .image-layers-panel__heading span {
    min-width: 0;
    padding: 0;
    color: var(--layers-muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .image-layers-panel__list {
    display: grid;
    max-height: min(36vh, 328px);
    padding: 0;
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
    border-bottom: 1px solid var(--layers-line);
    border-radius: 5px;
    cursor: default;
    transition: background-color 100ms ease;
  }

  .image-layer-row:hover {
    background: #1d1d1d;
  }

  .image-layer-row.is-dragging {
    z-index: 4;
    opacity: 0.84;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.48);
    cursor: grabbing;
    will-change: transform;
  }

  .image-layer-row.is-drop-before::before,
  .image-layer-row.is-drop-after::after {
    position: absolute;
    right: 0;
    left: 0;
    z-index: 6;
    height: 3px;
    pointer-events: none;
    background: #ffffff;
    box-shadow: 0 0 0 1px #111111, 0 0 10px rgba(255, 255, 255, 0.72);
    content: "";
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
    border-bottom-color: #e6e6e6;
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
    grid-template-columns: 44px 30px 30px minmax(0, 1fr);
    gap: 4px;
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

  .image-layer-row__name {
    display: grid;
    align-content: center;
    cursor: default;
  }

  .image-layer-row__name span {
    overflow: hidden;
    font-size: 12px;
    font-weight: 650;
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
    gap: 4px;
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
  .image-layers-panel__opacity input:focus-visible {
    outline: 2px solid var(--layers-focus);
    outline-offset: 1px;
  }

  .layer-icon-button:disabled {
    cursor: not-allowed;
    opacity: 0.24;
  }

  .layer-icon-button svg {
    width: 16px;
    height: 16px;
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

  .layer-icon-button--danger:hover:not(:disabled),
  .image-layer-row.is-active .layer-icon-button--danger:hover:not(:disabled) {
    color: #ffffff;
    background: #752c2c;
    border-color: #a94b4b;
  }

  .image-layers-panel__opacity {
    display: grid;
    gap: 6px;
    padding: 8px 10px 9px;
    border-top: 1px solid var(--layers-line);
  }

  .image-layers-panel__opacity label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--layers-muted);
    font-size: 12px;
    font-weight: 650;
  }

  .image-layers-panel__opacity output {
    color: var(--layers-ink);
    font-variant-numeric: tabular-nums;
  }

  .image-layers-panel__opacity input {
    width: 100%;
    height: 24px;
    margin: 0;
    accent-color: #ffffff;
    cursor: pointer;
  }

  .image-layers-panel__opacity input:disabled {
    cursor: not-allowed;
    opacity: 0.4;
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

  @media (max-width: 440px) {
    .image-layer-row {
      grid-template-columns: minmax(0, 1fr);
    }

    .image-layer-row__actions {
      justify-content: flex-end;
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
</style>
