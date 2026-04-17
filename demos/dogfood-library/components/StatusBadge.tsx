import React from 'react';

export const BADGE_FONT = '12px sans-serif';
export const BADGE_LINE_HEIGHT = 16;
export const BADGE_WIDTH = 80;

export function StatusBadge({ label }: { label: string }) {
  return <span style={{ width: BADGE_WIDTH, font: BADGE_FONT }}>{label}</span>;
}
