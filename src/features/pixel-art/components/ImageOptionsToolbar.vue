<script setup lang="ts">
import { Download, MousePointer2, Ruler, SlidersHorizontal } from "@lucide/vue";
import { ref, watch } from "vue";

type ImageOptionPanel = "preferences" | "resize" | "transfer" | "transform";

const props = withDefaults(defineProps<{
  activePanel: ImageOptionPanel | null;
  controlsId?: string;
  variant?: "rail" | "tabs";
}>(), {
  controlsId: "image-editor-options-dialog",
  variant: "rail",
});

const emit = defineEmits<{
  open: [panel: ImageOptionPanel];
}>();

const options = [
  {
    icon: Ruler,
    label: "Resize",
    panel: "resize",
  },
  {
    icon: SlidersHorizontal,
    label: "View",
    panel: "preferences",
  },
  {
    icon: MousePointer2,
    label: "Transform",
    panel: "transform",
  },
  {
    icon: Download,
    label: "Files",
    panel: "transfer",
  },
] as const satisfies ReadonlyArray<{
  icon: typeof Ruler;
  label: string;
  panel: ImageOptionPanel;
}>;

const focusedPanel = ref<ImageOptionPanel>(props.activePanel ?? "resize");

watch(
  () => props.activePanel,
  (panel) => {
    if (panel) focusedPanel.value = panel;
  },
);

const openOption = (panel: ImageOptionPanel) => {
  focusedPanel.value = panel;
  emit("open", panel);
};

const navigateOptions = (event: KeyboardEvent) => {
  if (
    !new Set(["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home"]).has(
      event.key,
    )
  ) {
    return;
  }

  const toolbar = event.currentTarget as HTMLElement;
  const buttons = Array.from(toolbar.querySelectorAll<HTMLButtonElement>("button"));
  if (buttons.length === 0) return;

  event.preventDefault();
  event.stopPropagation();

  const currentIndex = buttons.indexOf(event.target as HTMLButtonElement);
  if (event.key === "Home") {
    buttons[0]?.focus();
    return;
  }
  if (event.key === "End") {
    buttons[buttons.length - 1]?.focus();
    return;
  }

  const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const nextIndex = currentIndex < 0
    ? 0
    : (currentIndex + direction + buttons.length) % buttons.length;
  buttons[nextIndex]?.focus();
};
</script>

<template>
  <div
    class="image-options-toolbar"
    :class="`is-${variant}`"
    role="toolbar"
    aria-label="Image options"
    :aria-orientation="variant === 'tabs' ? 'horizontal' : 'vertical'"
    @keydown="navigateOptions"
  >
    <button
      v-for="option in options"
      :key="option.panel"
      type="button"
      class="image-options-toolbar__button"
      :class="{ 'is-active': activePanel === option.panel }"
      :tabindex="focusedPanel === option.panel ? 0 : -1"
      :aria-haspopup="variant === 'rail' ? 'dialog' : undefined"
      :aria-controls="variant === 'rail' ? controlsId : undefined"
      :aria-expanded="variant === 'rail' ? activePanel === option.panel : undefined"
      :aria-pressed="variant === 'tabs' ? activePanel === option.panel : undefined"
      :aria-label="
        variant === 'rail'
          ? `Open ${option.label.toLowerCase()} options`
          : `Show ${option.label.toLowerCase()} options`
      "
      :title="option.label"
      @focus="focusedPanel = option.panel"
      @click="openOption(option.panel)"
    >
      <component :is="option.icon" :size="18" :stroke-width="2" aria-hidden="true" />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
  .image-options-toolbar {
    display: grid;
    grid-template-columns: 40px;
    gap: 2px;
    width: 46px;
    padding: 3px;
    box-sizing: border-box;
    color: #eeeeee;
    background: rgba(12, 12, 12, 0.96);
    border: 1px solid #343434;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.34);
  }

  .image-options-toolbar__button {
    display: grid;
    grid-template-columns: 18px;
    place-content: center;
    width: 40px;
    min-width: 40px;
    height: 40px;
    min-height: 40px;
    padding: 0;
    color: #999999;
    font: inherit;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 6px;
    outline: none;
  }

  .image-options-toolbar__button:hover,
  .image-options-toolbar__button:focus-visible {
    color: #ffffff;
    background: #1c1c1c;
  }

  .image-options-toolbar__button:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: -2px;
  }

  .image-options-toolbar__button.is-active {
    color: #101010;
    background: #f2f2f2;
  }

  .image-options-toolbar__button span {
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

  .image-options-toolbar.is-tabs {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2px;
    width: 100%;
    padding: 4px 6px;
    background: #0d0d0d;
    border: 0;
    border-bottom: 1px solid #2c2c2c;
    border-radius: 0;
    box-shadow: none;
  }

  .image-options-toolbar.is-tabs .image-options-toolbar__button {
    grid-template-rows: 18px auto;
    grid-template-columns: minmax(0, 1fr);
    gap: 3px;
    place-items: center;
    width: 100%;
    min-width: 0;
    height: 50px;
    min-height: 50px;
    color: #a9a9a9;
    font-size: 10px;
    font-weight: 600;
    text-align: center;
  }

  .image-options-toolbar.is-tabs .image-options-toolbar__button > svg {
    justify-self: center;
    align-self: center;
  }

  .image-options-toolbar.is-tabs .image-options-toolbar__button.is-active {
    color: #101010;
  }

  .image-options-toolbar.is-tabs .image-options-toolbar__button span {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    overflow: visible;
    clip: auto;
    line-height: 1;
    white-space: nowrap;
  }

  @media (min-width: 769px) {
    .image-options-toolbar.is-tabs {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .image-options-toolbar.is-rail {
      display: none;
    }

    .image-options-toolbar.is-tabs {
      height: 52px;
      padding: 4px 50px 4px 4px;
    }

    .image-options-toolbar.is-tabs .image-options-toolbar__button {
      grid-template-rows: 16px auto;
      gap: 2px;
      height: 44px;
      min-height: 44px;
      color: #9b9b9b;
      border-radius: 5px;
    }

    .image-options-toolbar.is-tabs .image-options-toolbar__button.is-active {
      color: #ffffff;
      background: #242424;
      box-shadow: inset 0 -2px 0 #f2f2f2;
    }

    .image-options-toolbar:not(.is-tabs) {
      grid-template-columns: 42px;
      width: 48px;
      padding: 2px;
    }

    .image-options-toolbar:not(.is-tabs) .image-options-toolbar__button {
      width: 42px;
      min-width: 42px;
      height: 42px;
      min-height: 42px;
    }
  }

  @media (max-width: 420px) {
    .image-options-toolbar:not(.is-tabs) {
      grid-template-columns: 40px;
      width: 42px;
      padding: 0;
    }

    .image-options-toolbar:not(.is-tabs) .image-options-toolbar__button {
      width: 40px;
      min-width: 40px;
      height: 40px;
      min-height: 40px;
    }
  }

  @media (forced-colors: active) {
    .image-options-toolbar,
    .image-options-toolbar__button {
      border-color: ButtonBorder;
    }

    .image-options-toolbar__button.is-active {
      color: HighlightText;
      background: Highlight;
    }
  }
</style>
