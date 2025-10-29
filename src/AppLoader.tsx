import { useState, useEffect } from 'react';
import { useTranslation, I18nextProvider } from 'react-i18next';
import { useLibraryStore, useSearchStore, useSettingsStore } from './store';
import {
  IonApp,
  IonContent,
  IonSpinner,
  IonAlert,
  setupIonicReact,
} from '@ionic/react';
import {
  getEffectiveThemePreset,
} from './ionicTheme';
import i18n from './i18n/i18n';
import App from './App';
import { useSystemStore } from './store/useSystemStore';
import { setBaseUrl } from './api/system';
import { isWindowsPlatform } from './utils/platformUtils';

// Initialize Ionic - mode will be set dynamically
const getInitialThemePreset = (): 'ios' | 'md' => {
  const stored = localStorage.getItem('settings-storage');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const themePreset = parsed.state?.themePreset || 'auto';
      return getEffectiveThemePreset(themePreset);
    } catch (e) {
      return getEffectiveThemePreset('auto');
    }
  }
  return getEffectiveThemePreset('auto');
};

setupIonicReact({
  rippleEffect: true,
  mode: getInitialThemePreset(),
});

interface AppLoaderState {
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

const AppLoaderContent = () => {
  const { t, i18n: i18nInstance } = useTranslation();
  const guiLanguage = useSettingsStore((state) => state.viewSettings?.guiLanguage);
  const [state, setState] = useState<AppLoaderState>({
    isLoading: true,
    error: null,
    isInitialized: false,
  });

  // Handle language changes from settings
  useEffect(() => {
    if (guiLanguage) {
      i18nInstance.changeLanguage(guiLanguage);
    }
  }, [guiLanguage, i18nInstance]);

  useEffect(() => {
    const initializeStores = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        // Determine base URL based on platform
        // Windows: use http protocol with window.location.origin
        // Non-Windows: use mdx:// custom protocol
        let baseUrl: string;
        if (isWindowsPlatform()) {
          // On Windows, use http protocol from window.location.origin
          baseUrl = window.location.origin + '/service/';
        } else {
          // On non-Windows platforms (macOS, Linux), use mdx:// custom protocol
          baseUrl = 'mdx://mdict.cn/service/';
        }
        console.log('Setting base URL:', baseUrl);
        
        // Set base URL before initializing other stores
        useSystemStore.getState().setBaseUrl(baseUrl);
        await setBaseUrl(baseUrl);
        
        // Initialize all stores
        await Promise.all([
          useLibraryStore.getState().loadGroups(),
          useSearchStore.getState().init(),
          useSettingsStore.getState().loadAllSettings(),
        ]);

        setState({
          isLoading: false,
          error: null,
          isInitialized: true,
        });

        console.log('All stores initialized successfully');
      } catch (error) {
        console.error('Failed to initialize stores:', error);
        setState({
          isLoading: false,
          error: error instanceof Error ? error.message : t('Initialization failed, please try again'),
          isInitialized: false,
        });
      }
    };

    initializeStores();
  }, [t]);

  const handleRetry = () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    // Trigger re-initialization by changing a dependency (we'll restart the effect)
    window.location.reload();
  };

  // Show error alert
  if (state.error) {
    return (
      <IonApp>
        <IonAlert
          isOpen={true}
          header={t('Initialization Failed')}
          message={state.error}
          buttons={[
            {
              text: t('Retry'),
              role: 'confirm',
              handler: handleRetry,
            },
          ]}
        />
      </IonApp>
    );
  }

  // Show loading spinner
  if (state.isLoading) {
    return (
      <IonApp>
        <IonContent className="ion-padding" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: '100vh'
        }}>
          <div style={{ textAlign: 'center' }}>
            <IonSpinner name="crescent" style={{ width: '48px', height: '48px' }} />
            <p style={{ marginTop: '16px', color: 'var(--ion-color-medium)' }}>
              {t('Initializing application...')}
            </p>
          </div>
        </IonContent>
      </IonApp>
    );
  }

  // Render main app when initialized
  return <App />;
};

function AppLoader() {
  return (
    <I18nextProvider i18n={i18n}>
      <AppLoaderContent />
    </I18nextProvider>
  );
}

export default AppLoader;