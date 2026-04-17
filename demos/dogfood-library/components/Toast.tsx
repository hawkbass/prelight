import React from 'react';

export const TOAST_FONT = '14px sans-serif';
export const TOAST_LINE_HEIGHT = 18;
export const TOAST_WIDTH = 320;
export const TOAST_MAX_LINES = 2;

export function Toast({ message }: { message: string }) {
  return <div style={{ width: TOAST_WIDTH, font: TOAST_FONT }}>{message}</div>;
}
