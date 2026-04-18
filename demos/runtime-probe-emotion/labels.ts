/**
 * Same copy matrix as `demos/failing-german-button`. Reusing it here
 * makes the demos directly comparable: the only thing that differs is
 * how the button is styled, not what it says.
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
