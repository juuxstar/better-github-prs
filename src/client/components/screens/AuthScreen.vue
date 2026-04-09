<template>
	<section class="screen">
		<div class="u-flex u-flex-col u-items-center u-justify-center u-flex-1 u-p-screen u-text-center">
			<div class="u-text-secondary u-mb-6 u-opacity-60" v-html="$icon('github', 48)"></div>
			<h2 class="u-fs-24 u-fw-600 u-mb-2-5 u-text-primary">Sign in with GitHub</h2>
			<p class="u-fs-15 u-leading-relaxed u-mb-8 u-max-w-360 u-text-secondary">Authenticate to view your open pull requests across all repositories.</p>
			<button class="btn btn-primary btn-lg" @click="$emit('login')" :disabled="disabled" v-html="buttonHtml"></button>
		</div>
	</section>
</template>

<script lang="ts">
import { iconSvg } from '@/lib/icons';

import { Component, Prop, Vue } from 'vue-facing-decorator';

/** Sign-in screen that prompts the user to authenticate via GitHub OAuth. */
@Component({ emits : [ 'login' ] })
export default class AuthScreen extends Vue {

	@Prop({ required : true }) readonly disabled!: boolean;

	get buttonHtml(): string {
		return this.disabled ? 'Starting...' : `${iconSvg('github', 18)} Sign in with GitHub`;
	}

}
</script>
