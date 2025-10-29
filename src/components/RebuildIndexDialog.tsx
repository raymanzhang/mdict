/**
 * ConvertDBDialog Component
 * 
 * Dialog for configuring collation parameters and database conversion options
 * Uses ICU4X collation settings based on BCP 47 locale extensions
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonCheckbox,
} from '@ionic/react';
import { MdxProfile } from '../types';

// ICU4X Collation Types
export interface CollationOptions {
  language: string;
  collationType?: string;
  strength: 'level1' | 'level2' | 'level3' | 'level4';
  alternateHandling: 'noignore' | 'shifted';
  caseLevel: 'true' | 'false';
  caseFirst: 'off' | 'upper' | 'lower';
}

// Conversion Options
export interface ConvertOptions {
  collation: CollationOptions;
  removeOldFiles: boolean;
  createFulltextIndex: boolean;
}

// Supported languages with collation (based on ICU4X documentation)
// This list includes languages with special collation rules
const COLLATION_LANGUAGES = [
  { code: 'ar', nameKey: 'lang_arabic', collations: ['standard'] },
  { code: 'ca', nameKey: 'lang_catalan', collations: ['standard'] },
  { code: 'cs', nameKey: 'lang_czech', collations: ['standard'] },
  { code: 'da', nameKey: 'lang_danish', collations: ['standard'] },
  { code: 'de', nameKey: 'lang_german', collations: ['standard', 'phonebk'] },
  { code: 'el', nameKey: 'lang_greek', collations: ['standard'] },
  { code: 'en', nameKey: 'lang_english', collations: ['standard'] },
  { code: 'es', nameKey: 'lang_spanish', collations: ['standard', 'trad'] },
  { code: 'fi', nameKey: 'lang_finnish', collations: ['standard'] },
  { code: 'fr', nameKey: 'lang_french', collations: ['standard'] },
  { code: 'he', nameKey: 'lang_hebrew', collations: ['standard'] },
  { code: 'hi', nameKey: 'lang_hindi', collations: ['standard'] },
  { code: 'hu', nameKey: 'lang_hungarian', collations: ['standard'] },
  { code: 'is', nameKey: 'lang_icelandic', collations: ['standard'] },
  { code: 'it', nameKey: 'lang_italian', collations: ['standard'] },
  { code: 'ja', nameKey: 'lang_japanese', collations: ['standard'] },
  { code: 'ko', nameKey: 'lang_korean', collations: ['standard'] },
  { code: 'nb', nameKey: 'lang_norwegian', collations: ['standard'] },
  { code: 'nl', nameKey: 'lang_dutch', collations: ['standard'] },
  { code: 'pl', nameKey: 'lang_polish', collations: ['standard'] },
  { code: 'pt', nameKey: 'lang_portuguese', collations: ['standard'] },
  { code: 'ro', nameKey: 'lang_romanian', collations: ['standard'] },
  { code: 'ru', nameKey: 'lang_russian', collations: ['standard'] },
  { code: 'sv', nameKey: 'lang_swedish', collations: ['standard'] },
  { code: 'th', nameKey: 'lang_thai', collations: ['standard'] },
  { code: 'tr', nameKey: 'lang_turkish', collations: ['standard'] },
  { code: 'uk', nameKey: 'lang_ukrainian', collations: ['standard'] },
  { code: 'vi', nameKey: 'lang_vietnamese', collations: ['standard'] },
  { code: 'zh', nameKey: 'lang_chinese', collations: ['standard','pinyin', 'stroke', 'zhuyin'] },
];

// Strength level descriptions (keys for i18n)
const STRENGTH_DESCRIPTIONS = {
  level1: {
    labelKey: 'Level 1 (Primary)',
    descriptionKey: 'Compares base characters only, ignoring accents and case',
    exampleKey: 'strength_level1_example',
  },
  level2: {
    labelKey: 'Level 2 (Secondary)',
    descriptionKey: 'Compares base characters and accents, ignoring case',
    exampleKey: 'strength_level2_example',
  },
  level3: {
    labelKey: 'Level 3 (Tertiary)',
    descriptionKey: 'Compares base characters, accents, and case',
    exampleKey: 'strength_level3_example',
  },
  level4: {
    labelKey: 'Level 4 (Quaternary)',
    descriptionKey: 'Distinguishes punctuation and whitespace',
    exampleKey: 'strength_level4_example',
  },
};

interface ConvertDBDialogProps {
  profile: MdxProfile;
  options: ConvertOptions;
  onOptionsChange: (options: ConvertOptions) => void;
}

export const ConvertDBDialog: React.FC<ConvertDBDialogProps> = ({
  profile,
  options,
  onOptionsChange,
}) => {
  const { t } = useTranslation();

  // Get available collation types for selected language
  const availableCollations = useMemo(() => {
    const lang = COLLATION_LANGUAGES.find((l) => l.code === options.collation.language);
    return lang?.collations || ['standard'];
  }, [options.collation.language]);

  // Shared select styles
  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px',
    marginTop: '8px',
    fontSize: '16px',
    border: '1px solid var(--ion-color-medium)',
    borderRadius: '8px',
    backgroundColor: 'var(--ion-background-color)',
    color: 'var(--ion-text-color)',
    cursor: 'pointer',
  };

  return (
      <>
        <h2 style={{ marginTop: 0 }}>{t('Rebuild Index')} : {profile.title}</h2>
        <IonLabel>
          {t('Collation settings for dictionary index')}
        </IonLabel>

        <IonList style={{ 
          background: 'transparent',
          maxHeight: '60vh',
          overflowY: 'auto'
        }}>
            {/* Language Selection */}
            <IonItem lines="none">
              <IonLabel position="stacked">
                {t('Language') + ': '}
                <IonNote>{t('Select the primary language for sorting')}</IonNote>
              </IonLabel>
              <select
                value={options.collation.language}
                onChange={(e) => {
                  const newLang = e.target.value;
                  const lang = COLLATION_LANGUAGES.find((l) => l.code === newLang);
                  onOptionsChange({
                    ...options,
                    collation: {
                      ...options.collation,
                      language: newLang,
                      collationType: lang?.collations[0] || 'standard',
                    },
                  });
                }}
                style={selectStyle}
              >
                {COLLATION_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {t(lang.nameKey)} ({lang.code})
                  </option>
                ))}
              </select>
            </IonItem>

            {/* Collation Type Selection */}
            {availableCollations.length > 1 && (
              <IonItem lines="none">
                <IonLabel position="stacked">
                  {t('Collation Type') + ': '}
                  <IonNote>
                    {t('Language-specific sorting algorithm')}
                  </IonNote>
                </IonLabel>
                <select
                  value={options.collation.collationType}
                  onChange={(e) =>
                    onOptionsChange({ 
                      ...options, 
                      collation: { ...options.collation, collationType: e.target.value }
                    })
                  }
                  style={selectStyle}
                >
                  {availableCollations.map((collation) => (
                    <option key={collation} value={collation}>
                      {t(`collation_${collation}`)}
                    </option>
                  ))}
                </select>
              </IonItem>
            )}

            {/* Strength Level */}
            <IonItem lines="none">
              <IonLabel position="stacked">
                {t('Collation Strength') + ': '}
                <IonNote>
                  {t('Determines how strictly characters are compared during sorting')}
                </IonNote>
              </IonLabel>
              <select
                value={options.collation.strength}
                onChange={(e) => onOptionsChange({ 
                  ...options, 
                  collation: { ...options.collation, strength: e.target.value as any }
                })}
                style={selectStyle}
              >
                {Object.entries(STRENGTH_DESCRIPTIONS).map(([key, desc]) => (
                  <option key={key} value={key}>
                    {t(desc.labelKey)} - {t(desc.descriptionKey)}
                  </option>
                ))}
              </select>
              <IonNote style={{ marginTop: '8px', display: 'block' }}>
                <strong>{t('Example')}:</strong>{' '}
                {t(STRENGTH_DESCRIPTIONS[options.collation.strength].exampleKey)}
              </IonNote>
            </IonItem>

            {/* Alternate Handling */}
            <IonItem lines="none">
              <IonLabel position="stacked">
                {t('Alternate Handling') + ': '}
                <IonNote>
                  {t('How to treat punctuation and whitespace')}
                </IonNote>
              </IonLabel>
              <select
                value={options.collation.alternateHandling}
                onChange={(e) =>
                  onOptionsChange({ 
                    ...options, 
                    collation: { ...options.collation, alternateHandling: e.target.value as any }
                  })
                }
                style={selectStyle}
              >
                <option value="noignore">
                  {t('Non-Ignorable')} - {t('Treat punctuation as significant')}
                </option>
                <option value="shifted">
                  {t('Shifted')} - {t('Treat punctuation as minor importance')}
                </option>
              </select>
            </IonItem>

            {/* Case Level */}
            <IonItem lines="none">
              <IonLabel position="stacked">
                {t('Case Level') + ': '}
                <IonNote>
                  {t('Enable case-sensitive sorting at primary strength')}
                </IonNote>
              </IonLabel>
              <select
                value={options.collation.caseLevel}
                onChange={(e) => onOptionsChange({ 
                  ...options, 
                  collation: { ...options.collation, caseLevel: e.target.value as any }
                })}
                style={selectStyle}
              >
                <option value="false">{t('Off')}</option>
                <option value="true">{t('On')}</option>
              </select>
            </IonItem>

            {/* Case First */}
            <IonItem lines="none">
              <IonLabel position="stacked">
                {t('Case First') + ': '}
                <IonNote>
                  {t('Sort uppercase or lowercase letters first')}
                </IonNote>
              </IonLabel>
              <select
                value={options.collation.caseFirst}
                onChange={(e) => onOptionsChange({ 
                  ...options, 
                  collation: { ...options.collation, caseFirst: e.target.value as any }
                })}
                style={selectStyle}
              >
                <option value="off">{t('Default')}</option>
                <option value="upper">{t('Uppercase First')}</option>
                <option value="lower">{t('Lowercase First')}</option>
              </select>
            </IonItem>

            {/* Remove Old Files */}
            <IonItem lines="none">
              <IonLabel>
                <h3>{t('Remove Old Files After Conversion')}</h3>
                <IonNote>
                  {t('Automatically remove old MDX/MDD files after successful conversion')}
                </IonNote>
              </IonLabel>
              <IonCheckbox
                slot="start"
                checked={options.removeOldFiles}
                onIonChange={(e) => onOptionsChange({ ...options, removeOldFiles: e.detail.checked })}
              />
            </IonItem>

            {/* Create Fulltext Index */}
            <IonItem lines="none">
              <IonLabel>
                <h3>{t('Create Fulltext Index')}</h3>
                <IonNote>
                  {t('Create fulltext search index after conversion for faster searching')}
                </IonNote>
              </IonLabel>
              <IonCheckbox
                slot="start"
                checked={options.createFulltextIndex}
                onIonChange={(e) => onOptionsChange({ ...options, createFulltextIndex: e.detail.checked })}
              />
            </IonItem>
          </IonList>
      </>
  );
};

/**
 * Hook for using ConvertDBDialog imperatively
 */
export const useConvertDBDialog = () => {
  const showConvertDBDialog = (
    profile: MdxProfile,
    onConvert: (profileId: number, options: ConvertOptions) => Promise<void>
  ) => {
    // This would need to be implemented using the EnhancedDialog system
    // For now, we'll use this as a typed interface
    return { profile, onConvert };
  };

  return { showConvertDBDialog };
};

