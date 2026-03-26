<template>
  <div class="rate-limit-banner" v-show="visible">
    <span v-html="$icon('warning', 16)"></span>
    <span>{{ message }}</span>
    <button class="rate-limit-dismiss" title="Dismiss" @click="$emit('dismiss')">×</button>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-facing-decorator'

/** Dismissible warning banner shown when the GitHub API rate limit is exceeded. */
@Component({ emits: ['dismiss'] })
export default class RateLimitBanner extends Vue {
  @Prop() visible!: boolean
  @Prop() message!: string
}
</script>

<style>
.rate-limit-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 24px;
  background: rgba(248, 81, 73, 0.15);
  border-bottom: 1px solid var(--accent-red, #f85149);
  color: var(--accent-red, #f85149);
  font-size: 13px;
  font-weight: 500;
  position: sticky;
  top: 50px;
  z-index: 99;
}

.rate-limit-banner svg {
  flex-shrink: 0;
}

.rate-limit-banner span {
  flex: 1;
}

.rate-limit-dismiss {
  background: none;
  border: none;
  color: var(--accent-red, #f85149);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  opacity: 0.7;
}

.rate-limit-dismiss:hover {
  opacity: 1;
}
</style>
