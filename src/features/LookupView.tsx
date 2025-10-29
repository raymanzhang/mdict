import { forwardRef, useImperativeHandle, useRef, useCallback, useState, useEffect } from 'react';
import {
  IonText,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSearchbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { MdxGroupIndex, SearchResultEntry } from '../types';
import * as searchAPI from '../api/search';
import { useSearchStore } from '../store/useSearchStore';
import { EntryList } from '../components/EntryList';
import { fts_count, index_count } from '../utils/storeUtils';

/**
 * LookupView - Combined Component
 * 
 * Handles search functionality with debounced input and entry selection.
 * All state is managed in useSearchStore.
 */

export interface LookupViewProps {
  onIndexesSelected?: (indexGroups: MdxGroupIndex[], highlight?: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface LookupViewRef {
  focus: () => void;
  isInputFocused: () => boolean;
  setInputValue: (value: string) => void;
}

export const LookupView = forwardRef<LookupViewRef, LookupViewProps>(({
  onIndexesSelected,
  className,
  style
}, ref) => {
  const { t } = useTranslation();
  
  // Refs
  const searchBarRef = useRef<HTMLIonSearchbarElement>(null);
  const entryListRef = useRef<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Get data and actions from search store
  const totalCount = useSearchStore((state) => state.totalCount);
  const isLoading = useSearchStore((state) => state.loading);
  const currentIndex = useSearchStore((state) => state.currentIndex);
  const entryCacheVersion = useSearchStore((state) => state.entryCacheVersion);
  const searchMode = useSearchStore((state) => state.searchMode);
  const error = useSearchStore((state) => state.error);
  const performSearch = useSearchStore((state) => state.performSearch);
  const setSearchMode = useSearchStore((state) => state.setSearchMode);
  const currentProfile = useSearchStore((state) => state.currentProfile);
  
  useEffect(() => {
    performSearch(searchTerm);
  }, [searchTerm, performSearch, searchMode]);

  // Scroll to found index effect
  useEffect(() => {
    if (currentIndex >= 0 && entryListRef.current && !isLoading) {
      entryListRef.current?.scrollToIndex(currentIndex, 'start');
    }
  }, [currentIndex, entryListRef, entryCacheVersion, isLoading]);

  // Handlers
  const handleInputChange = useCallback((event: CustomEvent) => {
    const newValue = event.detail.value || '';
    setSearchTerm(newValue);
  }, [setSearchTerm]);

  const handleSearch = useCallback(() => {
    if (!searchTerm.trim() || isLoading || totalCount === 0) {
      return;
    }
    entryListRef.current?.selectItem(entryListRef.current?.getVisibleStartIndex() ?? 0);
  }, [searchTerm, isLoading, totalCount, entryListRef]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  }, [handleSearch]);

  const handleItemSelect = useCallback(async (_item: SearchResultEntry, index: number) => {
    if (onIndexesSelected) {
      try {
        const indexGroups = await searchAPI.getGroupIndexes(index);
        if (searchMode === 'index') {
          onIndexesSelected(indexGroups, "");
        } else {
          onIndexesSelected(indexGroups, searchTerm);
        }
      } catch (error) {
        console.error('Error getting indexes:', error);
      }
    }
  }, [onIndexesSelected, searchMode, searchTerm]);

  const focusInput = useCallback(async () => {
    await searchBarRef.current?.setFocus();
  }, []);

  const isInputFocused = useCallback(() => {
    const activeElement = document.activeElement;
    return searchBarRef.current?.contains(activeElement) ?? false;
  }, []);

  const handleSearchModeChange = useCallback((mode: any) => {
    setSearchMode(mode);
  }, [setSearchMode]);

  // Expose imperative methods through ref
  useImperativeHandle(ref, () => ({
    focus: focusInput,
    isInputFocused,
    setInputValue: (value: string) => {
      setSearchTerm(value);
    },
  }), [focusInput, isInputFocused, setSearchTerm]);

  return (
    <div className={className} style={{ ...style }}>
      {/* Search Bar */}
      <IonSearchbar
        ref={searchBarRef}
        style={{ width: '100%', height: '48px', minHeight: '48px', padding: '0' }}
        debounce={200}
        value={searchTerm}
        onIonInput={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={t('Search...')}
        showClearButton="focus"
        enterkeyhint="search"
        inputmode="search"
        type="search"
      />

      {/* Entry List */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {error ? (
          <div style={{ padding: '16px' }}>
            <div style={{ 
              padding: '12px', 
              color: 'var(--ion-color-danger-contrast)',
              borderRadius: '4px',
              borderLeft: '4px solid var(--ion-color-danger)'
            }}>
              <IonText color="danger">
                <strong>{t('Search error: {{error}}', { error })}</strong>
              </IonText>
            </div>
          </div>
        ) : !searchTerm.trim() ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IonText color="medium">
              <p style={{ fontSize: '14px' }}>{t('Enter keywords to start searching')}</p>
            </IonText>
          </div>
        ) : (
          <EntryList
            ref={entryListRef}
            onItemSelect={handleItemSelect}
          />
        )}
      </div>

      {/* Mode Toggle */}
        <IonSegment
          style={{ boarderTop: '2px solid var(--ion-color-border)', margin: '4px 0 4px 0' }}
          value={searchMode}
          disabled={!currentProfile?.isFtsEnabled}
          onIonChange={(e) => {
            const val = e.detail.value;
            if (val) handleSearchModeChange(val);
          }}
        >
          <IonSegmentButton value="index">
            <IonLabel>
              {t('Index ({{count}})', { count: index_count(currentProfile) })}
            </IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="fulltext">
            <IonLabel>
              {t('Full-text Search ({{count}})', { count: fts_count(currentProfile) })}
            </IonLabel>
          </IonSegmentButton>
        </IonSegment>
    </div>
  );
});

LookupView.displayName = 'LookupView';

