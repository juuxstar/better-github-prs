<template>
	<div class="pr-detail-page u-flex u-flex-col u-overflow-hidden">
		<pr-detail-load-state v-if="loading || error" :loading="loading" :error="error" @retry="loadAll" />

		<template v-else-if="pr">
			<div class="pr-detail-main u-flex u-flex-col u-flex-1 u-min-h-0 u-overflow-hidden">
				<header class="pr-detail-header u-flex u-items-center u-justify-between u-py-2-5 u-px-4 u-flex-shrink-0 u-sticky u-top-0 u-z-100 u-gap-4">
					<div class="pr-detail-header-left u-flex u-items-center u-gap-2-5 u-min-w-0 u-flex-1">
						<a href="/" class="pr-detail-back u-flex-shrink-0" title="Back to dashboard">&larr;</a>
						<span
							class="pr-detail-badge u-flex-shrink-0"
							:class="{
								'pr-detail-badge-draft' : pr.draft,
								'pr-detail-badge-merged' : !pr.draft && pr.merged,
								'pr-detail-badge-closed' : !pr.draft && !pr.merged && pr.state === 'closed',
								'pr-detail-badge-open' : !pr.draft && !pr.merged && pr.state === 'open',
							}"
							>{{ prStatusBadgeText }}</span>
						<div class="pr-detail-header-title-block u-flex u-items-center u-min-w-0 u-flex-grow-1 u-gap-2">
							<div class="pr-detail-title-edit-group u-flex u-items-center u-min-w-0 u-flex-1 u-gap-1">
								<h1 class="pr-detail-title u-min-w-0 u-flex-1 u-fs-15 u-fw-600 u-text-primary u-truncate u-m-0">
									{{ pr.title }}
								</h1>
								<button type="button" class="pr-detail-header-icon-btn u-flex-shrink-0" title="Edit title" aria-label="Edit title" @click="openTitleEdit">
									<span class="u-flex u-items-center u-justify-center" aria-hidden="true" v-html="$icon('pencil', 14)"></span>
								</button>
							</div>
							<span v-if="canToggleDraft" class="pr-detail-control-wrap has-tooltip" :data-tooltip="draftToggleTooltip">
								<button type="button" class="pr-detail-header-draft-btn" :disabled="togglingDraft" :title="pr.draft ? 'Mark ready for review' : 'Mark as draft'" @click="togglePrDraft">
									<span v-if="togglingDraft" class="async-loader"></span>
									<template v-else>{{ pr.draft ? "Ready for review" : "Mark draft" }}</template>
								</button>
							</span>
						</div>
					</div>
					<div class="pr-detail-header-center u-flex u-items-center u-justify-center u-flex-1">
						<pr-detail-tab-bar :active-tab="activeTab" :changed-files-count="pr.changed_files" :files-length="files.length" :review-pct="reviewPct" @switch-tab="switchTab" />
						<button
							v-if="showMarkWhitespaceViewedButton"
							type="button"
							class="pr-whitespace-viewed-btn has-tooltip"
							:data-tooltip="whitespaceViewedBtnTooltip"
							:disabled="markingWhitespaceViewed"
							@click="openWhitespaceViewedConfirm"
						>
							Whitespace&rarr;viewed ({{ whitespaceOnlyUnviewedCount }})
						</button>
						<button
							v-if="activeTab === 'overview' && showMergePrButton"
							class="pr-merge-btn has-tooltip"
							data-tooltip="Squash all commits into one and merge into the base branch (same as GitHub's squash merge)."
							:disabled="mergingPr"
							@click="openMergeConfirm"
						>
							<span v-if="mergingPr" class="async-loader"></span>
							<template v-else>Merge PR</template>
						</button>
						<button v-if="showApproveInHeader" class="pr-approve-btn" :disabled="approvingPr" @click="approvePr">
							<span v-if="approvingPr" class="async-loader"></span>
							<template v-else>&#10003; Approve</template>
						</button>
					</div>
					<div class="pr-detail-header-right u-flex u-items-center u-gap-3 u-flex-1 u-justify-end">
						<template v-if="pendingComments.length">
							<button class="pr-review-discard-btn" @click="discardAllPending" title="Discard all pending comments">&times;</button>
							<button class="pr-review-submit-btn" :disabled="submittingReview" @click="submitReview">
								<span v-if="submittingReview" class="async-loader"></span>
								Submit Review ({{ pendingComments.length }})
							</button>
						</template>
						<span class="pr-detail-control-wrap has-tooltip" data-tooltip="App colours: light, dark, or Auto (follow system).&#10;Saved in this browser.">
							<appearance-select class="pr-detail-appearance" />
						</span>
						<span
							class="pr-detail-control-wrap has-tooltip"
							data-tooltip="Syntax highlighting theme for code in the diff (matches current app mode).&#10;Your choice is saved per light and dark mode."
						>
							<select class="pr-detail-tab-size" :value="hljsTheme" @change="hljsTheme = ($event.target as HTMLSelectElement).value">
								<option v-for="t in hljsThemesFiltered" :key="t.id" :value="t.id">{{ t.label }}</option>
							</select>
						</span>
						<span class="pr-detail-control-wrap has-tooltip" data-tooltip="Font size for line numbers and code in the Files tab.&#10;Saved in this browser.">
							<select class="pr-detail-tab-size" :value="diffFontSize" @change="diffFontSize = +($event.target as HTMLSelectElement).value">
								<option v-for="p in diffFontSizePresets" :key="p.value" :value="p.value">{{ p.label }}</option>
							</select>
						</span>
						<span class="pr-detail-control-wrap has-tooltip" data-tooltip="How many spaces wide each tab character appears in diff code.&#10;Saved in this browser.">
							<select class="pr-detail-tab-size" :value="tabSize" @change="tabSize = +($event.target as HTMLSelectElement).value">
								<option :value="2">2 spaces</option>
								<option :value="4">4 spaces</option>
								<option :value="8">8 spaces</option>
							</select>
						</span>
						<a :href="pr.html_url" target="_blank" rel="noopener" class="pr-detail-github-link">GitHub &rarr;</a>
					</div>
				</header>

				<div class="pr-detail-tab-shell u-flex u-flex-col u-flex-1 u-min-h-0 u-overflow-hidden">
					<pr-overview-tab
						v-if="activeTab === 'overview'"
						:pr="pr"
						:checks="checks"
						:checks-loading="checksLoading"
						:repo-labels="repoLabels"
						:review-comments="reviewComments"
						:issue-comments="issueComments"
						:comments-loading="reviewCommentsLoading"
						@add-label="addLabel"
						@remove-label="removeLabel"
						@comments-updated="onCommentsUpdated"
					/>
					<pr-files-tab
						v-else-if="activeTab === 'files'"
						:files="files"
						:files-loading="filesLoading"
						:owner="owner"
						:repo="repo"
						:base-ref="pr.base.sha"
						:head-ref="pr.head.sha"
						:initial-file-index="initialFileIndex"
						:pr-title="pr.title"
						:pr-number="pr.number"
						:pr-author-login="pr.user.login"
						:tab-size="tabSize"
						:diff-font-size="diffFontSize"
						:viewed-files="viewedFiles"
						:pr-node-id="prNodeId"
						:review-comments="reviewComments"
						:pending-comments="pendingComments"
						:commit-id="pr.head.sha"
						@update:file-index="onFileIndexChange"
						@update:viewed="onViewedChange"
						@add-pending="onAddPending"
						@remove-pending="onRemovePending"
						@edit-pending="onEditPending"
						@comments-updated="onCommentsUpdated"
					/>
				</div>
			</div>

			<Teleport to="body">
				<div v-if="mergeConfirmOpen && pr" class="pr-merge-confirm-backdrop u-fixed u-inset-0 u-z-modal u-flex u-items-center u-justify-center u-p-6" @click.self="closeMergeConfirm">
					<div class="pr-merge-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="pr-merge-confirm-title">
						<h2 id="pr-merge-confirm-title" class="pr-merge-confirm-title">Merge pull request?</h2>
						<p class="pr-merge-confirm-body">
							This will squash all commits into one and merge
							<span class="pr-merge-confirm-repo">{{ owner }}/{{ repo }}</span>
							<strong>#{{ pr.number }}</strong> into <strong>{{ pr.base.ref }}</strong>.
						</p>
						<p v-if="mergeConfirmError" class="pr-merge-confirm-error">{{ mergeConfirmError }}</p>
						<div class="pr-merge-confirm-actions u-flex u-justify-end u-gap-2-5 u-flex-wrap">
							<button type="button" class="btn btn-secondary" :disabled="mergingPr" @click="closeMergeConfirm">Cancel</button>
							<button type="button" class="btn pr-merge-confirm-submit" :disabled="mergingPr" @click="confirmMergePr">
								<span v-if="mergingPr" class="async-loader"></span>
								<template v-else>Squash and merge</template>
							</button>
						</div>
					</div>
				</div>
				<div
					v-if="whitespaceViewedConfirmOpen && pr"
					class="pr-merge-confirm-backdrop u-fixed u-inset-0 u-z-modal u-flex u-items-center u-justify-center u-p-6"
					@click.self="closeWhitespaceViewedConfirm"
				>
					<div class="pr-merge-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="pr-whitespace-viewed-confirm-title">
						<h2 id="pr-whitespace-viewed-confirm-title" class="pr-merge-confirm-title">Mark whitespace-only files as viewed?</h2>
						<p class="pr-merge-confirm-body">
							This will mark <strong>{{ whitespaceOnlyUnviewedCount }}</strong> unviewed file(s) as viewed on GitHub.
						</p>
						<p class="pr-merge-confirm-body">
							Only files with a patch where every removed/added line pair differs by whitespace are included (modified or renamed; no patch, binary, or uneven blocks are skipped).
						</p>
						<p v-if="whitespaceViewedConfirmError" class="pr-merge-confirm-error">{{ whitespaceViewedConfirmError }}</p>
						<div class="pr-merge-confirm-actions u-flex u-justify-end u-gap-2-5 u-flex-wrap">
							<button type="button" class="btn btn-secondary" :disabled="markingWhitespaceViewed" @click="closeWhitespaceViewedConfirm">Cancel</button>
							<button type="button" class="btn pr-merge-confirm-submit" :disabled="markingWhitespaceViewed" @click="confirmMarkWhitespaceViewedFiles">
								<span v-if="markingWhitespaceViewed" class="async-loader"></span>
								<template v-else>Mark {{ whitespaceOnlyUnviewedCount }} as viewed</template>
							</button>
						</div>
					</div>
				</div>
				<div v-if="titleEditOpen && pr" class="pr-merge-confirm-backdrop u-fixed u-inset-0 u-z-modal u-flex u-items-center u-justify-center u-p-6" @click.self="closeTitleEdit">
					<div class="pr-merge-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="pr-title-edit-title" @keydown.escape="closeTitleEdit">
						<h2 id="pr-title-edit-title" class="pr-merge-confirm-title">Edit pull request title</h2>
						<input ref="prTitleEditInput" v-model="titleEditValue" type="text" class="pr-title-edit-input" maxlength="500" autocomplete="off" @keydown.enter.prevent="saveTitleEdit" />
						<p v-if="titleEditError" class="pr-merge-confirm-error">{{ titleEditError }}</p>
						<div class="pr-merge-confirm-actions u-flex u-justify-end u-gap-2-5 u-flex-wrap">
							<button type="button" class="btn btn-secondary" :disabled="updatingTitle" @click="closeTitleEdit">Cancel</button>
							<button type="button" class="btn pr-merge-confirm-submit" :disabled="updatingTitle" @click="saveTitleEdit">
								<span v-if="updatingTitle" class="async-loader"></span>
								<template v-else>Save</template>
							</button>
						</div>
					</div>
				</div>
			</Teleport>
		</template>
	</div>
</template>

<script lang="ts">
import PrDetailLoadState                        from '@/components/pr/PrDetailLoadState.vue';
import PrDetailTabBar                           from '@/components/pr/PrDetailTabBar.vue';
import { getStoredToken }                       from '@/lib/api/auth';
import type { CheckRunDetail, IssueComment, PendingComment, PRFile, RepoLabel, ReviewComment }    from '@/lib/api/githubClient';
import GitHubClient                             from '@/lib/api/githubClient';
import { isWhitespaceOnlyFileChange }           from '@/lib/diff/patchDiff';
import { loadPendingReview, savePendingReview } from '@/lib/pendingReviewStorage';
import type { ResolvedScheme }                  from '@/lib/theme/colorScheme';
import { getResolvedScheme, subscribeColorScheme } from '@/lib/theme/colorScheme';
import { getStoredHljsThemeId, hljsThemesForResolvedScheme, loadHljsTheme, setStoredHljsThemeId } from '@/lib/theme/hljsTheme';
import { timeAgo }                              from '@/lib/utils';

import { Component, Prop, Vue, Watch } from 'vue-facing-decorator';

@Component({
	components : { PrDetailLoadState, PrDetailTabBar },
	emits      : [ 'update:fileIndex' ],
})
export default class PrDetailView extends Vue {

	/** Line break matches prior `data-tooltip` &#10; for multi-line has-tooltip text. */
	readonly whitespaceViewedBtnTooltip = 'Mark unviewed files whose patch changes only whitespace as viewed on GitHub (same as the Files tab checkbox).\nSkips files without a patch or with uneven diff blocks.';

	@Prop({ required : true }) readonly owner!: string;
	@Prop({ required : true }) readonly repo!: string;
	@Prop({ required : true }) readonly number!: string;
	@Prop({ required : true }) readonly tab!: string;

	pr: any = null;
	checks: CheckRunDetail[] = [];
	repoLabels: RepoLabel[] = [];
	files: PRFile[] = [];
	loading = true;
	checksLoading = true;
	filesLoading = false;
	error = '';
	activeTab: 'overview' | 'files' = 'overview';
	tabSize = parseInt(localStorage.getItem('diffTabSize') || '4', 10);

	diffFontSize = (() => {
		const raw = localStorage.getItem('diffFontSize');
		const n   = raw ? parseInt(raw, 10) : 12;
		return [ 11, 12, 13, 14, 16 ].includes(n) ? n : 12;
	})();

	readonly diffFontSizePresets = [
		{ value : 11, label : 'x-small' },
		{ value : 12, label : 'small' },
		{ value : 13, label : 'medium' },
		{ value : 14, label : 'large' },
		{ value : 16, label : 'x-large' },
	] as const;

	resolvedScheme: ResolvedScheme = getResolvedScheme();
	hljsTheme = getStoredHljsThemeId(getResolvedScheme());
	viewedFiles: Record<string, string> = {};
	reviewComments: ReviewComment[] = [];
	issueComments: IssueComment[] = [];
	pendingComments: PendingComment[] = [];
	prNodeId = '';
	reviewCommentsLoading = false;
	submittingReview = false;
	approvingPr = false;
	mergingPr = false;
	mergeConfirmOpen = false;
	mergeConfirmError = '';
	titleEditOpen = false;
	titleEditValue = '';
	titleEditError = '';
	updatingTitle = false;
	togglingDraft = false;
	whitespaceViewedConfirmOpen = false;
	whitespaceViewedConfirmError = '';
	markingWhitespaceViewed = false;
	reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null = null;

	@Watch('tabSize')
	onTabSizeChanged(val: number) {
		localStorage.setItem('diffTabSize', String(val));
	}

	@Watch('diffFontSize')
	onDiffFontSizeChanged(val: number) {
		localStorage.setItem('diffFontSize', String(val));
	}

	@Watch('hljsTheme')
	onHljsThemeChanged(val: string) {
		setStoredHljsThemeId(this.resolvedScheme, val);
		loadHljsTheme(val);
	}

	/** Stable key for SPA navigation between PRs (owner/repo/number only). */
	get prRouteKey(): string {
		return `${this.owner}/${this.repo}/${this.number}`;
	}

	@Watch('prRouteKey')
	onPrRouteKeyChanged(_newKey: string, oldKey: string | undefined) {
		if (oldKey === undefined) {
			return;
		}
		const parts = oldKey.split('/');
		if (parts.length !== 3) {
			return;
		}
		const [ o, r, nStr ] = parts;
		const n              = parseInt(nStr, 10);
		if (!Number.isFinite(n)) {
			return;
		}
		const head = this.pr?.head?.sha;
		if (head) {
			savePendingReview(o, r, n, head, this.pendingComments);
		}
		this.pendingComments = [];
		void this.loadAll();
	}

	get hljsThemesFiltered() {
		return hljsThemesForResolvedScheme(this.resolvedScheme);
	}

	readonly timeAgo = timeAgo;

	private _checksTimer: ReturnType<typeof setInterval> | null = null;
	private _unsubColorScheme: (() => void) | null = null;
	private _originalTitle = '';

	get prNumber(): number {
		return parseInt(this.number, 10);
	}

	/** Header badge: open PRs show # only; draft / merged / closed add an explicit status. */
	get prStatusBadgeText(): string {
		if (!this.pr) {
			return '';
		}
		const n = this.pr.number;
		if (this.pr.draft) {
			return `#${n} · Draft`;
		}
		if (this.pr.merged) {
			return `#${n} · Merged`;
		}
		if (this.pr.state === 'closed') {
			return `#${n} · Closed`;
		}
		return `#${n}`;
	}

	get initialFileIndex(): number {
		const q   = this.$route.query.file;
		const idx = typeof q === 'string' ? parseInt(q, 10) : NaN;
		return isNaN(idx) ? 0 : idx;
	}

	get reviewedCount(): number {
		return Object.values(this.viewedFiles).filter(s => s === 'VIEWED').length;
	}

	get reviewPct(): number {
		const total = this.files.length;
		if (!total) {
			return 0;
		}
		return Math.round((this.reviewedCount / total) * 100);
	}

	get whitespaceOnlyUnviewedFiles(): PRFile[] {
		return this.files.filter(f => isWhitespaceOnlyFileChange(f) && this.viewedFiles[f.filename] !== 'VIEWED');
	}

	get whitespaceOnlyUnviewedCount(): number {
		return this.whitespaceOnlyUnviewedFiles.length;
	}

	get showMarkWhitespaceViewedButton(): boolean {
		return Boolean(this.files.length && this.prNodeId && this.whitespaceOnlyUnviewedCount > 0);
	}

	get showMergePrButton(): boolean {
		if (!this.pr) {
			return false;
		}
		if (this.pr.draft || this.pr.state !== 'open' || this.pr.merged) {
			return false;
		}
		return this.reviewDecision === 'APPROVED';
	}

	/** Approve in header only on Files tab, same slot as Merge PR on Overview. */
	get showApproveInHeader(): boolean {
		if (this.activeTab !== 'files') {
			return false;
		}
		if (!this.files.length) {
			return false;
		}
		return this.reviewPct >= 100 && this.reviewDecision !== 'APPROVED';
	}

	get canToggleDraft(): boolean {
		return Boolean(this.pr && this.pr.state === 'open' && !this.pr.merged);
	}

	get draftToggleTooltip(): string {
		if (!this.pr) {
			return '';
		}
		return this.pr.draft ? 'Publish this pull request (remove draft), same as on GitHub.' : 'Convert to draft: stays open but is not ready for review until you publish.';
	}

	mounted() {
		this._originalTitle = document.title;
		if (this.tab === 'files') {
			this.activeTab = 'files';
		}
		const token = getStoredToken();
		if (token) {
			GitHubClient.setToken(token);
		}
		this.resolvedScheme = getResolvedScheme();
		this.hljsTheme      = getStoredHljsThemeId(this.resolvedScheme);
		loadHljsTheme(this.hljsTheme);
		this._unsubColorScheme = subscribeColorScheme(() => {
			const next          = getResolvedScheme();
			this.resolvedScheme = next;
			this.hljsTheme      = getStoredHljsThemeId(next);
			loadHljsTheme(this.hljsTheme);
		});
		this.loadAll();
	}

	beforeUnmount() {
		this.persistPendingToStorage();
		this.stopChecksPolling();
		this._unsubColorScheme?.();
		this._unsubColorScheme = null;
		document.title         = this._originalTitle;
	}

	async loadAll() {
		this.loading = true;
		this.error   = '';
		try {
			const [ pr, decision ] = await Promise.all([
				GitHubClient.fetchPRDetail(this.owner, this.repo, this.prNumber),
				GitHubClient.fetchPullRequestReviewDecision(this.owner, this.repo, this.prNumber),
			]);
			this.pr             = pr;
			this.reviewDecision = decision;
			document.title      = `#${this.pr.number} ${this.pr.title}`;
			const headSha       = pr.head?.sha;
			if (headSha) {
				const restored       = loadPendingReview(this.owner, this.repo, this.prNumber, headSha);
				this.pendingComments = restored ?? [];
			}
			else {
				this.pendingComments = [];
			}
			if (pr.user?.login) {
				await GitHubClient.fetchUserFirstNames([ pr.user.login ]);
			}
			this.loading = false;
			this.loadChecks();
			this.loadRepoLabels();
			this.loadReviewComments();
			if (this.activeTab === 'files') {
				this.loadFiles();
			}
		}
		catch (e: any) {
			this.error   = e.message || 'Failed to load PR';
			this.loading = false;
		}
	}

	async loadChecks() {
		this.checksLoading = true;
		try {
			this.checks      = await GitHubClient.fetchDetailedChecks(this.owner, this.repo, this.prNumber);
			const hasPending = this.checks.some(check => {
				const passed = [ 'success', 'neutral', 'skipped' ].includes(check.conclusion ?? '');
				const failed = [ 'failure', 'timed_out', 'cancelled', 'error' ].includes(check.conclusion ?? '');
				return !passed && !failed;
			});
			if (hasPending) {
				this.startChecksPolling();
			}
		}
		catch {
			this.checks = [];
		}
		finally {
			this.checksLoading = false;
		}
	}

	async loadRepoLabels() {
		try {
			this.repoLabels = await GitHubClient.fetchRepoLabels(this.owner, this.repo);
		}
		catch {
			this.repoLabels = [];
		}
	}

	async loadFiles() {
		if (this.files.length || this.filesLoading) {
			return;
		}
		this.filesLoading = true;
		try {
			this.files = await GitHubClient.fetchPRFiles(this.owner, this.repo, this.prNumber);
			await this.loadViewedState();
		}
		catch {
			this.files = [];
		}
		finally {
			this.filesLoading = false;
		}
	}

	async loadReviewComments() {
		this.reviewCommentsLoading = true;
		try {
			const [ rRev, rIss ] = await Promise.allSettled([
				GitHubClient.fetchPRReviewComments(this.owner, this.repo, this.prNumber),
				GitHubClient.fetchPRIssueComments(this.owner, this.repo, this.prNumber),
			]);
			this.reviewComments = rRev.status === 'fulfilled' ? rRev.value : [];
			this.issueComments  = rIss.status === 'fulfilled' ? rIss.value : [];
		}
		finally {
			this.reviewCommentsLoading = false;
		}
	}

	async loadViewedState() {
		try {
			const result  = await GitHubClient.fetchPRFilesViewedState(this.owner, this.repo, this.prNumber);
			this.prNodeId = result.prNodeId;
			const byPath  = result.viewedFiles;
			if (this.files.length) {
				const merged: Record<string, string> = {};
				for (const f of this.files) {
					let state = byPath[f.filename];
					if (state === undefined && f.previous_filename) {
						state = byPath[f.previous_filename];
					}
					if (state !== undefined) {
						merged[f.filename] = state;
					}
				}
				this.viewedFiles = merged;
			}
			else {
				this.viewedFiles = byPath;
			}
		}
		catch {
			this.viewedFiles = {};
		}
	}

	switchTab(tab: 'overview' | 'files') {
		this.activeTab = tab;
		const base     = `/pull-request/${this.owner}/${this.repo}/${this.number}/${tab}`;
		this.$router.replace({ path : base });
		if (tab === 'files') {
			this.loadFiles();
		}
	}

	onFileIndexChange(index: number) {
		this.$router.replace({
			path  : `/pull-request/${this.owner}/${this.repo}/${this.number}/files`,
			query : { file : String(index) },
		});
	}

	onViewedChange(payload: { filename: string; state: string }) {
		this.viewedFiles = { ...this.viewedFiles, [payload.filename] : payload.state };
	}

	startChecksPolling() {
		this.stopChecksPolling();
		this._checksTimer = setInterval(async () => {
			try {
				this.checks      = await GitHubClient.fetchDetailedChecks(this.owner, this.repo, this.prNumber);
				const hasPending = this.checks.some(c => {
					const con    = c.conclusion;
					const passed = con === 'success' || con === 'neutral' || con === 'skipped';
					const failed = con === 'failure' || con === 'timed_out' || con === 'cancelled' || con === 'error';
					return !passed && !failed;
				});
				if (!hasPending) {
					this.stopChecksPolling();
				}
			}
			catch {
				this.stopChecksPolling();
			}
		}, 10000);
	}

	stopChecksPolling() {
		if (this._checksTimer) {
			clearInterval(this._checksTimer);
			this._checksTimer = null;
		}
	}

	async addLabel(name: string) {
		const fullRepo = `${this.owner}/${this.repo}`;
		try {
			await GitHubClient.addLabel(fullRepo, this.prNumber, name);
			const matched = this.repoLabels.find(l => l.name === name);
			if (matched) {
				this.pr.labels.push({ id : matched.id, name : matched.name, color : matched.color });
			}
		}
		catch (e: any) {
			console.error('Failed to add label:', e);
		}
	}

	async removeLabel(name: string) {
		const fullRepo = `${this.owner}/${this.repo}`;
		try {
			await GitHubClient.removeLabel(fullRepo, this.prNumber, name);
			this.pr.labels = this.pr.labels.filter((l: any) => l.name !== name);
		}
		catch (e: any) {
			console.error('Failed to remove label:', e);
		}
	}

	onAddPending(comment: PendingComment) {
		this.pendingComments = [ ...this.pendingComments, comment ];
		this.persistPendingToStorage();
	}

	onRemovePending(id: string) {
		this.pendingComments = this.pendingComments.filter(c => c.id !== id);
		this.persistPendingToStorage();
	}

	onEditPending(updated: PendingComment) {
		this.pendingComments = this.pendingComments.map(c => (c.id === updated.id ? updated : c));
		this.persistPendingToStorage();
	}

	onCommentsUpdated() {
		this.loadReviewComments();
	}

	async submitReview() {
		if (!this.pendingComments.length || this.submittingReview) {
			return;
		}
		this.submittingReview = true;
		try {
			await GitHubClient.submitReview(this.owner, this.repo, this.prNumber, this.pr.head.sha, this.pendingComments);
			this.pendingComments = [];
			this.persistPendingToStorage();
			await this.loadReviewComments();
		}
		catch (e: any) {
			console.error('Failed to submit review:', e);
		}
		finally {
			this.submittingReview = false;
		}
	}

	discardAllPending() {
		this.pendingComments = [];
		this.persistPendingToStorage();
	}

	private persistPendingToStorage() {
		if (!this.pr?.head?.sha) {
			return;
		}
		savePendingReview(this.owner, this.repo, this.prNumber, this.pr.head.sha, this.pendingComments);
	}

	async approvePr() {
		if (this.approvingPr) {
			return;
		}
		this.approvingPr = true;
		try {
			await GitHubClient.submitReview(this.owner, this.repo, this.prNumber, this.pr.head.sha, [], 'APPROVE');
			this.reviewDecision = await GitHubClient.fetchPullRequestReviewDecision(this.owner, this.repo, this.prNumber);
		}
		catch (e: any) {
			console.error('Failed to approve PR:', e);
		}
		finally {
			this.approvingPr = false;
		}
	}

	openMergeConfirm() {
		if (this.mergingPr || !this.pr) {
			return;
		}
		this.mergeConfirmError = '';
		this.mergeConfirmOpen  = true;
	}

	closeMergeConfirm() {
		if (this.mergingPr) {
			return;
		}
		this.mergeConfirmOpen  = false;
		this.mergeConfirmError = '';
	}

	openWhitespaceViewedConfirm() {
		if (this.markingWhitespaceViewed || !this.whitespaceOnlyUnviewedCount) {
			return;
		}
		this.whitespaceViewedConfirmError = '';
		this.whitespaceViewedConfirmOpen  = true;
	}

	closeWhitespaceViewedConfirm() {
		if (this.markingWhitespaceViewed) {
			return;
		}
		this.whitespaceViewedConfirmOpen  = false;
		this.whitespaceViewedConfirmError = '';
	}

	openTitleEdit() {
		if (!this.pr) {
			return;
		}
		this.titleEditValue = this.pr.title || '';
		this.titleEditError = '';
		this.titleEditOpen  = true;
		this.$nextTick(() => {
			const el = this.$refs.prTitleEditInput as HTMLInputElement | undefined;
			el?.focus();
			el?.select();
		});
	}

	closeTitleEdit() {
		if (this.updatingTitle) {
			return;
		}
		this.titleEditOpen  = false;
		this.titleEditError = '';
	}

	async saveTitleEdit() {
		if (!this.pr || this.updatingTitle) {
			return;
		}
		const next = this.titleEditValue.trim();
		if (!next) {
			this.titleEditError = 'Title cannot be empty.';
			return;
		}
		if (next === this.pr.title) {
			this.closeTitleEdit();
			return;
		}
		this.titleEditError = '';
		this.updatingTitle  = true;
		try {
			const updated      = await GitHubClient.updatePullRequest(this.owner, this.repo, this.prNumber, { title : next });
			this.pr.title      = updated.title ?? next;
			document.title     = `#${this.pr.number} ${this.pr.title}`;
			this.titleEditOpen = false;
		}
		catch (e: any) {
			this.titleEditError = e.message || 'Failed to update title';
		}
		finally {
			this.updatingTitle = false;
		}
	}

	async togglePrDraft() {
		if (!this.pr || !this.canToggleDraft || this.togglingDraft) {
			return;
		}
		this.togglingDraft = true;
		try {
			const updated = await GitHubClient.updatePullRequest(this.owner, this.repo, this.prNumber, {
				draft : !this.pr.draft,
			});
			this.pr.draft = Boolean(updated.draft);
		}
		catch (e: any) {
			console.error('Failed to update draft state:', e);
		}
		finally {
			this.togglingDraft = false;
		}
	}

	async confirmMarkWhitespaceViewedFiles() {
		if (this.markingWhitespaceViewed || !this.prNodeId) {
			return;
		}
		const targets = this.whitespaceOnlyUnviewedFiles;
		if (!targets.length) {
			this.whitespaceViewedConfirmOpen = false;
			return;
		}
		this.whitespaceViewedConfirmError = '';
		this.markingWhitespaceViewed      = true;
		try {
			for (const f of targets) {
				await GitHubClient.markFileAsViewed(this.prNodeId, f.filename);
				this.viewedFiles = { ...this.viewedFiles, [f.filename] : 'VIEWED' };
			}
			await this.loadViewedState();
			this.whitespaceViewedConfirmOpen = false;
		}
		catch (e: any) {
			console.error('Failed to mark whitespace-only files as viewed:', e);
			this.whitespaceViewedConfirmError = e.message || 'Failed to mark files as viewed';
		}
		finally {
			this.markingWhitespaceViewed = false;
		}
	}

	async confirmMergePr() {
		if (this.mergingPr || !this.pr) {
			return;
		}
		this.mergeConfirmError = '';
		this.mergingPr         = true;
		try {
			await GitHubClient.mergePullRequestSquash(this.owner, this.repo, this.prNumber);
			this.mergeConfirmOpen = false;
			await this.loadAll();
		}
		catch (e: any) {
			console.error('Failed to merge PR:', e);
			this.mergeConfirmError = e.message || 'Merge failed';
		}
		finally {
			this.mergingPr = false;
		}
	}

}
</script>

<style>
.pr-detail-page {
	max-width: 100%;
	margin: 0 auto;
	padding: 0;
	height: 100vh;
}

.pr-detail-tab-shell > * {
	flex: 1;
	min-height: 0;
	min-width: 0;
	overflow: hidden;
}

.pr-detail-header {
	background: var(--bg-secondary);
	border-bottom: 1px solid var(--border);
}

html[data-color-scheme="light"] .pr-detail-header {
	background: #e4e7ec;
}

.pr-detail-back {
	color: var(--text-secondary);
	text-decoration: none;
	font-size: 18px;
	line-height: 1;
	transition: color var(--transition);

	&:hover {
		color: var(--text-primary);
	}
}

.pr-detail-title {
	line-height: 1.2;
}

.pr-detail-header-icon-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	width: 28px;
	height: 28px;
	padding: 0;
	border: 1px solid var(--border);
	border-radius: var(--radius-sm);
	background: var(--bg-primary);
	color: var(--text-secondary);
	cursor: pointer;
	transition:
		color var(--transition),
		border-color var(--transition),
		background var(--transition);
}

.pr-detail-header-icon-btn:hover {
	color: var(--text-primary);
	border-color: var(--text-tertiary);
}

.pr-detail-header-draft-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 3px 10px;
	border: 1px solid var(--border);
	border-radius: var(--radius-sm);
	background: var(--bg-primary);
	color: var(--text-secondary);
	font-size: 12px;
	font-weight: 600;
	font-family: inherit;
	cursor: pointer;
	white-space: nowrap;
	transition: all var(--transition);
}

.pr-detail-header-draft-btn:hover:not(:disabled) {
	color: var(--text-primary);
	border-color: var(--text-tertiary);
}

.pr-detail-header-draft-btn:disabled {
	opacity: 0.6;
	cursor: default;
}

.pr-title-edit-input {
	box-sizing: border-box;
	width: 100%;
	margin: 0 0 16px;
	padding: 8px 10px;
	font-size: 14px;
	font-family: inherit;
	color: var(--text-primary);
	background: var(--bg-primary);
	border: 1px solid var(--border);
	border-radius: var(--radius-sm);
}

.pr-title-edit-input:focus {
	outline: none;
	border-color: var(--accent-blue);
	box-shadow: 0 0 0 2px var(--accent-blue-bg, rgba(88, 166, 255, 0.2));
}

.pr-detail-badge {
	font-size: 12px;
	font-weight: 600;
	padding: 2px 8px;
	border-radius: 20px;
	white-space: nowrap;
}

.pr-detail-badge-open {
	background: var(--accent-green-bg);
	color: var(--accent-green);
}

.pr-detail-badge-closed {
	background: var(--danger-bg-subtle);
	color: var(--accent-red);
}

.pr-detail-badge-merged {
	background: var(--accent-purple-bg);
	color: var(--accent-purple);
}

.pr-detail-badge-draft {
	background: var(--muted-bg);
	color: var(--text-secondary);
}

.pr-detail-avatar {
	width: 20px;
	height: 20px;
	border-radius: 50%;
}

.pr-detail-github-link {
	color: var(--text-secondary);
	text-decoration: none;
	font-size: 13px;
	white-space: nowrap;
	transition: color var(--transition);

	&:hover {
		color: var(--text-primary);
	}
}

.pr-detail-tabs {
	background: var(--bg-primary);
	border-radius: var(--radius-sm);
	border: 1px solid var(--border);
}

.pr-detail-tab {
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
	white-space: nowrap;

	&:hover {
		color: var(--text-secondary);
	}

	&.active {
		color: var(--text-primary);
		background: var(--bg-tertiary);
	}
}

.pr-detail-review-bar-track {
	width: 60px;
	height: 6px;
	border-radius: 3px;
	background: var(--bg-tertiary);
	overflow: hidden;
}

.pr-detail-review-bar-fill {
	display: block;
	height: 100%;
	border-radius: 3px;
	transition:
		width 0.3s ease,
		background 0.3s ease;
}

.pr-detail-review-pct {
	font-size: 13px;
	font-weight: 700;
	min-width: 32px;
}

.pr-detail-review-progress.low {
	.pr-detail-review-bar-fill {
		background: var(--text-tertiary);
	}
	.pr-detail-review-pct {
		color: var(--text-secondary);
	}
}

.pr-detail-review-progress.partial {
	.pr-detail-review-bar-fill {
		background: var(--accent-orange);
	}
	.pr-detail-review-pct {
		color: var(--accent-orange);
	}
}

.pr-detail-review-progress.complete {
	.pr-detail-review-bar-fill {
		background: var(--accent-green);
	}
	.pr-detail-review-pct {
		color: var(--accent-green);
	}
}

.pr-whitespace-viewed-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 3px 10px;
	margin-left: 8px;
	border: 1px solid var(--border);
	border-radius: var(--radius-sm);
	background: var(--bg-primary);
	color: var(--text-secondary);
	font-size: 12px;
	font-weight: 600;
	font-family: inherit;
	cursor: pointer;
	white-space: nowrap;
	transition: all var(--transition);
}

.pr-whitespace-viewed-btn:hover:not(:disabled) {
	color: var(--text-primary);
	border-color: var(--text-tertiary);
}

.pr-whitespace-viewed-btn:disabled {
	opacity: 0.6;
	cursor: default;
}

.pr-detail-header-center .pr-whitespace-viewed-btn.has-tooltip {
	position: relative;
}

.pr-approve-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 3px 10px;
	border: none;
	border-radius: var(--radius-sm);
	background: var(--accent-green);
	color: var(--btn-primary-fg);
	font-size: 12px;
	font-weight: 600;
	font-family: inherit;
	cursor: pointer;
	white-space: nowrap;
	transition: all var(--transition);
	margin-left: 4px;
}

.pr-approve-btn:hover:not(:disabled) {
	filter: brightness(1.15);
}

.pr-approve-btn:disabled {
	opacity: 0.6;
	cursor: default;
}

.pr-merge-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 3px 10px;
	border: none;
	border-radius: var(--radius-sm);
	background: var(--accent-purple);
	color: var(--btn-primary-fg);
	font-size: 12px;
	font-weight: 600;
	font-family: inherit;
	cursor: pointer;
	white-space: nowrap;
	transition: all var(--transition);
	margin-left: 4px;
}

.pr-merge-btn:hover:not(:disabled) {
	filter: brightness(1.12);
}

.pr-merge-btn:disabled {
	opacity: 0.6;
	cursor: default;
}

.pr-merge-confirm-backdrop {
	background: var(--overlay-backdrop);
	backdrop-filter: blur(2px);
}

.pr-merge-confirm-dialog {
	width: 100%;
	max-width: 420px;
	padding: 22px 24px;
	background: var(--bg-secondary);
	border: 1px solid var(--border);
	border-radius: var(--radius-md);
	box-shadow: var(--shadow-lg);
}

.pr-merge-confirm-title {
	font-size: 18px;
	font-weight: 600;
	margin: 0 0 12px;
	color: var(--text-primary);
}

.pr-merge-confirm-body {
	margin: 0 0 16px;
	font-size: 14px;
	line-height: 1.5;
	color: var(--text-secondary);
}

.pr-merge-confirm-repo {
	color: var(--text-tertiary);
	font-size: 13px;
}

.pr-merge-confirm-error {
	margin: 0 0 16px;
	padding: 10px 12px;
	font-size: 13px;
	line-height: 1.4;
	color: var(--accent-red);
	background: var(--danger-bg-subtle);
	border: 1px solid var(--danger-border);
	border-radius: var(--radius-sm);
}

.pr-merge-confirm-submit {
	background: var(--accent-purple);
	color: var(--btn-primary-fg);
	border-color: transparent;
}

.pr-merge-confirm-submit:hover:not(:disabled) {
	filter: brightness(1.08);
}

.pr-merge-confirm-submit:disabled {
	opacity: 0.65;
	cursor: default;
}

.pr-detail-control-wrap {
	display: inline-flex;
	align-items: center;
	vertical-align: middle;
}

.pr-detail-control-wrap.has-tooltip {
	position: relative;
}

.pr-detail-control-wrap.has-tooltip::after {
	content: attr(data-tooltip);
	position: absolute;
	top: calc(100% + 6px);
	right: 0;
	left: auto;
	transform: none;
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
	z-index: 200;
	max-width: min(280px, 70vw);
	text-align: left;
}

.pr-detail-control-wrap.has-tooltip:hover::after {
	opacity: 1;
}

.pr-detail-tab-size {
	padding: 4px 24px 4px 8px;
	background: var(--bg-primary);
	color: var(--text-secondary);
	border: 1px solid var(--border);
	border-radius: var(--radius-sm);
	font-size: 12px;
	font-family: inherit;
	cursor: pointer;
	appearance: none;
	background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='%238b949e'%3E%3Cpath d='M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z'/%3E%3C/svg%3E");
	background-repeat: no-repeat;
	background-position: right 6px center;
	transition: all var(--transition);

	&:hover {
		border-color: var(--border-hover);
		color: var(--text-primary);
	}

	&:focus {
		outline: none;
		border-color: var(--focus-ring);
		box-shadow: 0 0 0 1px var(--focus-ring);
	}
}

.pr-review-submit-btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 5px 14px;
	border: none;
	border-radius: var(--radius-sm);
	background: var(--btn-primary-bg);
	color: var(--btn-primary-fg);
	font-size: 12px;
	font-weight: 600;
	font-family: inherit;
	cursor: pointer;
	white-space: nowrap;
	transition: all var(--transition);

	&:hover:not(:disabled) {
		background: var(--btn-primary-hover);
	}
	&:disabled {
		opacity: 0.6;
		cursor: default;
	}
}

.pr-review-discard-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	border: 1px solid var(--border);
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-tertiary);
	font-size: 16px;
	cursor: pointer;
	transition: all var(--transition);

	&:hover {
		color: var(--accent-red);
		border-color: var(--accent-red);
		background: var(--danger-bg-subtle);
	}
}

.pr-detail-appearance :deep(.appearance-select) {
	padding: 4px 24px 4px 8px;
	font-size: 12px;
	max-width: 100px;
	background-position: right 6px center;
}

.pr-detail-appearance :deep(.appearance-select:focus) {
	border-color: var(--focus-ring);
	box-shadow: 0 0 0 1px var(--focus-ring);
}
</style>
