export type Locale = 'en' | 'ru'

export type TranslationKeys = {
  heading: string
  description: string
  secretPlaceholder: string
  labelPlaceholder: string
  issuerPlaceholder: string
  periodPlaceholder: string
  digitsPlaceholder: string
  statusValid: string
  statusPaste: string
  codePlaceholder: string
  updatesIn: (seconds: number) => string
  copyCode: string
  copyLink: string
  share: string
  copyOtpauth: string
  madeWith: string
  theme: string
  cyrillicNotAllowed: string
}

const en: TranslationKeys = {
  heading: 'Generator',
  description: 'Paste a Base32 secret. The link and QR are generated automatically. No database is used.',
  secretPlaceholder: 'Secret (Base32)',
  labelPlaceholder: 'Label',
  issuerPlaceholder: 'Issuer',
  periodPlaceholder: 'Period (sec)',
  digitsPlaceholder: 'Digits',
  statusValid: 'Status: valid secret',
  statusPaste: 'Status: Paste a secret',
  codePlaceholder: '\u2014 \u2014 \u2014 \u2014 \u2014 \u2014',
  updatesIn: (s: number) => `updates in ${s}s`,
  copyCode: 'Copy code',
  copyLink: 'Copy link',
  share: 'Share',
  copyOtpauth: 'Copy otpauth',
  madeWith: 'Made with',
  theme: 'Theme',
  cyrillicNotAllowed: 'Cyrillic characters are not allowed',
}

const ru: TranslationKeys = {
  heading: 'Generator',
  description: 'Base32 secret. Ссылка и QR генерируются автоматически. БД не используется.',
  secretPlaceholder: 'Секрет (Base32)',
  labelPlaceholder: 'Метка',
  issuerPlaceholder: 'Издатель',
  periodPlaceholder: 'Период (сек)',
  digitsPlaceholder: 'Цифры',
  statusValid: 'Статус: секрет валиден',
  statusPaste: 'Статус: Вставьте секрет',
  codePlaceholder: '\u2014 \u2014 \u2014 \u2014 \u2014 \u2014',
  updatesIn: (s: number) => `обновление через ${s}с`,
  copyCode: 'Копировать код',
  copyLink: 'Копировать ссылку',
  share: 'Поделиться',
  copyOtpauth: 'Копировать otpauth',
  madeWith: 'Сделано с',
  theme: 'Тема',
  cyrillicNotAllowed: 'Кириллические символы запрещены',
}

export const translations: Record<Locale, TranslationKeys> = { en, ru }

export function detectLocale(): Locale {
  try {
    const lang = navigator.language || navigator.languages?.[0] || 'en'
    if (lang.startsWith('ru')) return 'ru'
  } catch {
    // ignore
  }
  return 'en'
}
