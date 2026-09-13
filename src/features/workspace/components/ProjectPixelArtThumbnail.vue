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

const colorPaths = computed(() => {
  const size = normalizedSize.value;
  const paths = new Map<string, string[]>();

  for (let index = 0; index < Math.min(props.pixels.length, size * size); index += 1) {
    const color = props.pixels[index];
    if (!color) continue;

    const commands = paths.get(color) || [];
    commands.push(`M${index % size} ${Math.floor(index / size)}h1v1h-1z`);
    paths.set(color, commands);
  }

  return [...paths].map(([color, commands]) => ({
    color,
    path: commands.join(""),
  }));
});
</script>

<template>
  <svg
    :viewBox="`0 0 ${normalizedSize} ${normalizedSize}`"
    preserveAspectRatio="none"
    shape-rendering="crispEdges"
    aria-hidden="true"
    focusable="false"
  >
    <path
      v-for="entry in colorPaths"
      :key="entry.color"
      :d="entry.path"
      :fill="entry.color"
    />
  </svg>
</template>

<style scoped>
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
