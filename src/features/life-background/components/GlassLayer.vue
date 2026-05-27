<template>
  <section class="glass-layer" aria-hidden="true">
    <div class="glass-sheet"></div>
  </section>
</template>

<style scoped>
.glass-layer {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.glass-sheet {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.015);
  backdrop-filter: blur(8px);
}
</style>
