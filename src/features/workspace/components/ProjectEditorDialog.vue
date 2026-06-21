<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

import PixelArtEditor from "../../pixel-art/components/PixelArtEditor.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    projectName: string;
    pixels: Array<string | null>;
    palette: string[];
    saving?: boolean;
    editing?: boolean;
    showUnsavedConfirm?: boolean;
    message?: string;
  }>(),
  {
    saving: false,
    editing: false,
    showUnsavedConfirm: false,
    message: "",
  },
);

const emit = defineEmits<{
  "update:projectName": [value: string];
  "update:pixels": [value: Array<string | null>];
  close: [];
  save: [];
  "discard-unsaved": [];
  "save-unsaved": [];
}>();

const isNameEditing = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);

const projectNameProxy = computed({
  get: () => props.projectName,
  set: (value: string) => emit("update:projectName", value),
});

const pixelsProxy = computed({
  get: () => props.pixels,
  set: (value: Array<string | null>) => emit("update:pixels", value),
});

const titleInputWidth = computed(() => {
  const visibleCharacters = Math.max(projectNameProxy.value.length + 1, 11);
  return `${Math.min(visibleCharacters, 34)}ch`;
});

const primaryLabel = computed(() => {
  if (props.saving) {
    return props.editing ? "Saving..." : "Creating...";
  }

  return props.editing ? "Save changes" : "Create project";
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      isNameEditing.value = false;
    }
  },
);

const focusNameInput = () => {
  isNameEditing.value = true;
  void nextTick(() => {
    nameInput.value?.focus();
    nameInput.value?.select();
  });
};

const finishNameEditing = () => {
  if (!projectNameProxy.value.trim()) {
    projectNameProxy.value = "New project";
  }

  isNameEditing.value = false;
};
</script>

<template>
  <div v-if="open" class="project-editor-layer" role="presentation">
    <section
      class="project-editor-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-editor-title"
      @click.stop
    >
      <header>
        <div class="project-editor-title">
          <input
            v-if="isNameEditing"
            id="project-editor-title"
            ref="nameInput"
            v-model="projectNameProxy"
            type="text"
            placeholder="New project"
            aria-label="Project name"
            :style="{ width: titleInputWidth }"
            @blur="finishNameEditing"
            @keydown.enter.prevent="finishNameEditing"
            @keydown.escape.prevent="finishNameEditing"
          />
          <h2 v-else id="project-editor-title">{{ projectNameProxy }}</h2>
          <button
            type="button"
            class="project-editor-title__button"
            aria-label="Edit project name"
            @click="focusNameInput"
          >
            <svg class="project-editor-pencil" viewBox="0 0 24 24" aria-hidden="true" fill="none">
              <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z" />
              <path d="M13 6.5 17.5 11" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          class="project-editor-dialog__close"
          aria-label="Close"
          :disabled="saving"
          @click="emit('close')"
        >
          <span aria-hidden="true"></span>
        </button>
      </header>

      <form @submit.prevent="emit('save')">
        <div class="project-editor-dialog__body">
          <fieldset class="project-editor-image">
            <legend class="project-editor-sr-only">Pixel art editor</legend>
            <PixelArtEditor
              v-model:pixels="pixelsProxy"
              class="project-editor-pixel"
              :palette="palette"
              aria-label="Project pixel art editor"
            />
          </fieldset>

          <p v-if="message" class="project-editor-dialog__message">{{ message }}</p>
        </div>

        <footer>
          <button
            type="button"
            class="project-editor-dialog__secondary"
            :disabled="saving"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="project-editor-dialog__primary"
            :disabled="saving || !projectNameProxy.trim()"
          >
            {{ primaryLabel }}
          </button>
        </footer>
      </form>

      <div
        v-if="showUnsavedConfirm"
        class="project-editor-unsaved-layer"
        role="presentation"
        @click.stop
      >
        <section
          class="project-editor-unsaved-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-editor-unsaved-title"
        >
          <p>Unsaved changes</p>
          <h2 id="project-editor-unsaved-title">Save project changes?</h2>
          <span>These changes have not been saved.</span>
          <div class="project-editor-unsaved-dialog__actions">
            <button
              type="button"
              class="project-editor-dialog__secondary"
              :disabled="saving"
              @click="emit('discard-unsaved')"
            >
              Discard changes
            </button>
            <button
              type="button"
              class="project-editor-dialog__primary"
              :disabled="saving"
              @click="emit('save-unsaved')"
            >
              {{ saving ? "Saving..." : "Save changes" }}
            </button>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
  .project-editor-layer {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(2, 2, 2, 0.64);
    backdrop-filter: blur(10px);
  }

  .project-editor-dialog {
    position: relative;
    width: min(760px, calc(100vw - 40px));
    max-height: min(860px, calc(100dvh - 32px));
    overflow: auto;
    color: var(--text);
    background: #101111;
    border: 1px solid rgba(255, 252, 244, 0.24);
    border-radius: 8px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48);
  }

  .project-editor-dialog header {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    padding: 22px;
    border-bottom: 1px solid var(--line);
  }

  .project-editor-title {
    display: flex;
    gap: 4px;
    align-items: center;
    min-width: 0;
  }

  .project-editor-title h2 {
    max-width: min(420px, calc(100vw - 150px));
    margin: 0;
    overflow: hidden;
    font-size: clamp(1.25rem, 2vw, 1.55rem);
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-editor-title input {
    width: 100%;
    max-width: min(420px, calc(100vw - 150px));
    height: 44px;
    min-width: 0;
    padding: 0 10px;
    color: var(--text);
    font: inherit;
    font-size: clamp(1.25rem, 2vw, 1.55rem);
    font-weight: 800;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    outline: 0;
    transition:
      border-color 180ms ease,
      background 180ms ease,
      box-shadow 180ms ease;
  }

  .project-editor-title input:hover,
  .project-editor-title input:focus {
    background: rgba(255, 252, 244, 0.055);
    border-color: rgba(255, 252, 244, 0.18);
  }

  .project-editor-title input:focus {
    box-shadow: 0 0 0 3px rgba(247, 241, 231, 0.1);
  }

  .project-editor-title input::placeholder {
    color: rgba(247, 241, 231, 0.58);
  }

  .project-editor-title__button,
  .project-editor-dialog__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    color: inherit;
    cursor: pointer;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 7px;
  }

  .project-editor-title__button:hover,
  .project-editor-dialog__close:hover {
    background: rgba(255, 252, 244, 0.08);
    border-color: var(--line);
  }

  .project-editor-pencil {
    display: block;
    width: 20px;
    height: 20px;
    color: var(--muted);
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }

  .project-editor-dialog__close span {
    position: relative;
    display: block;
    width: 16px;
    height: 16px;
  }

  .project-editor-dialog__close span::before,
  .project-editor-dialog__close span::after {
    position: absolute;
    top: 7px;
    left: 0;
    width: 16px;
    height: 2px;
    content: "";
    background: var(--muted);
    border-radius: 999px;
  }

  .project-editor-dialog__close span::before {
    transform: rotate(45deg);
  }

  .project-editor-dialog__close span::after {
    transform: rotate(-45deg);
  }

  .project-editor-dialog form {
    display: grid;
    gap: 0;
  }

  .project-editor-dialog__body {
    display: grid;
    gap: 18px;
    padding: 22px;
  }

  .project-editor-image {
    display: grid;
    gap: 8px;
    min-width: 0;
    padding: 0;
    margin: 0;
    border: 0;
  }

  .project-editor-pixel {
    --pixel-editor-max-width: 430px;
    --pixel-canvas-max-size: 390px;
  }

  .project-editor-dialog__message {
    width: min(100%, 430px);
    margin: 0 auto;
    color: rgba(247, 241, 231, 0.68);
    font-size: 0.84rem;
    line-height: 1.4;
  }

  .project-editor-dialog footer {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    padding: 0 22px 22px;
  }

  .project-editor-dialog__primary,
  .project-editor-dialog__secondary {
    min-height: 40px;
    padding: 0 16px;
    color: inherit;
    font: inherit;
    border-radius: 8px;
    cursor: pointer;
    transition:
      transform 180ms ease,
      border-color 180ms ease,
      background 180ms ease,
      box-shadow 180ms ease;
  }

  .project-editor-dialog__primary {
    color: #07100b;
    background: var(--mint);
    border: 1px solid rgba(255, 255, 255, 0.16);
    box-shadow: 0 12px 34px rgba(94, 168, 113, 0.17);
  }

  .project-editor-dialog__primary:hover:not(:disabled) {
    box-shadow: 0 16px 40px rgba(94, 168, 113, 0.24);
    transform: translateY(-1px);
  }

  .project-editor-dialog__secondary {
    background: rgba(255, 252, 244, 0.045);
    border: 1px solid var(--line-strong);
  }

  .project-editor-dialog__secondary:hover:not(:disabled) {
    background: rgba(255, 252, 244, 0.08);
    border-color: rgba(255, 252, 244, 0.32);
  }

  .project-editor-dialog__primary:disabled,
  .project-editor-dialog__secondary:disabled,
  .project-editor-dialog__close:disabled {
    cursor: not-allowed;
    filter: grayscale(0.4);
    opacity: 0.62;
    transform: none;
  }

  .project-editor-unsaved-layer {
    position: fixed;
    inset: 0;
    z-index: 8;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(2, 2, 2, 0.66);
    backdrop-filter: blur(10px);
  }

  .project-editor-unsaved-dialog {
    width: min(400px, 100%);
    padding: 20px;
    color: var(--text);
    background:
      radial-gradient(circle at 92% 12%, rgba(255, 126, 103, 0.12), transparent 38%),
      #101111;
    border: 1px solid rgba(255, 252, 244, 0.24);
    border-radius: 8px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
  }

  .project-editor-unsaved-dialog p {
    margin: 0 0 8px;
    color: rgba(255, 176, 159, 0.76);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    line-height: 1;
    text-transform: uppercase;
  }

  .project-editor-unsaved-dialog h2 {
    margin: 0;
    font-size: 1.2rem;
    line-height: 1.18;
    letter-spacing: 0;
  }

  .project-editor-unsaved-dialog span {
    display: block;
    margin: 10px 0 18px;
    color: rgba(247, 241, 231, 0.68);
    line-height: 1.45;
  }

  .project-editor-unsaved-dialog__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .project-editor-sr-only {
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

  @media (max-width: 520px) {
    .project-editor-layer {
      padding: 12px;
    }

    .project-editor-dialog {
      width: min(100%, 430px);
      max-height: calc(100dvh - 24px);
    }

    .project-editor-dialog header {
      gap: 8px;
      padding: 14px 14px 12px;
    }

    .project-editor-title h2 {
      max-width: calc(100vw - 128px);
      font-size: clamp(1.05rem, 5.2vw, 1.2rem);
    }

    .project-editor-title input {
      max-width: calc(100vw - 128px);
      height: 38px;
      font-size: clamp(1.05rem, 5.2vw, 1.2rem);
    }

    .project-editor-dialog form {
      min-height: 0;
    }

    .project-editor-dialog__body {
      padding: 14px;
    }

    .project-editor-dialog footer {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 0 14px 14px;
    }

    .project-editor-dialog footer button {
      min-width: 0;
      padding-inline: 8px;
    }
  }
</style>
