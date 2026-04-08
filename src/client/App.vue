<template>
  <app-header
    :user="user"
    :repos="repos"
    :current-repo="currentRepo"
    :current-type-filter="currentTypeFilter"
    :selected-team="selectedTeam"
    :refreshing="refreshing"
    @set-type-filter="setTypeFilter"
    @set-repo="setRepo"
    @set-team="setTeam"
    @refresh="handleRefresh"
    @logout="handleLogout"
  />
  <rate-limit-banner
    :visible="rateLimitVisible"
    :message="rateLimitMessage"
    @dismiss="dismissRateLimit"
  />
  <auth-screen
    v-if="currentScreen === 'auth'"
    :disabled="loginDisabled"
    @login="handleLogin"
  />
  <device-screen
    v-if="currentScreen === 'device'"
    :code="deviceCode"
    :url="deviceUrl"
    @cancel="handleCancelAuth"
  />
  <loading-screen v-if="currentScreen === 'loading'" />
  <pr-board
    v-if="currentScreen === 'pr'"
    :all-prs="allPRs"
    :current-type-filter="currentTypeFilter"
    :current-repo="currentRepo"
    :selected-team="selectedTeam"
    :async-version="dataVersion"
    :branches="branches"
    :user="user"
    @create-pr="handleCreatePR"
    @api-error="handleBoardApiError"
    @show-error="showError"
    @prs-changed="handlePRsChanged"
  />
  <error-screen v-if="currentScreen === 'error'" :message="errorMessage" @retry="handleRetry" />
</template>

<script lang="ts">
import { Component, Watch, Vue } from 'vue-facing-decorator';
import GitHubClient from '@/lib/githubClient';
import type { ApiError } from '@/lib/githubClient';
import {
  getStoredToken,
  storeToken,
  clearToken,
  startDeviceFlow,
  pollForToken,
  cancelPolling,
} from '@/services/auth';

/** Dashboard root — manages auth, data fetching, polling, and screen navigation. */
@Component
export default class App extends Vue {
  currentScreen = 'auth';
  currentTypeFilter = 'ready';
  currentRepo = localStorage.getItem('selectedRepo') || '';
  selectedTeam = (['alpha', 'beta', 'gamma'].includes(localStorage.getItem('selectedTeam')!) ? localStorage.getItem('selectedTeam')! : 'alpha');
  allPRs: any[] = [];
  user: any = null;
  errorMessage = '';
  deviceCode = '';
  deviceUrl = '';
  rateLimitVisible = false;
  rateLimitMessage = '';
  branches: any[] = [];
  refreshing = false;
  loginDisabled = false;
  dataVersion = 0;

  private _rateLimitTimer: ReturnType<typeof setTimeout> | null = null;
  private _checksTimer: ReturnType<typeof setInterval> | null = null;

  get repos(): string[] {
    const set = new Set<string>();
    this.allPRs.forEach(pr => {
      const m = pr.repository_url.match(/repos\/([^/]+\/[^/]+)/);
      if (m) set.add(m[1]);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  @Watch('repos')
  onReposChange(newRepos: string[]) {
    if (this.currentRepo && !newRepos.includes(this.currentRepo)) {
      this.currentRepo = '';
      localStorage.removeItem('selectedRepo');
    }
  }

  mounted() {
    this.init();
  }

  // ── Screen management ──────────────────────────────────

  showScreen(name: string) {
    this.currentScreen = name;
  }

  showError(msg: string | Error | any) {
    this.errorMessage = typeof msg === 'string' ? msg : msg.message || 'Something went wrong';
    this.showScreen('error');
  }

  // ── Rate limit ─────────────────────────────────────────

  showRateLimitBanner(error: ApiError) {
    let msg = 'GitHub API rate limit exceeded.';
    if (error.rateLimitReset) {
      const resetMs = error.rateLimitReset.getTime() - Date.now();
      if (resetMs > 0) {
        const mins = Math.ceil(resetMs / 60000);
        msg += ' Resets in ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.';
      }
    }
    this.rateLimitMessage = msg;
    this.rateLimitVisible = true;
    if (this._rateLimitTimer) clearTimeout(this._rateLimitTimer);
    this._rateLimitTimer = setTimeout(() => { this.rateLimitVisible = false; }, 60000);
  }

  dismissRateLimit() {
    this.rateLimitVisible = false;
    if (this._rateLimitTimer) clearTimeout(this._rateLimitTimer);
  }

  // ── API error handling ─────────────────────────────────

  isRateLimitError(error: any): boolean {
    return error.rateLimitReset || error.message?.includes('rate limit');
  }

  async handleApiError(error: any): Promise<boolean> {
    if (this.isRateLimitError(error)) {
      this.showRateLimitBanner(error);
      return true;
    }
    if (error.status === 401) {
      clearToken();
      this.user = null;
      this.showScreen('auth');
      return true;
    }
    return false;
  }

  handleAsyncError(error: any) {
    if (this.isRateLimitError(error)) this.showRateLimitBanner(error);
  }

  // ── Filter changes ─────────────────────────────────────

  setTypeFilter(type: string) {
    this.currentTypeFilter = type;
  }

  setRepo(repo: string) {
    this.currentRepo = repo;
    if (repo) localStorage.setItem('selectedRepo', repo);
    else localStorage.removeItem('selectedRepo');
    this.fetchAndRenderBranches();
  }

  setTeam(team: string) {
    this.selectedTeam = team;
    localStorage.setItem('selectedTeam', team);
  }

  // ── Auth: Device Flow ──────────────────────────────────

  async handleLogin() {
    this.loginDisabled = true;
    try {
      const response = await startDeviceFlow();
      this.deviceCode = response.user_code;
      this.deviceUrl = response.verification_uri;
      this.showScreen('device');

      const token = await pollForToken(response.device_code, response.interval, response.expires_in);
      storeToken(token);
      GitHubClient.setToken(token);
      await this.loadData();
    } catch (error: any) {
      this.loginDisabled = false;
      if (error.message !== 'Authentication cancelled') {
        this.showError(error.message);
      } else {
        this.showScreen('auth');
      }
    }
  }

  async handleCancelAuth() {
    cancelPolling();
    this.loginDisabled = false;
    this.showScreen('auth');
  }

  // ── Logout ─────────────────────────────────────────────

  handleLogout() {
    this.stopChecksPolling();
    clearToken();
    GitHubClient.clear();
    this.allPRs = [];
    this.user = null;
    this.branches = [];
    this.showScreen('auth');
  }

  // ── Refresh ────────────────────────────────────────────

  async handleRefresh() {
    this.stopChecksPolling();
    this.refreshing = true;
    try {
      GitHubClient.clearAsyncCaches();
      await this.fetchPRs(this.currentRepo);
      this.dataVersion++;
      await this.fetchAndRenderBranches();
      this.fetchAsyncData();
    } catch (error: any) {
      const handled = await this.handleApiError(error);
      if (!handled) this.showError(error.message);
    } finally {
      this.refreshing = false;
    }
  }

  // ── Data loading ───────────────────────────────────────

  async fetchPRs(repo?: string) {
    if (repo) {
      const repoPRs = await GitHubClient.fetchRepoPRs(repo);
      const existingIds = new Set(repoPRs.map((pr: any) => pr.id));
      this.allPRs = [
        ...repoPRs,
        ...this.allPRs.filter(pr => {
          const m = pr.repository_url.match(/repos\/([^/]+\/[^/]+)/);
          return !existingIds.has(pr.id) && m && m[1] !== repo;
        }),
      ];
    } else {
      this.allPRs = await GitHubClient.fetchAllAccessiblePRs();
    }
    const logins = [...new Set(this.allPRs.map(pr => pr.user.login))];
    await GitHubClient.fetchUserFirstNames(logins);
  }

  getVisiblePRs(): any[] {
    if (!this.currentRepo) return this.allPRs;
    return this.allPRs.filter(pr => {
      const m = pr.repository_url.match(/repos\/([^/]+\/[^/]+)/);
      return m && m[1] === this.currentRepo;
    });
  }

  fetchAsyncData() {
    const prs = this.getVisiblePRs();
    GitHubClient.fetchBotCommentCounts(prs).then(() => { this.dataVersion++; }).catch(e => this.handleAsyncError(e));
    GitHubClient.fetchPRStats(prs).then(() => { this.dataVersion++; }).catch(e => this.handleAsyncError(e));
    GitHubClient.fetchChecks(prs).then(() => {
      this.dataVersion++;
      if (this.getPRsNeedingCheckRefresh().length > 0) this.startChecksPolling();
    }).catch(e => this.handleAsyncError(e));
  }

  // ── Checks polling ─────────────────────────────────────

  isMergeLabeled(pr: any): boolean {
    const hasL = (name: string) => pr.labels?.some((l: any) => l.name.toLowerCase() === name.toLowerCase());
    return hasL('ready to merge') || hasL('δ: ready to merge');
  }

  getPRsNeedingCheckRefresh(): any[] {
    return this.allPRs.filter(pr => {
      const checks = GitHubClient.getChecks(pr.id);
      if (!checks) return false;
      if (checks.pending > 0) return true;
      if (this.isMergeLabeled(pr) && (checks.failed > 0 || checks.pending > 0)) return true;
      return false;
    });
  }

  startChecksPolling() {
    this.stopChecksPolling();
    this._checksTimer = setInterval(() => {
      const needRefresh = this.getPRsNeedingCheckRefresh();
      if (needRefresh.length === 0) { this.stopChecksPolling(); return; }
      needRefresh.forEach(pr => GitHubClient.clearChecksCacheFor(pr.id));
      GitHubClient.fetchChecks(needRefresh).then(() => {
        this.dataVersion++;
        if (this.getPRsNeedingCheckRefresh().length === 0) this.stopChecksPolling();
      }).catch((error: any) => {
        this.handleAsyncError(error);
        if (error.rateLimitReset) this.stopChecksPolling();
      });
    }, 10000);
  }

  stopChecksPolling() {
    if (this._checksTimer) {
      clearInterval(this._checksTimer);
      this._checksTimer = null;
    }
  }

  // ── Create PR ──────────────────────────────────────────

  async fetchAndRenderBranches() {
    if (!this.currentRepo) { this.branches = []; return; }
    try {
      this.branches = await GitHubClient.fetchBranchesWithoutPRs(this.currentRepo);
    } catch (error: any) {
      const handled = await this.handleApiError(error);
      if (!handled) this.branches = [];
    }
  }

  async handleCreatePR({ branch, title }: { branch: string; title: string }) {
    if (!title || !this.currentRepo) return;
    try {
      await GitHubClient.createPR(this.currentRepo, branch, 'dev', title, ['α: review requested']);
      await this.handleRefresh();
      this.fetchAndRenderBranches();
    } catch (error: any) {
      const handled = await this.handleApiError(error);
      if (!handled) this.showError('Failed to create PR: ' + error.message);
    }
  }

  // ── Board events ───────────────────────────────────────

  async handleBoardApiError(error: any) {
    const handled = await this.handleApiError(error);
    if (!handled) this.showError('Failed to move PR: ' + error.message);
  }

  handlePRsChanged() {
    this.dataVersion++;
  }

  // ── Retry ──────────────────────────────────────────────

  handleRetry() {
    if (GitHubClient.getToken()) this.loadData();
    else this.showScreen('auth');
  }

  // ── Main init ──────────────────────────────────────────

  async loadData() {
    this.showScreen('loading');
    try {
      await GitHubClient.fetchCurrentUser();
      this.user = GitHubClient.getUser();
      await this.fetchPRs(this.currentRepo || undefined);
      this.showScreen('pr');
      this.fetchAsyncData();
      this.fetchAndRenderBranches();
    } catch (error: any) {
      const handled = await this.handleApiError(error);
      if (!handled) this.showError(error.message);
    }
  }

  async init() {
    const token = getStoredToken();
    if (token) {
      GitHubClient.setToken(token);
      await this.loadData();
    } else {
      this.showScreen('auth');
    }
  }
}
</script>
