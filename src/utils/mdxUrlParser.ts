/**
 * Constants for invalid values
 */
export const INVALID_PROFILE_ID = -1;
export const INVALID_ENTRY_NO = -1;

import { useSystemStore } from '../store/useSystemStore';

/**
 * Parsed MDX URL interface
 */
export interface ParsedMdxUrl {
  profile_id: number;
  key: string;
  fragment: string;
}

/**
 * Parse mdx://mdict.cn/service/entry?profile_id=&key=#fragment URL
 * @param url The mdx URL to parse
 * @returns Parsed URL components with defaults for invalid values
 */
export const parseMdxNavigationUrl = (url: string): ParsedMdxUrl => {
  const result: ParsedMdxUrl = {
    profile_id: INVALID_PROFILE_ID,
    key: '',
    fragment: ''
  };

  try {
    const urlObj = new URL(url);
    
    // Check if it's a valid mdx URL with entry service
    // BaseUrl is like http://mdict.cn/service/
    // We only handle url like http://mdict.cn/service/entry?profile_id=&key=#fragment
    const baseUrl = useSystemStore.getState().baseUrl;
    if (!urlObj.href.startsWith(baseUrl+'entry')) {
      console.warn('Invalid mdx URL format:', url);
      return result;
    }
    
    // Extract query parameters
    const profileIdParam = urlObj.searchParams.get('profile_id');
    if (profileIdParam && profileIdParam.trim() !== '') {
      const profileId = parseInt(profileIdParam, 10);
      if (!isNaN(profileId)) {
        result.profile_id = profileId;
      }
    }
    
    const keyParam = urlObj.searchParams.get('key');
    if (keyParam && keyParam.trim() !== '') {
      result.key = keyParam.trim();
    }
    
    // Extract fragment
    if (urlObj.hash && urlObj.hash.length > 1) {
      result.fragment = urlObj.hash.substring(1); // Remove '#' prefix
    }
    
    return result;
  } catch (error) {
    console.warn('Failed to parse mdx URL:', error);
    return result;
  }
};
