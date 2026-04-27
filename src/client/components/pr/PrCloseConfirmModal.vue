<template>
	<pr-modal-dialog
		:open="open"
		title="Close pull request?"
		title-id="pr-close-confirm-title"
		:close-disabled="closing"
		@close="$emit('close')"
	>
		<p class="pr-merge-confirm-body">
			This will close <span class="pr-merge-confirm-repo">{{ owner }}/{{ repo }}</span> <strong>#{{ prNumber }}</strong> on GitHub without merging.
		</p>
		<p v-if="error" class="pr-merge-confirm-error">{{ error }}</p>
		<div class="pr-merge-confirm-actions u-flex u-justify-end u-gap-2-5 u-flex-wrap">
			<button type="button" class="btn btn-secondary" :disabled="closing" @click="$emit('close')">Cancel</button>
			<button type="button" class="btn pr-merge-confirm-danger" :disabled="closing" @click="$emit('confirm')">
				<span v-if="closing" class="async-loader"></span>
				<template v-else>Close pull request</template>
			</button>
		</div>
	</pr-modal-dialog>
</template>

<script setup lang="ts">
import PrModalDialog from '@/components/pr/PrModalDialog.vue';

defineProps<{
	open: boolean;
	owner: string;
	repo: string;
	prNumber: number;
	error: string;
	closing: boolean;
}>();

defineEmits<{ close: []; confirm: [] }>();
</script>
