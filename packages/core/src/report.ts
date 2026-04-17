/**
 * Failure formatting. Human-oriented, presentation-free. Adapters
 * (@prelight/vitest, @prelight/jest, @prelight/cli) layer color, emphasis,
 * and platform-specific presentation on top.
 *
 * PRELIGHT-INVARIANT: no ANSI, no color, no TTY detection in this module.
 */

import type { Failure, VerifyResult } from './types.js';

/** One-line summary of a single failure, for inline diffs and matchers. */
export function formatFailureShort(f: Failure): string {
  const { cell, constraint } = f;
  return `[${constraint}] ${cell.language} @ scale=${cell.scale}, width=${cell.width}px — ${f.message}`;
}

/** Multi-line report for CLI and rich matchers. */
export function formatReport(result: VerifyResult): string {
  if (result.ok) {
    return `Prelight: all ${result.cellsChecked} cells passed.`;
  }
  const header = `Prelight: ${result.failures.length} failure${result.failures.length === 1 ? '' : 's'} across ${result.cellsChecked} cells.`;
  const byCell = new Map<string, Failure[]>();
  for (const f of result.failures) {
    const key = cellKey(f);
    const bucket = byCell.get(key);
    if (bucket) bucket.push(f);
    else byCell.set(key, [f]);
  }
  const lines: string[] = [header, ''];
  for (const [key, bucket] of byCell) {
    lines.push(`  ${key}`);
    for (const f of bucket) {
      lines.push(`    - ${f.constraint}: ${f.message}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function cellKey(f: Failure): string {
  const { language, scale, width } = f.cell;
  return `${language}  scale=${scale}  width=${width}px`;
}
