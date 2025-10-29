import React, { forwardRef, useImperativeHandle, useMemo, useRef, useCallback, useState, useEffect } from 'react';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonText,
  IonSearchbar,
} from '@ionic/react';
import {
  heart,
  heartOutline,
  libraryOutline,
  chevronBack,
  chevronForward,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { MdxGroupIndex, MdxProfile, TargetInfo } from '../types';
import { INVALID_PROFILE_ID, INVALID_ENTRY_NO } from '../utils/mdxUrlParser';
import { getIconUrl } from '../utils/iframeTools/mdxHtmlTools';
import { useFavoritesStore } from '../store';
import { EntriesView } from '../components/EntriesView';
import { TabContainer, TabItem, TabContentRenderer } from '../components/TabContainer';
import ProfileListMenu from '../components/ProfileListMenu';
import { useSearchStore } from '../store/useSearchStore';

/**
 * ContentView - Combined Component
 * 
 * Handles content display with tabs, in-page search, and navigation.
 * All state is managed internally with props for initial values.
 */

export interface ContentViewProps {
  mdxGroupIndexes?: MdxGroupIndex[];
  targetInfo?: TargetInfo;
  initialHighlight?: string;
}

export interface ContentViewRef {
  focus: () => void;
  blur: () => void;
  isInputFocused: () => boolean;
}

export const ContentView = forwardRef<ContentViewRef, ContentViewProps>(({
  mdxGroupIndexes,
  targetInfo = {
    profile_id: INVALID_PROFILE_ID,
    entry_no: INVALID_ENTRY_NO,
    fragment: '',
  },
  initialHighlight = '',
}, ref) => {
  const { t } = useTranslation();
  
  // Refs
  const entriesViewRefs = useRef<Map<string, React.RefObject<any>>>(new Map());
  const searchBarRef = useRef<HTMLIonSearchbarElement>(null);
  const tabContainerRef = useRef<any>(null);
  
  // State
  const [currentMdxGroupIndexes, setCurrentMdxGroupIndexes] = useState<MdxGroupIndex[]>([]);
  const [profileMenuAnchorEl, setProfileMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [inPageSearchTerm, setInPageSearchTerm] = useState('');
  const [highlight, setHighlight] = useState('');
  const [showFavoriteButton, setShowFavoriteButton] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [hasNextMatchAvailable, setHasNextMatchAvailable] = useState(false);
  const [hasPrevMatchAvailable, setHasPrevMatchAvailable] = useState(false);
  
  const dbProfile = useSearchStore((state) => state.currentProfile);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const checkIsFavorited = useFavoritesStore((state) => state.isFavorited);
  
  // Update highlight when initialHighlight changes
  useEffect(() => {
    if (initialHighlight !== undefined && initialHighlight !== highlight) {
      setHighlight(initialHighlight);
    }
  }, [initialHighlight]);
  
  // Control button visibility based on content availability
  useEffect(() => {
    if (currentMdxGroupIndexes.length > 0) {
      setShowFavoriteButton(true);
      
      // Check if current entry is favorited
      if (dbProfile && currentMdxGroupIndexes[0]?.indexes[0]) {
        const keyword = currentMdxGroupIndexes[0].indexes[0].key;
        const profileId = dbProfile.profileId;
        const favorited = checkIsFavorited(keyword, profileId);
        setIsFavorited(favorited);
      }
    } else {
      setShowFavoriteButton(false);
    }
  }, [currentMdxGroupIndexes, dbProfile, checkIsFavorited]);
  
  // Process input props and create grouped indexes
  useEffect(() => {
    if (mdxGroupIndexes && mdxGroupIndexes.length > 0) {
      setCurrentMdxGroupIndexes(mdxGroupIndexes);
    } else {
      setCurrentMdxGroupIndexes([]);
    }
  }, [mdxGroupIndexes]);

  // Handle target parameters after content is displayed
  useEffect(() => {
    if (currentMdxGroupIndexes.length === 0) return;

    if (targetInfo.profile_id !== INVALID_PROFILE_ID) {
      const targetTabId = targetInfo.profile_id.toString();
      const targetTab = currentMdxGroupIndexes.find(group => group.profile_id === targetInfo.profile_id);
      
      if (targetTab) {
        setTimeout(() => {
          if (tabContainerRef.current) {
            tabContainerRef.current.setActiveTab(targetTabId);
          }
          
          if (targetInfo.entry_no !== INVALID_ENTRY_NO) {
            setTimeout(() => {
              const entriesViewRef = entriesViewRefs.current.get(targetTabId);
              if (entriesViewRef?.current) {
                const targetIndex = targetTab.indexes.find(index => index.entry_no === targetInfo.entry_no);
                if (targetIndex) {
                  entriesViewRef.current.scrollToKey(targetIndex.key);
                }
              }
            }, 200);
          }
        }, 100);
      }
    }
  }, [currentMdxGroupIndexes, targetInfo]);

  useEffect(() => {
    let tabId = tabContainerRef.current?.getActiveTab()?.id;
    if (tabId) {
      let entriesViewRef = entriesViewRefs.current.get(tabId);
      if (entriesViewRef && entriesViewRef.current) {
        entriesViewRef.current.setHighlight(highlight || '');
      }
    }
  }, [highlight, entriesViewRefs, tabContainerRef]);
  
  // Update match navigation button states
  const updateMatchNavigationStates = useCallback(() => {
    const tabId = tabContainerRef.current?.getActiveTab()?.id;
    if (!tabId) {
      setHasNextMatchAvailable(false);
      setHasPrevMatchAvailable(false);
      return;
    }

    const entriesViewRef = entriesViewRefs.current.get(tabId);
    if (entriesViewRef?.current) {
      const hasNext = entriesViewRef.current.hasNextMatch?.() ?? false;
      const hasPrev = entriesViewRef.current.hasPrevMatch?.() ?? false;
      setHasNextMatchAvailable(hasNext);
      setHasPrevMatchAvailable(hasPrev);
    } else {
      setHasNextMatchAvailable(false);
      setHasPrevMatchAvailable(false);
    }
  }, []);

  const handleTabChange = useCallback((_tabId: string, _tabItem: any) => {
    // Update match navigation states when tab changes
    setTimeout(() => {
      updateMatchNavigationStates();
    }, 100);
  }, [updateMatchNavigationStates]);

  const handleInPageSearchChange = useCallback((event: CustomEvent) => {
    const newValue = event.detail.value || '';
    setInPageSearchTerm(newValue);
  }, []);

  const handleInPageSearch = useCallback(() => {
    setHighlight(inPageSearchTerm);
    // Update navigation states after highlight completes
    // Use a short delay to allow highlight process to complete
    setTimeout(() => {
      updateMatchNavigationStates();
    }, 150);
  }, [inPageSearchTerm, updateMatchNavigationStates]);

  const handleInPageSearchKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleInPageSearch();
    }
  }, [handleInPageSearch]);

  const handleInPageSearchClear = useCallback(() => {
    setInPageSearchTerm('');
    setHighlight('');
    setHasNextMatchAvailable(false);
    setHasPrevMatchAvailable(false);
  }, []);

  const handlePrevMatch = useCallback(() => {
    const tabId = tabContainerRef.current?.getActiveTab()?.id;
    if (!tabId) return;

    const entriesViewRef = entriesViewRefs.current.get(tabId);
    if (entriesViewRef?.current?.scrollToPrevMatch) {
      entriesViewRef.current.scrollToPrevMatch();
      // Update button states immediately after navigation
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        updateMatchNavigationStates();
      });
    }
  }, [updateMatchNavigationStates]);

  const handleNextMatch = useCallback(() => {
    const tabId = tabContainerRef.current?.getActiveTab()?.id;
    if (!tabId) return;

    const entriesViewRef = entriesViewRefs.current.get(tabId);
    if (entriesViewRef?.current?.scrollToNextMatch) {
      entriesViewRef.current.scrollToNextMatch();
      // Update button states immediately after navigation
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        updateMatchNavigationStates();
      });
    }
  }, [updateMatchNavigationStates]);

  const handleFavoriteToggle = useCallback(async () => {
    if (currentMdxGroupIndexes.length > 0 && dbProfile) {
      const firstEntry = currentMdxGroupIndexes[0].indexes[0];
      const keyword = firstEntry.key;
      const profileId = dbProfile.profileId;
      const profileName = dbProfile.title;      
      
      try {
        const added = await toggleFavorite(keyword, currentMdxGroupIndexes, profileId, profileName);
        setIsFavorited(added ?? false);
      } catch (error) {
        console.error('Failed to toggle favorite:', error);
      }
    }
  }, [currentMdxGroupIndexes, dbProfile, toggleFavorite]);

  // Helper function to get title for a profile
  const getProfile = useCallback((profileId: number): MdxProfile | undefined => {
    if (dbProfile) {
      if (dbProfile.profileId === profileId) {
        return dbProfile;
      } else if (dbProfile.profiles) {
        return dbProfile.profiles.find((p: MdxProfile) => p.profileId === profileId);
      }
    }
    return undefined;
  }, [dbProfile]);

  // Create tabs from currentMdxGroupIndexes
  const tabs = useMemo(() => {
    return currentMdxGroupIndexes.map(group => {
      const profile = getProfile(group.profile_id);
      const title = profile?.title ?? '';
      return {
        id: group.profile_id.toString(),
        title: title,
        tooltip: title.length > 15 ? title : undefined,
        icon_url: profile ? getIconUrl(profile.profileId) : undefined,
        data: group
      };
    });
  }, [currentMdxGroupIndexes, getProfile]);

  // Create profiles array for ProfileListMenu
  const profiles: MdxProfile[] = useMemo(() => {
    return currentMdxGroupIndexes.map(group => {
      const profile = getProfile(group.profile_id);
      if (profile) {
        return profile;
      }else{
        return {
          title: `Unknown Profile: ${group.profile_id}`,
          description: `Unknown Profile ${group.profile_id}`,
          url: ``,
          disabled: false,
          profileId: group.profile_id,
          options: {
            fontFilePath: '',
          },
          isFtsEnabled: false,
        };
      }
    });
  }, [currentMdxGroupIndexes, getProfile]);

  // Get current active tab ID
  const getActiveTabId = useCallback((): string | undefined => {
    if (!tabContainerRef.current) return undefined;
    const activeTab = tabContainerRef.current.getActiveTab();
    return activeTab?.id;
  }, []);

  // Content renderer for TabContainer
  const renderTabContent: TabContentRenderer = useCallback((tabItem) => {
    const group = tabItem.data;
    const tabId = tabItem.id;
    
    // Create or get ref for this EntriesView
    if (!entriesViewRefs.current.has(tabId)) {
      entriesViewRefs.current.set(tabId, React.createRef());
    }
    const entriesViewRef = entriesViewRefs.current.get(tabId)!;
    
    return (
      <EntriesView
        ref={entriesViewRef}
        indexes={group.indexes}
        targetInfo={group.profile_id === targetInfo.profile_id ? targetInfo : undefined}
        highlight={highlight || undefined}
      />
    );
  }, [targetInfo, highlight]);

  // Expose imperative methods through ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      const contentArea = document.querySelector('[data-testid="content-view"]');
      if (contentArea) {
        (contentArea as HTMLElement).focus();
      }
    },
    blur: () => {
      const contentArea = document.querySelector('[data-testid="content-view"]');
      if (contentArea) {
        (contentArea as HTMLElement).blur();
      }
    },
    isInputFocused: () => {
      const activeElement = document.activeElement;
      return searchBarRef.current?.contains(activeElement) ?? false;
    }
  }), []);

  // Show placeholder if no mdx group indexes
  if (!currentMdxGroupIndexes.length) {
    return (
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        textAlign: 'center',
        padding: '40px',
        backgroundColor: 'var(--ion-background-color)'
      }}>
        <IonText>
          <h2 style={{ marginBottom: '8px' }}>{t('Select an entry')}</h2>
        </IonText>
        <IonText color="medium">
          <p>{t('Select an entry from the list to view details')}</p>
        </IonText>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: 'var(--ion-background-color)'
    }}>
      {/* Top toolbar */}
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--min-height': '40px' }}>
          <IonButtons slot="end" style={{ gap: '4px' }}>
            <IonSearchbar
                ref={searchBarRef}
                value={inPageSearchTerm}
                debounce={200}
                onIonInput={handleInPageSearchChange}
                onIonClear={handleInPageSearchClear}
                onKeyDown={handleInPageSearchKeyDown}
                placeholder={t('In-page search...')}
                showClearButton="focus"
                style={{
                  width: '250px',
                  padding: '0',
                  display: 'flex',
                }}
              />
            {/* Previous Match Button */}
            <IonButton
              fill="clear"
              size="small"
              onClick={handlePrevMatch}
              disabled={!hasPrevMatchAvailable}
              title={t('Previous match')}
            >
              <IonIcon slot="icon-only" icon={chevronBack} />
            </IonButton>
            
            {/* Next Match Button */}
            <IonButton
              fill="clear"
              size="small"
              onClick={handleNextMatch}
              disabled={!hasNextMatchAvailable}
              title={t('Next match')}
            >
              <IonIcon slot="icon-only" icon={chevronForward} />
            </IonButton>
            {/* Profile List Menu Button */}
            {profiles.length > 1 && (
              <IonButton
                fill="clear"
                size="small"
                onClick={(e) => setProfileMenuAnchorEl(e.currentTarget as any)}
                title={t('Switch dictionary')}
              >
                <IonIcon slot="icon-only" icon={libraryOutline} />
              </IonButton>
            )}
            
            {/* Profile Menu */}
            <ProfileListMenu
              profiles={profiles}
              activeProfileId={getActiveTabId() ? parseInt(getActiveTabId()!) : 0}
              onProfileSelect={(profileId) => {
                if (tabContainerRef.current) {
                  tabContainerRef.current.setActiveTab(profileId.toString());
                }
                setProfileMenuAnchorEl(null);
              }}
              anchorEl={profileMenuAnchorEl}
              open={Boolean(profileMenuAnchorEl)}
              onClose={() => setProfileMenuAnchorEl(null)}
            />
            
            {/* Pronunciation button */}
            {/* <IonButton
              fill="clear"
              size="small"
              onClick={handlePronunciation}
              disabled={!showPronunciationButton}
              title={t('Pronunciation')}
            >
              <IonIcon slot="icon-only" icon={volumeHighOutline} />
            </IonButton> */}
            
            {/* Favorite button */}
            <IonButton
              fill="clear"
              size="small"
              onClick={handleFavoriteToggle}
              disabled={!showFavoriteButton}
              title={isFavorited 
                ? t('Remove from favorites')
                : t('Add to favorites')
              }
            >
              <IonIcon slot="icon-only" icon={isFavorited ? heart : heartOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      {/* Content area with TabContainer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TabContainer
          ref={tabContainerRef}
          tabs={tabs as TabItem[]}
          contentRenderer={renderTabContent}
          onTabChange={handleTabChange}
          tabPosition="bottom"
        />
      </div>
    </div>
  );
});

ContentView.displayName = 'ContentView';
