<template>
  <section class="screen">
    <div
      class="u-flex u-flex-col u-items-center u-justify-center u-flex-1 u-gap-4 u-p-screen"
    >
      <div class="spinner"></div>
      <p class="u-text-secondary">Loading your pull requests...</p>
    </div>
  </section>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-facing-decorator';

/** Full-screen spinner shown while PR data is being fetched. */
@Component
export default class LoadingScreen extends Vue {}
</script>
