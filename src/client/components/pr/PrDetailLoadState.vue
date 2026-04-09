<template>
	<div v-if="loading" class="pr-detail-loading u-flex u-flex-col u-items-center u-justify-center u-gap-4 u-py-20 u-text-secondary">
		<div class="spinner"></div>
		<p class="u-m-0">Loading pull request...</p>
	</div>

	<div v-else-if="error" class="pr-detail-error u-flex u-flex-col u-items-center u-justify-center u-gap-4 u-py-20 u-text-secondary">
		<p class="u-m-0">{{ error }}</p>
		<button class="btn btn-secondary" type="button" @click="emit('retry')">Retry</button>
	</div>
</template>

<script setup lang="ts">
defineProps<{ loading: boolean; error: string }>();

const emit = defineEmits<{ retry: [] }>();
</script>
