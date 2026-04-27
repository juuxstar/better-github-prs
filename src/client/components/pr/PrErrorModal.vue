<template>
	<pr-modal-dialog
		:open="open"
		:title="title"
		:title-id="titleId"
		dialog-class="pr-approve-error-dialog"
		show-close
		@close="$emit('close')"
	>
		<p class="pr-merge-confirm-body pr-approve-error-message">{{ message }}</p>
		<div class="pr-merge-confirm-actions u-flex u-justify-end u-gap-2-5 u-flex-wrap">
			<button type="button" class="btn btn-secondary" @click="$emit('close')">Dismiss</button>
		</div>
	</pr-modal-dialog>
</template>

<script setup lang="ts">
import PrModalDialog from '@/components/pr/PrModalDialog.vue';

defineProps<{
	open: boolean;
	title: string;
	titleId: string;
	message: string;
}>();

defineEmits<{ close: [] }>();
</script>
