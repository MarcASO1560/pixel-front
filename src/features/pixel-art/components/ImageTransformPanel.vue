<script setup lang="ts">
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ClipboardPaste,
  Copy,
  FlipHorizontal2,
  FlipVertical2,
  MousePointer2,
  RotateCcw,
  RotateCw,
  Scissors,
  SquareDashed,
  Trash2,
  X,
} from "@lucide/vue";
import { computed } from "vue";

import type { ImageSelection } from "../types";

const props = defineProps<{
  selection: ImageSelection | null;
  canEdit: boolean;
  hasClipboard: boolean;
}>();

const emit = defineEmits<{
  "select-all": [];
  deselect: [];
  delete: [];
  copy: [];
  cut: [];
  paste: [];
  "flip-horizontal": [];
  "flip-vertical": [];
  "rotate-clockwise": [];
  "rotate-counterclockwise": [];
  nudge: [delta: { x: number; y: number }];
}>();

const hasSelection = computed(() => props.selection !== null);
const canModifySelection = computed(() => props.canEdit && hasSelection.value);
const transformTarget = computed(() => (hasSelection.value ? "selection" : "active layer"));
</script>

<template>
  <section class="image-transform-panel" aria-label="Transform">
    <div
      v-if="selection"
      class="image-transform-panel__bounds"
      role="group"
      aria-label="Selection bounds"
    >
      <dl>
        <div>
          <dt>X</dt>
          <dd>{{ selection.x }}</dd>
        </div>
        <div>
          <dt>Y</dt>
          <dd>{{ selection.y }}</dd>
        </div>
        <div>
          <dt>W</dt>
          <dd>{{ selection.width }}</dd>
        </div>
        <div>
          <dt>H</dt>
          <dd>{{ selection.height }}</dd>
        </div>
      </dl>
      <span>{{ selection.width }} × {{ selection.height }} px</span>
    </div>

    <p v-else class="image-transform-panel__hint">
      Transform actions affect the active layer when nothing is selected.
    </p>

    <div class="image-transform-panel__section">
      <h3>Selection</h3>
      <div
        class="image-transform-panel__button-grid image-transform-panel__button-grid--two"
        role="group"
        aria-label="Selection actions"
      >
        <button
          type="button"
          class="transform-action-button"
          aria-label="Select all"
          aria-keyshortcuts="Control+A Meta+A"
          title="Select all (Ctrl/Cmd+A)"
          @click="emit('select-all')"
        >
          <SquareDashed aria-hidden="true" />
          <span>Select all</span>
        </button>
        <button
          type="button"
          class="transform-action-button"
          :disabled="!hasSelection"
          aria-label="Deselect"
          aria-keyshortcuts="Escape"
          title="Deselect (Escape)"
          @click="emit('deselect')"
        >
          <X aria-hidden="true" />
          <span>Deselect</span>
        </button>
      </div>
    </div>

    <div class="image-transform-panel__section">
      <h3>Clipboard</h3>
      <div class="image-transform-panel__icon-grid" role="group" aria-label="Clipboard actions">
        <button
          type="button"
          class="transform-icon-button"
          :disabled="!hasSelection"
          aria-label="Copy selection"
          aria-keyshortcuts="Control+C Meta+C"
          title="Copy selection (Ctrl/Cmd+C)"
          @click="emit('copy')"
        >
          <Copy aria-hidden="true" />
          <span>Copy</span>
        </button>
        <button
          type="button"
          class="transform-icon-button"
          :disabled="!canModifySelection"
          aria-label="Cut selection"
          aria-keyshortcuts="Control+X Meta+X"
          title="Cut selection (Ctrl/Cmd+X)"
          @click="emit('cut')"
        >
          <Scissors aria-hidden="true" />
          <span>Cut</span>
        </button>
        <button
          type="button"
          class="transform-icon-button"
          :disabled="!canEdit || !hasClipboard"
          aria-label="Paste"
          aria-keyshortcuts="Control+V Meta+V"
          :title="hasClipboard ? 'Paste (Ctrl/Cmd+V)' : 'Nothing to paste'"
          @click="emit('paste')"
        >
          <ClipboardPaste aria-hidden="true" />
          <span>Paste</span>
        </button>
        <button
          type="button"
          class="transform-icon-button transform-icon-button--danger"
          :disabled="!canModifySelection"
          aria-label="Delete selection contents"
          aria-keyshortcuts="Delete Backspace"
          title="Delete selection contents (Delete/Backspace)"
          @click="emit('delete')"
        >
          <Trash2 aria-hidden="true" />
          <span>Delete</span>
        </button>
      </div>
    </div>

    <div class="image-transform-panel__section">
      <h3>Flip & rotate</h3>
      <div class="image-transform-panel__icon-grid" role="group" aria-label="Transform actions">
        <button
          type="button"
          class="transform-icon-button"
          :disabled="!canEdit"
          :aria-label="`Flip ${transformTarget} horizontally`"
          :title="`Flip ${transformTarget} horizontally`"
          @click="emit('flip-horizontal')"
        >
          <FlipHorizontal2 aria-hidden="true" />
          <span>Flip horizontal</span>
        </button>
        <button
          type="button"
          class="transform-icon-button"
          :disabled="!canEdit"
          :aria-label="`Flip ${transformTarget} vertically`"
          :title="`Flip ${transformTarget} vertically`"
          @click="emit('flip-vertical')"
        >
          <FlipVertical2 aria-hidden="true" />
          <span>Flip vertical</span>
        </button>
        <button
          type="button"
          class="transform-icon-button"
          :disabled="!canEdit"
          :aria-label="`Rotate ${transformTarget} counterclockwise`"
          :title="`Rotate ${transformTarget} 90° counterclockwise`"
          @click="emit('rotate-counterclockwise')"
        >
          <RotateCcw aria-hidden="true" />
          <span>Rotate left</span>
        </button>
        <button
          type="button"
          class="transform-icon-button"
          :disabled="!canEdit"
          :aria-label="`Rotate ${transformTarget} clockwise`"
          :title="`Rotate ${transformTarget} 90° clockwise`"
          @click="emit('rotate-clockwise')"
        >
          <RotateCw aria-hidden="true" />
          <span>Rotate right</span>
        </button>
      </div>
    </div>

    <div class="image-transform-panel__section image-transform-panel__move-section">
      <div class="image-transform-panel__move-copy">
        <h3>Move by 1 px</h3>
        <p>Use these controls or the arrow keys.</p>
      </div>
      <div class="image-transform-panel__nudge" role="group" aria-label="Move by one pixel">
        <button
          type="button"
          class="transform-icon-button is-up"
          :disabled="!canEdit"
          :aria-label="`Move ${transformTarget} up one pixel`"
          aria-keyshortcuts="ArrowUp"
          title="Move up 1 px"
          @click="emit('nudge', { x: 0, y: -1 })"
        >
          <ArrowUp aria-hidden="true" />
        </button>
        <button
          type="button"
          class="transform-icon-button is-left"
          :disabled="!canEdit"
          :aria-label="`Move ${transformTarget} left one pixel`"
          aria-keyshortcuts="ArrowLeft"
          title="Move left 1 px"
          @click="emit('nudge', { x: -1, y: 0 })"
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <span class="image-transform-panel__nudge-center" aria-hidden="true">
          <MousePointer2 />
        </span>
        <button
          type="button"
          class="transform-icon-button is-right"
          :disabled="!canEdit"
          :aria-label="`Move ${transformTarget} right one pixel`"
          aria-keyshortcuts="ArrowRight"
          title="Move right 1 px"
          @click="emit('nudge', { x: 1, y: 0 })"
        >
          <ArrowRight aria-hidden="true" />
        </button>
        <button
          type="button"
          class="transform-icon-button is-down"
          :disabled="!canEdit"
          :aria-label="`Move ${transformTarget} down one pixel`"
          aria-keyshortcuts="ArrowDown"
          title="Move down 1 px"
          @click="emit('nudge', { x: 0, y: 1 })"
        >
          <ArrowDown aria-hidden="true" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
  .image-transform-panel {
    --transform-ink: #f2f2f2;
    --transform-muted: #a8a8a8;
    --transform-line: #2d2d2d;
    --transform-control: #171717;
    --transform-control-hover: #262626;
    --transform-focus: #ffffff;
    display: grid;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    color: var(--transform-ink);
    background: transparent;
  }

  .image-transform-panel__section h3 {
    margin: 0;
    letter-spacing: 0;
  }

  .image-transform-panel__bounds {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    min-height: 36px;
    padding: 8px 12px;
    background: #171717;
    border-bottom: 1px solid var(--transform-line);
  }

  .image-transform-panel__bounds dl {
    display: flex;
    gap: 8px;
    padding: 0;
    margin: 0;
  }

  .image-transform-panel__bounds dl div {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 3px 2px;
    background: transparent;
    border: 0;
  }

  .image-transform-panel__bounds dt {
    color: var(--transform-muted);
    font-size: 12px;
    font-weight: 740;
    line-height: 1.4;
  }

  .image-transform-panel__bounds dd {
    margin: 0;
    font-size: 12px;
    line-height: 1.4;
    font-variant-numeric: tabular-nums;
  }

  .image-transform-panel__bounds > span {
    color: var(--transform-ink);
    font-size: 12px;
    line-height: 1.4;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .image-transform-panel__hint {
    padding: 10px 12px;
    margin: 0;
    color: var(--transform-muted);
    font-size: 12px;
    line-height: 1.5;
    border-bottom: 1px solid var(--transform-line);
  }

  .image-transform-panel__section {
    display: grid;
    gap: 8px;
    padding: 10px 12px;
  }

  .image-transform-panel__section + .image-transform-panel__section {
    border-top: 1px solid var(--transform-line);
  }

  .image-transform-panel__section h3 {
    color: var(--transform-muted);
    font-size: 12px;
    font-weight: 680;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .image-transform-panel__button-grid,
  .image-transform-panel__icon-grid {
    display: grid;
    gap: 6px;
  }

  .image-transform-panel__button-grid--two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .image-transform-panel__icon-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .transform-action-button,
  .transform-icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: 0;
    color: #d2d2d2;
    background: var(--transform-control);
    border: 1px solid #3a3a3a;
    border-radius: 5px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 650;
    line-height: 1.2;
  }

  .transform-action-button {
    gap: 6px;
    min-height: 34px;
    padding: 0 10px;
  }

  .transform-icon-button {
    gap: 7px;
    width: 100%;
    min-height: 34px;
    padding: 0 10px;
  }

  .transform-action-button:hover:not(:disabled),
  .transform-icon-button:hover:not(:disabled) {
    color: #ffffff;
    background: var(--transform-control-hover);
    border-color: #565656;
  }

  .transform-action-button:focus-visible,
  .transform-icon-button:focus-visible {
    outline: 2px solid var(--transform-focus);
    outline-offset: 1px;
  }

  .transform-action-button:disabled,
  .transform-icon-button:disabled {
    cursor: not-allowed;
    opacity: 0.27;
  }

  .transform-action-button svg,
  .transform-icon-button svg,
  .image-transform-panel__nudge-center svg {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
    stroke-width: 1.8;
  }

  .transform-icon-button--danger:hover:not(:disabled) {
    color: #ffffff;
    background: #752c2c;
    border-color: #a94b4b;
  }

  .image-transform-panel__move-section {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px;
    align-items: center;
  }

  .image-transform-panel__move-copy p {
    margin: 4px 0 0;
    color: var(--transform-muted);
    font-size: 12px;
    line-height: 1.45;
  }

  .image-transform-panel__nudge {
    display: grid;
    grid-template-columns: repeat(3, 32px);
    grid-template-rows: repeat(3, 32px);
    gap: 3px;
  }

  .image-transform-panel__nudge .transform-icon-button {
    min-height: 32px;
    padding: 0;
  }

  .image-transform-panel__nudge .is-up {
    grid-area: 1 / 2;
  }

  .image-transform-panel__nudge .is-left {
    grid-area: 2 / 1;
  }

  .image-transform-panel__nudge .is-right {
    grid-area: 2 / 3;
  }

  .image-transform-panel__nudge .is-down {
    grid-area: 3 / 2;
  }

  .image-transform-panel__nudge-center {
    display: grid;
    grid-area: 2 / 2;
    place-items: center;
    color: #686868;
    border: 1px solid #343434;
    border-radius: 4px;
  }

  @media (max-width: 640px) {
    .image-transform-panel {
      width: 100%;
    }
  }

  @media (forced-colors: active) {
    .image-transform-panel__bounds,
    .transform-action-button,
    .transform-icon-button {
      border-color: ButtonBorder;
    }
  }

</style>
