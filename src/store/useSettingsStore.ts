/**
 * Settings Store
 * 
 * Manages application settings including:
 * - Theme preferences (preset, mode)
 * - Global settings (paths, clipboard, hotkeys, etc.)
 * - View settings (appearance, fonts, colors)
 * - Persistence to local storage
 * 
 * Following best practices:
 * - Immer for immutable updates
 * - DevTools for debugging
 * - Local storage sync
 * - Integration with backend config
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { ThemePreset, ThemeMode } from '../ionicTheme';
import * as configAPI from '../api/config';
import * as hotkeyAPI from '../api/hotkey';
import { withAsyncHandler } from '../utils/storeUtils';

// Global Settings Interface
interface GlobalSettings {
  appOwner: string;
  extraLibSearchPath: string;
  autoLookupClipboard: boolean;
  autoLookupSelection: boolean;
  hotkeyLetter: string;
  hotkeyModifier: string;
  usePopoverForLookup: boolean;
}

// View Settings Interface
interface ViewSettings {
  guiLanguage: string;
  appearanceMode: string;
}

interface SettingsState {
  // Theme settings (local only, not from backend)
  themePreset: ThemePreset;
  themeMode: ThemeMode;
  
  // Global settings
  globalSettings: GlobalSettings;
  
  // View settings
  viewSettings: ViewSettings;
  
  // Font list cache
  availableFonts: string[];
  
  // Loading state
  loading: boolean;
  error: string | null;
  
  // Actions - Theme (local only)
  setThemePreset: (preset: ThemePreset) => void;
  setThemeMode: (mode: ThemeMode) => void;
  
  // Actions - Global Settings
  setAppOwner: (email: string) => Promise<void>;
  setExtraLibSearchPath: (path: string) => Promise<void>;
  setAutoLookupClipboard: (enabled: boolean) => Promise<void>;
  setAutoLookupSelection: (enabled: boolean) => Promise<void>;
  setHotkey: (letter: string, modifier: string) => Promise<void>;
  setUsePopoverForLookup: (enabled: boolean) => Promise<void>;
  
  // Actions - View Settings
  setGuiLanguage: (language: string) => Promise<void>;
  setAppearanceMode: (mode: string) => Promise<void>;  
  
  // Actions - Config Management
  saveConfig: () => Promise<void>;
  loadAllSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      immer((set, get) => {
        // Create a bound version of withAsyncHandler for this store
        const handleAsync = <T extends any[], R>(
          fn: (...args: T) => Promise<R>,
          errorMessage: string
        ) => withAsyncHandler(set, fn, errorMessage);

        return {
          // Initial state
          themePreset: 'auto',
          themeMode: 'auto',
          globalSettings: {
            appOwner: '',
            extraLibSearchPath: '',
            autoLookupClipboard: true,
            autoLookupSelection: false,
            hotkeyLetter: '',
            hotkeyModifier: '',
            usePopoverForLookup: true,
          },
          viewSettings: {
            guiLanguage: '',
            appearanceMode: 'Auto',
          },
          availableFonts: [],
          loading: false,
          error: null,

          // ============ Theme Actions (local only) ============
          
          setThemePreset: (preset: ThemePreset) => {
            const currentPreset = get().themePreset;
            set({ themePreset: preset });
            
            // Force reload if preset actually changed (after state is persisted)
            if (currentPreset !== preset) {
              // Give zustand persist time to save to localStorage
              setTimeout(() => {
                window.location.reload();
              }, 100);
            }
          },

          setThemeMode: (mode: ThemeMode) => {
            set({ themeMode: mode });
          },

          // ============ Global Settings Actions ============

          setAppOwner: handleAsync(
            async (email: string) => {
              await configAPI.setConfigValue('global', 'app_owner', email);
              set((state) => {
                state.globalSettings.appOwner = email;
              });
            },
            'Failed to set user email'
          ),

          setExtraLibSearchPath: handleAsync(
            async (path: string) => {
              await configAPI.setConfigValue('global', 'extra_lib_search_path', path);
              set((state) => {
                state.globalSettings.extraLibSearchPath = path;
              });
            },
            'Failed to set data file directory'
          ),

          setAutoLookupClipboard: handleAsync(
            async (enabled: boolean) => {
              await configAPI.setConfigValue('global', 'auto_lookup_clipboard', enabled);
              set((state) => {
                state.globalSettings.autoLookupClipboard = enabled;
              });
            },
            'Failed to set auto lookup clipboard'
          ),

          setAutoLookupSelection: handleAsync(
            async (enabled: boolean) => {
              await configAPI.setConfigValue('global', 'auto_lookup_selection', enabled);
              set((state) => {
                state.globalSettings.autoLookupSelection = enabled;
              });
            },
            'Failed to set auto lookup selection'
          ),

          setHotkey: handleAsync(
            async (letter: string, modifier: string) => {
              // Save to config first
              await configAPI.setConfigValue('global', 'hotkey_letter', letter);
              await configAPI.setConfigValue('global', 'hotkey_modifier', modifier);
              
              // Register or unregister hotkey based on values
              if (letter && modifier) {
                await hotkeyAPI.registerHotkey(letter, modifier);
              } else {
                await hotkeyAPI.unregisterHotkey();
              }
              
              // Update state
              set((state) => {
                state.globalSettings.hotkeyLetter = letter;
                state.globalSettings.hotkeyModifier = modifier;
              });
            },
            'Failed to set hotkey'
          ),

          setUsePopoverForLookup: handleAsync(
            async (enabled: boolean) => {
              await configAPI.setConfigValue('global', 'use_popover_for_lookup', enabled);
              set((state) => {
                state.globalSettings.usePopoverForLookup = enabled;
              });
            },
            'Failed to set popover mode'
          ),

          // ============ View Settings Actions ============

          setGuiLanguage: handleAsync(
            async (language: string) => {
              await configAPI.setConfigValue('view', 'gui_language', language);
              set((state) => {
                state.viewSettings.guiLanguage = language;
              });
            },
            'Failed to set interface language'
          ),

          setAppearanceMode: handleAsync(
            async (mode: string) => {
              await configAPI.setConfigValue('view', 'appearance_mode', mode);
              set((state) => {
                state.viewSettings.appearanceMode = mode;
              });
            },
            'Failed to set appearance mode'
          ),

          // ============ Config Management Actions ============

          saveConfig: handleAsync(
            async () => {
              await configAPI.saveAppConfig();
            },
            'Failed to save configuration'
          ),

          loadAllSettings: handleAsync(
            async () => {
              // Load all settings using batch API
              const [globalSettings, viewSettings] = await Promise.all([
                configAPI.getGlobalSettings(),
                configAPI.getViewSettings(),
              ]);

              set((state) => {
                state.globalSettings = {
                  appOwner: globalSettings.app_owner || '',
                  extraLibSearchPath: globalSettings.extra_lib_search_path || '',
                  autoLookupClipboard: globalSettings.auto_lookup_clipboard ?? true,
                  autoLookupSelection: globalSettings.auto_lookup_selection ?? false,
                  hotkeyLetter: globalSettings.hotkey_letter || '',
                  hotkeyModifier: globalSettings.hotkey_modifier || '',
                  usePopoverForLookup: globalSettings.use_popover_for_lookup ?? true,
                };
                state.viewSettings = {
                  guiLanguage: viewSettings.gui_language || '',
                  appearanceMode: viewSettings.appearance_mode || 'Auto',
                };
              });
            },
            'Failed to load settings'
          ),
        };
      }),
      {
        name: 'settings-storage',
        version: 1,
        // Only persist client-side settings, not backend-synced ones
        partialize: (state) => ({
          themePreset: state.themePreset,
          themeMode: state.themeMode,
        }),
      }
    ),
    { name: 'SettingsStore' }
  )
);

