import React from 'react';

export const BUTTON_FONT = '14px sans-serif';
export const BUTTON_LINE_HEIGHT = 18;
export const BUTTON_WIDTH = 140;

export function Button({ label }: { label: string }) {
  return (
    <button style={{ width: BUTTON_WIDTH, font: BUTTON_FONT }}>{label}</button>
  );
}
