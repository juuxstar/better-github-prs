<template>
	<section class="screen">
		<div class="device-container">
			<div class="device-step">
				<span class="step-number">1</span>
				<span class="step-text">Go to <strong>{{ url }}</strong></span>
			</div>
			<a :href="url" class="btn btn-secondary btn-open-link" @click.prevent="openUrl">
				<span v-html="$icon('externalLink', 14)"></span> Open GitHub
			</a>
			<div class="device-step">
				<span class="step-number">2</span>
				<span class="step-text">Enter this code:</span>
			</div>
			<div class="device-code-box">
				<code ref="codeEl">{{ code }}</code>
				<button
					:class="['btn-copy', { copied: copyState === 'copied' }]"
					title="Copy code"
					@click="doCopy"
					v-html="copyBtnHtml"
				></button>
			</div>
			<div class="device-waiting">
				<div class="spinner spinner-sm"></div>
				<span>Waiting for authorization...</span>
			</div>
			<button class="btn btn-secondary btn-sm" @click="$emit('cancel')">Cancel</button>
		</div>
	</section>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-facing-decorator';
import { iconSvg } from '@/lib/icons';

/** OAuth device-flow screen showing the user code and a link to GitHub for authorization. */
@Component({ emits: ['cancel'] })
export default class DeviceScreen extends Vue {
	@Prop() code!: string;
	@Prop() url!: string;

	copyState = 'idle';

	get copyBtnHtml(): string {
		return iconSvg(this.copyState === 'copied' ? 'checkmark' : 'copy', 16);
	}

	async doCopy() {
		try {
			await navigator.clipboard.writeText(this.code);
			this.copyState = 'copied';
			setTimeout(() => { this.copyState = 'idle'; }, 2000);
		} catch {
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
.device-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 32px;
  text-align: center;
  gap: 20px;
  flex: 1;
  justify-content: center;
}

.device-step {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  color: var(--text-primary);
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--accent-blue);
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
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
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--bg-secondary);
  border: 2px solid var(--accent-blue);
  border-radius: var(--radius-lg);
  padding: 20px 28px;
  margin: 8px 0;

  code {
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace;
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
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
  flex-shrink: 0;

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

.device-waiting {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-tertiary);
  font-size: 14px;
  margin-top: 8px;
}

.spinner-sm {
  width: 18px;
  height: 18px;
  border-width: 2px;
}
</style>
