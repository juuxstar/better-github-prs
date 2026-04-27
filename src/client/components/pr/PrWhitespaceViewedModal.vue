<template>
	<pr-modal-dialog
		:open="open"
		title="Mark whitespace-only files as viewed?"
		title-id="pr-whitespace-viewed-confirm-title"
		:close-disabled="marking"
		@close="$emit('close')"
	>
		<p class="pr-merge-confirm-body">
			This will mark <strong>{{ count }}</strong> unviewed file(s) as viewed on GitHub.
		</p>
		<p class="pr-merge-confirm-body">
			Only files with a patch where every removed/added line pair differs by whitespace are included (modified or renamed; no patch, binary, or uneven blocks are skipped).
		</p>
		<p v-if="error" class="pr-merge-confirm-error">{{ error }}</p>
		<div class="pr-merge-confirm-actions u-flex u-justify-end u-gap-2-5 u-flex-wrap">
			<button type="button" class="btn btn-secondary" :disabled="marking" @click="$emit('close')">Cancel</button>
			<button type="button" class="btn pr-merge-confirm-submit" :disabled="marking" @click="$emit('confirm')">
				<span v-if="marking" class="async-loader"></span>
				<template v-else>Mark {{ count }} as viewed</template>
			</button>
		</div>
	</pr-modal-dialog>
</template>

<script setup lang="ts">
import PrModalDialog from '@/components/pr/PrModalDialog.vue';

defineProps<{
	open: boolean;
	count: number;
	error: string;
	marking: boolean;
}>();

defineEmits<{ close: []; confirm: [] }>();
</script>
