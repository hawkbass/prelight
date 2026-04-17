/**
 * Run the Button verifier and print the actual failure output.
 * Used to capture real output for the site; run with `bun run capture-output.mjs`.
 */
import React from 'react';
import { ensureCanvasEnv, formatReport } from '@prelight/core';
import { verifyComponent } from '@prelight/react';

await ensureCanvasEnv();

function Button({ label }) {
  return React.createElement(
    'button',
    { style: { width: 120, font: '16px sans-serif', lineHeight: '20px' } },
    label,
  );
}

const labels = {
  en: 'Get coverage',
  de: 'Rechtsschutzversicherungsgesellschaften',
  ar: 'شركات التأمين',
  ja: '法的保護保険会社',
};

const result = verifyComponent({
  element: (lang) => Button({ label: labels[lang] }),
  languages: ['en', 'de', 'ar', 'ja'],
  font: '16px sans-serif',
  maxWidth: 120,
  lineHeight: 20,
  constraints: { maxLines: 1, noOverflow: true },
});

console.log(formatReport(result));
