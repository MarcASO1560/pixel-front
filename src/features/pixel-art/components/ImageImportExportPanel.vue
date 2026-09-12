<script setup lang="ts">
import { Download, FileJson2, FileUp, ImageDown, Palette } from "@lucide/vue";
import { computed, ref, useId, watch } from "vue";

import {
  PNG_EXPORT_SCALES,
  type PngExportScale,
} from "../lib/importExport";

type PngBackgroundMode = "transparent" | "custom";

const props = withDefaults(
  defineProps<{
    canEdit: boolean;
    defaultBackgroundColor?: string;
    isBusy?: boolean;
  }>(),
  {
    defaultBackgroundColor: "#101111",
    isBusy: false,
  },
);

const emit = defineEmits<{
  "import-file": [file: File];
  "create-animation": [file: File];
  "export-png": [options: { scale: PngExportScale; backgroundColor: string | null }];
  "export-json": [];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedScale = ref<PngExportScale>(1);
const backgroundMode = ref<PngBackgroundMode>("transparent");
const customBackgroundColor = ref("#101111");
const selectedFileName = ref("");
const importError = ref("");
const fileInputId = useId();

const canImport = computed(() => props.canEdit && !props.isBusy);
const canExport = computed(() => !props.isBusy);

const normalizeBackgroundColor = (value: string) => {
  const color = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : "#101111";
};

const isSupportedImport = (file: File) => {
  const supportedExtension = /\.(?:jpe?g|json|png|webp)$/i.test(file.name);
  const supportedMimeType = new Set([
    "application/json",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/json",
  ]).has(file.type.toLowerCase());

  return supportedExtension || supportedMimeType;
};

const openFilePicker = () => {
  if (canImport.value) {
    fileInputRef.value?.click();
  }
};

const handleFileSelection = (event: Event) => {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";

  if (!file || !canImport.value) {
    return;
  }

  if (/\.gif$/i.test(file.name) || file.type.toLowerCase() === "image/gif") {
    selectedFileName.value = file.name;
    importError.value = "GIF files continue in the animation creation flow.";
    emit("create-animation", file);
    return;
  }

  if (!isSupportedImport(file)) {
    selectedFileName.value = "";
    importError.value = "Choose a PNG, JPEG, WebP, or Sefkira JSON file.";
    return;
  }

  selectedFileName.value = file.name;
  importError.value = "";
  emit("import-file", file);
};

const selectBackgroundMode = (mode: PngBackgroundMode) => {
  backgroundMode.value = mode;
};

const requestPngExport = () => {
  if (!canExport.value) {
    return;
  }

  emit("export-png", {
    scale: selectedScale.value,
    backgroundColor:
      backgroundMode.value === "custom"
        ? normalizeBackgroundColor(customBackgroundColor.value)
        : null,
  });
};

watch(
  () => props.defaultBackgroundColor,
  (color) => {
    customBackgroundColor.value = normalizeBackgroundColor(color);
  },
  { immediate: true },
);
</script>

<template>
  <section
    class="image-transfer-panel"
    aria-label="Import and export"
    :aria-busy="isBusy"
  >
    <div class="image-transfer-panel__section">
      <div class="image-transfer-panel__section-title">
        <div>
          <h3>Import</h3>
          <p>PNG, JPEG, WebP or JSON · GIF opens animation creation</p>
        </div>
        <FileUp :size="15" aria-hidden="true" />
      </div>

      <input
        :id="fileInputId"
        ref="fileInputRef"
        class="image-transfer-panel__file-input"
        type="file"
        tabindex="-1"
        aria-hidden="true"
        accept=".png,.jpg,.jpeg,.webp,.gif,.json,application/json,image/png,image/jpeg,image/webp,image/gif"
        :disabled="!canImport"
        @change="handleFileSelection"
      />
      <button
        type="button"
        class="image-transfer-panel__primary-button"
        :disabled="!canImport"
        :aria-describedby="`${fileInputId}-import-note`"
        @click="openFilePicker"
      >
        <FileUp aria-hidden="true" />
        <span>{{ canEdit ? "Choose file" : "Import unavailable" }}</span>
      </button>

      <p :id="`${fileInputId}-import-note`" class="image-transfer-panel__note">
        Importing replaces the current image after confirmation.
      </p>
      <p
        v-if="selectedFileName"
        class="image-transfer-panel__filename"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Selected: <strong>{{ selectedFileName }}</strong>
      </p>
      <p v-if="importError" class="image-transfer-panel__error" role="alert">
        {{ importError }}
      </p>
    </div>

    <div class="image-transfer-panel__section">
      <div class="image-transfer-panel__section-title">
        <div>
          <h3>PNG</h3>
          <p>Nearest-neighbor integer scaling</p>
        </div>
        <ImageDown :size="15" aria-hidden="true" />
      </div>

      <label class="image-transfer-panel__field">
        <span>Scale</span>
        <select v-model="selectedScale" :disabled="!canExport" aria-label="PNG export scale">
          <option v-for="scale in PNG_EXPORT_SCALES" :key="scale" :value="scale">
            {{ scale }}×
          </option>
        </select>
      </label>

      <fieldset class="image-transfer-panel__background">
        <legend>Background</legend>
        <div class="image-transfer-panel__segments">
          <button
            type="button"
            :class="{ 'is-active': backgroundMode === 'transparent' }"
            :aria-pressed="backgroundMode === 'transparent'"
            :disabled="!canExport"
            @click="selectBackgroundMode('transparent')"
          >
            <span class="image-transfer-panel__transparent-swatch" aria-hidden="true"></span>
            Transparent
          </button>
          <button
            type="button"
            :class="{ 'is-active': backgroundMode === 'custom' }"
            :aria-pressed="backgroundMode === 'custom'"
            :disabled="!canExport"
            @click="selectBackgroundMode('custom')"
          >
            <Palette aria-hidden="true" />
            Custom
          </button>
        </div>
      </fieldset>

      <label v-if="backgroundMode === 'custom'" class="image-transfer-panel__color-field">
        <span>Background color</span>
        <span class="image-transfer-panel__color-control">
          <input
            v-model="customBackgroundColor"
            type="color"
            :disabled="!canExport"
            aria-label="Custom PNG background color"
          />
          <output>{{ normalizeBackgroundColor(customBackgroundColor) }}</output>
        </span>
      </label>

      <button
        type="button"
        class="image-transfer-panel__primary-button"
        :disabled="!canExport"
        @click="requestPngExport"
      >
        <ImageDown aria-hidden="true" />
        <span>Export PNG · {{ selectedScale }}×</span>
      </button>
    </div>

    <div class="image-transfer-panel__section image-transfer-panel__json-section">
      <div class="image-transfer-panel__json-copy">
        <FileJson2 :size="17" aria-hidden="true" />
        <div>
          <h3>Sefkira JSON</h3>
          <p>Layers, palette and transparency</p>
        </div>
      </div>
      <button
        type="button"
        class="image-transfer-panel__icon-button"
        :disabled="!canExport"
        aria-label="Export Sefkira JSON"
        title="Export Sefkira JSON"
        @click="emit('export-json')"
      >
        <Download aria-hidden="true" />
      </button>
    </div>

    <p v-if="isBusy" class="image-transfer-panel__busy" role="status">
      Preparing file…
    </p>
  </section>
</template>

<style scoped>
  .image-transfer-panel {
    --transfer-ink: #f2f2f2;
    --transfer-muted: #a8a8a8;
    --transfer-line: #2d2d2d;
    --transfer-control: #171717;
    --transfer-control-hover: #262626;
    --transfer-focus: #ffffff;
    display: grid;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    color: var(--transfer-ink);
    background: transparent;
  }

  .image-transfer-panel__section h3 {
    margin: 0;
    letter-spacing: 0;
  }

  .image-transfer-panel__section-title p,
  .image-transfer-panel__json-copy p {
    margin: 2px 0 0;
    color: var(--transfer-muted);
    font-size: 12px;
    line-height: 1.4;
  }

  .image-transfer-panel__section-title > svg {
    color: var(--transfer-muted);
  }

  .image-transfer-panel__section {
    display: grid;
    gap: 9px;
    padding: 10px 12px;
  }

  .image-transfer-panel__section + .image-transfer-panel__section {
    border-top: 1px solid var(--transfer-line);
  }

  .image-transfer-panel__section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .image-transfer-panel__section h3 {
    color: #cfcfcf;
    font-size: 12px;
    font-weight: 680;
    letter-spacing: 0;
  }

  .image-transfer-panel__file-input {
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

  .image-transfer-panel__primary-button,
  .image-transfer-panel__icon-button,
  .image-transfer-panel__segments button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: 0;
    color: #d2d2d2;
    font: inherit;
    background: var(--transfer-control);
    border: 1px solid #3a3a3a;
    border-radius: 5px;
    cursor: pointer;
  }

  .image-transfer-panel__primary-button {
    gap: 6px;
    width: 100%;
    height: 34px;
    padding: 0 10px;
    font-size: 12px;
    font-weight: 680;
  }

  .image-transfer-panel__primary-button svg,
  .image-transfer-panel__icon-button svg,
  .image-transfer-panel__segments svg {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
    stroke-width: 1.8;
  }

  .image-transfer-panel__primary-button:hover:not(:disabled),
  .image-transfer-panel__icon-button:hover:not(:disabled),
  .image-transfer-panel__segments button:hover:not(:disabled) {
    color: #ffffff;
    background: var(--transfer-control-hover);
    border-color: #565656;
  }

  .image-transfer-panel__primary-button:focus-visible,
  .image-transfer-panel__icon-button:focus-visible,
  .image-transfer-panel__segments button:focus-visible,
  .image-transfer-panel select:focus-visible,
  .image-transfer-panel input:focus-visible {
    outline: 2px solid var(--transfer-focus);
    outline-offset: 1px;
  }

  .image-transfer-panel button:disabled,
  .image-transfer-panel select:disabled,
  .image-transfer-panel input:disabled {
    cursor: not-allowed;
    opacity: 0.32;
  }

  .image-transfer-panel__note,
  .image-transfer-panel__filename,
  .image-transfer-panel__error {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
  }

  .image-transfer-panel__note {
    color: var(--transfer-muted);
  }

  .image-transfer-panel__filename {
    overflow: hidden;
    color: var(--transfer-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .image-transfer-panel__filename strong {
    color: var(--transfer-ink);
    font-weight: 620;
  }

  .image-transfer-panel__error {
    color: #ff8a80;
  }

  .image-transfer-panel__field,
  .image-transfer-panel__color-field {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    color: var(--transfer-muted);
    font-size: 12px;
  }

  .image-transfer-panel__field select {
    width: 88px;
    height: 34px;
    padding: 0 9px;
    color: var(--transfer-ink);
    font: inherit;
    font-size: 12px;
    background: var(--transfer-control);
    border: 1px solid #454545;
    border-radius: 5px;
  }

  .image-transfer-panel__background {
    display: grid;
    gap: 4px;
    padding: 0;
    margin: 0;
    border: 0;
  }

  .image-transfer-panel__background legend {
    padding: 0;
    margin-bottom: 4px;
    color: var(--transfer-muted);
    font-size: 12px;
  }

  .image-transfer-panel__segments {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .image-transfer-panel__segments button {
    gap: 5px;
    height: 34px;
    padding: 0 8px;
    font-size: 12px;
  }

  .image-transfer-panel__segments button.is-active {
    color: #111111;
    background: #e6e6e6;
    border-color: #e6e6e6;
  }

  .image-transfer-panel__transparent-swatch {
    width: 16px;
    height: 16px;
    background: #171717 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6' viewBox='0 0 6 6'%3E%3Cpath fill='%23636363' d='M0 0h3v3H0zM3 3h3v3H3z'/%3E%3C/svg%3E") center / 6px 6px;
    border: 1px solid #565656;
    border-radius: 4px;
  }

  .image-transfer-panel__color-control {
    display: inline-flex;
    gap: 7px;
    align-items: center;
  }

  .image-transfer-panel__color-control input {
    width: 32px;
    height: 32px;
    padding: 2px;
    background: transparent;
    border: 1px solid #454545;
    border-radius: 5px;
    cursor: pointer;
  }

  .image-transfer-panel__color-control output {
    color: var(--transfer-ink);
    font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .image-transfer-panel__json-section {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }

  .image-transfer-panel__json-copy {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  .image-transfer-panel__json-copy > svg {
    flex: 0 0 auto;
    color: var(--transfer-muted);
  }

  .image-transfer-panel__icon-button {
    width: 34px;
    height: 34px;
  }

  .image-transfer-panel__busy {
    padding: 6px 8px;
    margin: 0;
    color: var(--transfer-ink);
    font-size: 12px;
    text-align: center;
    background: var(--transfer-control);
    border-top: 1px solid var(--transfer-line);
  }

  @media (max-width: 640px) {
    .image-transfer-panel {
      width: 100%;
    }
  }

  @media (forced-colors: active) {
    .image-transfer-panel__primary-button,
    .image-transfer-panel__icon-button,
    .image-transfer-panel__segments button {
      border-color: ButtonBorder;
    }

    .image-transfer-panel__segments button.is-active {
      color: HighlightText;
      background: Highlight;
    }
  }
</style>
