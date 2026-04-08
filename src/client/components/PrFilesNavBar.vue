<template>
  <nav class="pr-files-nav-bar">
    <button
      class="pr-files-nav-btn pr-files-nav-btn-skip has-tooltip"
      :disabled="prevUnviewedIndex === -1"
      @click="currentIndex = prevUnviewedIndex"
      data-tooltip="Skip to previous unviewed file &#10;Shortcut: ←"
    >
      &laquo;
    </button>
    <button
      class="pr-files-nav-btn has-tooltip"
      :disabled="currentIndex <= 0"
      @click="currentIndex--"
      data-tooltip="Go to previous file"
    >
      &lt;
    </button>
    <button
      class="pr-files-nav-viewed-btn has-tooltip"
      :class="{ checked: isCurrentFileViewed }"
      @click="emit('toggleViewed')"
      data-tooltip="Mark file as viewed/unviewed &#10;Shortcut: Space"
    >
      ✓
    </button>
    <div class="pr-files-dropdown" :class="{ 'file-viewed': isCurrentFileViewed }">
      <button
        ref="dropdownTriggerRef"
        class="pr-files-dropdown-trigger has-tooltip"
        data-tooltip="Click to browse all changed files"
        @click="onDropdownTriggerClick"
      >
        <span :class="['file-status-icon', 'file-status-' + currentFile.status]">{{ fileStatusSymbol(currentFile.status) }}</span>
        <span class="pr-files-dropdown-filename">{{ currentFile.filename }}</span>
      </button>
      <ul
        v-if="dropdownOpen"
        class="pr-files-dropdown-list"
        :style="dropdownListMaxHeightPx != null ? { maxHeight: `${dropdownListMaxHeightPx}px` } : undefined"
      >
        <li
          v-for="(file, i) in files"
          :key="file.filename"
          :class="['pr-files-dropdown-item', { active: i === currentIndex }]"
          @click="currentIndex = i; dropdownOpen = false"
        >
          <span class="pr-files-dropdown-viewed" :class="{ checked: viewedFiles[file.filename] === 'VIEWED' }">✓</span>
          <span :class="['file-status-icon', 'file-status-' + file.status]">{{ fileStatusSymbol(file.status) }}</span>
          <span class="pr-files-dropdown-item-name">{{ file.previous_filename ? file.previous_filename + ' → ' : '' }}{{ file.filename }}</span>
          <span class="pr-files-dropdown-item-stats">
            <span class="pr-files-dropdown-item-add">+{{ file.additions }}</span>
            <span class="pr-files-dropdown-item-del">&minus;{{ file.deletions }}</span>
          </span>
        </li>
      </ul>
    </div>
    <button
      class="pr-files-nav-viewed-btn has-tooltip"
      :class="{ checked: isCurrentFileViewed }"
      @click="emit('toggleViewed')"
      data-tooltip="Mark file as viewed/unviewed &#10;Shortcut: Space"
    >
      ✓
    </button>
    <button
      class="pr-files-nav-btn has-tooltip"
      :disabled="currentIndex >= files.length - 1"
      @click="currentIndex++"
      data-tooltip="Go to next file"
    >
      &gt;
    </button>
    <button
      class="pr-files-nav-btn pr-files-nav-btn-skip has-tooltip"
      :disabled="nextUnviewedIndex === -1"
      @click="currentIndex = nextUnviewedIndex"
      data-tooltip="Skip to next unviewed file &#10;Shortcut: →"
    >
      &raquo;
    </button>
    <span class="pr-files-nav-counter">{{ currentIndex + 1 }}/{{ files.length }}</span>
    <span class="pr-files-nav-stats">
      <span class="pr-files-nav-add">+{{ currentFile.additions }}</span>
      <span class="pr-files-nav-del">&minus;{{ currentFile.deletions }}</span>
    </span>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PRFile } from '@/lib/githubClient';
import '@/styles/pr-diff.css';

const props = defineProps<{
  files: PRFile[];
  viewedFiles: Record<string, string>;
}>();

const currentIndex = defineModel<number>('currentIndex', { required: true });

const emit = defineEmits<{ toggleViewed: [] }>();

const dropdownOpen = ref(false);
const dropdownTriggerRef = ref<HTMLButtonElement | null>(null);
/** Measured space from list top to bottom of viewport (px); null while closed / before measure */
const dropdownListMaxHeightPx = ref<number | null>(null);

const DROPDOWN_LIST_BOTTOM_MARGIN = 8;
const DROPDOWN_LIST_MIN_HEIGHT = 120;

function updateDropdownListMaxHeight() {
  if (!dropdownOpen.value) return;
  const btn = dropdownTriggerRef.value;
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const vv = window.visualViewport;
  const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const available = visibleBottom - rect.bottom - DROPDOWN_LIST_BOTTOM_MARGIN;
  dropdownListMaxHeightPx.value = Math.max(DROPDOWN_LIST_MIN_HEIGHT, available);
}

function onDropdownTriggerClick() {
  dropdownOpen.value = !dropdownOpen.value;
  if (dropdownOpen.value) {
    void nextTick(() => updateDropdownListMaxHeight());
  }
}

watch(dropdownOpen, (open) => {
  if (!open) dropdownListMaxHeightPx.value = null;
});

const currentFile = computed(() => props.files[currentIndex.value] ?? props.files[0]);

const isCurrentFileViewed = computed(() => props.viewedFiles[currentFile.value?.filename] === 'VIEWED');

function fileStatusSymbol(status: string): string {
  const map: Record<string, string> = { added: '+', removed: '−', modified: '●', renamed: '→', copied: '⊕' };
  return map[status] || status[0]?.toUpperCase() || '?';
}

function findUnviewedFile(direction: 1 | -1): number {
  const len = props.files.length;
  const idx0 = currentIndex.value;
  for (let offset = 1; offset < len; offset++) {
    const idx = (idx0 + direction * offset + len) % len;
    if (props.viewedFiles[props.files[idx].filename] !== 'VIEWED') return idx;
  }
  const next = idx0 + direction;
  if (next >= 0 && next < len) return next;
  return -1;
}

const prevUnviewedIndex = computed(() => findUnviewedFile(-1));
const nextUnviewedIndex = computed(() => findUnviewedFile(1));

const _keyHandler = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (dropdownOpen.value) {
      e.preventDefault();
      e.stopPropagation();
      dropdownOpen.value = false;
    }
    return;
  }
  if (dropdownOpen.value) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const idx = findUnviewedFile(-1);
    if (idx !== -1) currentIndex.value = idx;
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    const idx = findUnviewedFile(1);
    if (idx !== -1) currentIndex.value = idx;
  } else if (e.key === ' ') {
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button') return;
    e.preventDefault();
    emit('toggleViewed');
  }
};

const _clickOutsideHandler = (e: MouseEvent) => {
  if (!dropdownOpen.value) return;
  const target = e.target as HTMLElement | null;
  if (target && !target.closest('.pr-files-dropdown')) dropdownOpen.value = false;
};

const _resizeHandler = () => updateDropdownListMaxHeight();

onMounted(() => {
  window.addEventListener('keydown', _keyHandler);
  document.addEventListener('mousedown', _clickOutsideHandler);
  window.addEventListener('resize', _resizeHandler);
  window.visualViewport?.addEventListener('resize', _resizeHandler);
  window.visualViewport?.addEventListener('scroll', _resizeHandler);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', _keyHandler);
  document.removeEventListener('mousedown', _clickOutsideHandler);
  window.removeEventListener('resize', _resizeHandler);
  window.visualViewport?.removeEventListener('resize', _resizeHandler);
  window.visualViewport?.removeEventListener('scroll', _resizeHandler);
});
</script>

<style scoped>
.pr-files-nav-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 8px;
  font-size: 13px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  position: sticky;
  top: 0;
  z-index: 5;
  flex-shrink: 0;
}

.pr-files-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 15px;
  font-family: inherit;
  padding: 0;
  flex-shrink: 0;
}

.pr-files-nav-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.pr-files-nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.pr-files-nav-btn-skip {
  font-size: 17px;
  font-weight: 700;
}

.pr-files-nav-viewed-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--border);
  background: transparent;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.pr-files-nav-viewed-btn:hover {
  border-color: var(--accent-green);
  color: var(--accent-green);
  background: var(--accent-green-faint-bg);
}

.pr-files-nav-viewed-btn.checked {
  border-color: var(--accent-green);
  color: var(--accent-green);
  background: var(--accent-green-selected-bg);
}

.pr-files-dropdown {
  position: relative;
  flex: 1;
  min-width: 0;
}

.pr-files-dropdown.file-viewed {
  border: 2px solid var(--accent-green);
  border-radius: var(--radius-sm);
  background: var(--accent-green-selected-bg);
  box-sizing: border-box;
}

.pr-files-dropdown.file-viewed .pr-files-dropdown-trigger {
  border-color: transparent;
  background: var(--bg-primary);
}

.pr-files-dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  cursor: pointer;
  text-align: left;
}

.pr-files-dropdown-filename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  text-align: center;
}

.pr-files-dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  /* Fallback before first layout measure; inline maxHeight overrides when open */
  max-height: calc(100dvh - 120px);
  overflow-y: auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  margin-top: 2px;
  padding: 4px 0;
  z-index: 50;
  list-style: none;
}

.pr-files-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  color: var(--text-primary);
}

.pr-files-dropdown-item:hover {
  background: var(--bg-tertiary);
}

.pr-files-dropdown-item.active {
  background: var(--bg-tertiary);
  font-weight: 600;
}

.pr-files-dropdown-viewed {
  font-size: 16px;
  width: 20px;
  text-align: center;
  color: transparent;
  flex-shrink: 0;
}

.pr-files-dropdown-viewed.checked {
  color: var(--accent-green);
}

.pr-files-dropdown-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.pr-files-dropdown-item-stats {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  margin-left: 8px;
}

.pr-files-dropdown-item-add {
  color: var(--accent-green);
}

.pr-files-dropdown-item-del {
  color: var(--accent-red);
}

.file-status-icon {
  font-size: 14px;
  font-weight: 700;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.pr-files-nav-counter {
  color: var(--text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}

.pr-files-nav-stats {
  display: flex;
  gap: 6px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  white-space: nowrap;
  flex-shrink: 0;
}

.pr-files-nav-add {
  color: var(--accent-green);
}

.pr-files-nav-del {
  color: var(--accent-red);
}

.has-tooltip {
  position: relative;
}

.has-tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 10px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  font-weight: 400;
  line-height: 1.4;
  white-space: pre;
  border-radius: 6px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 100;
}

.has-tooltip:hover::after {
  opacity: 1;
}

.has-tooltip:disabled::after {
  display: none;
}
</style>
