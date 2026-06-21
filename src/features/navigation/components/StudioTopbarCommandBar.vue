<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    searchAriaLabel?: string;
    buttonLabel?: string;
    buttonAriaLabel?: string;
    buttonDisabled?: boolean;
  }>(),
  {
    placeholder: "Search",
    searchAriaLabel: "Search",
    buttonLabel: "New",
    buttonAriaLabel: "",
    buttonDisabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "new-click": [];
}>();

const updateSearch = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
};
</script>

<template>
  <div class="studio-command-bar">
    <label class="studio-search">
      <span class="studio-search__icon" aria-hidden="true"></span>
      <input
        :value="modelValue"
        type="search"
        :placeholder="placeholder"
        :aria-label="searchAriaLabel"
        @input="updateSearch"
      />
    </label>

    <button
      class="studio-command-bar__new"
      type="button"
      :aria-label="buttonAriaLabel || buttonLabel"
      :disabled="buttonDisabled"
      @click="emit('new-click')"
    >
      {{ buttonLabel }}
    </button>
  </div>
</template>

<style scoped>
  .studio-command-bar {
    display: grid;
    grid-template-columns: minmax(220px, 560px) auto;
    gap: 14px;
    align-items: center;
    justify-self: center;
    width: min(100%, 660px);
    min-width: 0;
  }

  .studio-search {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .studio-search__icon {
    position: absolute;
    left: 17px;
    width: 15px;
    height: 15px;
    border: 2px solid var(--quiet);
    border-radius: 999px;
    pointer-events: none;
  }

  .studio-search__icon::after {
    position: absolute;
    right: -5px;
    bottom: -4px;
    width: 7px;
    height: 2px;
    content: "";
    background: var(--quiet);
    border-radius: 999px;
    transform: rotate(45deg);
  }

  .studio-search input {
    width: 100%;
    min-width: 0;
    height: 44px;
    padding: 0 18px 0 44px;
    color: var(--text);
    background: rgba(255, 252, 244, 0.05);
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    outline: none;
    transition:
      border-color 180ms ease,
      background 180ms ease,
      box-shadow 180ms ease;
  }

  .studio-search input:focus {
    background: rgba(255, 252, 244, 0.075);
    border-color: rgba(247, 241, 231, 0.72);
    box-shadow: 0 0 0 3px rgba(247, 241, 231, 0.1);
  }

  .studio-search input::placeholder {
    color: var(--quiet);
  }

  .studio-command-bar__new {
    min-height: 40px;
    padding: 0 16px;
    color: #07100b;
    background: var(--mint);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 8px;
    box-shadow: 0 12px 34px rgba(94, 168, 113, 0.17);
    cursor: pointer;
    transition:
      transform 180ms ease,
      border-color 180ms ease,
      background 180ms ease,
      box-shadow 180ms ease;
  }

  .studio-command-bar__new:hover {
    transform: translateY(-1px);
    box-shadow: 0 16px 40px rgba(94, 168, 113, 0.24);
  }

  .studio-command-bar__new:disabled {
    cursor: not-allowed;
    filter: grayscale(0.4);
    opacity: 0.62;
    transform: none;
  }

  @media (max-width: 820px) {
    .studio-command-bar {
      grid-template-columns: minmax(0, 1fr) auto;
      justify-self: stretch;
      width: 100%;
    }
  }

  @media (max-width: 520px) {
    .studio-command-bar {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      overflow: visible;
    }

    .studio-search {
      min-width: 0;
    }

    .studio-search input {
      height: 40px;
      padding-left: 40px;
      font-size: 0.88rem;
      background: rgba(5, 5, 5, 0.94);
      border-color: rgba(255, 252, 244, 0.2);
    }

    .studio-search__icon {
      z-index: 1;
      left: 14px;
      width: 14px;
      height: 14px;
    }

    .studio-command-bar__new {
      min-width: 60px;
      min-height: 40px;
      padding: 0 12px;
    }
  }

  @media (max-width: 380px) {
    .studio-command-bar {
      grid-template-columns: minmax(0, 1fr) 56px;
    }

    .studio-command-bar__new {
      min-width: 0;
      padding: 0 7px;
    }
  }
</style>
