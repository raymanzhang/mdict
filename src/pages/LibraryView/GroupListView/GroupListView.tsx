import { useCallback, useEffect, useState } from 'react';
import {
  IonSpinner,
  IonText,
  IonIcon,
  IonList,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { folderOutline } from 'ionicons/icons';
import { MdxProfile } from '../../../types';
import { GroupListItem } from './GroupListItem';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { useSearchStore } from '../../../store/useSearchStore';

/**
 * GroupListView - Combined Component
 * 
 * Handles group list management with CRUD operations and drag-and-drop reordering.
 * All state is managed internally with props for initial values.
 */

export interface GroupListViewProps {
  onSelectGroup?: (profileId: number) => void;
  onEditGroup?: (profileId: number) => void;
  onError?: (error: string) => void;
}



export const GroupListView: React.FC<GroupListViewProps> = ({
  onSelectGroup,
  onEditGroup,
  onError,
}) => {
  const { t } = useTranslation();
  const groupList = useLibraryStore((state) => state.groups);
  const loading = useLibraryStore((state) => state.loading);
  const currentProfile = useSearchStore((state) => state.currentProfile);
  const renameGroup = useLibraryStore((state) => state.renameGroup);
  const deleteGroup = useLibraryStore((state) => state.deleteGroup);
  const [groups, setGroups] = useState<MdxProfile[]>([]);

  useEffect(() => {
    let newGroups = groupList.map(group => ({
      ...group,
      isActive: group.profileId === currentProfile?.profileId,
    }));
    setGroups(newGroups);
  }, [groupList,currentProfile]);

  const handleRenameGroup = useCallback(async (profileId: number, newName: string) => {
    try {
      await renameGroup(profileId, newName);
    } catch (err) {
      console.log('Failed to rename group:', err);
      onError?.(t('Failed to rename dictionary group') + (err as Error).message);
    }
  }, [onError, t, renameGroup]);

  // Handle delete group with confirmation
  const handleDeleteGroup = useCallback(async (profile: MdxProfile) => {
    if (profile.profileId === 1) {
      console.log('Default group protected, not deleting');
      return;
    }
    
    // Show confirmation dialog
    const confirmed = await confirmDialog({
      title: t('Confirm Delete'),
      message: t('Are you sure you want to delete the dictionary group "{groupName}"? This action cannot be undone.', { groupName: profile.title }),
      confirmLabel: t('Delete'),
      danger: true,
    });
    
    if (confirmed) {      
      try {
        await deleteGroup(profile.profileId);
      } catch (err) {
        console.error('Failed to delete group:', err);
        onError?.(t('Failed to delete dictionary group') + (err as Error).message);
      }
    }
  }, [onError, t, deleteGroup]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      overflow: 'hidden',
      minHeight: 0
    }}>
        {/* Loading state */}
        {loading && (
          <div 
            style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px',
              color: 'var(--ion-color-medium)',
            }}
          >
            <IonSpinner name="crescent" style={{ marginRight: '8px' }} />
            <IonText>{t('Loading...')}</IonText>
          </div>
        )}

        {/* Empty state */}
        {!loading && groups.length === 0 && (
          <div 
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: 'var(--ion-color-medium)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '200px',
            }}
          >
            <div style={{ fontSize: '48px', opacity: 0.3, marginBottom: '16px' }}>
              <IonIcon icon={folderOutline} style={{ fontSize: '48px' }} />
            </div>
            <IonText>
              <h3 style={{ margin: '0 0 8px 0' }}>
                {t('No Dictionary Groups')}
              </h3>
            </IonText>
            <IonText color="medium">
              <p style={{ margin: 0, fontSize: '14px' }}>
                {t('Create dictionary groups to organize and manage your dictionaries')}
              </p>
            </IonText>
          </div>
        )}

        {/* Group list with drag-and-drop */}
        {!loading && groups.length > 0 && (            // Enable drag when not creating new group
            <IonList>
              {groups.map((group) => (
                <GroupListItem
                  key={group.profileId}
                  group={group}
                  allowEdit={ group.profileId !== 1  }
                  onSelect={onSelectGroup}
                  onEdit={onEditGroup}
                  onDelete={handleDeleteGroup}
                  onRename={handleRenameGroup}
                />
              ))}
            </IonList>
          )
        }
    </div>
  );
};
