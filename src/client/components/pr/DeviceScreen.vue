<template>
	<section class="screen">
		<div class="u-flex u-flex-col u-items-center u-justify-center u-flex-1 u-gap-5 u-p-screen u-text-center">
			<div class="device-step u-flex u-items-center u-gap-3 u-fs-16 u-text-primary">
				<span class="step-number u-flex u-items-center u-justify-center u-flex-shrink-0 u-fw-700">1</span>
				<span class="step-text">Go to <strong>{{ url }}</strong></span>
			</div>
			<a :href="url" class="btn btn-secondary btn-open-link" @click.prevent="openUrl"> <span v-html="$icon('externalLink', 14)"></span> Open GitHub </a>
			<div class="device-step u-flex u-items-center u-gap-3 u-fs-16 u-text-primary">
				<span class="step-number u-flex u-items-center u-justify-center u-flex-shrink-0 u-fw-700">2</span>
				<span class="step-text">Enter this code:</span>
			</div>
			<div class="device-code-box u-flex u-items-center u-gap-3-5 u-my-2">
				<code ref="codeEl">{{ code }}</code>
				<button
					class="btn-copy u-flex u-items-center u-justify-center u-flex-shrink-0"
					:class="{ copied : copyState === 'copied' }"
					title="Copy code"
					@click="doCopy"
					v-html="copyBtnHtml"
				></button>
			</div>
			<div class="device-waiting u-flex u-items-center u-gap-2-5 u-fs-14 u-mt-2 u-text-tertiary">
				<div class="spinner spinner-sm"></div>
				<span>Waiting for authorization...</span>
			</div>
			<button class="btn btn-secondary btn-sm" @click="$emit('cancel')">Cancel</button>
		</div>
	</section>
</template>

<script lang="ts">
import { iconSvg } from '@/lib/icons';

import { Component, Prop, Vue } from 'vue-facing-decorator';

/**
 * OAuth device-flow screen showing the user code and a link to GitHub for authorization.
 */
@Component({ emits : [ 'cancel' ] })
export default class DeviceScreen extends Vue {

	@Prop({ required : true }) readonly code!: string;
	@Prop({ required : true }) readonly url!: string;

	copyState = 'idle';

	get copyBtnHtml(): string {
		return iconSvg(this.copyState === 'copied' ? 'checkmark' : 'copy', 16);
	}

	async doCopy() {
		try {
			await navigator.clipboard.writeText(this.code);
			this.copyState = 'copied';
			setTimeout(() => {
				this.copyState = 'idle';
			}, 2000);
		}
		catch {
			const range = document.createRange();
			range.selectNodeContents(this.$refs.codeEl as HTMLElement);
			const sel = window.getSelection();
			sel?.removeAllRanges();
			sel?.addRange(range);
		}
	}

	openUrl() {
		window.open(this.url, '_blank');
	}

}
</script>

<style>
.step-number {
	width: 30px;
	height: 30px;
	border-radius: 50%;
	background: var(--accent-blue);
	color: var(--btn-primary-fg);
	font-size: 14px;
}

.step-text {
	font-size: 16px;
	color: var(--text-secondary);

	strong {
		color: var(--text-primary);
	}
}

.btn-open-link {
	text-decoration: none;
	font-size: 14px;
}

.device-code-box {
	background: var(--bg-secondary);
	border: 2px solid var(--accent-blue);
	border-radius: var(--radius-lg);
	padding: var(--u-5) var(--u-7);

	code {
		font-family: "SF Mono", "Fira Code", "Cascadia Code", Menlo, monospace;
		font-size: 36px;
		font-weight: 700;
		letter-spacing: 8px;
		color: var(--text-primary);
		user-select: all;
	}
}

.btn-copy {
	background: none;
	border: 1px solid var(--border);
	color: var(--text-secondary);
	width: 36px;
	height: 36px;
	border-radius: var(--radius-sm);
	cursor: pointer;
	transition: all var(--transition);

	&:hover {
		color: var(--text-primary);
		border-color: var(--border-hover);
		background: var(--bg-tertiary);
	}

	&.copied {
		color: var(--accent-green);
		border-color: var(--accent-green);
	}
}

.spinner-sm {
	width: 18px;
	height: 18px;
	border-width: 2px;
}
</style>
