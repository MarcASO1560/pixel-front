<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { Check, Pencil, Star, StarOff, X } from "@lucide/vue";

import { isCompleteImageColor, normalizeImageColorDraft } from "../lib/color";
import { normalizePixelColor } from "../lib/document";
import {
  normalizePinnedPaletteColors,
  type PinnedPaletteColor,
} from "../lib/palette";
import type {
  ImagePaletteEditRequest,
  ImagePalettePanelSwatch,
  ImagePalettePinRequest,
  ImagePaletteRemoveRequest,
} from "./ImagePalettePanel.types";

type PaletteContextMenu = {
  swatch: ImagePalettePanelSwatch;
  x: number;
  y: number;
};

type PaletteEditor = {
  swatch: ImagePalettePanelSwatch;
};

const props = withDefaults(
  defineProps<{
    swatches: readonly string[];
    pinnedColors: readonly PinnedPaletteColor[];
    primaryColor: string;
    secondaryColor: string;
    canSelect?: boolean;
    canManage?: boolean;
    label?: string;
  }>(),
  {
    canManage: true,
    canSelect: true,
    label: "Drawing color palette",
  },
);

const emit = defineEmits<{
  "select-primary": [color: string];
  "select-secondary": [color: string];
  pin: [request: ImagePalettePinRequest];
  edit: [request: ImagePaletteEditRequest];
  remove: [request: ImagePaletteRemoveRequest];
}>();

const contextMenu = ref<PaletteContextMenu | null>(null);
const editor = ref<PaletteEditor | null>(null);
const editorName = ref("");
const editorColor = ref("");
const editorError = ref("");
const menuRef = ref<HTMLElement | null>(null);
const editorFormRef = ref<HTMLFormElement | null>(null);
const editorColorRef = ref<HTMLInputElement | null>(null);
let activeSwatchTrigger: HTMLElement | null = null;

const normalizedPrimaryColor = computed(() => normalizePixelColor(props.primaryColor));
const normalizedSecondaryColor = computed(() => normalizePixelColor(props.secondaryColor));

const paletteSwatches = computed<ImagePalettePanelSwatch[]>(() => {
  const usedColors = new Set(
    props.swatches
      .map((color) => normalizePixelColor(color))
      .filter((color): color is string => Boolean(color)),
  );
  const merged: ImagePalettePanelSwatch[] = [];
  const colors = new Set<string>();

  for (const entry of normalizePinnedPaletteColors(props.pinnedColors)) {
    const color = entry.color;
    if (colors.has(color)) continue;
    colors.add(color);
    merged.push({
      id: entry.id,
      color,
      name: entry.name?.trim() || null,
      pinned: true,
      used: usedColors.has(color),
    });
  }

  for (const rawColor of props.swatches) {
    const color = normalizePixelColor(rawColor);
    if (!color || colors.has(color)) continue;
    colors.add(color);
    merged.push({ id: null, color, name: null, pinned: false, used: true });
  }

  return merged;
});

const swatchLabel = (swatch: ImagePalettePanelSwatch) => {
  const name = swatch.name ? `${swatch.name}, ` : "";
  const persistence = swatch.pinned ? "pinned" : "used in this image";
  const selection = [
    normalizedPrimaryColor.value === swatch.color ? "primary" : "",
    normalizedSecondaryColor.value === swatch.color ? "secondary" : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const selected = selection ? `, selected as ${selection}` : "";
  return `${name}${swatch.color}, ${persistence}${selected}. Left click for primary; Shift click for secondary; context menu for options.`;
};

const chooseSwatch = (event: MouseEvent, swatch: ImagePalettePanelSwatch) => {
  if (!props.canSelect) return;
  emit(event.shiftKey ? "select-secondary" : "select-primary", swatch.color);
};

const clampContextMenu = async () => {
  await nextTick();
  const menu = menuRef.value;
  if (!menu || !contextMenu.value || typeof window === "undefined") return;

  const padding = 8;
  const rect = menu.getBoundingClientRect();
  contextMenu.value = {
    ...contextMenu.value,
    x: Math.max(padding, Math.min(contextMenu.value.x, window.innerWidth - rect.width - padding)),
    y: Math.max(padding, Math.min(contextMenu.value.y, window.innerHeight - rect.height - padding)),
  };
  await nextTick();
  menu.querySelector<HTMLElement>("[role='menuitem']:not(:disabled)")?.focus();
};

const openContextMenuAt = (
  swatch: ImagePalettePanelSwatch,
  x: number,
  y: number,
  trigger: HTMLElement,
) => {
  if (!props.canSelect && !props.canManage) return;
  activeSwatchTrigger = trigger;
  editor.value = null;
  contextMenu.value = { swatch, x, y };
  void clampContextMenu();
};

const openPointerContextMenu = (event: MouseEvent, swatch: ImagePalettePanelSwatch) => {
  event.preventDefault();
  openContextMenuAt(swatch, event.clientX, event.clientY, event.currentTarget as HTMLElement);
};

const openKeyboardContextMenu = (event: KeyboardEvent, swatch: ImagePalettePanelSwatch) => {
  if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
  event.preventDefault();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  openContextMenuAt(
    swatch,
    rect.left + Math.min(20, rect.width / 2),
    rect.bottom + 4,
    event.currentTarget as HTMLElement,
  );
};

const closeContextMenu = (restoreFocus = false) => {
  contextMenu.value = null;
  if (restoreFocus) void nextTick(() => activeSwatchTrigger?.focus());
};

const runMenuAction = (action: () => void) => {
  action();
  closeContextMenu(true);
};

const openEditor = (swatch: ImagePalettePanelSwatch) => {
  closeContextMenu();
  editor.value = { swatch };
  editorName.value = swatch.name || "";
  editorColor.value = swatch.color;
  editorError.value = "";
  void nextTick(() => {
    editorColorRef.value?.focus();
    editorColorRef.value?.select();
  });
};

const closeEditor = () => {
  editor.value = null;
  editorError.value = "";
  void nextTick(() => activeSwatchTrigger?.focus());
};

const updateEditorColor = (event: Event) => {
  const input = event.currentTarget as HTMLInputElement;
  editorColor.value = normalizeImageColorDraft(input.value);
};

const submitEditor = () => {
  const state = editor.value;
  if (!state || !props.canManage) return;
  const name = editorName.value.trim() || undefined;

  const color = normalizeImageColorDraft(editorColor.value);
  if (!isCompleteImageColor(color)) {
    editorError.value = "Enter a complete #RRGGBB or #RRGGBBAA color.";
    editorColorRef.value?.focus();
    return;
  }

  emit("edit", {
    ...(state.swatch.id ? { id: state.swatch.id } : {}),
    originalColor: state.swatch.color,
    color,
    name,
    pinned: state.swatch.pinned,
    used: state.swatch.used,
  });
  closeEditor();
};

const handleMenuKeydown = (event: KeyboardEvent) => {
  const menu = menuRef.value;
  if (!menu) return;
  const items = Array.from(
    menu.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)"),
  );
  const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
  let nextIndex: number | null = null;

  if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
  if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = items.length - 1;
  if (nextIndex === null || !items[nextIndex]) return;
  event.preventDefault();
  items[nextIndex].focus();
};

const handleEditorKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Tab") return;
  const form = editorFormRef.value;
  if (!form) return;
  const controls = Array.from(
    form.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
    ),
  );
  if (controls.length === 0) return;
  const currentIndex = controls.indexOf(document.activeElement as HTMLElement);
  const nextIndex = event.shiftKey
    ? currentIndex <= 0
      ? controls.length - 1
      : currentIndex - 1
    : currentIndex < 0 || currentIndex === controls.length - 1
      ? 0
      : currentIndex + 1;
  event.preventDefault();
  controls[nextIndex]?.focus();
};

const handleWindowPointerDown = (event: PointerEvent) => {
  const target = event.target;
  if (target instanceof Node && menuRef.value?.contains(target)) return;
  closeContextMenu();
};

const handleWindowKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  if (editor.value) {
    closeEditor();
    return;
  }
  closeContextMenu(true);
};

onMounted(() => {
  window.addEventListener("pointerdown", handleWindowPointerDown);
  window.addEventListener("keydown", handleWindowKeydown);
  window.addEventListener("resize", handleWindowViewportChange);
  window.addEventListener("scroll", handleWindowViewportChange, true);
});

const handleWindowViewportChange = () => closeContextMenu();

onUnmounted(() => {
  window.removeEventListener("pointerdown", handleWindowPointerDown);
  window.removeEventListener("keydown", handleWindowKeydown);
  window.removeEventListener("resize", handleWindowViewportChange);
  window.removeEventListener("scroll", handleWindowViewportChange, true);
});
</script>

<template>
  <section class="image-palette-panel" :aria-label="label">
    <div v-if="paletteSwatches.length" class="image-palette-panel__swatches">
      <button
        v-for="swatch in paletteSwatches"
        :key="swatch.color"
        type="button"
        class="image-palette-panel__swatch"
        :class="{
          'is-primary': normalizedPrimaryColor === swatch.color,
          'is-secondary': normalizedSecondaryColor === swatch.color,
          'is-pinned': swatch.pinned,
        }"
        :style="{ '--image-palette-swatch': swatch.color }"
        :aria-label="swatchLabel(swatch)"
        :title="swatch.name ? `${swatch.name} · ${swatch.color}` : swatch.color"
        :disabled="!canSelect && !canManage"
        @click="chooseSwatch($event, swatch)"
        @contextmenu="openPointerContextMenu($event, swatch)"
        @keydown="openKeyboardContextMenu($event, swatch)"
      >
        <span v-if="swatch.pinned" class="image-palette-panel__star" aria-hidden="true">
          <Star :size="14" :stroke-width="2.25" />
        </span>
        <span
          v-if="normalizedPrimaryColor === swatch.color"
          class="image-palette-panel__channel image-palette-panel__channel--primary"
          aria-hidden="true"
        >P</span>
        <span
          v-if="normalizedSecondaryColor === swatch.color"
          class="image-palette-panel__channel image-palette-panel__channel--secondary"
          aria-hidden="true"
        >S</span>
      </button>
    </div>
    <p v-else class="image-palette-panel__empty">Colors used in the image will appear here.</p>
  </section>

  <Teleport to="body">
    <div
      v-if="contextMenu"
      ref="menuRef"
      class="image-palette-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      role="menu"
      :aria-label="`Options for ${contextMenu.swatch.name || contextMenu.swatch.color}`"
      @contextmenu.prevent
      @keydown="handleMenuKeydown"
    >
      <button
        v-if="canSelect"
        type="button"
        role="menuitem"
        @click="runMenuAction(() => emit('select-primary', contextMenu!.swatch.color))"
      >
        <Check :size="15" :stroke-width="2" aria-hidden="true" />
        <span>Use as primary</span>
      </button>
      <button
        v-if="canSelect"
        type="button"
        role="menuitem"
        @click="runMenuAction(() => emit('select-secondary', contextMenu!.swatch.color))"
      >
        <Check :size="15" :stroke-width="2" aria-hidden="true" />
        <span>Use as secondary</span>
      </button>

      <div v-if="canSelect && canManage" class="image-palette-menu__separator" role="separator"></div>

      <template v-if="canManage">
        <button
          v-if="!contextMenu.swatch.pinned"
          type="button"
          role="menuitem"
          @click="runMenuAction(() => emit('pin', { color: contextMenu!.swatch.color }))"
        >
          <Star :size="15" :stroke-width="2" aria-hidden="true" />
          <span>Pin color</span>
        </button>
        <button type="button" role="menuitem" @click="openEditor(contextMenu.swatch)">
          <Pencil :size="15" :stroke-width="2" aria-hidden="true" />
          <span>Edit color…</span>
        </button>
        <template v-if="contextMenu.swatch.id">
          <div class="image-palette-menu__separator" role="separator"></div>
          <button
            type="button"
            role="menuitem"
            @click="runMenuAction(() => emit('remove', {
              id: contextMenu!.swatch.id!,
              color: contextMenu!.swatch.color,
              used: contextMenu!.swatch.used,
            }))"
          >
            <StarOff :size="15" :stroke-width="2" aria-hidden="true" />
            <span>Unpin color</span>
          </button>
        </template>
      </template>
    </div>

    <div v-if="editor" class="image-palette-editor-layer" @pointerdown.self="closeEditor">
      <form
        ref="editorFormRef"
        class="image-palette-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-palette-editor-title"
        @submit.prevent="submitEditor"
        @keydown="handleEditorKeydown"
      >
        <header>
          <div>
            <strong id="image-palette-editor-title">Edit color</strong>
            <span>{{ editor.swatch.color }}</span>
          </div>
          <button type="button" aria-label="Close color editor" @click="closeEditor">
            <X :size="16" :stroke-width="2" aria-hidden="true" />
          </button>
        </header>

        <label class="image-palette-editor__field">
          <span>Color</span>
          <div class="image-palette-editor__color-row">
            <i :style="{ '--image-palette-swatch': editorColor }" aria-hidden="true"></i>
            <input
              ref="editorColorRef"
              :value="editorColor"
              inputmode="text"
              maxlength="9"
              autocomplete="off"
              spellcheck="false"
              aria-describedby="image-palette-editor-color-hint"
              @input="updateEditorColor"
            />
          </div>
          <small id="image-palette-editor-color-hint">#RRGGBB or #RRGGBBAA</small>
        </label>

        <label class="image-palette-editor__field">
          <span>Name <small>Optional</small></span>
          <input
            v-model="editorName"
            type="text"
            maxlength="64"
            autocomplete="off"
            placeholder="e.g. Moonlight"
          />
        </label>

        <p v-if="editorError" class="image-palette-editor__error" role="alert">
          {{ editorError }}
        </p>
        <p v-else-if="!editor.swatch.pinned" class="image-palette-editor__hint">
          Saving these changes will also pin the color to your palette.
        </p>

        <footer>
          <button type="button" @click="closeEditor">Cancel</button>
          <button type="submit" class="is-primary">Save changes</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
  .image-palette-panel {
    min-width: 0;
  }

  .image-palette-panel__swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
  }

  .image-palette-panel__swatch {
    position: relative;
    width: 32px;
    height: 32px;
    padding: 0;
    overflow: hidden;
    cursor: pointer;
    background: var(--image-palette-swatch, #ffffff);
    border: 1px solid #686a69;
    border-radius: 5px;
    outline: none;
  }

  .image-palette-panel__swatch:hover:not(:disabled) {
    border-color: #d7d9d7;
  }

  .image-palette-panel__swatch:focus-visible {
    outline: 2px solid var(--editor-focus, #f7f1e7);
    outline-offset: 2px;
  }

  .image-palette-panel__swatch.is-primary {
    border-color: #f7f1e7;
  }

  .image-palette-panel__swatch.is-secondary {
    border-bottom-width: 3px;
  }

  .image-palette-panel__swatch:disabled {
    cursor: default;
    opacity: 0.48;
  }

  .image-palette-panel__star,
  .image-palette-panel__channel {
    position: absolute;
    display: grid;
    place-items: center;
    color: #ffffff;
    font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
    font-size: 8px;
    font-style: normal;
    font-weight: 800;
    line-height: 1;
    background: #171818;
    border: 1px solid #ededed;
    pointer-events: none;
  }

  .image-palette-panel__star {
    top: 2px;
    right: 2px;
    width: 14px;
    height: 14px;
    color: #101111;
    background: transparent;
    border: 0;
  }

  .image-palette-panel__star svg {
    fill: #f7f1e7;
    stroke: #101111;
  }

  .image-palette-panel__channel {
    bottom: 2px;
    width: 13px;
    height: 12px;
    border-radius: 3px;
  }

  .image-palette-panel__channel--primary {
    left: 2px;
  }

  .image-palette-panel__channel--secondary {
    right: 2px;
  }

  .image-palette-panel__empty {
    margin: 0;
    color: var(--editor-muted, #9b9d9c);
    font-size: 12px;
    line-height: 1.4;
  }

  .image-palette-menu {
    position: fixed;
    z-index: 120;
    display: grid;
    gap: 2px;
    min-width: 210px;
    padding: 5px;
    color: #f7f1e7;
    background: #141515;
    border: 1px solid #3b3d3c;
    border-radius: 7px;
  }

  .image-palette-menu button {
    display: flex;
    gap: 9px;
    align-items: center;
    min-height: 34px;
    padding: 0 9px;
    color: inherit;
    font: inherit;
    font-size: 12px;
    font-weight: 650;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 4px;
    outline: none;
  }

  .image-palette-menu button:hover,
  .image-palette-menu button:focus-visible {
    background: #242626;
  }

  .image-palette-menu button.is-danger {
    color: #ffafa1;
  }

  .image-palette-menu svg {
    flex: 0 0 auto;
    color: #b9bcba;
  }

  .image-palette-menu .is-danger svg {
    color: #ff8f7d;
  }

  .image-palette-menu__separator {
    height: 1px;
    margin: 4px;
    background: #343635;
  }

  .image-palette-editor-layer {
    position: fixed;
    z-index: 130;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 18px;
    background: rgba(0, 0, 0, 0.62);
  }

  .image-palette-editor {
    display: grid;
    gap: 16px;
    width: min(360px, calc(100vw - 36px));
    padding: 16px;
    color: #f7f1e7;
    background: #141515;
    border: 1px solid #424443;
    border-radius: 8px;
  }

  .image-palette-editor header,
  .image-palette-editor footer,
  .image-palette-editor__color-row {
    display: flex;
    align-items: center;
  }

  .image-palette-editor header {
    justify-content: space-between;
  }

  .image-palette-editor header > div {
    display: grid;
    gap: 2px;
  }

  .image-palette-editor header strong {
    font-size: 14px;
  }

  .image-palette-editor header span,
  .image-palette-editor__field small,
  .image-palette-editor__hint {
    color: #9ea19f;
    font-size: 11px;
  }

  .image-palette-editor header button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    color: #c9ccca;
    cursor: pointer;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
  }

  .image-palette-editor header button:hover,
  .image-palette-editor header button:focus-visible {
    background: #242626;
    border-color: #3f4140;
    outline: none;
  }

  .image-palette-editor__field {
    display: grid;
    gap: 6px;
    color: #d9dcda;
    font-size: 12px;
    font-weight: 650;
  }

  .image-palette-editor__field > span {
    display: flex;
    gap: 6px;
    align-items: baseline;
  }

  .image-palette-editor__color-row {
    gap: 8px;
  }

  .image-palette-editor__color-row i {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    background: var(--image-palette-swatch, #ffffff);
    border: 1px solid #686a69;
    border-radius: 5px;
  }

  .image-palette-editor input {
    width: 100%;
    min-width: 0;
    height: 36px;
    padding: 0 10px;
    box-sizing: border-box;
    color: #f7f1e7;
    font: inherit;
    background: #0d0e0e;
    border: 1px solid #3b3d3c;
    border-radius: 5px;
    outline: none;
  }

  .image-palette-editor input:hover {
    border-color: #555856;
  }

  .image-palette-editor input:focus-visible {
    border-color: #f7f1e7;
  }

  .image-palette-editor__error,
  .image-palette-editor__hint {
    margin: -6px 0 0;
    line-height: 1.45;
  }

  .image-palette-editor__error {
    color: #ffafa1;
    font-size: 12px;
  }

  .image-palette-editor footer {
    gap: 8px;
    justify-content: flex-end;
    padding-top: 2px;
  }

  .image-palette-editor footer button {
    min-height: 34px;
    padding: 0 13px;
    color: #d9dcda;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    background: transparent;
    border: 1px solid #454745;
    border-radius: 5px;
  }

  .image-palette-editor footer button:hover,
  .image-palette-editor footer button:focus-visible {
    color: #ffffff;
    background: #242626;
    outline: none;
  }

  .image-palette-editor footer button.is-primary {
    color: #101111;
    background: #f7f1e7;
    border-color: #f7f1e7;
  }

  .image-palette-editor footer button.is-primary:hover,
  .image-palette-editor footer button.is-primary:focus-visible {
    background: #ffffff;
  }

  @media (max-width: 560px) {
    .image-palette-menu {
      min-width: min(230px, calc(100vw - 16px));
    }

    .image-palette-editor-layer {
      align-items: end;
      padding: 8px;
    }

    .image-palette-editor {
      width: 100%;
      border-radius: 8px;
    }
  }
</style>
