import type { PRFile }                   from '@/lib/githubClient';
import { highlightLines }                from '@/lib/highlight';
import { parseChangedLines, parseHunks } from '@/lib/patchDiff';
import type { DiffLine }                 from '@/lib/prDiffTypes';
import { annotateLinePair }              from '@/lib/wordDiff';

export function buildFullFileLines(content: string, changedLines: Set<number>, changeType: 'add' | 'del', allChanged: boolean, filename?: string): DiffLine[] {
	const rawLines  = content.split('\n');
	const htmlLines = filename ? highlightLines(content, filename) : null;
	return rawLines.map((line, i) => ({
		num     : i + 1,
		content : line,
		html    : htmlLines?.[i],
		type    : allChanged || changedLines.has(i + 1) ? changeType : 'context',
	}));
}

export function applyWordDiffToFullContent(left: DiffLine[], right: DiffLine[], patch: string | undefined) {
	if (!patch) {
		return;
	}
	const hunks     = parseHunks(patch);
	const leftByNum = new Map<number, DiffLine>();
	for (const l of left) {
		if (l.num != null) {
			leftByNum.set(l.num, l);
		}
	}
	const rightByNum = new Map<number, DiffLine>();
	for (const r of right) {
		if (r.num != null) {
			rightByNum.set(r.num, r);
		}
	}

	for (const hunk of hunks) {
		let oldLine = hunk.oldStart;
		let newLine = hunk.newStart;
		let i       = 0;
		while (i < hunk.lines.length) {
			const dels: number[] = [];
			while (i < hunk.lines.length && hunk.lines[i].type === 'del') {
				dels.push(oldLine++);
				i++;
			}
			const adds: number[] = [];
			while (i < hunk.lines.length && hunk.lines[i].type === 'add') {
				adds.push(newLine++);
				i++;
			}
			const pairCount = Math.min(dels.length, adds.length);
			for (let p = 0; p < pairCount; p++) {
				const delLine = leftByNum.get(dels[p]);
				const addLine = rightByNum.get(adds[p]);
				if (delLine && addLine) {
					annotateLinePair(delLine, addLine);
				}
			}
			if (i < hunk.lines.length && hunk.lines[i].type === 'context') {
				oldLine++;
				newLine++;
				i++;
			}
		}
	}
}

export function applyWordDiffToPatchLines(left: DiffLine[], right: DiffLine[]) {
	let li = 0;
	let ri = 0;
	while (li < left.length && ri < right.length) {
		const dels: DiffLine[] = [];
		while (li < left.length && left[li].type === 'del') {
			dels.push(left[li++]);
		}
		const adds: DiffLine[] = [];
		while (ri < right.length && right[ri].type === 'add') {
			adds.push(right[ri++]);
		}

		const pairCount = Math.min(dels.length, adds.length);
		for (let p = 0; p < pairCount; p++) {
			annotateLinePair(dels[p], adds[p]);
		}

		while (li < left.length && left[li].type !== 'del') {
			li++;
		}
		while (ri < right.length && right[ri].type !== 'add') {
			ri++;
		}
	}
}

export function parsePatch(patch: string | undefined, file: PRFile | null): { left: DiffLine[]; right: DiffLine[] } {
	const left: DiffLine[]  = [];
	const right: DiffLine[] = [];
	if (!patch) {
		return { left, right };
	}

	let oldLine = 0;
	let newLine = 0;

	for (const raw of patch.split('\n')) {
		if (raw.startsWith('@@')) {
			const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
			if (m) {
				oldLine = parseInt(m[1], 10);
				newLine = parseInt(m[2], 10);
			}
			left.push({ num : null, content : raw, type : 'hunk' });
			right.push({ num : null, content : raw, type : 'hunk' });
		}
		else if (raw.startsWith('-')) {
			left.push({ num : oldLine++, content : raw.slice(1), type : 'del' });
		}
		else if (raw.startsWith('+')) {
			right.push({ num : newLine++, content : raw.slice(1), type : 'add' });
		}
		else {
			const content = raw.startsWith(' ') ? raw.slice(1) : raw;
			left.push({ num : oldLine++, content, type : 'context' });
			right.push({ num : newLine++, content, type : 'context' });
		}
	}

	if (file) {
		const leftCode  = left.filter(l => l.type !== 'hunk').map(l => l.content).join('\n');
		const rightCode = right.filter(l => l.type !== 'hunk').map(l => l.content).join('\n');
		const leftFn    = file.previous_filename || file.filename;
		const leftHtml  = highlightLines(leftCode, leftFn);
		const rightHtml = highlightLines(rightCode, file.filename);
		if (leftHtml) {
			let hi = 0;
			for (const l of left) {
				if (l.type !== 'hunk') {
					l.html = leftHtml[hi++];
				}
			}
		}
		if (rightHtml) {
			let hi = 0;
			for (const l of right) {
				if (l.type !== 'hunk') {
					l.html = rightHtml[hi++];
				}
			}
		}
	}

	applyWordDiffToPatchLines(left, right);

	return { left, right };
}

export function buildSplitLinesForFile(file: PRFile, baseContent: string | null, headContent: string | null): { left: DiffLine[]; right: DiffLine[] } {
	const isAddedOrRemoved = file.status === 'added' || file.status === 'removed';

	let left: DiffLine[] = [];
	if (baseContent !== null) {
		const fn = file.previous_filename || file.filename;
		if (file.status === 'removed') {
			left = buildFullFileLines(baseContent, new Set(), 'del', true, fn);
		}
		else {
			const { deleted } = parseChangedLines(file.patch);
			left              = buildFullFileLines(baseContent, deleted, 'del', false, fn);
		}
	}

	let right: DiffLine[] = [];
	if (headContent !== null) {
		if (file.status === 'added') {
			right = buildFullFileLines(headContent, new Set(), 'add', true, file.filename);
		}
		else {
			const { added } = parseChangedLines(file.patch);
			right           = buildFullFileLines(headContent, added, 'add', false, file.filename);
		}
	}

	if (!isAddedOrRemoved && left.length && right.length) {
		applyWordDiffToFullContent(left, right, file.patch);
	}

	return { left, right };
}
