import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { type Locale, type TranslationKeys, translations, detectLocale } from './translations.ts'
import { idbGet, idbSet } from '../utils/storage.ts'

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: TranslationKeys
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

export function LocaleProvider(props: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  useEffect(() => {
    ;(async () => {
      try {
        const saved = await idbGet<Locale>('locale')
        if (saved && (saved === 'en' || saved === 'ru')) {
          setLocaleState(saved)
        }
      } catch {
        // ignore
      }
    })()
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try {
      void idbSet('locale', l)
    } catch {
      // ignore
    }
  }, [])

  const t = translations[locale]

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  )

  return <LocaleContext.Provider value={value}>{props.children}</LocaleContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
