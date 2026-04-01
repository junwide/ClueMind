// src/i18n/index.tsx
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { zh } from './locales/zh';
import { en } from './locales/en';

export type Locale = 'zh' | 'en';

export type TranslationMap = Record<string, string>;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const translations: Record<Locale, TranslationMap> = { zh, en };

const I18nContext = createContext<I18nContextType>({
  locale: 'zh',
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('locale') as Locale) || 'zh';
    }
    return 'zh';
  });

  useEffect(() => {
    localStorage.setItem('locale', locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string>): string => {
    let value = translations[locale]?.[key] || translations['zh']?.[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{${k}}`, v);
      }
    }
    return value;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
