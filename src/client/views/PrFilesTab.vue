<template>
  <div
    class="pr-files-tab"
    :style="{ '--tab-size': tabSize, '--diff-font-size': diffFontSize + 'px' }"
  >
    <div v-if="filesLoading" class="pr-detail-loading">
      <div class="spinner"></div>
      <p>Loading files...</p>
    </div>

    <template v-else-if="files.length">
      <pr-files-nav-bar
        v-model:current-index="currentIndex"
        :files="files"
        :viewed-files="viewedFiles"
        @toggle-viewed="toggleViewed"
      />

      <div v-if="contentLoading" class="pr-diff-content-loading">
        <span class="async-loader"></span> Loading file contents...
      </div>

      <div v-else-if="hasFullContent" class="pr-diff-viewer" :class="{ 'pr-diff-viewer-split': !isAddedOrRemoved, 'pr-diff-viewer-with-minimap': isAddedOrRemoved }">
        <template v-if="isAddedOrRemoved">
          <div class="pr-diff-panel-full" :class="currentFile.status === 'removed' ? 'pr-diff-panel-full-del' : ''">
            <pr-diff-table
              :lines="singlePanelLines"
              :side="singlePanelSide"
              :has-any-comment-at="hasAnyCommentAt"
              :comment-dot-class="commentDotClass"
              @gutter-click="onGutterClick"
            />
          </div>
          <diff-minimap
            class="diff-minimap-sticky"
            :left-lines="minimapLeftLines"
            :right-lines="minimapRightLines"
            :viewport-height="0"
            :scroll-top="0"
            :total-content-height="minimapTotalHeight"
          />
        </template>

        <template v-else>
          <div class="pr-diff-split" @wheel.prevent="onWheel">
            <div class="pr-diff-panel pr-diff-panel-left" ref="leftPanel">
              <pr-diff-table
                :lines="leftLines"
                side="LEFT"
                :table-style="{ transform: `translateY(-${leftScrollTop}px)` }"
                :has-any-comment-at="hasAnyCommentAt"
                :comment-dot-class="commentDotClass"
                @gutter-click="onGutterClick"
              />
            </div>
            <div class="pr-diff-connector-col" ref="connectorCol">
              <svg :width="48" :height="viewportHeight">
                <path
                  v-for="(d, i) in connectorPaths"
                  :key="i"
                  :d="d"
                  fill="var(--diff-minimap-faint)"
                  stroke="var(--border)"
                  stroke-width="0.5"
                />
              </svg>
            </div>
            <div class="pr-diff-panel pr-diff-panel-right" ref="rightPanel">
              <pr-diff-table
                :lines="rightLines"
                side="RIGHT"
                :table-style="{ transform: `translateY(-${rightScrollTop}px)` }"
                :has-any-comment-at="hasAnyCommentAt"
                :comment-dot-class="commentDotClass"
                @gutter-click="onGutterClick"
              />
            </div>
            <diff-minimap
              :left-lines="minimapLeftLines"
              :right-lines="minimapRightLines"
              :viewport-height="viewportHeight"
              :scroll-top="minimapScrollTop"
              :total-content-height="minimapTotalHeight"
              @scroll-to="onMinimapScrollTo"
            />
          </div>
        </template>
      </div>

      <div v-else-if="currentFile.patch" class="pr-diff-viewer" :class="{ 'pr-diff-viewer-with-minimap': isAddedOrRemoved }">
        <template v-if="isAddedOrRemoved">
          <div class="pr-diff-panel-full" :class="currentFile.status === 'removed' ? 'pr-diff-panel-full-del' : ''">
            <pr-diff-table
              :lines="patchSinglePanelLines"
              :side="singlePanelSide"
              :has-any-comment-at="hasAnyCommentAt"
              :comment-dot-class="commentDotClass"
              @gutter-click="onGutterClick"
            />
          </div>
          <diff-minimap
            class="diff-minimap-sticky"
            :left-lines="minimapLeftLines"
            :right-lines="minimapRightLines"
            :viewport-height="0"
            :scroll-top="0"
            :total-content-height="minimapTotalHeight"
          />
        </template>
        <template v-else>
          <div class="pr-diff-split">
            <div class="pr-diff-panel pr-diff-panel-left">
              <pr-diff-table
                :lines="parsedPatch.left"
                side="LEFT"
                :has-any-comment-at="hasAnyCommentAt"
                :comment-dot-class="commentDotClass"
                @gutter-click="onGutterClick"
              />
            </div>
            <div class="pr-diff-divider"></div>
            <div class="pr-diff-panel pr-diff-panel-right">
              <pr-diff-table
                :lines="parsedPatch.right"
                side="RIGHT"
                :has-any-comment-at="hasAnyCommentAt"
                :comment-dot-class="commentDotClass"
                @gutter-click="onGutterClick"
              />
            </div>
            <diff-minimap
              :left-lines="minimapLeftLines"
              :right-lines="minimapRightLines"
              :viewport-height="0"
              :scroll-top="0"
              :total-content-height="minimapTotalHeight"
            />
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
import { computeCommonBlocks } from '@/lib/patchDiff';
import { buildSplitLinesForFile, parsePatch } from '@/lib/diffLineBuilder';
import {
  buildConnectorPaths,
  buildScrollSegmentsFromState,
  maxVirtualScrollTop,
  resolveScroll,
} from '@/composables/usePrDiffVirtualScroll';
import type { CommentThread, DiffLine, ScrollSegment } from '@/lib/prDiffTypes';
import DiffMinimap from '@/components/DiffMinimap.vue';
import PrDiffTable from '@/components/PrDiffTable.vue';
import PrFilesNavBar from '@/components/PrFilesNavBar.vue';

@Component({ components: { DiffMinimap, PrDiffTable, PrFilesNavBar }, emits: ['update:fileIndex', 'update:viewed', 'add-pending', 'remove-pending', 'edit-pending', 'comments-updated'] })
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
  @Prop({ default: 12 }) diffFontSize!: number;
  @Prop({ default: () => ({}) }) viewedFiles!: Record<string, string>;
  @Prop({ default: '' }) prNodeId!: string;
  @Prop({ default: () => [] }) reviewComments!: ReviewComment[];
  @Prop({ default: () => [] }) pendingComments!: PendingComment[];
  @Prop({ default: '' }) commitId!: string;

  currentIndex = 0;
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

  get currentFile(): PRFile {
    return this.files[this.currentIndex] || this.files[0];
  }

  /** Next file index after `idx0` (wrapping) that is not VIEWED, or -1 if none. */
  private findNextUnviewedFileIndex(idx0: number): number {
    const len = this.files.length;
    if (len < 2) return -1;
    for (let offset = 1; offset < len; offset++) {
      const idx = (idx0 + offset) % len;
      if (this.viewedFiles[this.files[idx].filename] !== 'VIEWED') return idx;
    }
    return -1;
  }

  async toggleViewed() {
    const file = this.currentFile;
    if (!file || !this.prNodeId) return;
    const filename = file.filename;
    const wasViewed = this.viewedFiles[filename] === 'VIEWED';
    const newState = wasViewed ? 'UNVIEWED' : 'VIEWED';
    const indexBefore = this.currentIndex;
    this.$emit('update:viewed', { filename, state: newState });
    try {
      if (wasViewed) {
        await GitHubClient.unmarkFileAsViewed(this.prNodeId, filename);
      } else {
        await GitHubClient.markFileAsViewed(this.prNodeId, filename);
      }
    } catch {
      this.$emit('update:viewed', { filename, state: wasViewed ? 'VIEWED' : 'UNVIEWED' });
      return;
    }
    if (!wasViewed) {
      this.$nextTick(() => {
        const next = this.findNextUnviewedFileIndex(indexBefore);
        if (next !== -1) this.currentIndex = next;
      });
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

  get splitLines(): { left: DiffLine[]; right: DiffLine[] } {
    const file = this.currentFile;
    if (!file) return { left: [], right: [] };
    return buildSplitLinesForFile(file, this.baseContent, this.headContent);
  }

  get leftLines(): DiffLine[] {
    return this.splitLines.left;
  }

  get rightLines(): DiffLine[] {
    return this.splitLines.right;
  }

  get singlePanelLines(): DiffLine[] {
    if (this.currentFile?.status === 'removed') return this.leftLines;
    if (this.currentFile?.status === 'added') {
      return this.rightLines.map(l => ({ ...l, type: 'context' as const }));
    }
    return this.rightLines;
  }

  get parsedPatch(): { left: DiffLine[]; right: DiffLine[] } {
    return parsePatch(this.currentFile?.patch, this.currentFile ?? null);
  }

  get patchSinglePanelLines(): DiffLine[] {
    if (this.currentFile?.status === 'removed') return this.parsedPatch.left;
    if (this.currentFile?.status === 'added') {
      return this.parsedPatch.right.map(l => ({ ...l, type: 'context' as const }));
    }
    return this.parsedPatch.right;
  }

  get minimapLeftLines(): DiffLine[] {
    const file = this.currentFile;
    if (!file) return [];
    if (this.hasFullContent) {
      if (file.status === 'added') return [];
      return this.leftLines;
    }
    if (file.patch) {
      if (file.status === 'added') return [];
      return this.parsedPatch.left;
    }
    return [];
  }

  get minimapRightLines(): DiffLine[] {
    const file = this.currentFile;
    if (!file) return [];
    if (this.hasFullContent) {
      if (file.status === 'added') return this.rightLines;
      if (file.status === 'removed') return [];
      return this.rightLines;
    }
    if (file.patch) {
      if (file.status === 'added') return this.patchSinglePanelLines;
      if (file.status === 'removed') return [];
      return this.parsedPatch.right;
    }
    return [];
  }

  get minimapTotalHeight(): number {
    return Math.max(this.minimapLeftLines.length, this.minimapRightLines.length) * this.lineHeight;
  }

  get minimapScrollTop(): number {
    if (this.isAddedOrRemoved) return 0;
    return this.rightScrollTop;
  }

  onMinimapScrollTo(fraction: number) {
    const segments = this.scrollSegments();
    const maxScroll = maxVirtualScrollTop(segments, this.viewportHeight, this.lineHeight);
    this.virtualScrollTop = maxScroll * fraction;
    const { left, right } = resolveScroll(segments, this.virtualScrollTop);
    this.leftScrollTop = left;
    this.rightScrollTop = right;
  }

  get commonBlocks() {
    const file = this.currentFile;
    if (!file || !this.hasFullContent || this.isAddedOrRemoved) return [];
    const baseLineCount = this.baseContent?.split('\n').length ?? 0;
    const headLineCount = this.headContent?.split('\n').length ?? 0;
    return computeCommonBlocks(file.patch, baseLineCount, headLineCount);
  }

  scrollSegments(): ScrollSegment[] {
    return buildScrollSegmentsFromState(this.commonBlocks, this.baseContent, this.headContent, this.lineHeight);
  }

  get connectorPaths(): string[] {
    return buildConnectorPaths(
      this.commonBlocks,
      this.leftScrollTop,
      this.rightScrollTop,
      this.viewportHeight,
      this.lineHeight,
      48,
    );
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

  @Watch('diffFontSize')
  onDiffFontSizeChanged() {
    this.$nextTick(() => {
      this.measureLineHeight();
      this.measureViewportHeight();
      this.applyVirtualScroll();
    });
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
    document.addEventListener('mousedown', this._popoverClickOutside);
    if (this.files.length) {
      this.loadFileContent();
    }
  }

  beforeUnmount() {
    window.removeEventListener('resize', this._resizeHandler);
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
    const root = this.$el as HTMLElement;
    const row =
      (this.$refs.leftPanel as HTMLElement)?.querySelector('.pr-diff-row') ??
      root?.querySelector('.pr-diff-row');
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

  applyVirtualScroll() {
    const segments = this.scrollSegments();
    const { left, right } = resolveScroll(segments, this.virtualScrollTop);
    this.leftScrollTop = left;
    this.rightScrollTop = right;
  }

  onWheel(e: WheelEvent) {
    const segments = this.scrollSegments();

    if (!this._debugLogged) {
      this._debugLogged = true;
      const diffSegs = segments.filter(s => s.leftLength !== s.rightLength);
      console.log('[PrFilesTab] scrollSegments:', segments.length, 'total, diff segments:', diffSegs.length, diffSegs);
      console.log('[PrFilesTab] commonBlocks:', this.commonBlocks.length);
    }

    if (e.deltaY !== 0) {
      const maxScroll = maxVirtualScrollTop(segments, this.viewportHeight, this.lineHeight);
      this.virtualScrollTop = Math.max(0, Math.min(maxScroll, this.virtualScrollTop + e.deltaY));

      const { left, right } = resolveScroll(segments, this.virtualScrollTop);
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

  /** Pending or GitHub thread not yet resolved — pulsate gutter dot */
  gutterDotNeedsPulse(lineNum: number | null, side: 'LEFT' | 'RIGHT'): boolean {
    if (lineNum == null) return false;
    if (this.hasPendingAt(lineNum, side)) return true;
    const threadMap = side === 'LEFT' ? this.currentFileThreads.left : this.currentFileThreads.right;
    const thread = threadMap.get(lineNum);
    if (!thread) return false;
    return thread.comments.some(c => c.isResolved === false);
  }

  commentDotClass(lineNum: number | null, side: 'LEFT' | 'RIGHT'): string {
    if (lineNum == null) return '';
    const hasThread = this.hasThreadAt(lineNum, side);
    const hasPending = this.hasPendingAt(lineNum, side);
    const parts: string[] = [];
    if (hasThread && hasPending) parts.push('dot-both');
    else if (hasPending) parts.push('dot-pending');
    else if (hasThread) {
      const threadMap = side === 'LEFT' ? this.currentFileThreads.left : this.currentFileThreads.right;
      const thread = threadMap.get(lineNum);
      if (thread) {
        const type = parseCommentType(thread.comments[0].body);
        if (type === 'change-required') parts.push('dot-change-required');
        else if (type === 'question') parts.push('dot-question');
        else parts.push('dot-suggestion');
      }
    }
    if (this.gutterDotNeedsPulse(lineNum, side)) parts.push('gutter-dot-unresolved');
    return parts.join(' ');
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
@import '@/styles/pr-diff.css';

.pr-files-tab {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.pr-files-empty {
  color: var(--text-tertiary);
  font-size: 13px;
  padding: 32px;
  text-align: center;
}
</style>
