<template>
	<section class="screen">
		<div class="u-flex u-flex-col u-items-center u-justify-center u-flex-1 u-gap-4 u-p-screen u-text-center">
			<div class="error-icon u-flex u-items-center u-justify-center u-fw-700">!</div>
			<p class="u-fs-15 u-max-w-400 u-text-secondary">{{ message }}</p>
			<button class="btn btn-secondary" @click="$emit('retry')">Try Again</button>
		</div>
	</section>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-facing-decorator';

/** Full-screen error display with a retry button. */
@Component({ emits : [ 'retry' ] })
export default class ErrorScreen extends Vue {

	@Prop({ required : true }) readonly message!: string;

}
</script>

<style>
.error-icon {
	width: 56px;
	height: 56px;
	border-radius: 50%;
	background: var(--danger-btn-bg);
	color: var(--accent-red);
	font-size: 28px;
}
</style>
