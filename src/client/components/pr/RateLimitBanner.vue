<template>
	<div class="rate-limit-banner u-flex u-items-center u-gap-2 u-py-2 u-px-6 u-fs-13 u-fw-500 u-sticky u-z-99" v-show="visible">
		<span class="u-flex-shrink-0" v-html="$icon('warning', 16)"></span>
		<span class="u-flex-1">{{ message }}</span>
		<button class="rate-limit-dismiss" title="Dismiss" @click="$emit('dismiss')">×</button>
	</div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-facing-decorator';

/** Dismissible warning banner shown when the GitHub API rate limit is exceeded. */
@Component({ emits : [ 'dismiss' ] })
export default class RateLimitBanner extends Vue {

	@Prop({ required : true }) readonly visible!: boolean;
	@Prop({ required : true }) readonly message!: string;

}
</script>

<style>
.rate-limit-banner {
	top: 50px;
	background: var(--danger-btn-bg);
	border-bottom: 1px solid var(--accent-red);
	color: var(--accent-red);
}

.rate-limit-dismiss {
	background: none;
	border: none;
	color: var(--accent-red);
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
