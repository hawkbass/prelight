/**
 * A minimal but realistic button component. Pinned to a 120px slot with a
 * 16px font — numbers chosen so the English copy fits and the German copy
 * doesn't.
 *
 * Why these numbers? This is the exact scenario every product team runs
 * into: a designer picks a width that works for English, and nobody notices
 * until a German user files a bug from Berlin.
 */

import React from 'react';

export interface ButtonProps {
  label: string;
}

export const BUTTON_FONT = '16px sans-serif';
export const BUTTON_WIDTH = 120;
export const BUTTON_LINE_HEIGHT = 20;

export function Button({ label }: ButtonProps) {
  return (
    <button
      style={{
        width: BUTTON_WIDTH,
        font: BUTTON_FONT,
        lineHeight: `${BUTTON_LINE_HEIGHT}px`,
      }}
    >
      {label}
    </button>
  );
}
