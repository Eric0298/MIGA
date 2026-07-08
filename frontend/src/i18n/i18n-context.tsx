import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ca, enUS, es as esLocale, type Locale } from 'date-fns/locale'
import { en } from './messages/en'
import { es, type Messages } from './messages/es'
import { va } from './messages/va'
import { detectInitialLanguage, LANGUAGE_STORAGE_KEY } from './detect'
import type { Language } from './types'

const messagesByLang: Record<Language, Messages> = { es, en, va }
const localeByLang: Record<Language, Locale> = { es: esLocale, en: enUS, va: ca }

type I18nContextValue = {
  lang: Language
  setLang: (lang: Language) => void
  t: Messages
  locale: Locale
}

const I18nContext = createContext<I18nContextValue | null>(null)

type I18nProviderProps = {
  children: ReactNode
  initialLang?: Language
}

export function I18nProvider({ children, initialLang }: I18nProviderProps) {
  const [lang, setLangState] = useState<Language>(() => initialLang ?? detectInitialLanguage())

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'va' ? 'ca' : lang
    }
  }, [lang])

  const setLang = useCallback((next: Language) => {
    setLangState(next)
  }, [])

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: messagesByLang[lang],
      locale: localeByLang[lang],
    }),
    [lang, setLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used within an I18nProvider')
  return ctx
}
