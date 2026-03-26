<template>
  <header class="header">
    <div class="header-left">
      <span class="logo" v-html="$icon('github', 24)"></span>
      <h1 class="title">PR Dashboard</h1>
      <select class="repo-select" :value="currentRepo" @change="onRepoChange">
        <option value="">All repositories</option>
        <option v-for="repo in repos" :key="repo" :value="repo">{{ repo }}</option>
      </select>
      <div class="type-filters">
        <button :class="['type-filter-btn', { active: currentTypeFilter === 'ready' }]" @click="$emit('set-type-filter', 'ready')">Ready</button>
        <button :class="['type-filter-btn', { active: currentTypeFilter === 'draft' }]" @click="$emit('set-type-filter', 'draft')">Draft</button>
      </div>
      <button
        v-if="user"
        :class="['btn-refresh', { spinning: refreshing }]"
        title="Refresh"
        @click="$emit('refresh')"
        v-html="refreshBtnHtml"
      ></button>
    </div>
    <div class="header-right">
      <select class="repo-select" :value="selectedTeam" @change="onTeamChange">
        <option value="alpha">Alpha Team</option>
        <option value="beta">Beta Team</option>
        <option value="gamma">Gamma Team</option>
      </select>
      <template v-if="user">
        <div class="user-info">
          <img class="avatar" :src="user.avatar_url" :alt="user.login">
          <span class="username">{{ user.login }}</span>
        </div>
        <button class="btn-logout" @click="$emit('logout')">Sign out</button>
      </template>
    </div>
  </header>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-facing-decorator';
import { iconSvg } from '@/lib/icons';

/** Top navigation bar with repo/team selectors, type filters, refresh, and user info. */
@Component({ emits: ['set-type-filter', 'set-repo', 'set-team', 'refresh', 'logout'] })
export default class AppHeader extends Vue {
  @Prop() user!: Record<string, unknown> | null;
  @Prop() repos!: string[];
  @Prop() currentRepo!: string;
  @Prop() currentTypeFilter!: string;
  @Prop() selectedTeam!: string;
  @Prop() refreshing!: boolean;

  get refreshBtnHtml(): string {
    return iconSvg('refresh', 14);
  }

  onRepoChange(e: Event) {
    this.$emit('set-repo', (e.target as HTMLSelectElement).value);
  }

  onTeamChange(e: Event) {
    this.$emit('set-team', (e.target as HTMLSelectElement).value);
  }
}
</script>

<style>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  color: var(--text-primary);
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.repo-select {
  margin-left: 16px;
  padding: 5px 28px 5px 10px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='%238b949e'%3E%3Cpath d='M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: all var(--transition);
}

.repo-select:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.repo-select:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 1px var(--accent-blue);
}

.repo-select option {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.type-filters {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 16px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  padding: 2px;
  border: 1px solid var(--border);
}

.type-filter-btn {
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}

.type-filter-btn:hover {
  color: var(--text-secondary);
}

.type-filter-btn.active {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--border);
}

.username {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.btn-logout {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}

.btn-logout:hover {
  color: var(--accent-red);
  border-color: var(--accent-red);
  background: rgba(248, 81, 73, 0.1);
}

.btn-refresh {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
  margin-left: 8px;
}

.btn-refresh:hover {
  color: var(--text-primary);
  border-color: var(--border-hover);
  background: var(--bg-tertiary);
}

.btn-refresh.spinning svg {
  animation: spin 0.8s linear infinite;
}
</style>
