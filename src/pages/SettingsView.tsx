import { 
  ThemePreset, 
  ThemeMode,
} from '../ionicTheme';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonText,
  IonChip,
  IonIcon,
  IonCard,
  IonCardContent,
} from '@ionic/react';
import {
  folderOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import * as configAPI from '../api/config';
import { useSettingsStore } from '../store';
import { hotkeyInputDialog, textInputDialog } from '../components';
import { isHotkeyAvailable } from '../utils/platformUtils';

/**
 * SettingsView - Combined Component
 * 
 * Comprehensive settings page with global and view settings.
 * Integrates with Zustand store for state management.
 */

export interface SettingsViewProps {
  onSettingsChanged?: (setting: string, value: any) => void;
  className?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  className,
}) => {
  const { t } = useTranslation();
  
  // Zustand store
  const {
    globalSettings,
    viewSettings,
    themePreset,
    setAppOwner,
    setExtraLibSearchPath,
    setAutoLookupClipboard,
    setAutoLookupSelection,
    setHotkey,
    setGuiLanguage,
    setAppearanceMode,
    setThemePreset,
    setThemeMode,
  } = useSettingsStore();

  // ============ Handlers ============

  const handleEmailClick = async () => {
    try {
      const email = await textInputDialog({
        title: t('Set User Email'),
        value: globalSettings.appOwner,
        inputProps: {
          placeholder: t('Email address'),
          type: 'email',
          clearInput: true,
          autofocus: true,
        },
      });
      
      if (email !== null) {
        await setAppOwner(email);
      }
    } catch (error) {
      console.error('Failed to set email:', error);
    }
  };

  const handleSelectDirectory = async (type: 'extra') => {
    try {
      const titles = {
        extra: t('Data File Directory'),
      };
      
      // Get current path as default path
      const currentPaths = {
        extra: globalSettings.extraLibSearchPath,
      };
      
      const path = await configAPI.selectDirectory(titles[type], currentPaths[type]);
      if (!path) return;

      switch (type) {
        case 'extra':
          await setExtraLibSearchPath(path);
          break;
      }
    } catch (error) {
      console.error(`Failed to set ${type} path:`, error);
    }
  };

  const handleHotkeyClick = async () => {
    try {
      const result = await hotkeyInputDialog({
        initialLetter: globalSettings.hotkeyLetter,
        initialModifier: globalSettings.hotkeyModifier,
      });
      
      if (result !== null) {
        await setHotkey(result.letter, result.modifier);
      }
    } catch (error) {
      console.error('Failed to set hotkey:', error);
    }
  };

  const handleAppearanceModeChange = async (mode: string) => {
    try {
      // Save to backend config
      await setAppearanceMode(mode);
      
      // Map backend value to ThemeMode and apply to store
      const themeModeMap: Record<string, ThemeMode> = {
        'Auto': 'auto',
        'Light': 'light',
        'Dark': 'dark',
      };
      
      const mappedThemeMode = themeModeMap[mode] || 'auto';
      setThemeMode(mappedThemeMode);
    } catch (error) {
      console.error('Failed to set appearance mode:', error);
    }
  };

  const getHotkeyDisplay = () => {
    const { hotkeyLetter, hotkeyModifier } = globalSettings;
    if (!hotkeyLetter && !hotkeyModifier) return t('Not set');
    if (!hotkeyModifier) return hotkeyLetter;
    return `${hotkeyModifier}+${hotkeyLetter}`;
  };

  return (
    <IonPage className={className}>
      {/* Header */}
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('Settings')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      {/* Content */}
      <IonContent className="ion-padding">
        {/* Global Settings */}
        <IonText color="medium">
          <h6 style={{ marginLeft: '16px', marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.875rem' }}>
            {t('Global Settings')}
          </h6>
        </IonText>
        
        <IonCard>
          <IonCardContent style={{ padding: 0 }}>
            <IonList>
              {/* AppOwner */}
              <IonItem button onClick={handleEmailClick}>
                <IonLabel>
                  <h2>{t('User Email')}</h2>
                  <p>{globalSettings.appOwner || t('Not set')}</p>
                </IonLabel>
              </IonItem>

              {/* ExtraLibSearchPath */}
              <IonItem button onClick={() => handleSelectDirectory('extra')}>
                <IonLabel>
                  <h2>{t('Data File Directory')}</h2>
                  <p>{globalSettings.extraLibSearchPath || t('Not set')}</p>
                </IonLabel>
                <IonIcon slot="end" icon={folderOutline} />
              </IonItem>

              {/* AutoLookupClipboard */}
              <IonItem>
                <IonLabel>
                  <h2>{t('Auto Lookup Clipboard')}</h2>
                  <p>{t('Automatically lookup clipboard content when activating the interface')}</p>
                </IonLabel>
                <IonToggle 
                  checked={globalSettings.autoLookupClipboard}
                  onIonChange={(e) => setAutoLookupClipboard(e.detail.checked)}
                  slot="end"
                />
              </IonItem>

              {/* AutoLookupSelection */}
              <IonItem>
                <IonLabel>
                  <h2>{t('Auto Lookup Selection')}</h2>
                  <p>{t('Automatically lookup selected text')}</p>
                </IonLabel>
                <IonToggle 
                  checked={globalSettings.autoLookupSelection}
                  onIonChange={(e) => setAutoLookupSelection(e.detail.checked)}
                  slot="end"
                />
              </IonItem>

              {/* Hotkey (desktop only) */}
              {isHotkeyAvailable() && (
                <IonItem button onClick={handleHotkeyClick}>
                  <IonLabel>
                    <h2>{t('Hotkey Settings')}</h2>
                    <div style={{ marginTop: '4px' }}>
                      <IonChip color="primary" style={{ margin: 0 }}>
                        {getHotkeyDisplay()}
                      </IonChip>
                    </div>
                  </IonLabel>
                </IonItem>
              )}

              {/* UsePopoverForLookup */}
              {/* <IonItem>
                <IonLabel>
                  <h2>{t('Display in Popup')}</h2>
                  <p>{t('Display dictionary lookup in popup window')}</p>
                </IonLabel>
                <IonToggle 
                  checked={globalSettings.usePopoverForLookup}
                  onIonChange={(e) => setUsePopoverForLookup(e.detail.checked)}
                  slot="end"
                />
              </IonItem> */}
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* View Settings */}
        <IonText color="medium">
          <h6 style={{ marginLeft: '16px', marginBottom: '8px', marginTop: '24px', textTransform: 'uppercase', fontSize: '0.875rem' }}>
            {t('View Settings')}
          </h6>
        </IonText>
        
        <IonCard>
          <IonCardContent style={{ padding: 0 }}>
            <IonList>
              {/* GuiLanguage */}
              <IonItem>
                <IonLabel>
                  <h2>{t('Interface Language')}</h2>
                  <p>{viewSettings.guiLanguage === '' 
                    ? t('Follow System')
                    : viewSettings.guiLanguage === 'zh-CN' 
                      ? t('Simplified Chinese')
                      : t('English')
                  }</p>
                </IonLabel>
                <IonSelect 
                  value={viewSettings.guiLanguage || ''}
                  onIonChange={(e) => setGuiLanguage(e.detail.value)}
                  interface="popover"
                  slot="end"
                >
                  <IonSelectOption value="">
                    {t('Follow System')}
                  </IonSelectOption>
                  <IonSelectOption value="zh-CN">
                    {t('Simplified Chinese')}
                  </IonSelectOption>
                  <IonSelectOption value="en-US">
                    {t('English')}
                  </IonSelectOption>
                </IonSelect>
              </IonItem>

              {/* AppearanceMode */}
              <IonItem>
                <IonLabel>
                  <h2>{t('Appearance Mode')}</h2>
                  <p>{viewSettings.appearanceMode === 'Auto'
                    ? t('Follow System')
                    : viewSettings.appearanceMode === 'Light'
                      ? t('Light Mode')
                      : t('Dark Mode')
                  }</p>
                </IonLabel>
                <IonSelect 
                  value={viewSettings.appearanceMode}
                  onIonChange={(e) => handleAppearanceModeChange(e.detail.value)}
                  interface="popover"
                  slot="end"
                >
                  <IonSelectOption value="Auto">
                    {t('Follow System')}
                  </IonSelectOption>
                  <IonSelectOption value="Light">
                    {t('Light Mode')}
                  </IonSelectOption>
                  <IonSelectOption value="Dark">
                    {t('Dark Mode')}
                  </IonSelectOption>
                </IonSelect>
              </IonItem>

              {/* ThemePreset */}
              <IonItem>
                <IonLabel>
                  <h2>{t('Theme Style')}</h2>
                  <p>{themePreset === 'auto'
                    ? t('Follow System')
                    : themePreset === 'ios'
                      ? t('iOS')
                      : t('Material Design')
                  }</p>
                </IonLabel>
                <IonSelect 
                  value={themePreset || 'md'}
                  onIonChange={(e) => setThemePreset(e.detail.value as ThemePreset)}
                  interface="popover"
                  slot="end"
                >
                  <IonSelectOption value="auto">
                    {t('Follow System')}
                  </IonSelectOption>
                  <IonSelectOption value="ios">
                    {t('iOS')}
                  </IonSelectOption>
                  <IonSelectOption value="md">
                    {t('Material Design')}
                  </IonSelectOption>
                </IonSelect>
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};
