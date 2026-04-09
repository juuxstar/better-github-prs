<template>
	<table class="pr-diff-table" :style="tableStyle">
		<tr v-for="(line, i) in lines" :key="i" class="pr-diff-row" :class="'pr-diff-row-' + line.type">
			<td class="pr-diff-gutter gutter-commentable" :class="{ 'has-comment' : hasAnyCommentAt(line.num, side) }" @click="onGutterClick(line, $event)">
				{{ line.num ?? "" }}
				<span v-if="hasAnyCommentAt(line.num, side)" class="gutter-dot" :class="commentDotClass(line.num, side)"></span>
				<span v-else-if="line.num != null" class="gutter-add">+</span>
			</td>
			<td class="pr-diff-code">
				<pre v-if="line.html" v-html="line.html"></pre>
				<pre v-else>{{ line.content }}</pre>
			</td>
		</tr>
	</table>
</template>

<script setup lang="ts">
import '@/styles/pr-diff.css';

import type { DiffLine } from '@/lib/diff/prDiffTypes';

const props = defineProps<{
	lines: DiffLine[];
	side: 'LEFT' | 'RIGHT';
	tableStyle?: Record<string, string>;
	hasAnyCommentAt: (lineNum: number | null, side: 'LEFT' | 'RIGHT') => boolean;
	commentDotClass: (lineNum: number | null, side: 'LEFT' | 'RIGHT') => string;
}>();

const emit = defineEmits<{
	gutterClick: [line: DiffLine, side: 'LEFT' | 'RIGHT', event: MouseEvent];
}>();

function onGutterClick(line: DiffLine, event: MouseEvent) {
	emit('gutterClick', line, props.side, event);
}
</script>
