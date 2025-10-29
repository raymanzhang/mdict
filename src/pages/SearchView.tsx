import { forwardRef, useImperativeHandle, useState, useRef, useCallback, useEffect } from 'react';
import {
  IonPage,
  IonText,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { MdxGroupIndex, TargetInfo } from '../types';
import * as searchAPI from '../api/search';
import { LookupView, LookupViewRef } from '../features/LookupView';
import { ContentView, ContentViewRef } from '../features/ContentView';
import { parseMdxNavigationUrl, INVALID_PROFILE_ID, INVALID_ENTRY_NO } from '../utils/mdxUrlParser';
import { useHistoryStore, useSearchStore, useSettingsStore } from '../store';

/**
 * SearchView - Combined Component
 * 
 * Main search page with lookup panel and content view.
 * Handles search, navigation, and panel resizing.
 */

export interface SearchViewProps {
}

export interface SearchViewRef {
  displayByEntry: (mdxGroupIndexes: MdxGroupIndex[], addToHistory?: boolean) => void;
  displayByKey: (key: string, addToHistory?: boolean) => void;
}

export const SearchView = forwardRef<SearchViewRef, SearchViewProps>(({
}, ref) => {
  // Translation
  const { t } = useTranslation();
  
  // Constants
  const MIN_LEFT_WIDTH = 250;
  const MAX_LEFT_WIDTH = 500;
  
  // Refs
  const contentViewRef = useRef<ContentViewRef>(null);
  const lookupViewRef = useRef<LookupViewRef>(null);
  
  // Store hooks
  const currentProfile = useSearchStore((state) => state.currentProfile);
  const performSearch = useSearchStore((state) => state.performSearch);
  const addToHistoryAction = useHistoryStore((state) => state.addToHistory);
  const autoLookupSelection = useSettingsStore((state) => state.globalSettings.autoLookupSelection);
  
  // Content display state
  const [mdxGroupIndexes, setMdxGroupIndexes] = useState<MdxGroupIndex[]>([]);
  const [highlight, setHighlight] = useState<string>('');
  const [targetInfo, setTargetInfo] = useState<TargetInfo>({
    profile_id: INVALID_PROFILE_ID,
    entry_no: INVALID_ENTRY_NO,
    fragment: '',
  });
  
  // Error state
  const [navigationError, setNavigationError] = useState<string>('');
  
  const addToHistoryStore = useCallback((indexes: MdxGroupIndex[], addToHistory: boolean = true) => {
    if (addToHistory && currentProfile && indexes.length > 0) {
      addToHistoryAction(
        indexes[0].indexes[0].key,
        indexes,
        currentProfile.profileId,
        currentProfile.title
      );
    }
  }, [currentProfile, addToHistoryAction]);
  
  // Display by key
  const displayByKey = useCallback(async (searchTerm: string, addToHistory: boolean = true) => {
    try {
      lookupViewRef.current?.setInputValue(searchTerm);
      //Need to force perform search to update the current index
      //The current index is updated in the next update cycle in LookupView.tsx, but we need to force it to update now.
      await performSearch(searchTerm);
      const currentIndex = useSearchStore.getState().currentIndex;
      if (currentIndex < 0) {
        setMdxGroupIndexes([]);
        return;
      }
      const findResult = await searchAPI.getGroupIndexes(currentIndex);

      if (Array.isArray(findResult) && findResult.length > 0) {
        const validGroups = findResult.filter(group => group.indexes && group.indexes.length > 0);
        if (validGroups.length > 0) {
          setNavigationError('');
          setMdxGroupIndexes(validGroups);
          
          addToHistoryStore(validGroups, addToHistory);          
          
          setTimeout(() => {
          contentViewRef.current?.focus();
        }, 100);
      } else {
        setNavigationError(t('Keyword not found: {keyword}', { keyword: searchTerm }));
      }
    } else {
      setNavigationError(t('Keyword not found: {keyword}', { keyword: searchTerm }));
    }
  } catch (error) {
    console.error('Error in displayByKey:', error);
    setNavigationError(t('Search failed: {keyword}', { keyword: searchTerm }));
  }
  }, [addToHistoryStore, performSearch]);
  
  // Display by entry
  const displayByEntry = useCallback((mdxGroupIndexes: MdxGroupIndex[], addToHistory: boolean = true) => {
    if (mdxGroupIndexes.length === 0 || mdxGroupIndexes[0].indexes.length === 0) {
      setMdxGroupIndexes([]);
      return;
    }else if (mdxGroupIndexes[0].indexes[0].profile_id != currentProfile?.profileId) {
      displayByKey(mdxGroupIndexes[0].indexes[0].key, addToHistory);
      return;
    }
    setNavigationError('');
    setMdxGroupIndexes(mdxGroupIndexes);    
    addToHistoryStore(mdxGroupIndexes, addToHistory);
    
    setTimeout(() => {
      contentViewRef.current?.focus();
    }, 100);
  }, [addToHistoryStore, currentProfile, displayByKey]);

  // Handle indexes selection
  const handleIndexesSelect = useCallback((indexes: MdxGroupIndex[], highlight?: string) => {
    setNavigationError('');
    setMdxGroupIndexes(indexes);
    setHighlight(highlight || '');
    addToHistoryStore(indexes, true);
  }, [addToHistoryStore]);
  
  // Handle navigation request
  const handleNavigationRequest = useCallback(async (url: string) => {   
    const parsed = parseMdxNavigationUrl(url);
    if (!parsed.key) {
      console.warn('Invalid navigation URL or missing key:', url);
      return;
    }
    
    try {
      const findResult = await searchAPI.findIndex(parsed.key);
      
      if (Array.isArray(findResult) && findResult.length > 0) {
        const validGroups = findResult.filter(group => group.indexes && group.indexes.length > 0);
        
        if (validGroups.length > 0) {
          setNavigationError('');
          setMdxGroupIndexes(validGroups);
          addToHistoryStore(validGroups, true);          
          
          if (parsed.profile_id !== INVALID_PROFILE_ID) {
            let targetMdxIndex = null;
            
            for (const groupIndex of validGroups) {
              targetMdxIndex = groupIndex.indexes.find((idx: any) => idx.profile_id === parsed.profile_id);
              if (targetMdxIndex) {
                break;
              }
            }
            
            if (targetMdxIndex) {
              setTargetInfo({
                profile_id: parsed.profile_id,
                entry_no: targetMdxIndex.entry_no,
                fragment: parsed.fragment || '',
              });
            } else {
              const firstGroup = validGroups[0];
              const firstIndex = firstGroup.indexes[0];
              setTargetInfo({
                profile_id: firstIndex.profile_id,
                entry_no: firstIndex.entry_no,
                fragment: parsed.fragment || '',
              });
            }
          } else {
            const firstGroup = validGroups[0];
            const firstIndex = firstGroup.indexes[0];
            setTargetInfo({
              profile_id: firstIndex.profile_id,
              entry_no: firstIndex.entry_no,
              fragment: parsed.fragment || '',
            });
          }
        } else {
          console.warn('No valid group indexes found:', findResult);
          setNavigationError(t('Keyword not found: {keyword}', { keyword: parsed.key }));
        }
      } else {
        console.warn('Entry not found or invalid:', findResult);
        setNavigationError(t('Keyword not found: {keyword}', { keyword: parsed.key }));
      }
    } catch (error) {
      console.error('Error handling navigation request:', error);
      setNavigationError(t('Navigation request error: {keyword}', { keyword: parsed.key }));
    }
  }, [addToHistoryStore]);
  
  const handleLookup=useCallback(async (word: string, _anchor:{x: number, y:number}) =>{
    if (word) {
      displayByKey(word);
    }
  }, [displayByKey]);

  // Effect: Reset target info after consumption
  useEffect(() => {
    if (targetInfo.profile_id !== INVALID_PROFILE_ID || 
        targetInfo.entry_no !== INVALID_ENTRY_NO || 
        targetInfo.fragment) {
      const timer = setTimeout(() => {
        setTargetInfo({
          profile_id: INVALID_PROFILE_ID,
          entry_no: INVALID_ENTRY_NO,
          fragment: '',
        });
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [targetInfo]);
  
  // Effect: Global keyboard handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isInputing = lookupViewRef.current?.isInputFocused() || 
                        contentViewRef.current?.isInputFocused();
      
      if (event.key === 'Enter') {
        const activeElement = document.activeElement;
        if (!activeElement) return;
        
        if (isInputing) {
          return;
        } else {
          event.preventDefault();
          lookupViewRef.current?.focus();
        }
        return;
      }
      
      const isAlphanumeric = /^[a-zA-Z0-9]$/.test(event.key);
      const hasModifiers = event.ctrlKey || event.metaKey || event.altKey;
      const shouldRedirect = isAlphanumeric && !hasModifiers;
      
      if (shouldRedirect && !isInputing) {
        event.preventDefault();
        lookupViewRef.current?.focus();
        // lookupViewRef.current?.setInputValue(event.key);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as any;
      if (data && data.type === 'has_selection' && typeof data.word === 'string') {
        event.stopPropagation();
        if (autoLookupSelection) {
          handleLookup(data.word, data.anchor);
        }
      }else if (data && data.type ==='lookup' && data.word) {
        event.stopPropagation();
        handleLookup(data.word, data.anchor);
      }else if (data && data.type ==='navigate' && data.url) {
        event.stopPropagation();
        handleNavigationRequest(data.url);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleLookup, autoLookupSelection]);

  // Expose imperative methods through ref
  useImperativeHandle(ref, () => ({
    displayByEntry,
    displayByKey,
  }), [displayByEntry, displayByKey]);
  
  return (
    <IonPage>
      {/* Content area with Allotment */}
        <Allotment>
          {/* Left panel - LookupView */}
          <Allotment.Pane preferredSize={MIN_LEFT_WIDTH} minSize={MIN_LEFT_WIDTH} maxSize={MAX_LEFT_WIDTH}>
              <LookupView
                ref={lookupViewRef}
                data-testid="lookup-view"
                onIndexesSelected={handleIndexesSelect}
                style={{ margin: '0 8px 0 8px', height: '100%', width: 'auto', display: 'flex', flexDirection: 'column' }}
              />
          </Allotment.Pane>

          {/* Right panel - ContentView */}
          <Allotment.Pane>
            <div 
              data-testid="content-view"
              style={{ 
                height: '100%',
                width: '100%',
                paddingLeft: '8px',
                paddingRight: '8px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {/* Navigation error display */}
              {navigationError && (
                <div style={{ padding: '16px' }}>
                  <div style={{
                    padding: '12px 16px',
                    // backgroundColor: 'var(--ion-color-warning-tint)',
                    // color: 'var(--ion-color-primary)',
                    borderRadius: '4px',
                    borderLeft: '4px solid var(--ion-color-warning)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <IonText color="warning">
                      <strong>{navigationError}</strong>
                    </IonText>
                    <button
                      onClick={() => setNavigationError('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        fontSize: '20px',
                        padding: '0 4px'
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <ContentView
                  ref={contentViewRef}
                  mdxGroupIndexes={mdxGroupIndexes}
                  targetInfo={targetInfo}
                  initialHighlight={highlight}
                />
              </div>
            </div>
          </Allotment.Pane>
        </Allotment>
    </IonPage>
  );
});

SearchView.displayName = 'SearchView';
