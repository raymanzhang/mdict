import { useState, useEffect, useCallback, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonAlert,
  IonSpinner,
} from '@ionic/react';
import {
  refreshOutline,
  addOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { LibraryViewMode, MdxProfile } from '../../types';
import { ProfileListView } from './ProfileListView';
import { GroupListView } from './GroupListView';
import { GroupEditView } from './GroupEditView';
import { useLibraryStore } from '../../store';

/**
 * LibraryView - Combined Component
 * 
 * Library management page with databases and groups views.
 * Handles view mode switching, group management, and library refresh.
 */

export interface LibraryViewProps {
  className?: string;
  onSelectLibrary?: (profileId: number) => void;
}

interface SegmentControlProps {
  options: Array<{ value: LibraryViewMode; label: string }>; 
  value: LibraryViewMode;
  onChange: (value: LibraryViewMode) => void;
}

const SegmentControl: React.FC<SegmentControlProps> = ({ options, value, onChange }) => {
  return (
    <IonSegment 
      value={value} 
      onIonChange={(e) => onChange(e.detail.value as LibraryViewMode)}
    >
      {options.map((option) => (
        <IonSegmentButton key={option.value} value={option.value}>
          <IonLabel>{option.label}</IonLabel>
        </IonSegmentButton>
      ))}
    </IonSegment>
  );
};

export const LibraryView: React.FC<LibraryViewProps> = ({
  className,
  onSelectLibrary
}) => {
  const { t } = useTranslation();
  
  // State
  const [viewMode, setViewMode] = useState<LibraryViewMode>('databases');
  const {loading} = useLibraryStore();
  const {refreshLibrary, createGroup} = useLibraryStore();
  const {getGroup} = useLibraryStore();

  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<MdxProfile | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  
  // Set error with auto-clear
  const setErrorWithTimeout = useCallback((errorMessage: string) => {
    if (errorTimeoutRef.current) {
      window.clearTimeout(errorTimeoutRef.current);
    }
    
    setError(errorMessage);
    
    const timeout = window.setTimeout(() => {
      setError(null);
      errorTimeoutRef.current = null;
    }, 5000);
    
    errorTimeoutRef.current = timeout;
  }, []);
      
  
  // Handle group edit
  const handleGroupEdit = useCallback(async (profileId: number) => {
    try {
      let group = getGroup(profileId);  
      if (group) {
        setSelectedGroup(group);
      } else {
        setErrorWithTimeout(t('Dictionary group does not exist'));
      }
    } catch (err) {
      console.error('Failed to get group:', err);
      setErrorWithTimeout(t('Failed to get dictionary group') + (err as Error).message);
    }
  }, [getGroup, setErrorWithTimeout, setSelectedGroup]);
  
  // Handle back to groups
  const handleBackToGroups = useCallback(() => {
    setSelectedGroup(null);
  }, []);
      
  // Handle create group
  const handleCreateGroup = useCallback(async () => {
    try {
      await createGroup(t('New Dictionary Group'));
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  }, [createGroup, t]);
    
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        window.clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);
  
  // If a group is selected, show the GroupEditView
  if (selectedGroup) {
    return (
      <GroupEditView
        group={selectedGroup}
        onBack={handleBackToGroups}
        onSelectProfile={onSelectLibrary}
      />
    );
  }
  
  return (
    <IonPage className={className}>
      {/* Top toolbar */}
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('Dictionary Management')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={refreshLibrary} disabled={loading}>
              {loading ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon slot="icon-only" icon={refreshOutline} />
              )}
            </IonButton>
            {viewMode === 'groups' && (
              <IonButton onClick={handleCreateGroup}>
                <IonIcon slot="icon-only" icon={addOutline} />
              </IonButton>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      {/* Content area */}
      <IonContent>
        <div style={{ padding: '16px' }}>
          {/* Segment Control */}
          <div style={{ marginBottom: '16px' }}>
            <SegmentControl
              options={[
                { value: 'databases', label: t('Databases') },
                { value: 'groups', label: t('Groups') }
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
          </div>
          
          {/* Error Alert */}
          {error && (
            <IonAlert
              isOpen={true}
              header={t('Error')}
              message={error}
              buttons={[t('OK')]}
              onDidDismiss={() => setError(null)}
            />
          )}

          {/* List View Container */}
          <div style={{ minHeight: 0 }}>
            {viewMode === 'databases' ? (
              <ProfileListView
                parentGroupId={1}
                onSelectProfile={onSelectLibrary}
                isEditMode={false}
              />
            ) : (
              <GroupListView
                onSelectGroup={onSelectLibrary}
                onEditGroup={handleGroupEdit}
                onError={setErrorWithTimeout}
              />
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};
