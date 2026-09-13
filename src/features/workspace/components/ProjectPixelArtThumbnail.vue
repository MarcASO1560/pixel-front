<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

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

const canvasRef = ref<HTMLCanvasElement | null>(null);

const renderThumbnail = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const size = normalizedSize.value;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) return;

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, size, size);

  for (const pixel of visiblePixels.value) {
    context.fillStyle = pixel.color;
    context.fillRect(pixel.x, pixel.y, 1, 1);
  }
};

watch([normalizedSize, visiblePixels], renderThumbnail, { flush: "post" });
onMounted(renderThumbnail);
</script>

<template>
  <canvas
    ref="canvasRef"
    :width="normalizedSize"
    :height="normalizedSize"
    aria-hidden="true"
  ></canvas>
</template>

<style scoped>
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    image-rendering: pixelated;
  }
</style>
