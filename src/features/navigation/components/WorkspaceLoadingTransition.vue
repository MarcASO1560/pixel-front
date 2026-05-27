<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { WORKSPACE_TRANSITION_STORAGE_KEY } from "../../../lib/routeTransition";

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
const WORKSPACE_ENTRY_MINIMUM_MS = 2000;

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

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

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
  const startedAt = performance.now();
  await show({ instant: true });
  await waitForWorkspacePaint();
  await wait(Math.max(0, WORKSPACE_ENTRY_MINIMUM_MS - (performance.now() - startedAt)));
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
    <div class="pixel-loader" aria-hidden="true">
      <span class="pixel-loader-core"></span>
    </div>
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

.pixel-loader {
  --pixel-size: clamp(7px, 1.2vw, 12px);
  position: relative;
  z-index: 0;
  display: grid;
  place-items: center;
  width: calc(var(--pixel-size) * 13);
  height: calc(var(--pixel-size) * 13);
  filter: drop-shadow(0 0 18px rgba(226, 247, 237, 0.18));
}

.pixel-loader::before,
.pixel-loader::after {
  position: absolute;
  content: "";
  inset: calc(var(--pixel-size) * 2);
  border: var(--pixel-size) solid rgba(255, 252, 255, 0.035);
  image-rendering: pixelated;
  animation: pixel-loader-frame 1.8s steps(4, end) infinite;
}

.pixel-loader::after {
  inset: calc(var(--pixel-size) * 3);
  border-color: rgba(213, 244, 225, 0.045);
  animation-delay: -0.45s;
}

.pixel-loader-core {
  --pixel-a: rgba(255, 252, 244, 0.96);
  --pixel-b: rgba(223, 249, 232, 0.82);
  --pixel-c: rgba(238, 218, 246, 0.72);
  position: relative;
  display: block;
  width: var(--pixel-size);
  height: var(--pixel-size);
  background: var(--pixel-a);
  image-rendering: pixelated;
  box-shadow:
    0 calc(var(--pixel-size) * -4) var(--pixel-a),
    calc(var(--pixel-size) * 3) calc(var(--pixel-size) * -3) var(--pixel-b),
    calc(var(--pixel-size) * 4) 0 rgba(223, 249, 232, 0.55),
    calc(var(--pixel-size) * 3) calc(var(--pixel-size) * 3) rgba(238, 218, 246, 0.42),
    0 calc(var(--pixel-size) * 4) rgba(255, 252, 244, 0.34),
    calc(var(--pixel-size) * -3) calc(var(--pixel-size) * 3) rgba(238, 218, 246, 0.48),
    calc(var(--pixel-size) * -4) 0 var(--pixel-c),
    calc(var(--pixel-size) * -3) calc(var(--pixel-size) * -3) var(--pixel-b);
  transform-origin: 50% 50%;
  animation:
    pixel-loader-spin 1.05s steps(8, end) infinite,
    pixel-loader-pulse 1.8s ease-in-out infinite;
}

.pixel-loader-core::before {
  position: absolute;
  inset: calc(var(--pixel-size) * -1);
  content: "";
  border: var(--pixel-size) solid rgba(255, 252, 255, 0.08);
  opacity: 0.8;
  image-rendering: pixelated;
  animation: pixel-loader-scan 1.05s steps(8, end) infinite;
}

@keyframes pixel-loader-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pixel-loader-pulse {
  0%,
  100% {
    filter: brightness(0.9);
  }

  50% {
    filter: brightness(1.18);
  }
}

@keyframes pixel-loader-scan {
  0%,
  100% {
    border-color: rgba(255, 252, 255, 0.1);
  }

  50% {
    border-color: rgba(223, 249, 232, 0.22);
  }
}

@keyframes pixel-loader-frame {
  0%,
  100% {
    opacity: 0.36;
    transform: scale(1);
  }

  50% {
    opacity: 0.68;
    transform: scale(1.04);
  }
}
</style>
