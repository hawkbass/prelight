/**
 * Predicate implementations. Each predicate is a pure function
 * `(Measurement, Constraints) => Failure | null`.
 *
 * PRELIGHT-INVARIANT: predicates are pure and orthogonal. No I/O, no cached
 * state, no dependency on other predicates' results. The verifier runs
 * every enabled predicate on every cell and collects all failures.
 */

import type { Constraints, Failure, Measurement } from './types.js';

export type Predicate = (m: Measurement, c: Constraints) => Failure | null;

function fail(
  m: Measurement,
  constraint: keyof Constraints,
  actual: unknown,
  expected: unknown,
  message: string,
): Failure {
  return { cell: m.cell, constraint, message, actual, expected };
}

export const noOverflow: Predicate = (m, c) => {
  if (!c.noOverflow) return null;
  if (!m.overflows) return null;
  const over = m.naturalWidth - m.cell.width;
  return fail(
    m,
    'noOverflow',
    `natural width ${m.naturalWidth.toFixed(1)}px exceeds slot ${m.cell.width}px`,
    `fit within ${m.cell.width}px`,
    `text overflows its slot at ${m.cell.language} scale=${m.cell.scale} (width ${m.cell.width}px): single-line text would be ${m.naturalWidth.toFixed(1)}px wide, ${over.toFixed(1)}px over. Wraps to ${m.lines} line${m.lines === 1 ? '' : 's'}.`,
  );
};

export const maxLines: Predicate = (m, c) => {
  if (c.maxLines === undefined) return null;
  if (m.lines <= c.maxLines) return null;
  return fail(
    m,
    'maxLines',
    m.lines,
    `<= ${c.maxLines}`,
    `text wraps to ${m.lines} lines but may not exceed ${c.maxLines} at ${m.cell.language} scale=${m.cell.scale}.`,
  );
};

export const minLines: Predicate = (m, c) => {
  if (c.minLines === undefined) return null;
  if (m.lines >= c.minLines) return null;
  return fail(
    m,
    'minLines',
    m.lines,
    `>= ${c.minLines}`,
    `text takes only ${m.lines} line${m.lines === 1 ? '' : 's'} but must fill at least ${c.minLines} at ${m.cell.language} scale=${m.cell.scale}.`,
  );
};

export const singleLine: Predicate = (m, c) => {
  if (!c.singleLine) return null;
  if (m.lines === 1 && !m.overflows) return null;
  if (m.lines > 1) {
    return fail(
      m,
      'singleLine',
      m.lines,
      1,
      `text wraps to ${m.lines} lines but must stay on a single line at ${m.cell.language} scale=${m.cell.scale}.`,
    );
  }
  const over = m.naturalWidth - m.cell.width;
  return fail(
    m,
    'singleLine',
    `overflows by ${over.toFixed(1)}px`,
    `fit on one line within ${m.cell.width}px`,
    `text stays on one line only because wrapping is disabled: natural width ${m.naturalWidth.toFixed(1)}px exceeds the slot by ${over.toFixed(1)}px at ${m.cell.language} scale=${m.cell.scale}. With ellipsis, the text will be visibly truncated.`,
  );
};

export const noTruncation: Predicate = (m, c) => {
  if (!c.noTruncation) return null;
  if (!m.overflows) return null;
  const over = m.naturalWidth - m.cell.width;
  return fail(
    m,
    'noTruncation',
    `would truncate at ${over.toFixed(1)}px past the slot`,
    `fit without ellipsis`,
    `text is wider than its slot (${m.naturalWidth.toFixed(1)}px vs ${m.cell.width}px) and would be truncated (ellipsized) at ${m.cell.language} scale=${m.cell.scale}.`,
  );
};

export const linesExact: Predicate = (m, c) => {
  if (c.lines === undefined) return null;
  if (m.lines === c.lines) return null;
  return fail(
    m,
    'lines',
    m.lines,
    c.lines,
    `text takes ${m.lines} lines but must take exactly ${c.lines} at ${m.cell.language} scale=${m.cell.scale}.`,
  );
};

export const PREDICATES: Record<keyof Constraints, Predicate> = {
  noOverflow,
  maxLines,
  minLines,
  singleLine,
  noTruncation,
  lines: linesExact,
};
