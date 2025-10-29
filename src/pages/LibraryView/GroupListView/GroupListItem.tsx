// Group List Item Component
import { IonAvatar, IonBadge, IonIcon, IonButton, IonItem, IonButtons, IonLabel } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { folderOutline, createOutline, trashOutline, settingsOutline } from 'ionicons/icons';
import { MdxProfile } from '../../../types';
import { useCallback } from 'react';
import { textInputDialog } from '../../../components';
interface GroupListItemProps {
    group: MdxProfile;
    allowEdit?: boolean;
    onSelect?: (profileId: number) => void;
    onEdit?: (profileId: number) => void;
    onDelete?: (profile: MdxProfile) => void;
    onRename?: (profileId: number, newName: string) => void;
    style?: React.CSSProperties;
  }
  
  export const GroupListItem: React.FC<GroupListItemProps> = ({ 
    style = {},
    group, 
    allowEdit,
    onSelect, 
    onEdit, 
    onDelete, 
    onRename 
  }) => {
    const { t } = useTranslation();
    const profileCount = group.profiles?.length || 0;
    const enabledProfiles = group.profiles?.filter(p => !p.disabled).length || 0;

    const doRename = useCallback(async () => {
      const newGroupName = await textInputDialog({
        title: t('Rename Dictionary Group'),
        value: group.title,
        inputProps: {
          placeholder: t('New name'),
          clearInput: true,
          autofocus: true,
        },
      });
      
      if (newGroupName !== null) {
        onRename?.(group.profileId, newGroupName);
      }
    }, [group, onRename, t]);
    
    return (
      <IonItem 
        lines="full"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          width: '100%',
          ...style,
        }}
        onClick={() => {
          onSelect?.(group.profileId);
        }}
      >
        <IonAvatar
          style={{
            backgroundColor: group.isActive ? 'var(--ion-color-success)' : 'var(--ion-color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
          slot="start" >
          <IonIcon 
            icon={folderOutline} 
            style={{ 
              width: '24px',
              height: '24px',
              color: 'var(--ion-color-primary-contrast)'
            }} 
          />
        </IonAvatar >
        <IonLabel>{group.title}</IonLabel>
        <IonButtons slot="end">
          <IonBadge color="success">{enabledProfiles}/{profileCount}</IonBadge>
          {allowEdit && (
            <IonButton fill="clear" size="small" color="primary"
              onClick={(e) => {
                e.stopPropagation();
                doRename();
              }}
            >
              <IonIcon slot="icon-only" icon={createOutline} />
            </IonButton>
          )}
          {allowEdit && (
            <IonButton fill="clear" size="small" color="danger"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(group);
              }}
            >
              <IonIcon slot="icon-only" icon={trashOutline} />
            </IonButton>
          )}
          {
            <IonButton fill="outline" size="small" title={t('Edit Group')}
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(group.profileId);
              }}                
            >
              <IonIcon slot="icon-only" icon={settingsOutline} />
            </IonButton>
          }
        </IonButtons>
      </IonItem>
    );
  };