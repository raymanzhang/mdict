/**
 * Platform detection utilities
 * 
 * Provides functions to detect the current platform (mobile vs desktop)
 */

/**
 * Detect if running on a mobile platform (iOS or Android)
 * @returns true if running on mobile, false otherwise
 */
export function isMobilePlatform(): boolean {
  // Check if running in Tauri
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    // Check user agent for mobile platforms
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    // Check for iOS
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      return true;
    }
    
    // Check for Android
    if (/android/i.test(userAgent)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Detect if running on a desktop platform (Windows, macOS, or Linux)
 * @returns true if running on desktop, false otherwise
 */
export function isDesktopPlatform(): boolean {
  return !isMobilePlatform();
}

/**
 * Check if hotkey feature is available on the current platform
 * Hotkeys are only available on desktop platforms
 * @returns true if hotkey feature is available, false otherwise
 */
export function isHotkeyAvailable(): boolean {
  return isDesktopPlatform();
}

/**
 * Detect if running on Windows platform
 * @returns true if running on Windows, false otherwise
 */
export function isWindowsPlatform(): boolean {
  if (typeof window !== 'undefined' && navigator) {
    const platform = navigator.platform || '';
    const userAgent = navigator.userAgent || '';
    
    // Check for Windows in platform or userAgent
    return /Win/.test(platform) || /Windows/.test(userAgent);
  }
  
  return false;
}

