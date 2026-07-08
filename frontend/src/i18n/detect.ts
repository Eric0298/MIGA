import { isSupportedLanguage, type Language } from './types'

export const LANGUAGE_STORAGE_KEY = 'miga.language'

export function detectBrowserLanguage(browserLang: string | null | undefined): Language {
  if (!browserLang) return 'en'
  const normalized = browserLang.toLowerCase()
  if (normalized.startsWith('es')) return 'es'
  if (normalized.startsWith('ca') || normalized.startsWith('va')) return 'va'
  if (normalized.startsWith('en')) return 'en'
  return 'en'
}

export function detectInitialLanguage(): Language {
  try {
    const stored =
      typeof localStorage !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null
    if (isSupportedLanguage(stored)) return stored
  } catch {
    // localStorage might not be available (SSR, disabled cookies, etc.)
  }
  const browserLang = typeof navigator !== 'undefined' ? navigator.language : null
  return detectBrowserLanguage(browserLang)
}
