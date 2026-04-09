import type { ReviewComment } from '@/lib/api/githubClient';

export interface DiffLine {
	num: number | null;
	content: string;
	html?: string;
	type: 'context' | 'add' | 'del' | 'hunk';
}

export interface PatchHunk {
	oldStart: number;
	oldCount: number;
	newStart: number;
	newCount: number;
	lines: { type: 'context' | 'add' | 'del'; content: string }[];
}

export interface CommonBlock {
	leftStart: number;
	leftEnd: number;
	rightStart: number;
	rightEnd: number;
}

export interface ScrollSegment {
	virtualLength: number;
	leftLength: number;
	rightLength: number;
}

export interface CommentThread {
	path: string;
	line: number;
	side: 'LEFT' | 'RIGHT';
	comments: ReviewComment[];
}
