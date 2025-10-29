import { IonItem, IonAvatar, IonLabel, IonIcon, IonToggle, IonReorder, IonButton } from "@ionic/react";
import { MdxProfile } from "../../../types";
import { getIconUrl } from "../../../utils/iframeTools/mdxHtmlTools";
import { bookOutline, checkmarkCircleOutline, constructOutline } from "ionicons/icons";

// Profile List Item Component
interface ProfileListItemProps {
    profile: MdxProfile;
    onToggle?: (profile: MdxProfile) => void;
    onOpen?: (profile: MdxProfile) => void;
    onRebuildIndex?: (profile: MdxProfile) => void;
    showToggle?: boolean;
    showReorder?: boolean;
    showRebuildButton?: boolean;
    style?: React.CSSProperties;
  }
  
  export const ProfileListItem: React.FC<ProfileListItemProps> = ({ 
    profile, 
    onToggle, 
    onOpen,
    onRebuildIndex,
    showToggle = false,
    showReorder = false,
    showRebuildButton = false,
    style = {}
  }) => {
    return (
      <IonItem  button={true} detail={false} lines="full"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
        onClick={() => {
          if (showToggle) {
            onToggle?.(profile);
          } else {
            onOpen?.(profile);
          }
        }}
      >
        <IonAvatar slot="start" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img 
            src={getIconUrl(profile.profileId)} 
            alt={profile.title}
            onError={(e) => {
              // Fallback to icon if image fails to load
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement!.innerHTML = `
                <ion-icon icon="${bookOutline}" style="align-items: center; font-size: 24px; color: ${profile.disabled ? 'var(--ion-color-medium)' : 'var(--ion-color-primary)'}"></ion-icon>
              `;
            }}
          />
        </IonAvatar>
        <IonLabel>{profile.title}</IonLabel>
            {!showToggle && profile.isActive && (
              <IonIcon 
                icon={checkmarkCircleOutline}
                color="success"
                style={{ 
                  fontSize: '24px',
                  flexShrink: 0
                }} 
              />
            )}
          {showRebuildButton && (
            <IonButton
              fill="clear"
              slot="end"
              onClick={(e) => {
                e.stopPropagation();
                onRebuildIndex?.(profile);
              }}
            >
              <IonIcon icon={constructOutline} />
            </IonButton>
          )}
          {showToggle && (
            <IonToggle
              checked={!profile.disabled}
              onIonChange={(e) => {
                e.stopPropagation();
                onToggle?.(profile);
              }}
              color="success"
              slot="end"
            />
          )}
          {showReorder && (
            <IonReorder key={profile.profileId} slot="end"></IonReorder>
          )}
      </IonItem>
    );
  };
  