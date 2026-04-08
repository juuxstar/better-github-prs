<template>
  <section class="screen">
    <div class="loading-container">
      <div class="spinner"></div>
      <p class="loading-text">Loading your pull requests...</p>
    </div>
  </section>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-facing-decorator'

/** Full-screen spinner shown while PR data is being fetched. */
@Component
export default class LoadingScreen extends Vue {}
</script>

<style>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 16px;
  padding: 80px 32px;
}

.loading-text {
  color: var(--text-secondary);
  font-size: 14px;
}
</style>
