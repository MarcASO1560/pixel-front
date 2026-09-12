<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    pixels: ReadonlyArray<string | null>;
    size?: number;
  }>(),
  {
    size: 16,
  },
);

const normalizedSize = computed(() =>
  Number.isFinite(props.size) ? Math.max(1, Math.floor(props.size)) : 16,
);

const visiblePixels = computed(() =>
  props.pixels
    .slice(0, normalizedSize.value * normalizedSize.value)
    .map((color, index) => ({
      color,
      x: index % normalizedSize.value,
      y: Math.floor(index / normalizedSize.value),
    }))
    .filter((pixel): pixel is { color: string; x: number; y: number } => Boolean(pixel.color)),
);
</script>

<template>
  <svg
    :viewBox="`0 0 ${normalizedSize} ${normalizedSize}`"
    preserveAspectRatio="none"
    shape-rendering="crispEdges"
    aria-hidden="true"
    focusable="false"
  >
    <rect
      v-for="pixel in visiblePixels"
      :key="`${pixel.x}-${pixel.y}`"
      :x="pixel.x"
      :y="pixel.y"
      width="1"
      height="1"
      :fill="pixel.color"
    />
  </svg>
</template>

<style scoped>
  svg {
    display: block;
    overflow: hidden;
    image-rendering: pixelated;
  }
</style>
