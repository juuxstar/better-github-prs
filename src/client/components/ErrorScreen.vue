<template>
  <section class="screen">
    <div class="error-container">
      <div class="error-icon">!</div>
      <p class="error-text">{{ message }}</p>
      <button class="btn btn-secondary" @click="$emit('retry')">Try Again</button>
    </div>
  </section>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-facing-decorator';

/** Full-screen error display with a retry button. */
@Component({ emits: ['retry'] })
export default class ErrorScreen extends Vue {
  @Prop() message!: string;
}
</script>

<style>
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 80px 32px;
  text-align: center;
  gap: 16px;
}

.error-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--danger-btn-bg);
  color: var(--accent-red);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
}

.error-text {
  color: var(--text-secondary);
  font-size: 15px;
  max-width: 400px;
}
</style>
