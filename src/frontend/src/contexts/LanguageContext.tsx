import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { LoadingOverlay, Text } from '@mantine/core';
import { type JSX, useEffect, useRef, useState } from 'react';

import { useShallow } from 'zustand/react/shallow';
import { api } from '../App';
import { useLocalState } from '../states/LocalState';
import { useServerApiState } from '../states/ServerApiState';
import { useStoredTableState } from '../states/StoredTableState';
import { fetchGlobalStates } from '../states/states';

export const defaultLocale = 'zh_Hans';

const supportedLanguages = {
  ar: 'العربية',
  bg: 'Български',
  cs: 'Čeština',
  da: 'Dansk',
  de: 'Deutsch',
  el: 'Ελληνικά',
  en: 'English',
  es: 'Español',
  es_MX: 'Español (México)',
  et: 'Eesti',
  fa: 'فارسی',
  fi: 'Suomi',
  fr: 'Français',
  he: 'עברית',
  hi: 'हिन्दी',
  hu: 'Magyar',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  nl: 'Nederlands',
  no: 'Norsk',
  pl: 'Polski',
  pt: 'Português',
  pt_BR: 'Português (Brasil)',
  ro: 'Română',
  ru: 'Русский',
  sk: 'Slovenčina',
  sl: 'Slovenščina',
  sr: 'Српски',
  sv: 'Svenska',
  th: 'ไทย',
  tr: 'Türkçe',
  uk: 'Українська',
  vi: 'Tiếng Việt',
  zh_Hans: '中文（简体）',
  zh_Hant: '中文（繁體）'
} as const;

const localeAliases: Record<string, string> = {
  'en-us': 'en',
  'en-gb': 'en',
  'es-mx': 'es_MX',
  'pt-br': 'pt_BR',
  zh: 'zh_Hans',
  'zh-cn': 'zh_Hans',
  'zh-sg': 'zh_Hans',
  'zh-hans': 'zh_Hans',
  'zh-tw': 'zh_Hant',
  'zh-hk': 'zh_Hant',
  'zh-hant': 'zh_Hant'
};

/*
 * Function which returns a record of supported languages.
 * Note that this is not a constant, as it is used in the LanguageSelect component
 */
export const getSupportedLanguages = (): Record<string, string> => {
  return supportedLanguages;
};

export function normalizeLocale(locale: string | null | undefined): string | null {
  if (!locale) {
    return null;
  }

  const rawLocale = locale.trim();

  if (!rawLocale) {
    return null;
  }

  const languages = getSupportedLanguages();

  if (rawLocale in languages) {
    return rawLocale;
  }

  const normalizedLocale = rawLocale.replaceAll('_', '-').toLowerCase();

  if (normalizedLocale in localeAliases) {
    return localeAliases[normalizedLocale];
  }

  const supportedLocale = Object.keys(languages).find((key) => {
    return (
      key.toLowerCase() === rawLocale.toLowerCase() ||
      key.replaceAll('_', '-').toLowerCase() === normalizedLocale
    );
  });

  if (supportedLocale) {
    return supportedLocale;
  }

  const baseLocale = normalizedLocale.split('-')[0];

  if (baseLocale in localeAliases) {
    return localeAliases[baseLocale];
  }

  const baseMatch = Object.keys(languages).find(
    (key) => key.toLowerCase() === baseLocale
  );

  return baseMatch || null;
}

function formatAcceptLanguage(locale: string): string {
  return locale.replaceAll('_', '-').toLowerCase();
}

export function LanguageContext({
  children
}: Readonly<{ children: JSX.Element }>) {
  const [language] = useLocalState(useShallow((state) => [state.language]));
  const [server] = useServerApiState(useShallow((state) => [state.server]));
  const resolvedLanguage = normalizeLocale(language);
  const resolvedServerLocale = normalizeLocale(server.default_locale);

  const [activeLocale, setActiveLocale] = useState<string | null>(null);

  useEffect(() => {
    // Update the locale based on prioritization:
    // 1. Locally selected locale
    // 2. Server default locale
    // 3. English (fallback)

    let locale: string | null = activeLocale;

    if (!!resolvedLanguage) {
      locale = resolvedLanguage;
    } else if (!!resolvedServerLocale) {
      locale = resolvedServerLocale;
    } else {
      locale = defaultLocale;
    }

    if (locale != activeLocale) {
      setActiveLocale(locale);
      activateLocale(locale);
    }
  }, [activeLocale, resolvedLanguage, resolvedServerLocale]);

  const [loadedState, setLoadedState] = useState<
    'loading' | 'loaded' | 'error'
  >('loading');
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    const lang = resolvedLanguage || resolvedServerLocale || defaultLocale;

    activateLocale(lang)
      .then(() => {
        if (isMounted.current) setLoadedState('loaded');

        /*
         * Configure the default Accept-Language header for all requests.
         * - Locally selected locale
         * - Server default locale
         * - en-us (backup)
         */
        const locales: (string | undefined)[] = [];

        if (!!lang && lang != 'pseudo-LOCALE') {
          locales.push(formatAcceptLanguage(lang));
        }

        if (!!resolvedServerLocale) {
          locales.push(formatAcceptLanguage(resolvedServerLocale));
        }

        if (locales.indexOf('en-us') < 0) {
          locales.push('en-us');
        }

        const new_locales = locales.join(', ');

        if (new_locales == api.defaults.headers.common['Accept-Language']) {
          return;
        }

        // Update default Accept-Language headers
        api.defaults.headers.common['Accept-Language'] = new_locales;

        // Reload server state (and refresh status codes)
        fetchGlobalStates();

        // Clear out cached table column names
        useStoredTableState.getState().clearTableColumnNames();
      })
      /* istanbul ignore next */
      .catch((err) => {
        console.error('ERR: Failed loading translations', err);
        if (isMounted.current) setLoadedState('error');
      });

    return () => {
      isMounted.current = false;
    };
  }, [resolvedLanguage, resolvedServerLocale]);

  if (loadedState === 'loading') {
    return <LoadingOverlay visible={true} />;
  }

  /* istanbul ignore next */
  if (loadedState === 'error') {
    return (
      <Text>
        An error occurred while loading translations, see browser console for
        details.
      </Text>
    );
  }

  // only render the i18n Provider if the locales are fully activated, otherwise we end
  // up with an error in the browser console
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

// This function is used to determine the locale to activate based on the prioritization rules.
export function getPriorityLocale(): string {
  const serverDefault = normalizeLocale(
    useServerApiState.getState().server.default_locale
  );
  const userDefault = normalizeLocale(useLocalState.getState().language);

  return userDefault || serverDefault || defaultLocale;
}

export async function activateLocale(locale: string | null) {
  if (!locale) {
    locale = getPriorityLocale();
  }

  const normalizedLocale = normalizeLocale(locale) || defaultLocale;

  try {
    const { messages } = await import(
      `../locales/${normalizedLocale}/messages.ts`
    );
    i18n.load(normalizedLocale, messages);
    i18n.activate(normalizedLocale);
  } catch (err) {
    console.error(`Failed to load locale ${normalizedLocale}:`, err);
  }
}
