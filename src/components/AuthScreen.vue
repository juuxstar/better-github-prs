<template>
  <section class="screen">
    <div class="auth-container">
      <div class="auth-icon" v-html="$icon('github', 48)"></div>
      <h2 class="auth-title">Sign in with GitHub</h2>
      <p class="auth-description">Authenticate to view your open pull requests across all repositories.</p>
      <button
        class="btn btn-primary btn-lg"
        @click="$emit('login')"
        :disabled="disabled"
        v-html="buttonHtml"
      ></button>
    </div>
  </section>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-facing-decorator';
import { iconSvg } from '@/lib/icons';

/** Sign-in screen that prompts the user to authenticate via GitHub OAuth. */
@Component({ emits: ['login'] })
export default class AuthScreen extends Vue {
  @Prop() disabled!: boolean;

  get buttonHtml(): string {
    return this.disabled ? 'Starting...' : iconSvg('github', 18) + ' Sign in with GitHub';
  }
}
</script>

<style>
.auth-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 32px;
  text-align: center;
  flex: 1;
}

.auth-icon {
  color: var(--text-secondary);
  margin-bottom: 24px;
  opacity: 0.6;
}

.auth-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--text-primary);
}

.auth-description {
  color: var(--text-secondary);
  font-size: 15px;
  margin-bottom: 32px;
  max-width: 360px;
  line-height: 1.6;
}
</style>
