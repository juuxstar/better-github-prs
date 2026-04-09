<template>
	<div class="pr-detail-tabs u-flex u-items-center u-gap-0-5 u-p-0-5">
		<button class="pr-detail-tab" :class="{ active : activeTab === 'overview' }" type="button" @click="emit('switch-tab', 'overview')">Overview</button>
		<button class="pr-detail-tab" :class="{ active : activeTab === 'files' }" type="button" @click="emit('switch-tab', 'files')">Files ({{ changedFilesCount }})</button>
	</div>
	<span v-if="filesLength" class="pr-detail-review-progress u-flex u-items-center u-gap-2 u-ml-3 u-whitespace-nowrap" :class="reviewProgressStateClass">
		<span class="pr-detail-review-bar-track">
			<span class="pr-detail-review-bar-fill" :style="reviewBarFillStyle"></span>
		</span>
		<span class="pr-detail-review-pct">{{ reviewPct }}%</span>
	</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
	activeTab: 'overview' | 'files';
	changedFilesCount: number;
	filesLength: number;
	reviewPct: number;
}>();

const emit = defineEmits<{ 'switch-tab': [tab: 'overview' | 'files'] }>();

const reviewProgressStateClass = computed(() => ({
	complete : props.reviewPct >= 100,
	partial  : props.reviewPct >= 50 && props.reviewPct < 100,
	low      : props.reviewPct < 50,
}));

const reviewBarFillStyle = computed(() => ({ width : `${props.reviewPct}%` }));
</script>
