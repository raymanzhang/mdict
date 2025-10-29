import React from 'react';
import { IonPopover, IonList, IonItem, IonLabel, IonAvatar } from '@ionic/react';
import { bookOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';

import { MdxProfile } from '../types';
import { getIconUrl } from '../utils/iframeTools/mdxHtmlTools';

interface ProfileListMenuProps {
  profiles: MdxProfile[];
  activeProfileId: number;
  onProfileSelect: (profileId: number) => void;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

/**
 * ProfileListMenu Component
 * 
 * A dropdown menu component that displays a list of profiles (dictionaries).
 * Uses Ionic Popover component for consistent behavior.
 * This component only handles the menu rendering - the trigger button
 * should be managed by the parent component.
 * 
 * @example
 * ```tsx
 * <ProfileListMenu
 *   profiles={profiles}
 *   activeProfileId={currentProfileId}
 *   onProfileSelect={(profileId) => handleProfileChange(profileId)}
 *   anchorEl={anchorEl}
 *   open={open}
 *   onClose={() => setAnchorEl(null)}
 * />
 * ```
 */
export const ProfileListMenu: React.FC<ProfileListMenuProps> = ({
  profiles,
  activeProfileId,
  onProfileSelect,
  anchorEl,
  open,
  onClose,
}) => {
  const { t } = useTranslation();

  const handleProfileSelect = (profileId: number) => {
    onProfileSelect(profileId);
    onClose();
  };

  // Don't render menu if there are no profiles or only one profile
  if (!profiles.length || profiles.length <= 1) {
    return null;
  }

  return (
    <IonPopover
      isOpen={open}
      event={anchorEl ? { target: anchorEl } as any : undefined}
      onDidDismiss={onClose}
      side="bottom"
      alignment="end"
      style={{
        '--min-width': '300px',
        '--max-width': '400px',
        '--max-height': '400px',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--ion-color-step-150)',
        backgroundColor: 'var(--ion-color-step-50)'
      }}>
        <div style={{
          color: 'var(--ion-color-medium)',
          fontSize: '13px',
          fontWeight: 500
        }}>
          {t('Select Dictionary ({count} total)', { count: profiles.length })}
        </div>
      </div>

      {/* Profile list */}
      <IonList lines="none" style={{ padding: 0 }}>
        {profiles.map((profile) => {
          const isActive = profile.profileId === activeProfileId;

          return (
            <IonItem
              key={profile.profileId}
              button
              detail={false}
              onClick={() => handleProfileSelect(profile.profileId)}
              color={isActive ? 'light' : undefined}
              style={{
                '--padding-start': '16px',
                '--padding-end': '16px',
                '--min-height': '40px',
              }}
            >
              <IonAvatar slot="start" style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={getIconUrl(profile.profileId)}
                  onError={(e) => {
                    // Fallback to icon if image fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = `
                      <ion-icon icon="${bookOutline}" style="align-items: center; font-size: 24px; color: ${profile.disabled ? 'var(--ion-color-medium)' : 'var(--ion-color-primary)'}"></ion-icon>
                    `;
                  }}
                />
              </IonAvatar>

              <IonLabel>
                <div style={{
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--ion-color-primary)' : 'var(--ion-color-step-850)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '14px'
                }}>
                  {profile.title}
                </div>
              </IonLabel>

              {isActive && (
                <div slot="end" style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--ion-color-primary)',
                }} />
              )}
            </IonItem>
          );
        })}
      </IonList>
    </IonPopover>
  );
};

export default ProfileListMenu;
