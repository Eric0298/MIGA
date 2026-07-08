export type Language = 'es' | 'en' | 'va'

export const SUPPORTED_LANGUAGES: readonly Language[] = ['es', 'en', 'va']

export function isSupportedLanguage(value: string | null | undefined): value is Language {
  if (!value) return false
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}
