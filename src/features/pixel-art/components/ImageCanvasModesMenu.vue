<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from "vue";
import {
  Check,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
  LocateFixed,
  LockKeyhole,
  MoreHorizontal,
  Settings2,
} from "@lucide/vue";

type ImageMirrorAxis = "horizontal" | "vertical";

defineProps<{
  horizontalMirror: boolean;
  horizontalMirrorLineLocked: boolean;
  horizontalMirrorLineVisible: boolean;
  verticalMirror: boolean;
  verticalMirrorLineLocked: boolean;
  verticalMirrorLineVisible: boolean;
  wrapAround: boolean;
}>();

const emit = defineEmits<{
  "center-horizontal-mirror-line": [];
  "center-vertical-mirror-line": [];
  "toggle-horizontal-mirror": [];
  "toggle-horizontal-mirror-line-lock": [];
  "toggle-horizontal-mirror-line-visibility": [];
  "toggle-vertical-mirror": [];
  "toggle-vertical-mirror-line-lock": [];
  "toggle-vertical-mirror-line-visibility": [];
  "toggle-wrap-around": [];
}>();

const isOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const firstToggleRef = ref<HTMLButtonElement | null>(null);
const horizontalOptionsTriggerRef = ref<HTMLButtonElement | null>(null);
const verticalOptionsTriggerRef = ref<HTMLButtonElement | null>(null);
const horizontalOptionsFirstItemRef = ref<HTMLButtonElement | null>(null);
const verticalOptionsFirstItemRef = ref<HTMLButtonElement | null>(null);
const openMirrorOptions = ref<ImageMirrorAxis | null>(null);
const popoverId = `image-canvas-modes-${useId()}`;
const horizontalOptionsId = `${popoverId}-horizontal-options`;
const verticalOptionsId = `${popoverId}-vertical-options`;

const openMenu = async () => {
  isOpen.value = true;
  await nextTick();
  firstToggleRef.value?.focus({ preventScroll: true });
};

const closeMenu = (restoreFocus = true) => {
  if (!isOpen.value) return;
  openMirrorOptions.value = null;
  isOpen.value = false;

  if (restoreFocus) {
    void nextTick(() => triggerRef.value?.focus({ preventScroll: true }));
  }
};

const getMirrorOptionsTrigger = (axis: ImageMirrorAxis) =>
  axis === "horizontal"
    ? horizontalOptionsTriggerRef.value
    : verticalOptionsTriggerRef.value;

const closeMirrorOptions = (restoreFocus = true) => {
  const axis = openMirrorOptions.value;
  if (!axis) return;
  openMirrorOptions.value = null;

  if (restoreFocus) {
    void nextTick(() => getMirrorOptionsTrigger(axis)?.focus({ preventScroll: true }));
  }
};

const toggleMirrorOptions = async (axis: ImageMirrorAxis) => {
  if (openMirrorOptions.value === axis) {
    closeMirrorOptions();
    return;
  }

  openMirrorOptions.value = axis;
  await nextTick();
  const firstItem =
    axis === "horizontal"
      ? horizontalOptionsFirstItemRef.value
      : verticalOptionsFirstItemRef.value;
  firstItem?.focus({ preventScroll: true });
};

const toggleMenu = () => {
  if (isOpen.value) {
    closeMenu();
    return;
  }

  void openMenu();
};

const handlePointerDown = (event: PointerEvent) => {
  const target = event.target;
  if (target instanceof Node && rootRef.value?.contains(target)) return;
  closeMenu(false);
};

const handleFocusOut = (event: FocusEvent) => {
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Node && rootRef.value?.contains(nextTarget)) return;

  void nextTick(() => {
    const activeElement = document.activeElement;
    if (activeElement instanceof Node && rootRef.value?.contains(activeElement)) return;
    closeMenu(false);
  });
};

const handleEscape = (event: KeyboardEvent) => {
  if (!isOpen.value || event.key !== "Escape") return;
  event.preventDefault();
  event.stopPropagation();
  if (openMirrorOptions.value) {
    closeMirrorOptions();
    return;
  }
  closeMenu();
};

onMounted(() => {
  window.addEventListener("pointerdown", handlePointerDown);
});

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handlePointerDown);
});
</script>

<template>
  <div
    ref="rootRef"
    class="image-canvas-modes-menu"
    :class="{ 'is-open': isOpen }"
    @focusout="handleFocusOut"
    @keydown="handleEscape"
  >
    <button
      ref="triggerRef"
      type="button"
      class="image-canvas-modes-menu__trigger"
      aria-haspopup="dialog"
      :aria-controls="popoverId"
      :aria-expanded="isOpen"
      aria-label="Canvas settings"
      title="Canvas settings"
      @click="toggleMenu"
    >
      <Settings2 :size="18" :stroke-width="2" aria-hidden="true" />
    </button>

    <section
      v-if="isOpen"
      :id="popoverId"
      class="image-canvas-modes-menu__popover"
      role="dialog"
      aria-label="Canvas settings"
    >
      <div
        class="image-canvas-modes-menu__option-group"
        :class="{ 'is-active': horizontalMirror }"
      >
        <div class="image-canvas-modes-menu__option-row">
          <button
            ref="firstToggleRef"
            type="button"
            class="image-canvas-modes-menu__option"
            :aria-pressed="horizontalMirror"
            @click="emit('toggle-horizontal-mirror')"
          >
            <span class="image-canvas-modes-menu__option-icon" aria-hidden="true">
              <FlipVertical2 :size="18" :stroke-width="2" />
            </span>
            <span class="image-canvas-modes-menu__option-copy">
              <strong>Horizontal mirror</strong>
              <small>Repeat strokes across the horizontal axis</small>
            </span>
          </button>
          <button
            ref="horizontalOptionsTriggerRef"
            type="button"
            class="image-canvas-modes-menu__more"
            :class="{ 'is-open': openMirrorOptions === 'horizontal' }"
            aria-label="Horizontal mirror options"
            title="Horizontal mirror options"
            aria-haspopup="true"
            :aria-controls="horizontalOptionsId"
            :aria-expanded="openMirrorOptions === 'horizontal'"
            @click="toggleMirrorOptions('horizontal')"
          >
            <MoreHorizontal :size="18" :stroke-width="2.2" aria-hidden="true" />
          </button>
        </div>

        <Transition name="image-canvas-modes-menu__reveal">
          <div
            v-if="openMirrorOptions === 'horizontal'"
            :id="horizontalOptionsId"
            class="image-canvas-modes-menu__mirror-options"
            role="group"
            aria-label="Horizontal mirror line options"
          >
          <button
            ref="horizontalOptionsFirstItemRef"
            type="button"
            class="image-canvas-modes-menu__mirror-action"
            :aria-pressed="!horizontalMirrorLineVisible"
            @click="emit('toggle-horizontal-mirror-line-visibility')"
          >
            <EyeOff :size="15" :stroke-width="2" aria-hidden="true" />
            <span>Hide horizontal mirror line</span>
            <span class="image-canvas-modes-menu__check" aria-hidden="true">
              <Check v-if="!horizontalMirrorLineVisible" :size="13" :stroke-width="2.6" />
            </span>
          </button>
          <button
            type="button"
            class="image-canvas-modes-menu__mirror-action"
            :aria-pressed="horizontalMirrorLineLocked"
            @click="emit('toggle-horizontal-mirror-line-lock')"
          >
            <LockKeyhole :size="15" :stroke-width="2" aria-hidden="true" />
            <span>Lock horizontal mirror line</span>
            <span class="image-canvas-modes-menu__check" aria-hidden="true">
              <Check v-if="horizontalMirrorLineLocked" :size="13" :stroke-width="2.6" />
            </span>
          </button>
          <button
            type="button"
            class="image-canvas-modes-menu__mirror-action"
            @click="emit('center-horizontal-mirror-line')"
          >
            <LocateFixed :size="15" :stroke-width="2" aria-hidden="true" />
            <span>Move to horizontal canvas center</span>
          </button>
          </div>
        </Transition>
      </div>

      <div
        class="image-canvas-modes-menu__option-group"
        :class="{ 'is-active': verticalMirror }"
      >
        <div class="image-canvas-modes-menu__option-row">
          <button
            type="button"
            class="image-canvas-modes-menu__option"
            :aria-pressed="verticalMirror"
            @click="emit('toggle-vertical-mirror')"
          >
            <span class="image-canvas-modes-menu__option-icon" aria-hidden="true">
              <FlipHorizontal2 :size="18" :stroke-width="2" />
            </span>
            <span class="image-canvas-modes-menu__option-copy">
              <strong>Vertical mirror</strong>
              <small>Repeat strokes across the vertical axis</small>
            </span>
          </button>
          <button
            ref="verticalOptionsTriggerRef"
            type="button"
            class="image-canvas-modes-menu__more"
            :class="{ 'is-open': openMirrorOptions === 'vertical' }"
            aria-label="Vertical mirror options"
            title="Vertical mirror options"
            aria-haspopup="true"
            :aria-controls="verticalOptionsId"
            :aria-expanded="openMirrorOptions === 'vertical'"
            @click="toggleMirrorOptions('vertical')"
          >
            <MoreHorizontal :size="18" :stroke-width="2.2" aria-hidden="true" />
          </button>
        </div>

        <Transition name="image-canvas-modes-menu__reveal">
          <div
            v-if="openMirrorOptions === 'vertical'"
            :id="verticalOptionsId"
            class="image-canvas-modes-menu__mirror-options"
            role="group"
            aria-label="Vertical mirror line options"
          >
          <button
            ref="verticalOptionsFirstItemRef"
            type="button"
            class="image-canvas-modes-menu__mirror-action"
            :aria-pressed="!verticalMirrorLineVisible"
            @click="emit('toggle-vertical-mirror-line-visibility')"
          >
            <EyeOff :size="15" :stroke-width="2" aria-hidden="true" />
            <span>Hide vertical mirror line</span>
            <span class="image-canvas-modes-menu__check" aria-hidden="true">
              <Check v-if="!verticalMirrorLineVisible" :size="13" :stroke-width="2.6" />
            </span>
          </button>
          <button
            type="button"
            class="image-canvas-modes-menu__mirror-action"
            :aria-pressed="verticalMirrorLineLocked"
            @click="emit('toggle-vertical-mirror-line-lock')"
          >
            <LockKeyhole :size="15" :stroke-width="2" aria-hidden="true" />
            <span>Lock vertical mirror line</span>
            <span class="image-canvas-modes-menu__check" aria-hidden="true">
              <Check v-if="verticalMirrorLineLocked" :size="13" :stroke-width="2.6" />
            </span>
          </button>
          <button
            type="button"
            class="image-canvas-modes-menu__mirror-action"
            @click="emit('center-vertical-mirror-line')"
          >
            <LocateFixed :size="15" :stroke-width="2" aria-hidden="true" />
            <span>Move to vertical canvas center</span>
          </button>
          </div>
        </Transition>
      </div>

      <button
        type="button"
        class="image-canvas-modes-menu__option"
        :aria-pressed="wrapAround"
        aria-keyshortcuts="Shift+W"
        @click="emit('toggle-wrap-around')"
      >
        <span class="image-canvas-modes-menu__option-icon" aria-hidden="true">
          <Grid3x3 :size="18" :stroke-width="2" />
        </span>
        <span class="image-canvas-modes-menu__option-copy">
          <span class="image-canvas-modes-menu__option-heading">
            <strong>Wrap-around mode</strong>
            <kbd>Shift+W</kbd>
          </span>
          <small>Tile the canvas and continue painting across edges</small>
        </span>
      </button>
    </section>
  </div>
</template>

<style scoped>
  .image-canvas-modes-menu {
    position: relative;
    z-index: 4;
    display: grid;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .image-canvas-modes-menu.is-open {
    z-index: 24;
  }

  .image-canvas-modes-menu__trigger {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    min-width: 24px;
    min-height: 24px;
    padding: 0;
    color: var(--editor-muted, #9b9b9b);
    font: inherit;
    cursor: pointer;
    background: var(--editor-panel, #0b0b0b);
    border: 0;
    border-top: 1px solid var(--editor-border, #292929);
    border-right: 1px solid var(--editor-border, #292929);
    box-sizing: border-box;
    outline: none;
  }

  .image-canvas-modes-menu__trigger:hover,
  .image-canvas-modes-menu__trigger:focus-visible {
    color: var(--editor-text, #f2f2f2);
    background: var(--editor-hover, #1b1b1b);
  }

  .image-canvas-modes-menu__trigger[aria-expanded="true"] {
    color: var(--editor-selected-ink, #080808);
    background: var(--editor-selected, #f2f2f2);
  }

  .image-canvas-modes-menu__trigger:focus-visible {
    outline: 2px solid var(--editor-focus, #ffffff);
    outline-offset: -3px;
  }

  .image-canvas-modes-menu__popover {
    position: absolute;
    bottom: calc(100% + 8px);
    left: calc(100% + 8px);
    display: grid;
    gap: 3px;
    width: min(320px, calc(100vw - 72px));
    max-height: calc(100dvh - 82px);
    padding: 5px;
    overflow-y: auto;
    color: var(--editor-text, #f2f2f2);
    background: var(--editor-surface, #111111);
    border: 1px solid var(--editor-border-strong, #3a3a3a);
    border-radius: var(--editor-radius-md, 8px);
    box-sizing: border-box;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.48);
  }

  .image-canvas-modes-menu__option-group {
    display: grid;
    min-width: 0;
    overflow: hidden;
    border: 1px solid transparent;
    border-radius: var(--editor-radius-sm, 6px);
  }

  .image-canvas-modes-menu__option-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 36px;
    min-width: 0;
  }

  .image-canvas-modes-menu__option {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    width: 100%;
    min-height: 44px;
    padding: 5px 8px;
    color: var(--editor-muted, #9b9b9b);
    font: inherit;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--editor-radius-sm, 6px);
    box-sizing: border-box;
    outline: none;
  }

  .image-canvas-modes-menu__option-group .image-canvas-modes-menu__option {
    border-radius: 0;
  }

  .image-canvas-modes-menu__option:hover,
  .image-canvas-modes-menu__option:focus-visible {
    color: var(--editor-text, #f2f2f2);
    background: var(--editor-hover, #1b1b1b);
  }

  .image-canvas-modes-menu__option:focus-visible {
    border-color: var(--editor-focus, #ffffff);
  }

  .image-canvas-modes-menu__option[aria-pressed="true"] {
    color: var(--editor-selected-ink, #080808);
    background: var(--editor-selected, #f2f2f2);
  }

  .image-canvas-modes-menu__option-group.is-active > .image-canvas-modes-menu__option-row {
    color: var(--editor-selected-ink, #080808);
    background: var(--editor-selected, #f2f2f2);
  }

  .image-canvas-modes-menu__option-group.is-active .image-canvas-modes-menu__option,
  .image-canvas-modes-menu__option-group.is-active .image-canvas-modes-menu__more {
    color: inherit;
    background: transparent;
  }

  .image-canvas-modes-menu__more {
    display: grid;
    place-items: center;
    min-width: 36px;
    min-height: 44px;
    padding: 0;
    color: var(--editor-muted, #9b9b9b);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-left: 1px solid transparent;
    outline: none;
  }

  .image-canvas-modes-menu__more:hover,
  .image-canvas-modes-menu__more:focus-visible,
  .image-canvas-modes-menu__more.is-open {
    color: var(--editor-text, #f2f2f2);
    background: var(--editor-hover, #1b1b1b);
  }

  .image-canvas-modes-menu__option-group.is-active .image-canvas-modes-menu__more:hover,
  .image-canvas-modes-menu__option-group.is-active .image-canvas-modes-menu__more:focus-visible,
  .image-canvas-modes-menu__option-group.is-active .image-canvas-modes-menu__more.is-open {
    color: var(--editor-selected-ink, #080808);
    background: rgba(0, 0, 0, 0.1);
  }

  .image-canvas-modes-menu__more:focus-visible {
    box-shadow: inset 0 0 0 2px var(--editor-focus, #ffffff);
  }

  .image-canvas-modes-menu__mirror-options {
    display: grid;
    gap: 2px;
    max-height: 132px;
    padding: 4px;
    overflow: hidden;
    color: var(--editor-text, #f2f2f2);
    background: var(--editor-panel, #0b0b0b);
    border-top: 1px solid var(--editor-border, #292929);
    box-sizing: border-box;
    transform-origin: top center;
  }

  .image-canvas-modes-menu__reveal-enter-active,
  .image-canvas-modes-menu__reveal-leave-active {
    transition:
      max-height 180ms cubic-bezier(0.22, 1, 0.36, 1),
      padding 180ms cubic-bezier(0.22, 1, 0.36, 1),
      border-color 140ms ease,
      opacity 140ms ease,
      transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .image-canvas-modes-menu__reveal-enter-from,
  .image-canvas-modes-menu__reveal-leave-to {
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    opacity: 0;
    border-top-color: transparent;
    transform: translateY(-4px) scaleY(0.96);
  }

  .image-canvas-modes-menu__mirror-action {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) 18px;
    gap: 7px;
    align-items: center;
    width: 100%;
    min-height: 34px;
    padding: 4px 7px;
    color: var(--editor-muted, #9b9b9b);
    font: inherit;
    font-size: 11px;
    font-weight: 560;
    line-height: 1.2;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    outline: none;
  }

  .image-canvas-modes-menu__mirror-action:hover,
  .image-canvas-modes-menu__mirror-action:focus-visible {
    color: var(--editor-text, #f2f2f2);
    background: var(--editor-hover, #1b1b1b);
  }

  .image-canvas-modes-menu__mirror-action:focus-visible {
    border-color: var(--editor-focus, #ffffff);
  }

  .image-canvas-modes-menu__mirror-action[aria-pressed="true"] {
    color: var(--editor-text, #f2f2f2);
  }

  .image-canvas-modes-menu__check {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border: 1px solid var(--editor-border-strong, #3a3a3a);
    border-radius: 3px;
    box-sizing: border-box;
  }

  .image-canvas-modes-menu__mirror-action[aria-pressed="true"]
    .image-canvas-modes-menu__check {
    color: var(--editor-selected-ink, #080808);
    background: var(--editor-selected, #f2f2f2);
    border-color: var(--editor-selected, #f2f2f2);
  }

  .image-canvas-modes-menu__option-icon {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    color: currentColor;
  }

  .image-canvas-modes-menu__option-copy {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .image-canvas-modes-menu__option-heading {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
  }

  .image-canvas-modes-menu__option strong {
    overflow: hidden;
    color: currentColor;
    font-size: 12px;
    font-weight: 680;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .image-canvas-modes-menu__option small {
    color: currentColor;
    font-size: 10px;
    line-height: 1.25;
    opacity: 0.72;
  }

  .image-canvas-modes-menu__option kbd {
    flex: 0 0 auto;
    padding: 1px 4px;
    color: currentColor;
    font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    font-weight: 650;
    line-height: 1.4;
    background: rgba(127, 127, 127, 0.12);
    border: 1px solid currentColor;
    border-radius: 3px;
    opacity: 0.72;
  }

  @media (max-width: 420px) {
    .image-canvas-modes-menu__popover {
      bottom: calc(100% + 6px);
      left: calc(100% + 6px);
      width: min(300px, calc(100vw - 62px));
      padding: 4px;
    }

    .image-canvas-modes-menu__option {
      grid-template-columns: 30px minmax(0, 1fr);
      gap: 6px;
      padding-right: 6px;
      padding-left: 6px;
    }

    .image-canvas-modes-menu__option-icon {
      width: 30px;
    }

    .image-canvas-modes-menu__mirror-action {
      gap: 5px;
      padding-right: 5px;
      padding-left: 5px;
      font-size: 10px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .image-canvas-modes-menu__reveal-enter-active,
    .image-canvas-modes-menu__reveal-leave-active {
      transition-duration: 1ms;
    }
  }

  @media (forced-colors: active) {
    .image-canvas-modes-menu__trigger,
    .image-canvas-modes-menu__popover,
    .image-canvas-modes-menu__option-group,
    .image-canvas-modes-menu__option,
    .image-canvas-modes-menu__mirror-action,
    .image-canvas-modes-menu__check,
    .image-canvas-modes-menu__option kbd {
      border-color: ButtonBorder;
    }

    .image-canvas-modes-menu__trigger[aria-expanded="true"],
    .image-canvas-modes-menu__option[aria-pressed="true"],
    .image-canvas-modes-menu__mirror-action[aria-pressed="true"]
      .image-canvas-modes-menu__check {
      color: HighlightText;
      background: Highlight;
    }
  }
</style>
