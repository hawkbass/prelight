/**
 * Dogfood library: what Prelight looks like in a real project.
 *
 * This config is what any team wiring Prelight into their CI would write:
 * one declarative matrix of component × slot × language × scale, checked
 * on every PR. No browser, no screenshots, no flake.
 *
 * Run it:
 *   bun x prelight                  # full run, terminal reporter
 *   bun x prelight --reporter json  # machine-readable
 *   bun x prelight --fail-fast      # stop at first failure
 */

import React from 'react';

import type { PrelightConfig } from '@prelight/cli';

import {
  BUTTON_FONT,
  BUTTON_LINE_HEIGHT,
  BUTTON_WIDTH,
  Button,
} from './components/Button.js';
import {
  NAV_FONT,
  NAV_LINE_HEIGHT,
  NAV_WIDTH,
  NavLink,
} from './components/NavLink.js';
import {
  BADGE_FONT,
  BADGE_LINE_HEIGHT,
  BADGE_WIDTH,
  StatusBadge,
} from './components/StatusBadge.js';
import {
  TOAST_FONT,
  TOAST_LINE_HEIGHT,
  TOAST_MAX_LINES,
  TOAST_WIDTH,
  Toast,
} from './components/Toast.js';
import { LANGS, labels } from './labels.js';

const matrix = {
  languages: LANGS as unknown as string[],
  fontScales: [1, 1.25, 1.5],
};

const config: PrelightConfig = {
  tests: [
    {
      name: 'Button: Save (short copy)',
      element: (lang) => <Button label={labels[lang as keyof typeof labels].save} />,
      font: BUTTON_FONT,
      maxWidth: BUTTON_WIDTH,
      lineHeight: BUTTON_LINE_HEIGHT,
      constraints: { maxLines: 1, noOverflow: true },
      ...matrix,
    },
    {
      name: 'Button: New item (medium copy)',
      element: (lang) => <Button label={labels[lang as keyof typeof labels].new_item} />,
      font: BUTTON_FONT,
      maxWidth: BUTTON_WIDTH,
      lineHeight: BUTTON_LINE_HEIGHT,
      constraints: { maxLines: 1, noOverflow: true },
      ...matrix,
    },
    {
      name: 'NavLink: Settings',
      element: (lang) => <NavLink label={labels[lang as keyof typeof labels].settings_nav} />,
      font: NAV_FONT,
      maxWidth: NAV_WIDTH,
      lineHeight: NAV_LINE_HEIGHT,
      constraints: { maxLines: 1, noOverflow: true },
      ...matrix,
    },
    {
      name: 'NavLink: Pricing',
      element: (lang) => <NavLink label={labels[lang as keyof typeof labels].pricing_nav} />,
      font: NAV_FONT,
      maxWidth: NAV_WIDTH,
      lineHeight: NAV_LINE_HEIGHT,
      constraints: { maxLines: 1, noOverflow: true },
      ...matrix,
    },
    {
      name: 'StatusBadge: Paid',
      element: (lang) => <StatusBadge label={labels[lang as keyof typeof labels].status_paid} />,
      font: BADGE_FONT,
      maxWidth: BADGE_WIDTH,
      lineHeight: BADGE_LINE_HEIGHT,
      constraints: { maxLines: 1, noOverflow: true },
      ...matrix,
    },
    {
      name: 'StatusBadge: Refunded',
      element: (lang) => <StatusBadge label={labels[lang as keyof typeof labels].status_refunded} />,
      font: BADGE_FONT,
      maxWidth: BADGE_WIDTH,
      lineHeight: BADGE_LINE_HEIGHT,
      constraints: { maxLines: 1, noOverflow: true },
      ...matrix,
    },
    {
      name: 'Toast: Error message (may wrap)',
      element: (lang) => <Toast message={labels[lang as keyof typeof labels].error} />,
      font: TOAST_FONT,
      maxWidth: TOAST_WIDTH,
      lineHeight: TOAST_LINE_HEIGHT,
      constraints: { maxLines: TOAST_MAX_LINES },
      ...matrix,
    },
  ],
};

export default config;
