<template>
  <div style="display: flex; flex-direction: column; flex: 1; min-height: 0">
    <div class="pr-column-header">
      <h2 class="pr-column-title">{{ title }}</h2>
      <span class="pr-count">{{ prs.length }}</span>
    </div>
    <div
      ref="list"
      :class="['pr-list', { 'drop-over': dropOver }]"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <pr-item
        v-for="pr in prs"
        :key="pr.id"
        :pr="pr"
        :hidden-labels="hiddenLabels"
        :show-repo="showRepo"
        :async-version="asyncVersion"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-facing-decorator';

/** Single column of PR items with a header, count badge, and drag-and-drop support. */
@Component({ emits: ['drop'] })
export default class PrColumn extends Vue {

  @Prop() title!: string;
  @Prop() prs!: any[];
  @Prop({ default: () => new Set<string>() }) hiddenLabels!: Set<string>;
  @Prop() section!: string;
  @Prop() showRepo!: boolean;
  @Prop() asyncVersion!: number;

  dropOver = false;

  get listEl(): HTMLElement {
    return this.$refs.list as HTMLElement;
  }

  onDragStart(e: DragEvent) {
    const item = (e.target as HTMLElement).closest('.pr-item');
    if (item) item.classList.add('dragging');
    document.querySelectorAll('.pr-list').forEach(el => el.classList.add('drop-target'));
  }

  onDragEnd(e: DragEvent) {
    const item = (e.target as HTMLElement).closest('.pr-item');
    if (item) item.classList.remove('dragging');
    document.querySelectorAll('.pr-list').forEach(el => {
      el.classList.remove('drop-target', 'drop-over');
    });
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    this.dropOver = true;
    this.updateDropIndicator(e.clientY);
  }

  onDragLeave(e: DragEvent) {
    if (!this.listEl.contains(e.relatedTarget as Node)) {
      this.dropOver = false;
      this.removeIndicator();
    }
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dropOver = false;
    this.removeIndicator();
    document.querySelectorAll('.pr-list').forEach(el => {
      el.classList.remove('drop-target', 'drop-over');
    });
    const prId = e.dataTransfer!.getData('text/plain');
    const dropIdx = this.getDropIndex(e.clientY);
    this.$emit('drop', { prId, section: this.section, dropIdx });
  }

  getDropIndex(y: number): number {
    const items = [...this.listEl.querySelectorAll('.pr-item:not(.dragging)')];
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (y < rect.top + rect.height / 2) return i;
    }
    return items.length;
  }

  updateDropIndicator(y: number) {
    this.removeIndicator();
    const list = this.listEl;
    const items = [...list.querySelectorAll('.pr-item:not(.dragging)')];
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    const idx = this.getDropIndex(y);
    if (idx < items.length) {
      items[idx].before(indicator);
    } else {
      list.appendChild(indicator);
    }
  }

  removeIndicator() {
    if (this.listEl) {
      this.listEl.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    }
  }
}
</script>

<style>
.pr-list {
  width: 100%;
  padding: 0 12px;
  min-height: 60px;

  &.drop-target {
    min-height: 60px;
  }

  &.drop-over {
    background: rgba(56, 139, 253, 0.08);
    border-radius: var(--radius-sm);
    outline: 2px dashed var(--accent-blue);
    outline-offset: -2px;
  }

  &.drop-loading {
    opacity: 0.6;
    pointer-events: none;
  }
}

.drop-indicator {
  height: 2px;
  background: var(--accent-blue);
  border-radius: 1px;
  margin: 2px 0;
}

.pr-count {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
}
</style>
