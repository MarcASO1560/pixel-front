<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";

import type { PixelColor } from "../types";

const props = defineProps<{
  pixels: PixelColor[];
  width: number;
  height: number;
  opacity: number;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

const renderThumbnail = () => {
  const canvas = canvasRef.value;
  const width = Math.max(1, Math.floor(props.width));
  const height = Math.max(1, Math.floor(props.height));
  if (!canvas) return;

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;

  context.imageSmoothingEnabled = false;
  const imageData = context.createImageData(width, height);
  const layerOpacity = Math.min(1, Math.max(0, props.opacity));
  const pixelCount = Math.min(props.pixels.length, width * height);

  for (let index = 0; index < pixelCount; index += 1) {
    const color = props.pixels[index];
    if (!color) continue;

    const hex = color.slice(1);
    const dataIndex = index * 4;
    imageData.data[dataIndex] = Number.parseInt(hex.slice(0, 2), 16);
    imageData.data[dataIndex + 1] = Number.parseInt(hex.slice(2, 4), 16);
    imageData.data[dataIndex + 2] = Number.parseInt(hex.slice(4, 6), 16);
    const pixelOpacity = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
    imageData.data[dataIndex + 3] = Math.round(255 * pixelOpacity * layerOpacity);
  }

  context.putImageData(imageData, 0, 0);
};

watch(
  () => [props.pixels, props.width, props.height, props.opacity] as const,
  () => void nextTick(renderThumbnail),
  { flush: "post" },
);

onMounted(renderThumbnail);
</script>

<template>
  <canvas ref="canvasRef" aria-hidden="true"></canvas>
</template>

<style scoped>
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
  }
</style>
