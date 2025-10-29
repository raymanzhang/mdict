import { useState, useEffect, useCallback } from 'react';
import {
  IonIcon,
  IonText,  
  IonReorderGroup,
  useIonToast,
} from '@ionic/react';
import {
  bookOutline,
} from 'ionicons/icons';
import { ReorderEndCustomEvent } from '@ionic/core';
import { MdxProfile } from '../../../types';
import { ProfileListItem } from './ProfileListItem';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { useSearchStore } from '../../../store/useSearchStore';
import { convertFile, createFtsIndex, cancelConversion, ConvertOptions, CollationOptions } from '../../../api/library';
import { useTranslation } from 'react-i18next';
import { ConvertDBDialogWrapper } from '../../../components/ConvertDBDialogWrapper';
import { ConversionProgressDialog } from '../../../components/ConversionProgressDialog';

/**
 * ProfileListView - Combined Component
 * 
 * Handles profile list management with drag-and-drop reordering and enable/disable toggling.
 * All state is managed internally with props for initial values.
 */

export interface ProfileListViewProps {
  parentGroupId: number;
  onSelectProfile?: (profileId: number) => void;
  isEditMode?: boolean;
}


export const ProfileListView: React.FC<ProfileListViewProps> = ({
  parentGroupId,
  onSelectProfile,
  isEditMode = false,
}) => {
  const { t } = useTranslation();
  const [presentToast] = useIonToast();
  
  // State
  const [profiles, setProfiles] = useState<MdxProfile[]>([]);
  const {updateProfileDisabledStatus, adjustProfileOrder, getGroup, groups} = useLibraryStore();
  const currentProfile = useSearchStore((state) => state.currentProfile);

  useEffect(() => {
    const group = getGroup(parentGroupId);
    if (group && group.profiles) {
      // Mark the current profile as active
      let profiles = group.profiles.map(profile => ({
        ...profile,
        isActive: profile.profileId === currentProfile?.profileId,
      }));
      setProfiles(profiles);
    }else{
      setProfiles([]);
    }
  }, [parentGroupId, getGroup, currentProfile, groups]);

  // Handle profile open
  const handleOpenProfile = useCallback((profile: MdxProfile) => {
    onSelectProfile?.(profile.profileId);
  }, [onSelectProfile]);

  // Handle profile toggle
  const handleToggleProfileInGroup = useCallback(async (profile: MdxProfile) => {
    if (profiles) {
      const newStatus=!profile.disabled;
      await updateProfileDisabledStatus(parentGroupId, profile.profileId, newStatus);

      //If the profile is disabled, adjust the order before the disabled profile
      //Otherwise, adjust the order after the enabled profile
      if (profiles && profiles.length > 0) {
        const currentIndex = profiles?.findIndex(p => p.profileId === profile.profileId);
        let newIndex = currentIndex;
        if (newStatus) {
          newIndex = profiles.findIndex(p => !p.disabled) + 1;
        }else{
          newIndex = profiles.findIndex(p => p.disabled);
        }
        if (newIndex !== undefined) {
          await adjustProfileOrder(parentGroupId, profile.profileId, newIndex);
        }
      }
    }
  }, [updateProfileDisabledStatus, adjustProfileOrder, profiles, parentGroupId ]);

  // Handle drag end - using event's from/to properties
  const handleReorderEnd = useCallback(async (event: ReorderEndCustomEvent) => {
    event.detail.complete();
    const { from, to } = event.detail;
    const movedProfile = profiles[from];
    if (movedProfile) {
      await adjustProfileOrder(parentGroupId, movedProfile.profileId, to);
    }
  }, [parentGroupId, profiles, adjustProfileOrder]);

  // State for conversion progress dialog
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [progressProfile, setProgressProfile] = useState<MdxProfile | null>(null);
  const [progressOptions, setProgressOptions] = useState<ConvertOptions | null>(null);
  const [conversionError, setConversionError] = useState<string>('');

  // Handle rebuild index confirmation
  const handleRebuildConfirm = useCallback(async (profile: MdxProfile, options: ConvertOptions) => {
    // Build collation locale string from collation options
    let collationLocale = options.collation.language;
    const extensions: string[] = [];
    
    if (options.collation.collationType && options.collation.collationType !== 'standard') {
      extensions.push(`co-${options.collation.collationType}`);
    }
    
    const strength = options.collation.strength.replace('level', 'level');
    extensions.push(`ks-${strength}`);
    
    if (options.collation.alternateHandling === 'shifted') {
      extensions.push('ka-shifted');
    }
    
    if (options.collation.caseLevel === 'true') {
      extensions.push('kc-true');
    }
    
    if (options.collation.caseFirst !== 'off') {
      extensions.push(`kf-${options.collation.caseFirst}`);
    }
    
    if (extensions.length > 0) {
      collationLocale += '-u-' + extensions.join('-');
    }
    
    // Show progress dialog and reset error state
    setProgressProfile(profile);
    setProgressOptions(options);
    setConversionError('');
    setShowProgressDialog(true);
    
    try {
      // Step 1: Convert files
      const conversionResult = await convertFile(profile.profileId, collationLocale, options.removeOldFiles);
      
      // Step 2: Create fulltext index (if enabled)
      // Always use the converted new mdx file for full-text indexing
      if (options.createFulltextIndex) {
        await createFtsIndex(conversionResult.newMdxPath);
      }
      
      // Conversion completed - dialog will show completion state automatically
    } catch (error) {
      console.error('Failed to rebuild index:', error);
      // Don't close dialog, just set error message
      const errorMsg = error instanceof Error ? error.message : String(error);
      setConversionError(errorMsg);
    }
  }, [t]);

  // Handle opening rebuild dialog
  const handleOpenRebuildDialog = useCallback(async (profile: MdxProfile) => {
    // Check if the profile is currently in use
    // A profile is in use if:
    // 1. It's the currently active single profile (currentProfile.profileId === profile.profileId)
    // 2. It's within an active group (currentProfile is a group containing this profile)
    let isProfileInUse = false;
    
    if (currentProfile) {
      // Check if it's the current single profile
      if (currentProfile.profileId === profile.profileId) {
        isProfileInUse = true;
      }
      // Check if it's within the current group
      else if (currentProfile.profiles && currentProfile.profiles.length > 0) {
        isProfileInUse = currentProfile.profiles.some(p => p.profileId === profile.profileId);
      }
    }
    
    // Reset options to default values
    const defaultCollationOptions: CollationOptions = {
      language: 'zh',
      collationType: 'pinyin',
      strength: 'level1',
      alternateHandling: 'shifted',
      caseLevel: 'false',
      caseFirst: 'off',
    };

    const defaultOptions: ConvertOptions = {
      collation: defaultCollationOptions,
      removeOldFiles: !isProfileInUse, // Default to false if profile is in use
      createFulltextIndex: true,
    };
    
    // Use a ref-like object to store the latest options
    const optionsRef = { current: { ...defaultOptions } };
    
    // Show rebuild dialog using showEnhancedDialog
    const { showEnhancedDialog } = await import('../../../components/EnhancedDialog');
    showEnhancedDialog({
      children: (
        <ConvertDBDialogWrapper
          profile={profile}
          initialOptions={defaultOptions}
          onOptionsReady={(newOptions) => {
            optionsRef.current = newOptions;
          }}
          isProfileInUse={isProfileInUse}
        />
      ),
      showButtons: true,
      confirmLabel: t('Start Rebuild'),
      cancelLabel: t('Cancel'),
      backdropDismiss: true,
      onConfirm: () => {
        handleRebuildConfirm(profile, optionsRef.current);
      },
    });
  }, [t, handleRebuildConfirm, currentProfile]);

  
  if (!profiles) {
    return null;
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      overflow: 'hidden',
      minHeight: 0
    }}>
      {/* Empty state */}
      {profiles?.length === 0 && (
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
            <IonIcon icon={bookOutline} style={{ fontSize: '48px' }} />
          </div>
          <IonText>
            <h3 style={{ margin: 0 }}>
              该词典组暂无词典
            </h3>
          </IonText>
        </div>
      )}

      {/* Profile list with drag-and-drop */}
      {profiles.length > 0 && (
        <IonReorderGroup disabled={false} onIonReorderEnd={handleReorderEnd}>
          {profiles?.map((profile) => (
            <ProfileListItem
              key={profile.profileId}
              profile={profile}
              onToggle={handleToggleProfileInGroup}
              onOpen={handleOpenProfile}
              onRebuildIndex={handleOpenRebuildDialog}
              showToggle={isEditMode}
              showReorder={isEditMode}
              showRebuildButton={true}
              />
          ))}
        </IonReorderGroup>
      )}

      {/* Conversion Progress Dialog */}
      {progressProfile && progressOptions && (
        <ConversionProgressDialog
          isOpen={showProgressDialog}
          profileTitle={progressProfile.title}
          showFulltextIndex={progressOptions.createFulltextIndex}
          errorMessage={conversionError}
          onCancel={async () => {
            try {
              await cancelConversion();
              setShowProgressDialog(false);
              setConversionError('');
              await presentToast({
                message: t('Conversion cancelled'),
                duration: 2000,
                color: 'warning',
              });
            } catch (error) {
              console.error('Failed to cancel conversion:', error);
            }
          }}
          onComplete={() => {
            setShowProgressDialog(false);
            setConversionError('');
            presentToast({
              message: t('Conversion completed successfully'),
              duration: 2000,
              color: 'success',
            });
          }}
        />
      )}
    </div>
  );
};
