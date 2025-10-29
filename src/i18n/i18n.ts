/**
 * i18next Configuration
 * 
 * Initializes i18next with proper settings for the application.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import enUS from '../locales/en-US/translation.json';
import zhCN from '../locales/zh-CN/translation.json';

/**
 * Detect system locale
 */
function detectLocale(): string {
  const browserLocale = navigator.language;
  // Map common locales
  if (browserLocale.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en-US';
}

// Initialize i18next
i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources: {
      'en-US': {
        translation: enUS,
      },
      'zh-CN': {
        translation: zhCN,
      },
    },
    lng: detectLocale(), // default language
    fallbackLng: 'en-US', // fallback language
    
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    
    // Use English text as keys (natural keys)
    // This allows us to use t('Hello, World!') directly
    returnEmptyString: false,
    returnNull: false,
  });

export default i18n;

