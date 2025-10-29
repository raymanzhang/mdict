/**
 * Ionic Theme Configuration
 * 
 * Provides comprehensive theme configuration for the application including light and dark modes.
 * Supports multiple predefined themes and system preference detection.
 * Follows Ionic best practices with CSS variables for consistent styling.
 */

/**
 * Theme preset names - Ionic platform modes
 */
export type ThemePreset = 'ios' | 'md' | 'auto';

/**
 * Theme mode options
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Theme configuration interface
 */
export interface ThemeConfig {
  preset: ThemePreset;
  mode: 'light' | 'dark';
}

/**
 * Apply theme to document root
 * Simplified to just toggle dark mode and platform mode (iOS vs Material Design)
 */
export function applyIonicTheme(config: ThemeConfig): void {
  const root = document.documentElement;
  
  // Toggle dark mode class
  if (config.mode === 'dark') {
    root.classList.add('ion-palette-dark');
  } else {
    root.classList.remove('ion-palette-dark');
  }
  
  // Font family
  root.style.setProperty('--ion-font-family', [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
    '"Apple Color Emoji"',
    '"Segoe UI Emoji"',
    '"Segoe UI Symbol"',
    '"Microsoft YaHei"',
    '"PingFang SC"',
    '"Hiragino Sans GB"',
    '"WenQuanYi Micro Hei"',
  ].join(','));
}

/**
 * Detect system platform preference
 */
export function getSystemPlatformPreference(): 'ios' | 'md' {
  if (typeof window !== 'undefined') {
    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Check if it's macOS or iOS
    if (platform.includes('mac') || 
        platform.includes('iphone') || 
        platform.includes('ipad') ||
        userAgent.includes('mac') ||
        userAgent.includes('iphone') ||
        userAgent.includes('ipad')) {
      return 'ios';
    }
  }
  return 'md';
}

/**
 * Detect system theme preference
 */
export function getSystemThemePreference(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Get effective theme preset based on user preference and system
 */
export function getEffectiveThemePreset(themePreset: ThemePreset): 'ios' | 'md' {
  if (themePreset === 'auto') {
    return getSystemPlatformPreference();
  }
  return themePreset as 'ios' | 'md';
}

/**
 * Get effective theme mode based on user preference and system
 */
export function getEffectiveThemeMode(themeMode: ThemeMode): 'light' | 'dark' {
  if (themeMode === 'auto') {
    return getSystemThemePreference();
  }
  return themeMode as 'light' | 'dark';
}

/**
 * Theme preset labels for UI
 */
export const THEME_PRESET_LABELS: Record<ThemePreset, string> = {
  'ios': 'iOS',
  'md': 'Material Design',
  'auto': '自动识别',
};

/**
 * Theme mode labels for UI
 */
export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  'light': '浅色',
  'dark': '深色',
  'auto': '跟随系统',
};

