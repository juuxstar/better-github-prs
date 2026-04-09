import type { CommonBlock, ScrollSegment } from '@/lib/diff/prDiffTypes';

export function buildScrollSegments(blocks: CommonBlock[], baseLineCount: number, headLineCount: number, lineHeight: number): ScrollSegment[] {
	const lh                        = lineHeight;
	const segments: ScrollSegment[] = [];

	if (!blocks.length) {
		if (baseLineCount > 0 || headLineCount > 0) {
			const ll = baseLineCount * lh;
			const rl = headLineCount * lh;
			segments.push({ virtualLength : Math.max(ll, rl), leftLength : ll, rightLength : rl });
		}
		return segments;
	}

	let leftPos  = 1;
	let rightPos = 1;

	for (const block of blocks) {
		const leftGap  = block.leftStart - leftPos;
		const rightGap = block.rightStart - rightPos;
		if (leftGap > 0 || rightGap > 0) {
			const ll = leftGap * lh;
			const rl = rightGap * lh;
			segments.push({ virtualLength : Math.max(ll, rl), leftLength : ll, rightLength : rl });
		}

		const commonLines = block.leftEnd - block.leftStart + 1;
		const len         = commonLines * lh;
		segments.push({ virtualLength : len, leftLength : len, rightLength : len });

		leftPos  = block.leftEnd + 1;
		rightPos = block.rightEnd + 1;
	}

	const leftGap  = Math.max(0, baseLineCount - leftPos + 1);
	const rightGap = Math.max(0, headLineCount - rightPos + 1);
	if (leftGap > 0 || rightGap > 0) {
		const ll = leftGap * lh;
		const rl = rightGap * lh;
		segments.push({ virtualLength : Math.max(ll, rl), leftLength : ll, rightLength : rl });
	}

	return segments;
}

export function buildScrollSegmentsFromState(blocks: CommonBlock[], baseContent: string | null, headContent: string | null, lineHeight: number): ScrollSegment[] {
	const baseLineCount = baseContent?.split('\n').length ?? 0;
	const headLineCount = headContent?.split('\n').length ?? 0;
	return buildScrollSegments(blocks, baseLineCount, headLineCount, lineHeight);
}

export function resolveScroll(segments: ScrollSegment[], v: number): { left: number; right: number } {
	let virtualAcc = 0;
	let leftAcc    = 0;
	let rightAcc   = 0;

	for (const seg of segments) {
		if (virtualAcc + seg.virtualLength > v) {
			const progress  = v - virtualAcc;
			leftAcc        += Math.min(progress, seg.leftLength);
			rightAcc       += Math.min(progress, seg.rightLength);
			return { left : leftAcc, right : rightAcc };
		}
		virtualAcc += seg.virtualLength;
		leftAcc    += seg.leftLength;
		rightAcc   += seg.rightLength;
	}

	return { left : leftAcc, right : rightAcc };
}

export function maxVirtualScrollTop(segments: ScrollSegment[], viewportHeight: number, lineHeight: number): number {
	const totalVH    = segments.reduce((s, seg) => s + seg.virtualLength, 0);
	const overscroll = Math.max(0, viewportHeight - lineHeight);
	return Math.max(0, totalVH - viewportHeight + overscroll);
}

export function buildConnectorPaths(commonBlocks: CommonBlock[], leftScrollTop: number, rightScrollTop: number, viewportHeight: number, lineHeight: number, width: number): string[] {
	if (!viewportHeight || !commonBlocks.length) {
		return [];
	}
	const lh              = lineHeight;
	const h               = viewportHeight;
	const paths: string[] = [];

	for (const block of commonBlocks) {
		const lTop = (block.leftStart - 1) * lh - leftScrollTop;
		const lBot = block.leftEnd * lh - leftScrollTop;
		const rTop = (block.rightStart - 1) * lh - rightScrollTop;
		const rBot = block.rightEnd * lh - rightScrollTop;

		if (lBot < 0 && rBot < 0) {
			continue;
		}
		if (lTop > h && rTop > h) {
			continue;
		}

		paths.push(`M 0 ${lTop} L ${width} ${rTop} L ${width} ${rBot} L 0 ${lBot} Z`);
	}
	return paths;
}
