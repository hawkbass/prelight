export const labels = {
  en: {
    save: 'Save',
    new_item: 'New item',
    settings_nav: 'Settings',
    pricing_nav: 'Pricing',
    notifications: 'Notifications',
    welcome: 'Welcome back',
    error: 'Something went wrong',
    status_paid: 'Paid',
    status_refunded: 'Refunded',
  },
  de: {
    save: 'Speichern',
    new_item: 'Neues Objekt',
    settings_nav: 'Einstellungen',
    pricing_nav: 'Preisgestaltung',
    notifications: 'Benachrichtigungen',
    welcome: 'Willkommen zurück',
    error: 'Etwas ist schiefgelaufen',
    status_paid: 'Bezahlt',
    status_refunded: 'Erstattet',
  },
  ar: {
    save: 'حفظ',
    new_item: 'عنصر جديد',
    settings_nav: 'الإعدادات',
    pricing_nav: 'الأسعار',
    notifications: 'الإشعارات',
    welcome: 'مرحبًا بعودتك',
    error: 'حدث خطأ ما',
    status_paid: 'مدفوع',
    status_refunded: 'تم استرداد المبلغ',
  },
  ja: {
    save: '保存',
    new_item: '新しい項目',
    settings_nav: '設定',
    pricing_nav: '料金',
    notifications: '通知',
    welcome: 'おかえりなさい',
    error: 'エラーが発生しました',
    status_paid: '支払い済み',
    status_refunded: '返金済み',
  },
} as const;

export type Lang = keyof typeof labels;
export const LANGS: Lang[] = ['en', 'de', 'ar', 'ja'];
