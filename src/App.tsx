import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MdxGroupIndex } from './types';
import { useSearchStore, useSettingsStore } from './store';
import { LibraryView } from './pages/LibraryView';
import { SearchView, SearchViewRef } from './pages/SearchView';
import { HistoryView } from './pages/HistoryView';
import { FavoritesView } from './pages/FavoritesView';
import { SettingsView } from './pages/SettingsView';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonAlert,
  setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import {
  searchOutline,
  libraryOutline,
  timeOutline,
  heartOutline,
  settingsOutline,
} from 'ionicons/icons';
import {
  applyIonicTheme,
  getEffectiveThemeMode,
  getEffectiveThemePreset,
} from './ionicTheme';
import { listen } from '@tauri-apps/api/event';
import { readText as tauriReadText } from '@tauri-apps/plugin-clipboard-manager';

// Initialize Ionic - mode will be set dynamically
// We need to get the initial theme preset from the store before setupIonicReact is called
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
/**
 * Tab item configuration
 */
interface TabItem {
  id: string;
  titleKey: string;
  icon: string;
  path: string;
}

const tabItems: TabItem[] = [
  { id: 'search', titleKey: 'Search', icon: searchOutline, path: '/search' },
  { id: 'library', titleKey: 'Library', icon: libraryOutline, path: '/library' },
  { id: 'history', titleKey: 'History', icon: timeOutline, path: '/history' },
  { id: 'favorites', titleKey: 'Favorites', icon: heartOutline, path: '/favorites' },
  { id: 'settings', titleKey: 'Settings', icon: settingsOutline, path: '/settings' },
];

/**
 * App Component
 * 
 * Main application component with Ionic React navigation and layout.
 * Uses Zustand stores for state management.
 * 
 * Architecture:
 * - Layout: IonTabs with adaptive positioning (side on desktop, bottom on mobile)
 * - Navigation: React Router with IonReactRouter
 * - State: Theme preferences, error handling
 * - Store usage: Direct store imports, no provider needed
 */
function App() {
  const { t } = useTranslation();
  
  // Use Zustand stores - separate actions from state to reduce re-renders
  const useProfile = useSearchStore((state) => state.useProfile);
  const performSearch = useSearchStore ((state) => state.performSearch);
  const searchTerm = useSearchStore ((state) => state.searchTerm);

  // Subscribe to theme settings from store
  const themePreset = useSettingsStore((state) => state.themePreset);
  const themeMode = useSettingsStore((state) => state.themeMode);// const location = useLocation();

  // Get effective theme preset (resolves 'auto' to actual platform)
  const effectiveThemePreset = getEffectiveThemePreset(themePreset);

  const [errorAlert, setErrorAlert] = useState<{ open: boolean; message: string }>({ 
    open: false, 
    message: '' 
  });

  // Effective theme mode (derived from themeMode)
  const [effectiveThemeMode, setEffectiveThemeMode] = useState<'light' | 'dark'>(() => 
    getEffectiveThemeMode(themeMode)
  );
  
  // Ref for SearchView
  const searchViewRef = useRef<SearchViewRef>(null);

  const setActiveTab = (tab: string) => {
    const tabElement = document.querySelector(`[tab="${tab}"]`) as HTMLElement;
    if (tab) {
      tabElement.click();
    }
  };

  // Handle library selection
  const handleSelectLibrary = useCallback(async (profileId?: number) => {
    try {
      if (profileId) {
        const lastSearchTerm = searchTerm;
        await useProfile(profileId);
        if (lastSearchTerm) {
          performSearch(lastSearchTerm);
        }
        // Trigger search tab click
        setActiveTab('search');
      }
      //TODO: Should recreate useSearchStore here.
    } catch (error) {
      console.error('Failed to open library:', error);
      setErrorAlert({
        open: true,
        message: t('Failed to open library. Please check if the dictionary file exists or try again.')
      });
    }
  }, [useProfile, performSearch, searchTerm]);


  // Handle entry selection from history/favorites
  const handleEntrySelect = useCallback((groupIndexes: MdxGroupIndex[], addToHistory: boolean = true) => {
    if (searchViewRef.current) {
      searchViewRef.current.displayByEntry(groupIndexes, addToHistory);
    }
    setActiveTab('search');
  }, [searchViewRef]);


  const handleCloseErrorAlert = useCallback(() => {
    setErrorAlert({ open: false, message: '' });
  }, [setErrorAlert]);


  // Update effective theme mode when themeMode changes
  useEffect(() => {
    const newEffectiveMode = getEffectiveThemeMode(themeMode);
    setEffectiveThemeMode(newEffectiveMode);
  }, [themeMode]);

  // Apply Ionic theme when preset or mode changes
  useEffect(() => {
    applyIonicTheme({ preset: effectiveThemePreset, mode: effectiveThemeMode });
  }, [effectiveThemePreset, effectiveThemeMode]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (themeMode !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const newMode = e.matches ? 'dark' : 'light';
      setEffectiveThemeMode(newMode);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [themeMode]);


  // Auto lookup clipboard on window focus
  const autoLookupClipboard = useSettingsStore((state) => state.globalSettings.autoLookupClipboard);

  // Listen for window focus event from backend and check clipboard changes
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let lastClipboardText: string | null = null;

    const setupWindowFocusListener = async () => {
      try {
        // Initialize last clipboard text
        try {
          lastClipboardText = await tauriReadText();
        } catch (error) {
          console.error('Failed to read initial clipboard:', error);
        }

        // Listen for window-focus event from backend
        unlisten = await listen('window-focus', async () => {
          
          // Only proceed if autoLookupClipboard is enabled
          if (!autoLookupClipboard) {
            return;
          }

          try {
            // Read current clipboard content
            const currentClipboardText = await tauriReadText();
            
            // Check if clipboard content has changed
            if (currentClipboardText && 
                currentClipboardText.trim() && 
                currentClipboardText !== lastClipboardText) {
              
              // Update last clipboard text
              lastClipboardText = currentClipboardText;
              
              // Perform lookup
              if (searchViewRef.current) {
                searchViewRef.current.displayByKey(currentClipboardText.trim(), true);
              }
              setActiveTab('search');
            }
          } catch (error) {
            console.error('Failed to read clipboard on window focus:', error);
          }
        });
      } catch (error) {
        console.error('Failed to setup window focus listener:', error);
      }
    };
    setupWindowFocusListener();

    // Cleanup listener on unmount
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [searchViewRef, autoLookupClipboard]);

  return (
    <IonApp>
      <IonReactRouter>
        <IonTabs>
          {/* Main Content */}
          <IonRouterOutlet>
            <Route 
              path="/search" 
              render={() => <SearchView ref={searchViewRef} />} 
              exact
            />
            
            <Route 
              path="/library" 
              render={() => <LibraryView onSelectLibrary={handleSelectLibrary} />} 
              exact
            />
            
            <Route 
              path="/history" 
              render={() => <HistoryView
                onEntrySelect={(groupIndexes) => handleEntrySelect(groupIndexes, false)}
              />} 
              exact
            />
            
            <Route 
              path="/favorites" 
              render={() => <FavoritesView
                onEntrySelect={(groupIndexes) => handleEntrySelect(groupIndexes, true)}
              />} 
              exact
            />
            
            <Route 
              path="/settings" 
              render={() => <SettingsView
                onSettingsChanged={(setting, value) => console.log('Setting changed:', setting, value)}
              />} 
              exact
            />
            
            <Route path="/" exact>
              <Redirect to="/search" />
            </Route>
          </IonRouterOutlet>

          {/* Tab Bar - adaptive positioning */}
          <IonTabBar slot="bottom" className="tab-bar">
            {tabItems.map((item) => (
              <IonTabButton
                key={item.id}
                tab={item.id}
                href={item.path}
              >
                <IonIcon icon={item.icon} />
                <IonLabel>{t(item.titleKey)}</IonLabel>
              </IonTabButton>
            ))}
          </IonTabBar>
        </IonTabs>

        {/* Error Alert */}
        <IonAlert
          isOpen={errorAlert.open}
          onDidDismiss={handleCloseErrorAlert}
          header={t('Error')}
          message={errorAlert.message}
          buttons={[
            {
              text: t('OK'),
              role: 'confirm',
              handler: handleCloseErrorAlert,
            },
          ]}
        />
        </IonReactRouter>
        
        {/* Global portal container for imperative dialogs */}
        <div id="dialog-portal-root" />
    </IonApp>
  );
}

export default App;
