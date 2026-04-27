<template>
	<div
		class="github-status-banner u-flex u-items-center u-gap-2 u-py-2 u-px-6 u-fs-13 u-fw-500 u-flex-shrink-0"
		:class="variantClass"
		v-show="visible"
	>
		<span class="u-flex-shrink-0" v-html="$icon('warning', 16)"></span>
		<span class="u-flex-1 u-min-w-0">{{ message }}</span>
		<a
			class="github-status-link u-flex-shrink-0 u-fw-500"
			href="https://www.githubstatus.com/"
			target="_blank"
			rel="noopener noreferrer"
		>githubstatus.com</a>
		<button class="github-status-dismiss u-fs-18 u-cursor-pointer u-p-0 u-px-1 u-leading-1" type="button" title="Dismiss" @click="$emit('dismiss')">×</button>
	</div>
</template>

<script lang="ts">
import type { GithubStatusBannerLevel } from '@/lib/githubStatus';

import { Component, Prop, Vue } from 'vue-facing-decorator';

/** Notice when GitHub.com reports issues affecting PRs, API, or git (public status page). */
@Component({ emits : [ 'dismiss' ] })
export default class GithubStatusBanner extends Vue {

	@Prop({ required : true }) readonly visible!: boolean;
	@Prop({ required : true }) readonly message!: string;
	@Prop({ required : true }) readonly level!: GithubStatusBannerLevel;

	get variantClass(): string {
		return this.level === 'critical' ? 'github-status--critical' : 'github-status--warning';
	}

}
</script>

<style>
.github-status-banner {
	background: var(--gh-status-bg);
	border-bottom: 1px solid var(--gh-status-border);
	color: var(--gh-status-fg);
}

.github-status--warning {
	--gh-status-bg: var(--bg-tertiary);
	--gh-status-border: var(--accent-orange);
	--gh-status-fg: var(--accent-orange);
}

.github-status--critical {
	--gh-status-bg: var(--danger-btn-bg);
	--gh-status-border: var(--danger-border);
	--gh-status-fg: var(--accent-red);
	--gh-status-dim: var(--text-secondary);
}

.github-status-link {
	color: var(--gh-status-fg);
	text-decoration: underline;
	text-underline-offset: 2px;
}

.github-status-link:hover {
	color: var(--gh-status-fg);
	filter: brightness(1.1);
}

.github-status-dismiss {
	background: none;
	border: none;
	color: var(--gh-status-fg);
	opacity: 0.7;
}

.github-status-dismiss:hover {
	opacity: 1;
}
</style>
