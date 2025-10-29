import { useState, useMemo } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonButtons,
  IonIcon,
  IonActionSheet,
  IonSelect,
  IonSelectOption,
  IonText,
} from '@ionic/react';
import {
  heartOutline,
  chevronForwardOutline,
  ellipsisVerticalOutline,
  trashOutline,
  swapVerticalOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { FavoriteEntry, MdxGroupIndex } from '../types';
import { useFavoritesStore } from '../store';
import { confirmDialog } from '../components/ConfirmDialog';
import { formatDate } from '../utils/displayUtils';
/**
 * FavoritesView - Combined Component
 * 
 * Displays favorite entries with sorting and filtering capabilities.
 * Uses Zustand store for state management.
 */

export interface FavoritesViewProps {
  onEntrySelect: (groupIndexes: MdxGroupIndex[]) => void;
  className?: string;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  onEntrySelect,
  className
}) => {
  const { t } = useTranslation();
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showSortActionSheet, setShowSortActionSheet] = useState(false);

  // Get favorites from store
  const allFavorites = useFavoritesStore((state) => state.favorites);
  const sortBy = useFavoritesStore((state) => state.sortBy);
  const filterProfileId = useFavoritesStore((state) => state.filterProfileId);
  const setSortBy = useFavoritesStore((state) => state.setSortBy);
  const setFilterProfileId = useFavoritesStore((state) => state.setFilterProfileId);
  const removeFavorite = useFavoritesStore((state) => state.removeFavorite);
  const clearAllFavorites = useFavoritesStore((state) => state.clearAllFavorites);
  
  // Compute sorted and filtered favorites using useMemo to avoid infinite loop
  const favorites = useMemo(() => {
    // Filter by profile if needed
    let filtered = allFavorites;
    if (filterProfileId !== null) {
      filtered = allFavorites.filter((fav) => fav.profileId === filterProfileId);
    }
    
    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.keyword.localeCompare(b.keyword, 'zh-CN');
      } else {
        // Sort by time (newest first)
        return b.addedAt - a.addedAt;
      }
    });
    
    return sorted;
  }, [allFavorites, sortBy, filterProfileId]);
  
  // Get unique profiles from favorites
  const availableProfiles = Array.from(
    new Map(
      allFavorites.map((fav) => [fav.profileId, { id: fav.profileId, name: fav.profileName }])
    ).values()
  );
  
  // Handle entry selection
  const handleEntrySelect = (entry: FavoriteEntry) => {
    // Pass the groupIndex array from the entry
    onEntrySelect(entry.groupIndex);
  };

  const handleSortChange = (sortBy: 'name' | 'time') => {
    setSortBy(sortBy);
    setShowSortActionSheet(false);
  };

  // Handle clear all with confirmation
  const handleClearAllClick = async () => {
    setShowActionSheet(false);
    const confirmed = await confirmDialog({
      title: t('Confirm Clear'),
      message: t('Are you sure you want to clear all favorites? This action cannot be undone.'),
      danger: true,
    });
    if (confirmed) {
      try {
        await clearAllFavorites();
      } catch (error) {
        console.error('Failed to clear favorites:', error);
      }
    }
  };

  return (
    <IonPage className={className}>
      {/* Top toolbar */}
      <IonHeader>
        <IonToolbar>
          {availableProfiles.length > 0 && (
            <IonSelect
              value={filterProfileId ?? 'all'}
              onIonChange={(e) => {
                const value = e.detail.value;
                setFilterProfileId(value === 'all' ? null : Number(value));
              }}
              interface="popover"
              placeholder={t('Filter Dictionary')}
              slot="start"
            >
              <IonSelectOption value="all">{t('All Dictionaries')}</IonSelectOption>
              {availableProfiles.map((profile) => (
                <IonSelectOption key={profile.id} value={profile.id}>
                  {profile.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          )}
          <IonTitle>{t('Favorites ({count})', { count: favorites.length })}</IonTitle>
          <IonButtons slot="end">
            {/* Sort button */}
            <IonButton onClick={() => setShowSortActionSheet(true)}>
              <IonIcon slot="icon-only" icon={swapVerticalOutline} />
            </IonButton>
            
            {/* More options */}
            <IonButton onClick={() => setShowActionSheet(true)}>
              <IonIcon slot="icon-only" icon={ellipsisVerticalOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        
      </IonHeader>

      {/* Sort action sheet */}
      <IonActionSheet
        isOpen={showSortActionSheet}
        onDidDismiss={() => setShowSortActionSheet(false)}
        header={t('Sort By')}
        buttons={[
          {
            text: t('Sort by Name'),
            handler: () => handleSortChange('name')
          },
          {
            text: t('Sort by Time'),
            handler: () => handleSortChange('time')
          },
          {
            text: t('Cancel'),
            role: 'cancel'
          }
        ]}
      />

      {/* Options action sheet */}
      <IonActionSheet
        isOpen={showActionSheet}
        onDidDismiss={() => setShowActionSheet(false)}
        header={t('Actions')}
        buttons={[
          {
            text: t('Clear All Favorites'),
            role: 'destructive',
            icon: trashOutline,
            handler: handleClearAllClick
          },
          {
            text: t('Cancel'),
            role: 'cancel'
          }
        ]}
      />

      {/* Content area */}
      <IonContent>
        {favorites.length > 0 ? (
          <IonList>
            {favorites.map((entry) => (
              <IonItem 
                key={entry.id}
                button
                onClick={() => handleEntrySelect(entry)}
              >
                <IonLabel>
                  <h2>{entry.keyword}</h2>
                  <p>{entry.profileName} · {formatDate(entry.addedAt)}</p>
                  </IonLabel>
                <IonButton
                  fill="clear"
                  slot="end"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFavorite(entry.id);
                  }}
                >
                  <IonIcon slot="icon-only" icon={trashOutline} />
                </IonButton>
                <IonIcon slot="end" icon={chevronForwardOutline} color="medium" />
              </IonItem>
            ))}
          </IonList>
        ) : (
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center',
            padding: '40px'
          }}>
            <IonIcon icon={heartOutline} style={{ fontSize: '64px', opacity: 0.3, marginBottom: '16px' }} color="medium" />
            <IonText>
              <h2>{t('No Favorites')}</h2>
            </IonText>
            <IonText color="medium">
              <p>{t('Entries you favorite will appear here')}</p>
            </IonText>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};
