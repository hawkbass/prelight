import React from 'react';

export const NAV_FONT = '15px sans-serif';
export const NAV_LINE_HEIGHT = 20;
export const NAV_WIDTH = 96;

export function NavLink({ label }: { label: string }) {
  return <a style={{ width: NAV_WIDTH, font: NAV_FONT }}>{label}</a>;
}
