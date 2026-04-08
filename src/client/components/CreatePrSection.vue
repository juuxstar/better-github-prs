<template>
	<div class="create-pr-section">
		<div class="pr-column-header">
			<h2 class="pr-column-title">Create PR</h2>
		</div>
		<div class="create-pr-body">
			<div class="create-pr-list">
				<div v-for="b in branches" :key="b.name" class="create-pr-row">
					<span class="create-pr-branch" :title="b.name">{{ b.name }}</span>
					<input class="create-pr-title-input" type="text" v-model="titles[b.name]">
					<button class="create-pr-btn" :disabled="creating[b.name]" @click="doCreate(b.name)">
						{{ creating[b.name] ? 'Creating...' : 'Create PR' }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import { Component, Prop, Watch, Vue } from 'vue-facing-decorator';

interface BranchEntry {
	name: string
	message: string
}

/** Lists recent branches and lets the user create a new PR from each one. */
@Component({ emits: ['create-pr'] })
export default class CreatePrSection extends Vue {

	@Prop() branches!: BranchEntry[];

	titles: Record<string, string> = {};
	creating: Record<string, boolean> = {};

	@Watch('branches', { immediate: true })
	onBranchesChange(branches: BranchEntry[]) {
		const titles: Record<string, string> = {};
		for (const b of branches) {
			titles[b.name] = this.titles[b.name] || b.message || this.humanizeBranch(b.name);
		}
		this.titles = titles;
		this.creating = {};
	}

	humanizeBranch(name: string): string {
		return name.replace(/[-_/]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
	}

	doCreate(branch: string) {
		const title = (this.titles[branch] || '').trim();
		if (!title) return;
		this.creating = { ...this.creating, [branch]: true };
		this.$emit('create-pr', { branch, title });
	}
}
</script>

<style>
.create-pr-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-bottom: 16px;
  flex: 0 0 auto;
}

.create-pr-body {
  padding: 8px 12px;
}

.create-pr-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.create-pr-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);

  &:last-child {
    border-bottom: none;
  }
}

.create-pr-branch {
  font-size: 13px;
  font-weight: 500;
  color: var(--accent-blue);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}

.create-pr-title-input {
  flex: 2;
  padding: 4px 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color var(--transition);

  &:focus {
    border-color: var(--accent-blue);
  }
}

.create-pr-btn {
  flex-shrink: 0;
  padding: 4px 10px;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background var(--transition);

  &:hover {
    background: var(--btn-primary-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
