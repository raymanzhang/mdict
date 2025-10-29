import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
} from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';

import { MdxProfile } from '../../../types';
import { ProfileListView } from '../ProfileListView';

/**
 * GroupEditView Component
 * 
 * Displays the edit view for a dictionary group.
 * Allows managing (enabling/disabling, reordering) profiles within a group.
 */

export interface GroupEditViewProps {
  group: MdxProfile;
  onBack: () => void;
  onSelectProfile?: (profileId: number) => void;
}

export const GroupEditView: React.FC<GroupEditViewProps> = ({
  group,
  onBack,
  onSelectProfile,
}) => {
  const { t } = useTranslation();
  
  return (
    <IonPage>
      {/* Group navigation bar */}
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onBack}>
              <IonIcon slot="icon-only" icon={arrowBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>{group.title} - {t('Dictionary Management')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent>
      <div style={{ padding: '16px' }}>          
        <div style={{ minHeight: 0 }}>
          <ProfileListView
            parentGroupId={group.profileId}
            onSelectProfile={onSelectProfile}
            isEditMode={true}
          />
        </div>
      </div>
      </IonContent>
    </IonPage>
  );
};

