<template>
  <div class="pr-files-tab" :style="{ '--tab-size': tabSize }">
    <div v-if="filesLoading" class="pr-detail-loading">
      <div class="spinner"></div>
      <p>Loading files...</p>
    </div>

    <template v-else-if="files.length">
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
          @click="toggleViewed"
          data-tooltip="Mark file as viewed/unviewed &#10;Shortcut: Space"
        >
          ✓
        </button>
        <div class="pr-files-dropdown" ref="filesDropdown">
          <button class="pr-files-dropdown-trigger has-tooltip" data-tooltip="Click to browse all changed files" @click="dropdownOpen = !dropdownOpen">
            <span :class="['file-status-icon', 'file-status-' + currentFile.status]">{{ fileStatusSymbol(currentFile.status) }}</span>
            <span class="pr-files-dropdown-filename">{{ currentFile.filename }}</span>
          </button>
          <ul v-if="dropdownOpen" class="pr-files-dropdown-list">
            <li
              v-for="(file, i) in files"
              :key="file.filename"
              :class="['pr-files-dropdown-item', { active: i === currentIndex }]"
              @click="currentIndex = i; dropdownOpen = false"
            >
              <span class="pr-files-dropdown-viewed" :class="{ checked: viewedFiles[file.filename] === 'VIEWED' }">✓</span>
              <span :class="['file-status-icon', 'file-status-' + file.status]">{{ fileStatusSymbol(file.status) }}</span>
              <span class="pr-files-dropdown-item-name">{{ file.previous_filename ? file.previous_filename + ' → ' : '' }}{{ file.filename }}</span>
            </li>
          </ul>
        </div>
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

      <div v-if="contentLoading" class="pr-diff-content-loading">
        <span class="async-loader"></span> Loading file contents...
      </div>

      <div v-else-if="hasFullContent" class="pr-diff-viewer" :class="{ 'pr-diff-viewer-split': !isAddedOrRemoved }">
        <template v-if="isAddedOrRemoved">
          <div class="pr-diff-panel-full" :class="currentFile.status === 'removed' ? 'pr-diff-panel-full-del' : ''">
            <table class="pr-diff-table">
              <tr
                v-for="(line, i) in singlePanelLines"
                :key="i"
                :class="'pr-diff-row pr-diff-row-' + line.type"
              >
                <td
                  class="pr-diff-gutter gutter-commentable"
                  :class="{ 'has-comment': hasAnyCommentAt(line.num, singlePanelSide) }"
                  @click="onGutterClick(line, singlePanelSide, $event)"
                >
                  {{ line.num ?? '' }}
                  <span v-if="hasAnyCommentAt(line.num, singlePanelSide)" class="gutter-dot" :class="commentDotClass(line.num, singlePanelSide)"></span>
                  <span v-else-if="line.num != null" class="gutter-add">+</span>
                </td>
                <td class="pr-diff-code"><pre v-if="line.html" v-html="line.html"></pre><pre v-else>{{ line.content }}</pre></td>
              </tr>
            </table>
          </div>
        </template>

        <template v-else>
          <div class="pr-diff-split" @wheel.prevent="onWheel">
            <div class="pr-diff-panel pr-diff-panel-left" ref="leftPanel">
              <table class="pr-diff-table" :style="{ transform: `translateY(-${leftScrollTop}px)` }">
                <tr
                  v-for="(line, i) in leftLines"
                  :key="i"
                  :class="'pr-diff-row pr-diff-row-' + line.type"
                >
                  <td
                    class="pr-diff-gutter gutter-commentable"
                    :class="{ 'has-comment': hasAnyCommentAt(line.num, 'LEFT') }"
                    @click="onGutterClick(line, 'LEFT', $event)"
                  >
                    {{ line.num ?? '' }}
                    <span v-if="hasAnyCommentAt(line.num, 'LEFT')" class="gutter-dot" :class="commentDotClass(line.num, 'LEFT')"></span>
                    <span v-else-if="line.num != null" class="gutter-add">+</span>
                  </td>
                  <td class="pr-diff-code"><pre v-if="line.html" v-html="line.html"></pre><pre v-else>{{ line.content }}</pre></td>
                </tr>
              </table>
            </div>
            <div class="pr-diff-connector-col" ref="connectorCol">
              <svg :width="48" :height="viewportHeight">
                <path
                  v-for="(d, i) in connectorPaths"
                  :key="i"
                  :d="d"
                  fill="rgba(139,148,158,0.08)"
                  stroke="var(--border)"
                  stroke-width="0.5"
                />
              </svg>
            </div>
            <div class="pr-diff-panel pr-diff-panel-right" ref="rightPanel">
              <table class="pr-diff-table" :style="{ transform: `translateY(-${rightScrollTop}px)` }">
                <tr
                  v-for="(line, i) in rightLines"
                  :key="i"
                  :class="'pr-diff-row pr-diff-row-' + line.type"
                >
                  <td
                    class="pr-diff-gutter gutter-commentable"
                    :class="{ 'has-comment': hasAnyCommentAt(line.num, 'RIGHT') }"
                    @click="onGutterClick(line, 'RIGHT', $event)"
                  >
                    {{ line.num ?? '' }}
                    <span v-if="hasAnyCommentAt(line.num, 'RIGHT')" class="gutter-dot" :class="commentDotClass(line.num, 'RIGHT')"></span>
                    <span v-else-if="line.num != null" class="gutter-add">+</span>
                  </td>
                  <td class="pr-diff-code"><pre v-if="line.html" v-html="line.html"></pre><pre v-else>{{ line.content }}</pre></td>
                </tr>
              </table>
            </div>
          </div>
        </template>
      </div>

      <div v-else-if="currentFile.patch" class="pr-diff-viewer">
        <template v-if="isAddedOrRemoved">
          <div class="pr-diff-panel-full" :class="currentFile.status === 'removed' ? 'pr-diff-panel-full-del' : ''">
            <table class="pr-diff-table">
              <tr
                v-for="(line, i) in patchSinglePanelLines"
                :key="i"
                :class="'pr-diff-row pr-diff-row-' + line.type"
              >
                <td
                  class="pr-diff-gutter gutter-commentable"
                  :class="{ 'has-comment': hasAnyCommentAt(line.num, singlePanelSide) }"
                  @click="onGutterClick(line, singlePanelSide, $event)"
                >
                  {{ line.num ?? '' }}
                  <span v-if="hasAnyCommentAt(line.num, singlePanelSide)" class="gutter-dot" :class="commentDotClass(line.num, singlePanelSide)"></span>
                  <span v-else-if="line.num != null" class="gutter-add">+</span>
                </td>
                <td class="pr-diff-code"><pre v-if="line.html" v-html="line.html"></pre><pre v-else>{{ line.content }}</pre></td>
              </tr>
            </table>
          </div>
        </template>
        <template v-else>
          <div class="pr-diff-split">
            <div class="pr-diff-panel pr-diff-panel-left">
              <table class="pr-diff-table">
                <tr
                  v-for="(line, i) in parsedPatch.left"
                  :key="i"
                  :class="'pr-diff-row pr-diff-row-' + line.type"
                >
                  <td
                    class="pr-diff-gutter gutter-commentable"
                    :class="{ 'has-comment': hasAnyCommentAt(line.num, 'LEFT') }"
                    @click="onGutterClick(line, 'LEFT', $event)"
                  >
                    {{ line.num ?? '' }}
                    <span v-if="hasAnyCommentAt(line.num, 'LEFT')" class="gutter-dot" :class="commentDotClass(line.num, 'LEFT')"></span>
                    <span v-else-if="line.num != null" class="gutter-add">+</span>
                  </td>
                  <td class="pr-diff-code"><pre v-if="line.html" v-html="line.html"></pre><pre v-else>{{ line.content }}</pre></td>
                </tr>
              </table>
            </div>
            <div class="pr-diff-divider"></div>
            <div class="pr-diff-panel pr-diff-panel-right">
              <table class="pr-diff-table">
                <tr
                  v-for="(line, i) in parsedPatch.right"
                  :key="i"
                  :class="'pr-diff-row pr-diff-row-' + line.type"
                >
                  <td
                    class="pr-diff-gutter gutter-commentable"
                    :class="{ 'has-comment': hasAnyCommentAt(line.num, 'RIGHT') }"
                    @click="onGutterClick(line, 'RIGHT', $event)"
                  >
                    {{ line.num ?? '' }}
                    <span v-if="hasAnyCommentAt(line.num, 'RIGHT')" class="gutter-dot" :class="commentDotClass(line.num, 'RIGHT')"></span>
                    <span v-else-if="line.num != null" class="gutter-add">+</span>
                  </td>
                  <td class="pr-diff-code"><pre v-if="line.html" v-html="line.html"></pre><pre v-else>{{ line.content }}</pre></td>
                </tr>
              </table>
            </div>
          </div>
        </template>
      </div>

      <div v-else class="pr-diff-binary">Binary file not shown</div>
    </template>

    <p v-else class="pr-files-empty">No files changed</p>

    <comment-popover
      v-if="activeComment"
      :thread="activeThread"
      :pending-comment="activePending"
      :path="activeComment.path"
      :line="activeComment.line"
      :side="activeComment.side"
      :anchor-rect="activeComment.rect"
      :line-content="activeComment.lineContent"
      :owner="owner"
      :repo="repo"
      :pr-number="prNumber"
      :commit-id="commitId"
      @close="closeComment"
      @add-pending="onPopoverAddPending"
      @remove-pending="onPopoverRemovePending"
      @edit-pending="onPopoverEditPending"
      @comments-updated="onPopoverCommentsUpdated"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-facing-decorator';
import GitHubClient from '@/lib/githubClient';
import type { PRFile, ReviewComment, PendingComment } from '@/lib/githubClient';
import { parseCommentType } from '@/lib/githubClient';
import { highlightLines } from '@/lib/highlight';

interface CommentThread {
  path: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  comments: ReviewComment[];
}

interface DiffLine {
  num: number | null;
  content: string;
  html?: string;
  type: 'context' | 'add' | 'del' | 'hunk';
}

interface PatchHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: { type: 'context' | 'add' | 'del'; content: string }[];
}

interface CommonBlock {
  leftStart: number;
  leftEnd: number;
  rightStart: number;
  rightEnd: number;
}

interface ScrollSegment {
  virtualLength: number;
  leftLength: number;
  rightLength: number;
}

@Component({ emits: ['update:fileIndex', 'update:viewed', 'add-pending', 'remove-pending', 'edit-pending', 'comments-updated'] })
export default class PrFilesTab extends Vue {
  @Prop() files!: PRFile[];
  @Prop() filesLoading!: boolean;
  @Prop() owner!: string;
  @Prop() repo!: string;
  @Prop() baseRef!: string;
  @Prop() headRef!: string;
  @Prop({ default: 0 }) initialFileIndex!: number;
  @Prop() prTitle!: string;
  @Prop() prNumber!: number;
  @Prop() prAuthorLogin!: string;
  @Prop({ default: 4 }) tabSize!: number;
  @Prop({ default: () => ({}) }) viewedFiles!: Record<string, string>;
  @Prop({ default: '' }) prNodeId!: string;
  @Prop({ default: () => [] }) reviewComments!: ReviewComment[];
  @Prop({ default: () => [] }) pendingComments!: PendingComment[];
  @Prop({ default: '' }) commitId!: string;

  currentIndex = 0;
  dropdownOpen = false;
  baseContent: string | null = null;
  headContent: string | null = null;
  contentLoading   = false;
  leftScrollTop    = 0;
  rightScrollTop   = 0;
  viewportHeight   = 0;
  lineHeight       = 16.8;
  virtualScrollTop = 0;

  activeComment: { path: string; line: number; side: 'LEFT' | 'RIGHT'; rect: DOMRect; lineContent: string } | null = null;

  private _contentCache = new Map<string, { base: string | null; head: string | null }>();
  private _loadId = 0;
  private _resizeHandler = () => {
    this.measureViewportHeight();
    this.applyVirtualScroll();
  };
  private _keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (this.dropdownOpen) {
        e.preventDefault();
        e.stopPropagation();
        this.dropdownOpen = false;
      }
      return;
    }
    if (this.dropdownOpen) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const idx = this.findUnviewedFile(-1);
      if (idx !== -1) this.currentIndex = idx;
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const idx = this.findUnviewedFile(1);
      if (idx !== -1) this.currentIndex = idx;
    } else if (e.key === ' ') {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button') return;
      e.preventDefault();
      this.toggleViewed();
    }
  };
  private _clickOutsideHandler = (e: MouseEvent) => {
    if (!this.dropdownOpen) return;
    const target = e.target as HTMLElement | null;
    if (target && !target.closest('.pr-files-dropdown')) this.dropdownOpen = false;
  };

  get currentFile(): PRFile {
    return this.files[this.currentIndex] || this.files[0];
  }

  get isCurrentFileViewed(): boolean {
    return this.viewedFiles[this.currentFile?.filename] === 'VIEWED';
  }

  get nextUnviewedIndex(): number {
    return this.findUnviewedFile(1);
  }

  get prevUnviewedIndex(): number {
    return this.findUnviewedFile(-1);
  }

  async toggleViewed() {
    const file = this.currentFile;
    if (!file || !this.prNodeId) return;
    const filename = file.filename;
    const wasViewed = this.viewedFiles[filename] === 'VIEWED';
    const newState = wasViewed ? 'UNVIEWED' : 'VIEWED';
    this.$emit('update:viewed', { filename, state: newState });
    try {
      if (wasViewed) {
        await GitHubClient.unmarkFileAsViewed(this.prNodeId, filename);
      } else {
        await GitHubClient.markFileAsViewed(this.prNodeId, filename);
      }
    } catch {
      this.$emit('update:viewed', { filename, state: wasViewed ? 'VIEWED' : 'UNVIEWED' });
    }
  }

  get isAddedOrRemoved(): boolean {
    return this.currentFile?.status === 'added' || this.currentFile?.status === 'removed';
  }

  get hasFullContent(): boolean {
    const file = this.currentFile;
    if (!file) return false;
    if (file.status === 'added') return this.headContent !== null;
    if (file.status === 'removed') return this.baseContent !== null;
    return this.baseContent !== null && this.headContent !== null;
  }

  get leftLines(): DiffLine[] {
    const file = this.currentFile;
    if (!file || this.baseContent === null) return [];
    const fn = file.previous_filename || file.filename;
    if (file.status === 'removed') {
      return this.buildFullFileLines(this.baseContent, new Set(), 'del', true, fn);
    }
    const { deleted } = this.parseChangedLines(file.patch);
    return this.buildFullFileLines(this.baseContent, deleted, 'del', false, fn);
  }

  get rightLines(): DiffLine[] {
    const file = this.currentFile;
    if (!file || this.headContent === null) return [];
    if (file.status === 'added') {
      return this.buildFullFileLines(this.headContent, new Set(), 'add', true, file.filename);
    }
    const { added } = this.parseChangedLines(file.patch);
    return this.buildFullFileLines(this.headContent, added, 'add', false, file.filename);
  }

  get singlePanelLines(): DiffLine[] {
    if (this.currentFile?.status === 'removed') return this.leftLines;
    if (this.currentFile?.status === 'added') {
      return this.rightLines.map(l => ({ ...l, type: 'context' as const }));
    }
    return this.rightLines;
  }

  get parsedPatch(): { left: DiffLine[]; right: DiffLine[] } {
    return this.parsePatch(this.currentFile?.patch);
  }

  get patchSinglePanelLines(): DiffLine[] {
    if (this.currentFile?.status === 'removed') return this.parsedPatch.left;
    if (this.currentFile?.status === 'added') {
      return this.parsedPatch.right.map(l => ({ ...l, type: 'context' as const }));
    }
    return this.parsedPatch.right;
  }

  get commonBlocks(): CommonBlock[] {
    const file = this.currentFile;
    if (!file || !this.hasFullContent || this.isAddedOrRemoved) return [];
    const baseLineCount = this.baseContent?.split('\n').length ?? 0;
    const headLineCount = this.headContent?.split('\n').length ?? 0;
    return this.computeCommonBlocks(file.patch, baseLineCount, headLineCount);
  }

  buildScrollSegments(): ScrollSegment[] {
    const blocks = this.commonBlocks;
    const lh = this.lineHeight;
    const segments: ScrollSegment[] = [];

    if (!blocks.length) {
      const leftTotal = this.baseContent?.split('\n').length ?? 0;
      const rightTotal = this.headContent?.split('\n').length ?? 0;
      if (leftTotal > 0 || rightTotal > 0) {
        const ll = leftTotal * lh;
        const rl = rightTotal * lh;
        segments.push({ virtualLength: Math.max(ll, rl), leftLength: ll, rightLength: rl });
      }
      return segments;
    }

    let leftPos = 1;
    let rightPos = 1;

    for (const block of blocks) {
      const leftGap = block.leftStart - leftPos;
      const rightGap = block.rightStart - rightPos;
      if (leftGap > 0 || rightGap > 0) {
        const ll = leftGap * lh;
        const rl = rightGap * lh;
        segments.push({ virtualLength: Math.max(ll, rl), leftLength: ll, rightLength: rl });
      }

      const commonLines = block.leftEnd - block.leftStart + 1;
      const len = commonLines * lh;
      segments.push({ virtualLength: len, leftLength: len, rightLength: len });

      leftPos = block.leftEnd + 1;
      rightPos = block.rightEnd + 1;
    }

    const baseLineCount = this.baseContent?.split('\n').length ?? 0;
    const headLineCount = this.headContent?.split('\n').length ?? 0;
    const leftGap = Math.max(0, baseLineCount - leftPos + 1);
    const rightGap = Math.max(0, headLineCount - rightPos + 1);
    if (leftGap > 0 || rightGap > 0) {
      const ll = leftGap * lh;
      const rl = rightGap * lh;
      segments.push({ virtualLength: Math.max(ll, rl), leftLength: ll, rightLength: rl });
    }

    return segments;
  }

  get connectorPaths(): string[] {
    if (!this.viewportHeight || !this.commonBlocks.length) return [];
    const lh = this.lineHeight;
    const h = this.viewportHeight;
    const w = 48;
    const lScroll = this.leftScrollTop;
    const rScroll = this.rightScrollTop;
    const paths: string[] = [];

    for (const block of this.commonBlocks) {
      const lTop = (block.leftStart - 1) * lh - lScroll;
      const lBot = block.leftEnd * lh - lScroll;
      const rTop = (block.rightStart - 1) * lh - rScroll;
      const rBot = block.rightEnd * lh - rScroll;

      if (lBot < 0 && rBot < 0) continue;
      if (lTop > h && rTop > h) continue;

      paths.push(`M 0 ${lTop} L ${w} ${rTop} L ${w} ${rBot} L 0 ${lBot} Z`);
    }
    return paths;
  }

  private _filesInitialized = false;

  @Watch('files')
  onFilesChanged() {
    this._contentCache.clear();
    this.baseContent = null;
    this.headContent = null;
    this.virtualScrollTop = 0;
    if (!this._filesInitialized && this.files.length) {
      this._filesInitialized = true;
      const idx = this.initialFileIndex;
      this.currentIndex = (idx >= 0 && idx < this.files.length) ? idx : 0;
    } else {
      this.currentIndex = 0;
    }
    if (this.files.length) {
      this.loadFileContent();
    }
  }

  @Watch('currentIndex')
  onIndexChanged() {
    this.virtualScrollTop = 0;
    this.leftScrollTop = 0;
    this.rightScrollTop = 0;
    this.activeComment = null;
    this.$emit('update:fileIndex', this.currentIndex);
    this.loadFileContent();
  }

  @Watch('contentLoading')
  onContentLoadingChanged(val: boolean) {
    if (!val && this.hasFullContent && !this.isAddedOrRemoved) {
      this.$nextTick(() => {
        this.measureLineHeight();
        this.measureViewportHeight();
        this.resetPanelScroll();
      });
    }
  }

  mounted() {
    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('keydown', this._keyHandler);
    document.addEventListener('mousedown', this._clickOutsideHandler);
    document.addEventListener('mousedown', this._popoverClickOutside);
    if (this.files.length) {
      this.loadFileContent();
    }
  }

  beforeUnmount() {
    window.removeEventListener('resize', this._resizeHandler);
    window.removeEventListener('keydown', this._keyHandler);
    document.removeEventListener('mousedown', this._clickOutsideHandler);
    document.removeEventListener('mousedown', this._popoverClickOutside);
  }

  async loadFileContent() {
    const file = this.currentFile;
    if (!file) return;

    const cacheKey = file.filename;
    const cached = this._contentCache.get(cacheKey);
    if (cached) {
      this.baseContent = cached.base;
      this.headContent = cached.head;
      this.$nextTick(() => {
        this.measureLineHeight();
        this.measureViewportHeight();
        this.resetPanelScroll();
      });
      return;
    }

    const loadId = ++this._loadId;
    this.contentLoading = true;
    this.baseContent = null;
    this.headContent = null;

    try {
      let base: string | null = null;
      let head: string | null = null;

      if (file.status === 'added') {
        head = await GitHubClient.fetchFileContent(this.owner, this.repo, file.filename, this.headRef);
      } else if (file.status === 'removed') {
        const basePath = file.previous_filename || file.filename;
        base = await GitHubClient.fetchFileContent(this.owner, this.repo, basePath, this.baseRef);
      } else {
        const basePath = file.previous_filename || file.filename;
        [base, head] = await Promise.all([
          GitHubClient.fetchFileContent(this.owner, this.repo, basePath, this.baseRef),
          GitHubClient.fetchFileContent(this.owner, this.repo, file.filename, this.headRef),
        ]);
      }

      if (this._loadId !== loadId) return;
      this.baseContent = base;
      this.headContent = head;
      this._contentCache.set(cacheKey, { base, head });
    } catch {
      if (this._loadId !== loadId) return;
    } finally {
      if (this._loadId === loadId) {
        this.contentLoading = false;
      }
    }
  }

  measureLineHeight() {
    const row = (this.$refs.leftPanel as HTMLElement)?.querySelector('.pr-diff-row');
    if (row) this.lineHeight = row.getBoundingClientRect().height;
  }

  measureViewportHeight() {
    const col = this.$refs.connectorCol as HTMLElement | undefined;
    const left = this.$refs.leftPanel as HTMLElement | undefined;
    this.viewportHeight = col?.clientHeight ?? left?.clientHeight ?? 0;
  }

  resetPanelScroll() {
    this.virtualScrollTop = 0;
    this.leftScrollTop = 0;
    this.rightScrollTop = 0;
  }

  private _debugLogged = false;

  resolveScroll(segments: ScrollSegment[], v: number): { left: number; right: number } {
    let virtualAcc = 0;
    let leftAcc = 0;
    let rightAcc = 0;

    for (const seg of segments) {
      if (virtualAcc + seg.virtualLength > v) {
        const progress = v - virtualAcc;
        leftAcc  += Math.min(progress, seg.leftLength);
        rightAcc += Math.min(progress, seg.rightLength);
        return { left: leftAcc, right: rightAcc };
      }
      virtualAcc += seg.virtualLength;
      leftAcc    += seg.leftLength;
      rightAcc   += seg.rightLength;
    }

    return { left: leftAcc, right: rightAcc };
  }

  applyVirtualScroll() {
    const segments = this.buildScrollSegments();
    const { left, right } = this.resolveScroll(segments, this.virtualScrollTop);
    this.leftScrollTop = left;
    this.rightScrollTop = right;
  }

  onWheel(e: WheelEvent) {
    const segments = this.buildScrollSegments();

    if (!this._debugLogged) {
      this._debugLogged = true;
      const diffSegs = segments.filter(s => s.leftLength !== s.rightLength);
      console.log('[PrFilesTab] scrollSegments:', segments.length, 'total, diff segments:', diffSegs.length, diffSegs);
      console.log('[PrFilesTab] commonBlocks:', this.commonBlocks.length);
    }

    if (e.deltaY !== 0) {
      const totalVH = segments.reduce((s, seg) => s + seg.virtualLength, 0);
      const overscroll = Math.max(0, this.viewportHeight - this.lineHeight);
      const maxScroll = Math.max(0, totalVH - this.viewportHeight + overscroll);
      this.virtualScrollTop = Math.max(0, Math.min(maxScroll, this.virtualScrollTop + e.deltaY));

      const { left, right } = this.resolveScroll(segments, this.virtualScrollTop);
      this.leftScrollTop = left;
      this.rightScrollTop = right;
    }

    if (e.deltaX !== 0) {
      const leftEl = this.$refs.leftPanel as HTMLElement | undefined;
      const rightEl = this.$refs.rightPanel as HTMLElement | undefined;
      const target = e.target as HTMLElement;
      if (leftEl?.contains(target)) {
        leftEl.scrollLeft += e.deltaX;
      } else if (rightEl?.contains(target)) {
        rightEl.scrollLeft += e.deltaX;
      } else {
        if (leftEl) leftEl.scrollLeft += e.deltaX;
        if (rightEl) rightEl.scrollLeft += e.deltaX;
      }
    }
  }

  parseHunks(patch: string): PatchHunk[] {
    const hunks: PatchHunk[] = [];
    let current: PatchHunk | null = null;
    for (const raw of patch.split('\n')) {
      if (raw.startsWith('@@')) {
        const m = raw.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (m) {
          current = {
            oldStart: parseInt(m[1], 10),
            oldCount: parseInt(m[2] ?? '1', 10),
            newStart: parseInt(m[3], 10),
            newCount: parseInt(m[4] ?? '1', 10),
            lines: [],
          };
          hunks.push(current);
        }
      } else if (current) {
        if (raw.startsWith('-')) {
          current.lines.push({ type: 'del', content: raw.slice(1) });
        } else if (raw.startsWith('+')) {
          current.lines.push({ type: 'add', content: raw.slice(1) });
        } else if (raw.length > 0 || current.lines.length > 0) {
          const content = raw.startsWith(' ') ? raw.slice(1) : raw;
          current.lines.push({ type: 'context', content });
        }
      }
    }
    return hunks;
  }

  computeCommonBlocks(patch: string | undefined, baseLineCount: number, headLineCount: number): CommonBlock[] {
    const blocks: CommonBlock[] = [];
    if (!patch || baseLineCount === 0 || headLineCount === 0) {
      if (baseLineCount > 0 && headLineCount > 0) {
        blocks.push({ leftStart: 1, leftEnd: baseLineCount, rightStart: 1, rightEnd: headLineCount });
      }
      return blocks;
    }

    const hunks = this.parseHunks(patch);
    if (!hunks.length) {
      blocks.push({ leftStart: 1, leftEnd: baseLineCount, rightStart: 1, rightEnd: headLineCount });
      return blocks;
    }

    let leftPos = 1;
    let rightPos = 1;

    for (const hunk of hunks) {
      if (leftPos < hunk.oldStart) {
        const count = hunk.oldStart - leftPos;
        blocks.push({
          leftStart: leftPos,
          leftEnd: leftPos + count - 1,
          rightStart: rightPos,
          rightEnd: rightPos + count - 1,
        });
      }
      leftPos = hunk.oldStart;
      rightPos = hunk.newStart;

      let contextStart: { left: number; right: number } | null = null;

      for (const line of hunk.lines) {
        if (line.type === 'context') {
          if (!contextStart) {
            contextStart = { left: leftPos, right: rightPos };
          }
          leftPos++;
          rightPos++;
        } else {
          if (contextStart) {
            blocks.push({
              leftStart: contextStart.left,
              leftEnd: leftPos - 1,
              rightStart: contextStart.right,
              rightEnd: rightPos - 1,
            });
            contextStart = null;
          }
          if (line.type === 'del') leftPos++;
          else rightPos++;
        }
      }
      if (contextStart) {
        blocks.push({
          leftStart: contextStart.left,
          leftEnd: leftPos - 1,
          rightStart: contextStart.right,
          rightEnd: rightPos - 1,
        });
      }
    }

    if (leftPos <= baseLineCount && rightPos <= headLineCount) {
      blocks.push({
        leftStart: leftPos,
        leftEnd: baseLineCount,
        rightStart: rightPos,
        rightEnd: headLineCount,
      });
    }

    return blocks;
  }

  parseChangedLines(patch: string | undefined): { deleted: Set<number>; added: Set<number> } {
    const deleted = new Set<number>();
    const added = new Set<number>();
    if (!patch) return { deleted, added };

    let oldLine = 0;
    let newLine = 0;

    for (const raw of patch.split('\n')) {
      if (raw.startsWith('@@')) {
        const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (m) {
          oldLine = parseInt(m[1], 10);
          newLine = parseInt(m[2], 10);
        }
      } else if (raw.startsWith('-')) {
        deleted.add(oldLine++);
      } else if (raw.startsWith('+')) {
        added.add(newLine++);
      } else {
        oldLine++;
        newLine++;
      }
    }
    return { deleted, added };
  }

  buildFullFileLines(content: string, changedLines: Set<number>, changeType: 'add' | 'del', allChanged: boolean, filename?: string): DiffLine[] {
    const rawLines = content.split('\n');
    const htmlLines = filename ? highlightLines(content, filename) : null;
    return rawLines.map((line, i) => ({
      num: i + 1,
      content: line,
      html: htmlLines?.[i],
      type: allChanged || changedLines.has(i + 1) ? changeType : 'context',
    }));
  }

  parsePatch(patch: string | undefined): { left: DiffLine[]; right: DiffLine[] } {
    const left: DiffLine[] = [];
    const right: DiffLine[] = [];
    if (!patch) return { left, right };

    let oldLine = 0;
    let newLine = 0;

    for (const raw of patch.split('\n')) {
      if (raw.startsWith('@@')) {
        const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (m) {
          oldLine = parseInt(m[1], 10);
          newLine = parseInt(m[2], 10);
        }
        left.push({ num: null, content: raw, type: 'hunk' });
        right.push({ num: null, content: raw, type: 'hunk' });
      } else if (raw.startsWith('-')) {
        left.push({ num: oldLine++, content: raw.slice(1), type: 'del' });
      } else if (raw.startsWith('+')) {
        right.push({ num: newLine++, content: raw.slice(1), type: 'add' });
      } else {
        const content = raw.startsWith(' ') ? raw.slice(1) : raw;
        left.push({ num: oldLine++, content, type: 'context' });
        right.push({ num: newLine++, content, type: 'context' });
      }
    }

    const file = this.currentFile;
    if (file) {
      const leftCode = left.filter(l => l.type !== 'hunk').map(l => l.content).join('\n');
      const rightCode = right.filter(l => l.type !== 'hunk').map(l => l.content).join('\n');
      const leftFn = file.previous_filename || file.filename;
      const leftHtml = highlightLines(leftCode, leftFn);
      const rightHtml = highlightLines(rightCode, file.filename);
      if (leftHtml) {
        let hi = 0;
        for (const l of left) { if (l.type !== 'hunk') l.html = leftHtml[hi++]; }
      }
      if (rightHtml) {
        let hi = 0;
        for (const l of right) { if (l.type !== 'hunk') l.html = rightHtml[hi++]; }
      }
    }

    return { left, right };
  }

  findUnviewedFile(direction: 1 | -1): number {
    const len = this.files.length;
    for (let offset = 1; offset < len; offset++) {
      const idx = (this.currentIndex + direction * offset + len) % len;
      if (this.viewedFiles[this.files[idx].filename] !== 'VIEWED') return idx;
    }
    const next = this.currentIndex + direction;
    if (next >= 0 && next < len) return next;
    return -1;
  }

  fileStatusSymbol(status: string): string {
    const map: Record<string, string> = { added: '+', removed: '−', modified: '●', renamed: '→', copied: '⊕' };
    return map[status] || status[0]?.toUpperCase() || '?';
  }

  fileStatusLabel(status: string): string {
    const map: Record<string, string> = { added: 'A', removed: 'D', modified: 'M', renamed: 'R', copied: 'C' };
    return map[status] || status[0]?.toUpperCase() || '?';
  }

  // ─── Comment mapping ─────────────────────────────────

  get singlePanelSide(): 'LEFT' | 'RIGHT' {
    return this.currentFile?.status === 'removed' ? 'LEFT' : 'RIGHT';
  }

  get currentFileThreads(): { left: Map<number, CommentThread>; right: Map<number, CommentThread> } {
    const left = new Map<number, CommentThread>();
    const right = new Map<number, CommentThread>();
    const filename = this.currentFile?.filename;
    if (!filename) return { left, right };

    const rootMap = new Map<number, ReviewComment>();
    const replyMap = new Map<number, ReviewComment[]>();
    for (const c of this.reviewComments) {
      if (c.path !== filename) continue;
      if (c.in_reply_to_id) {
        const arr = replyMap.get(c.in_reply_to_id);
        if (arr) arr.push(c);
        else replyMap.set(c.in_reply_to_id, [c]);
      } else {
        rootMap.set(c.id, c);
      }
    }
    for (const [rootId, root] of rootMap) {
      const line = root.line;
      if (line == null) continue;
      const replies = replyMap.get(rootId) || [];
      const all = [root, ...replies].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const thread: CommentThread = { path: filename, line, side: root.side, comments: all };
      const map = root.side === 'LEFT' ? left : right;
      map.set(line, thread);
    }
    return { left, right };
  }

  get currentFilePending(): { left: Map<number, PendingComment>; right: Map<number, PendingComment> } {
    const left = new Map<number, PendingComment>();
    const right = new Map<number, PendingComment>();
    const filename = this.currentFile?.filename;
    if (!filename) return { left, right };
    for (const c of this.pendingComments) {
      if (c.path !== filename) continue;
      const map = c.side === 'LEFT' ? left : right;
      map.set(c.line, c);
    }
    return { left, right };
  }

  hasThreadAt(lineNum: number | null, side: 'LEFT' | 'RIGHT'): boolean {
    if (lineNum == null) return false;
    const map = side === 'LEFT' ? this.currentFileThreads.left : this.currentFileThreads.right;
    return map.has(lineNum);
  }

  hasPendingAt(lineNum: number | null, side: 'LEFT' | 'RIGHT'): boolean {
    if (lineNum == null) return false;
    const map = side === 'LEFT' ? this.currentFilePending.left : this.currentFilePending.right;
    return map.has(lineNum);
  }

  hasAnyCommentAt(lineNum: number | null, side: 'LEFT' | 'RIGHT'): boolean {
    return this.hasThreadAt(lineNum, side) || this.hasPendingAt(lineNum, side);
  }

  commentDotClass(lineNum: number | null, side: 'LEFT' | 'RIGHT'): string {
    if (lineNum == null) return '';
    const hasThread = this.hasThreadAt(lineNum, side);
    const hasPending = this.hasPendingAt(lineNum, side);
    if (hasThread && hasPending) return 'dot-both';
    if (hasPending) return 'dot-pending';

    const threadMap = side === 'LEFT' ? this.currentFileThreads.left : this.currentFileThreads.right;
    const thread = threadMap.get(lineNum);
    if (thread) {
      const type = parseCommentType(thread.comments[0].body);
      if (type === 'change-required') return 'dot-change-required';
      if (type === 'question') return 'dot-question';
      return 'dot-suggestion';
    }
    return '';
  }

  onGutterClick(line: DiffLine, side: 'LEFT' | 'RIGHT', event: MouseEvent) {
    if (line.num == null) return;
    const td = (event.target as HTMLElement).closest('.pr-diff-gutter') as HTMLElement;
    if (!td) return;
    const rect = td.getBoundingClientRect();
    this.activeComment = {
      path: this.currentFile.filename,
      line: line.num,
      side,
      rect,
      lineContent: line.content,
    };
  }

  closeComment() {
    this.activeComment = null;
  }

  get activeThread(): CommentThread | null {
    if (!this.activeComment) return null;
    const map = this.activeComment.side === 'LEFT' ? this.currentFileThreads.left : this.currentFileThreads.right;
    return map.get(this.activeComment.line) ?? null;
  }

  get activePending(): PendingComment | null {
    if (!this.activeComment) return null;
    const map = this.activeComment.side === 'LEFT' ? this.currentFilePending.left : this.currentFilePending.right;
    return map.get(this.activeComment.line) ?? null;
  }

  onPopoverAddPending(comment: PendingComment) {
    this.$emit('add-pending', comment);
  }

  onPopoverRemovePending(id: string) {
    this.$emit('remove-pending', id);
    this.closeComment();
  }

  onPopoverEditPending(comment: PendingComment) {
    this.$emit('edit-pending', comment);
  }

  onPopoverCommentsUpdated() {
    this.$emit('comments-updated');
  }

  private _popoverClickOutside = (e: MouseEvent) => {
    if (!this.activeComment) return;
    const target = e.target as HTMLElement;
    if (target.closest('.comment-popover') || target.closest('.pr-diff-gutter')) return;
    this.closeComment();
  };
}
</script>

<style>
.pr-files-tab {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

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

  &:hover:not(:disabled) { background: var(--bg-tertiary); }
  &:disabled { opacity: 0.3; cursor: default; }
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
  background: rgba(63, 185, 80, 0.05);
}

.pr-files-nav-viewed-btn.checked {
  border-color: var(--accent-green);
  color: var(--accent-green);
  background: rgba(63, 185, 80, 0.15);
}

.pr-files-dropdown {
  position: relative;
  flex: 1;
  min-width: 0;
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
  max-height: 400px;
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

.pr-files-dropdown-item:hover { background: var(--bg-tertiary); }
.pr-files-dropdown-item.active { background: var(--bg-tertiary); font-weight: 600; }

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

.pr-files-nav-add { color: var(--accent-green); }
.pr-files-nav-del { color: var(--accent-red); }


.pr-diff-content-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 24px;
  justify-content: center;
}

.pr-diff-viewer {
  flex: 1;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-top: 8px;
}

.pr-diff-viewer-split {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.pr-diff-viewer-split .pr-diff-split {
  flex: 1;
  min-height: 0;
}

.pr-diff-viewer-split .pr-diff-panel {
  overflow-y: hidden;
  overflow-x: auto;
}

.pr-diff-split {
  display: flex;
}

.pr-diff-panel {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}

.pr-diff-panel-full {
  overflow-x: auto;
}

.pr-diff-connector-col {
  width: 48px;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  background: var(--bg-primary);
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
}

.pr-diff-connector-col svg {
  display: block;
}

.pr-diff-divider {
  width: 1px;
  flex-shrink: 0;
  background: var(--border);
}

.pr-diff-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.pr-diff-row {
  line-height: 1.4;
}

.pr-diff-gutter {
  width: 50px;
  min-width: 50px;
  padding: 0 8px;
  text-align: right;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 12px;
  color: var(--text-tertiary);
  user-select: none;
  border-right: 1px solid var(--border);
  vertical-align: top;
}

.pr-diff-code {
  padding: 0 12px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 12px;
  color: var(--text-primary);
  vertical-align: top;

  pre {
    margin: 0;
    white-space: pre;
    font: inherit;
    line-height: 1.4;
    tab-size: var(--tab-size, 4);
  }

  .hljs {
    background: transparent;
    padding: 0;
  }
}

.pr-diff-row-context {
  background: var(--bg-primary);
}

.pr-diff-panel-left .pr-diff-row-del {
  background: rgba(248, 81, 73, 0.1);

  .pr-diff-gutter { color: var(--accent-red); }
  .pr-diff-code pre { opacity: 0.75; }
}

.pr-diff-panel-right .pr-diff-row-add {
  background: rgba(63, 185, 80, 0.1);

  .pr-diff-gutter { color: var(--accent-green); }
  .pr-diff-code pre { opacity: 0.75; }
}

.pr-diff-panel-full-add .pr-diff-row-add {
  background: rgba(63, 185, 80, 0.1);

  .pr-diff-gutter { color: var(--accent-green); }
  .pr-diff-code pre { opacity: 0.75; }
}

.pr-diff-panel-full-del .pr-diff-row-del {
  background: rgba(248, 81, 73, 0.1);

  .pr-diff-gutter { color: var(--accent-red); }
  .pr-diff-code pre { opacity: 0.75; }
}

.pr-diff-row-hunk {
  background: rgba(56, 139, 253, 0.1);

  .pr-diff-gutter { background: rgba(56, 139, 253, 0.08); }

  .pr-diff-code {
    color: var(--accent-blue);
    font-style: italic;
    opacity: 0.8;
  }
}

.pr-diff-binary {
  padding: 32px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-top: 8px;
}

.pr-files-empty {
  color: var(--text-tertiary);
  font-size: 13px;
  padding: 32px;
  text-align: center;
}

.file-status-added { color: var(--accent-green); }
.file-status-removed { color: var(--accent-red); }
.file-status-modified { color: var(--accent-orange); }
.file-status-renamed { color: var(--text-secondary); }
.file-status-copied { color: var(--text-secondary); }

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
  background: var(--bg-tertiary, #2d333b);
  color: var(--text-primary, #cdd9e5);
  font-size: 12px;
  font-family: inherit;
  font-weight: 400;
  line-height: 1.4;
  white-space: pre;
  border-radius: 6px;
  border: 1px solid var(--border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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

/* Comment gutter indicators */
.gutter-commentable {
  position: relative;
  cursor: pointer;
}

.gutter-add {
  position: absolute;
  left: 2px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent-blue);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.1s ease;
  pointer-events: none;
}

.gutter-commentable:hover .gutter-add {
  opacity: 1;
}

.gutter-dot {
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.gutter-dot.dot-suggestion {
  background: var(--accent-purple);
}

.gutter-dot.dot-change-required {
  background: var(--accent-orange);
}

.gutter-dot.dot-question {
  background: var(--accent-blue);
}

.gutter-dot.dot-pending {
  background: transparent;
  border: 2px dashed var(--accent-orange);
}

.gutter-dot.dot-both {
  background: var(--accent-purple);
  box-shadow: 3px -3px 0 0 var(--accent-orange);
}
</style>
