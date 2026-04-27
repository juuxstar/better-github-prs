<template>
	<pr-modal-dialog
		:open="open"
		title="Edit pull request title"
		title-id="pr-title-edit-title"
		:close-disabled="updating"
		:focus-on-open="false"
		@close="$emit('close')"
	>
		<input
			ref="inputEl"
			:value="modelValue"
			type="text"
			class="pr-title-edit-input"
			maxlength="500"
			autocomplete="off"
			@input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
			@keydown.enter.prevent="$emit('save')"
		/>
		<p v-if="error" class="pr-merge-confirm-error">{{ error }}</p>
		<div class="pr-merge-confirm-actions u-flex u-justify-end u-gap-2-5 u-flex-wrap">
			<button type="button" class="btn btn-secondary" :disabled="updating" @click="$emit('close')">Cancel</button>
			<button type="button" class="btn pr-merge-confirm-submit" :disabled="updating" @click="$emit('save')">
				<span v-if="updating" class="async-loader"></span>
				<template v-else>Save</template>
			</button>
		</div>
	</pr-modal-dialog>
</template>

<script setup lang="ts">
import PrModalDialog from '@/components/pr/PrModalDialog.vue';

import { nextTick, ref, watch } from 'vue';

const props = defineProps<{
	open: boolean;
	modelValue: string;
	error: string;
	updating: boolean;
}>();

defineEmits<{ 'update:modelValue': [value: string]; close: []; save: [] }>();

const inputEl = ref<HTMLInputElement | null>(null);

watch(() => props.open, async open => {
	if (!open) {
		return;
	}
	await nextTick();
	inputEl.value?.focus();
	inputEl.value?.select();
});
</script>

<style>
.pr-title-edit-input {
	box-sizing: border-box;
	width: 100%;
	margin: 0 0 16px;
	padding: 8px 10px;
	font-size: 14px;
	font-family: inherit;
	color: var(--text-primary);
	background: var(--bg-primary);
	border: 1px solid var(--border);
	border-radius: var(--radius-sm);
}

.pr-title-edit-input:focus {
	outline: none;
	border-color: var(--accent-blue);
	box-shadow: 0 0 0 2px var(--accent-blue-bg, rgba(88, 166, 255, 0.2));
}
</style>
