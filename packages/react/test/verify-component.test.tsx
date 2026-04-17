import React from 'react';
import { describe, expect, test } from 'vitest';

import { extractText, htmlToText, verifyComponent } from '../src/index.js';

describe('htmlToText', () => {
  test('strips tags and decodes entities', () => {
    expect(htmlToText('<span>Speichern &amp; Beenden</span>')).toBe('Speichern & Beenden');
  });
  test('decodes numeric entities', () => {
    expect(htmlToText('&#9733;')).toBe('★');
  });
});

describe('extractText', () => {
  test('returns plain text from a button', () => {
    expect(extractText(<button>Save</button>)).toBe('Save');
  });
  test('nested elements collapse to text', () => {
    expect(
      extractText(
        <div>
          <span>Save</span>
          <span>Done</span>
        </div>,
      ),
    ).toBe('SaveDone');
  });
});

describe('verifyComponent', () => {
  function Button(props: { label: string }) {
    return <button>{props.label}</button>;
  }

  test('passes when rendered text fits', () => {
    const labels: Record<string, string> = { en: 'Save', de: 'Speichern' };
    const result = verifyComponent({
      element: (lang) => <Button label={labels[lang] ?? ''} />,
      languages: ['en', 'de'],
      font: '16px sans-serif',
      maxWidth: 120,
      lineHeight: 20,
      constraints: { maxLines: 1, noOverflow: true },
    });
    expect(result.ok).toBe(true);
  });

  test('fails on a German overflow', () => {
    const labels: Record<string, string> = {
      en: 'Save',
      de: 'Rechtsschutzversicherungsgesellschaften',
    };
    const result = verifyComponent({
      element: (lang) => <Button label={labels[lang] ?? ''} />,
      languages: ['en', 'de'],
      font: '16px sans-serif',
      maxWidth: 120,
      lineHeight: 20,
      constraints: { singleLine: true },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures.some((f) => f.cell.language === 'de')).toBe(true);
    }
  });
});
