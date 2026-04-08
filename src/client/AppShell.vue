<template>
  <router-view />
</template>

<script lang="ts">
import { Component, Vue } from 'vue-facing-decorator';

/** Root shell that renders the active route via vue-router. */
@Component
export default class AppShell extends Vue {}
</script>
