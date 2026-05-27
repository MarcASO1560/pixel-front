<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { WORKSPACE_TRANSITION_STORAGE_KEY } from "../../../lib/routeTransition";
import GameOfLife from "../../life-background/components/GameOfLife.vue";

const props = withDefaults(
  defineProps<{
    active?: boolean;
    phase?: "exit" | "entry";
  }>(),
  {
    active: false,
    phase: "exit",
  },
);

const isRendered = ref(false);
const isVisible = ref(false);
const isLeaving = ref(false);
let leaveTimer = 0;

const show = async (options: { instant?: boolean } = {}) => {
  window.clearTimeout(leaveTimer);
  isLeaving.value = false;
  isVisible.value = options.instant === true;
  isRendered.value = true;
  await nextTick();

  if (options.instant) {
    window.requestAnimationFrame(() => {
      document.documentElement.classList.remove("route-transition-pending");
    });
    return;
  }

  window.requestAnimationFrame(() => {
    isVisible.value = true;
    document.documentElement.classList.remove("route-transition-pending");
  });
};

const hide = () => {
  document.documentElement.classList.remove("route-transition-pending");
  isLeaving.value = true;
  isVisible.value = false;
  leaveTimer = window.setTimeout(() => {
    isRendered.value = false;
    isLeaving.value = false;
  }, 620);
};

const waitForWorkspacePaint = async () => {
  if (document.readyState !== "complete") {
    await new Promise<void>((resolve) => {
      window.addEventListener("load", () => resolve(), { once: true });
    });
  }

  await document.fonts?.ready.catch(() => undefined);
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
  await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
};

watch(
  () => props.active,
  (active) => {
    if (props.phase !== "exit") {
      return;
    }

    if (active) {
      void show();
    }
  },
);

onMounted(async () => {
  if (props.phase !== "entry") {
    return;
  }

  if (window.sessionStorage.getItem(WORKSPACE_TRANSITION_STORAGE_KEY) !== "pending") {
    return;
  }

  window.sessionStorage.removeItem(WORKSPACE_TRANSITION_STORAGE_KEY);
  await show({ instant: true });
  await waitForWorkspacePaint();
  hide();
});

onBeforeUnmount(() => {
  window.clearTimeout(leaveTimer);
});
</script>

<template>
  <div
    v-if="isRendered"
    class="workspace-loading-transition"
    :class="{ 'is-visible': isVisible, 'is-leaving': isLeaving }"
    role="status"
    aria-label="Loading workspace"
  >
    <GameOfLife variant="travelers" />
  </div>
</template>

<style scoped>
.workspace-loading-transition {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: #000;
  color: rgba(255, 252, 255, 0.92);
  opacity: 0;
  pointer-events: auto;
  transition: opacity 260ms ease-out;
}

.workspace-loading-transition.is-visible {
  opacity: 1;
}

.workspace-loading-transition.is-leaving {
  transition-duration: 560ms;
  transition-timing-function: ease-in-out;
}

.workspace-loading-transition :deep(.life-stage) {
  position: absolute;
  z-index: 0;
  background: #000;
  transform: scale(1.24) rotate(0deg);
  animation: loading-life-spin 5.4s linear infinite;
}

.workspace-loading-transition :deep(.life-board) {
  filter: none;
}

@keyframes loading-life-spin {
  to {
    transform: scale(1.24) rotate(360deg);
  }
}
</style>
