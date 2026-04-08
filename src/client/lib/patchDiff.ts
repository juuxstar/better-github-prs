import type { CommonBlock, PatchHunk } from '@/lib/prDiffTypes';

export function parseHunks(patch: string): PatchHunk[] {
  const hunks: PatchHunk[] = [];
  let current: PatchHunk | null = null;
  for (const raw of patch.split('\n')) {
    if (raw.startsWith('@@')) {
      const m = raw.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (m) {
        current = {
          oldStart: parseInt(m[1], 10),
          oldCount: parseInt(m[2] ?? '1', 10),
          newStart: parseInt(m[3], 10),
          newCount: parseInt(m[4] ?? '1', 10),
          lines: [],
        };
        hunks.push(current);
      }
    } else if (current) {
      if (raw.startsWith('-')) {
        current.lines.push({ type: 'del', content: raw.slice(1) });
      } else if (raw.startsWith('+')) {
        current.lines.push({ type: 'add', content: raw.slice(1) });
      } else if (raw.length > 0 || current.lines.length > 0) {
        const content = raw.startsWith(' ') ? raw.slice(1) : raw;
        current.lines.push({ type: 'context', content });
      }
    }
  }
  return hunks;
}

export function computeCommonBlocks(
  patch: string | undefined,
  baseLineCount: number,
  headLineCount: number,
): CommonBlock[] {
  const blocks: CommonBlock[] = [];
  if (!patch || baseLineCount === 0 || headLineCount === 0) {
    if (baseLineCount > 0 && headLineCount > 0) {
      blocks.push({ leftStart: 1, leftEnd: baseLineCount, rightStart: 1, rightEnd: headLineCount });
    }
    return blocks;
  }

  const hunks = parseHunks(patch);
  if (!hunks.length) {
    blocks.push({ leftStart: 1, leftEnd: baseLineCount, rightStart: 1, rightEnd: headLineCount });
    return blocks;
  }

  let leftPos = 1;
  let rightPos = 1;

  for (const hunk of hunks) {
    if (leftPos < hunk.oldStart) {
      const count = hunk.oldStart - leftPos;
      blocks.push({
        leftStart: leftPos,
        leftEnd: leftPos + count - 1,
        rightStart: rightPos,
        rightEnd: rightPos + count - 1,
      });
    }
    leftPos = hunk.oldStart;
    rightPos = hunk.newStart;

    let contextStart: { left: number; right: number } | null = null;

    for (const line of hunk.lines) {
      if (line.type === 'context') {
        if (!contextStart) {
          contextStart = { left: leftPos, right: rightPos };
        }
        leftPos++;
        rightPos++;
      } else {
        if (contextStart) {
          blocks.push({
            leftStart: contextStart.left,
            leftEnd: leftPos - 1,
            rightStart: contextStart.right,
            rightEnd: rightPos - 1,
          });
          contextStart = null;
        }
        if (line.type === 'del') leftPos++;
        else rightPos++;
      }
    }
    if (contextStart) {
      blocks.push({
        leftStart: contextStart.left,
        leftEnd: leftPos - 1,
        rightStart: contextStart.right,
        rightEnd: rightPos - 1,
      });
    }
  }

  if (leftPos <= baseLineCount && rightPos <= headLineCount) {
    blocks.push({
      leftStart: leftPos,
      leftEnd: baseLineCount,
      rightStart: rightPos,
      rightEnd: headLineCount,
    });
  }

  return blocks;
}

export function parseChangedLines(patch: string | undefined): { deleted: Set<number>; added: Set<number> } {
  const deleted = new Set<number>();
  const added = new Set<number>();
  if (!patch) return { deleted, added };

  let oldLine = 0;
  let newLine = 0;

  for (const raw of patch.split('\n')) {
    if (raw.startsWith('@@')) {
      const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) {
        oldLine = parseInt(m[1], 10);
        newLine = parseInt(m[2], 10);
      }
    } else if (raw.startsWith('-')) {
      deleted.add(oldLine++);
    } else if (raw.startsWith('+')) {
      added.add(newLine++);
    } else {
      oldLine++;
      newLine++;
    }
  }
  return { deleted, added };
}
