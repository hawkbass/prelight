/**
 * Real-world-like translation strings. The German entry is the 39-character
 * compound word for "legal protection insurance companies" — a real German
 * word, not contrived.
 */
export const labels = {
  en: {
    save: 'Save',
    confirm: 'Confirm',
    newPolicy: 'Get coverage',
  },
  de: {
    save: 'Speichern',
    confirm: 'Bestätigen',
    newPolicy: 'Rechtsschutzversicherungsgesellschaften',
  },
  ar: {
    save: 'حفظ',
    confirm: 'تأكيد',
    newPolicy: 'شركات التأمين',
  },
  ja: {
    save: '保存',
    confirm: '確認',
    newPolicy: '法的保護保険会社',
  },
} as const;

export type Lang = keyof typeof labels;
export const LANGS: Lang[] = ['en', 'de', 'ar', 'ja'];
