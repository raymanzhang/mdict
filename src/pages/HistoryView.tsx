import { useState } from 'react';
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
  IonText,
} from '@ionic/react';
import {
  timeOutline,
  chevronForwardOutline,
  ellipsisVerticalOutline,
  trashOutline,
  arrowBackOutline,
  arrowForwardOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { HistoryEntry, MdxGroupIndex } from '../types';
import { useHistoryStore } from '../store';
import { confirmDialog } from '../components/ConfirmDialog';
import { formatDate } from '../utils/displayUtils';
/**
 * HistoryView - Combined Component
 * 
 * Displays history entries with navigation and management capabilities.
 * Uses Zustand store for state management.
 */

export interface HistoryViewProps {
  onEntrySelect: (groupIndexes: MdxGroupIndex[]) => void;
  className?: string;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  onEntrySelect,
  className
}) => {
  const { t } = useTranslation();
  const [showActionSheet, setShowActionSheet] = useState(false);

  // Get history from store
  const history = useHistoryStore((state) => state.history);
  const currentIndex = useHistoryStore((state) => state.currentIndex);
  const canGoBack = useHistoryStore((state) => state.canGoBack());
  const canGoForward = useHistoryStore((state) => state.canGoForward());
  const goBack = useHistoryStore((state) => state.goBack);
  const goForward = useHistoryStore((state) => state.goForward);
  const removeFromHistory = useHistoryStore((state) => state.removeFromHistory);
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  
  // Handle entry selection
  const handleEntrySelect = (entry: HistoryEntry) => {
    // Pass the groupIndex array from the entry
    onEntrySelect(entry.groupIndex);
  };
  
  // Handle go back
  const handleGoBack = () => {
    const entry = goBack();
    if (entry) {
      // Pass the groupIndex array from the entry
      onEntrySelect(entry.groupIndex);
    }
  };
  
  // Handle go forward
  const handleGoForward = () => {
    const entry = goForward();
    if (entry) {
      // Pass the groupIndex array from the entry
      onEntrySelect(entry.groupIndex);
    }
  };

  // Handle clear all with confirmation
  const handleClearAllClick = async () => {
    setShowActionSheet(false);
    const confirmed = await confirmDialog({
      title: t('Confirm Clear'),
      message: t('Are you sure you want to clear all history? This action cannot be undone.'),
      danger: true,
    });
    if (confirmed) {
      clearHistory();
    }
  };

  return (
    <IonPage className={className}>
      {/* Top toolbar */}
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={handleGoBack} disabled={!canGoBack}>
              <IonIcon slot="icon-only" icon={arrowBackOutline} />
            </IonButton>
            
            <IonButton onClick={handleGoForward} disabled={!canGoForward}>
              <IonIcon slot="icon-only" icon={arrowForwardOutline} />
            </IonButton>
          </IonButtons>
          
          <IonTitle>{t('History ({count})', { count: history.length })}</IonTitle>
          
          <IonButtons slot="end">
            {/* More options */}
            <IonButton onClick={() => setShowActionSheet(true)}>
              <IonIcon slot="icon-only" icon={ellipsisVerticalOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      {/* Options action sheet */}
      <IonActionSheet
        isOpen={showActionSheet}
        onDidDismiss={() => setShowActionSheet(false)}
        header={t('Actions')}
        buttons={[
          {
            text: t('Clear All History'),
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
        {history.length > 0 ? (
          <IonList>
            {[...history].reverse().map((entry, reverseIndex) => {
              const index = history.length - 1 - reverseIndex;
              const isCurrent = index === currentIndex;
              
              return (
                <IonItem 
                  key={entry.id}
                  button
                  onClick={() => handleEntrySelect(entry)}
                  color={isCurrent ? 'light' : undefined}
                >
                  <IonLabel>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h2>{entry.keyword}</h2>
                    </div>
                    <p>{entry.profileName} · {formatDate(entry.visitedAt)}</p>
                  </IonLabel>
                  <IonButton
                    fill="clear"
                    slot="end"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromHistory(entry.id);
                    }}
                  >
                    <IonIcon slot="icon-only" icon={trashOutline} />
                  </IonButton>
                  <IonIcon slot="end" icon={chevronForwardOutline} color="medium" />
                </IonItem>
              );
            })}
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
            <IonIcon icon={timeOutline} style={{ fontSize: '64px', opacity: 0.3, marginBottom: '16px' }} color="medium" />
            <IonText>
              <h2>{t('No History')}</h2>
            </IonText>
            <IonText color="medium">
              <p>{t('Entries you view will appear here')}</p>
            </IonText>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};
