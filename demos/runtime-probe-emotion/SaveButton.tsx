/**
 * Same button as `demos/failing-german-button`, but styled with
 * `@emotion/styled`. The critical difference: the CSS declarations
 * (`width`, `font`, `line-height`) live in a `<style>` tag emotion
 * injects on mount, not in the component's `style` prop. Prelight's
 * static walker (`resolveStyles()`) has no view into emotion's
 * injected stylesheet, so without the runtime probe this component
 * is invisible to `verifyComponent()` — it would throw
 * `font not known` and force the test to duplicate the typography
 * in the spec.
 *
 * With `verifyComponent({ runtime: true })`, Prelight mounts the
 * component into happy-dom, lets emotion inject, then reads
 * `getComputedStyle()` to recover the same `font` / `maxWidth` /
 * `lineHeight` the static walker would have read from an inline
 * `style` object. Numbers match Button.tsx so the demo maps 1:1.
 */

import React from 'react';
import styled from '@emotion/styled';

export const BUTTON_WIDTH = 120;
export const BUTTON_LINE_HEIGHT = 20;
export const BUTTON_FONT = '16px sans-serif';

// Emotion-styled button. The `font` shorthand lives inside emotion's
// generated class — `style={{}}` would make it visible to the static
// walker and defeat the demo.
const StyledButton = styled.button`
  width: ${BUTTON_WIDTH}px;
  font: ${BUTTON_FONT};
  line-height: ${BUTTON_LINE_HEIGHT}px;
`;

export interface SaveButtonProps {
  label: string;
}

export function SaveButton({ label }: SaveButtonProps) {
  return <StyledButton>{label}</StyledButton>;
}
