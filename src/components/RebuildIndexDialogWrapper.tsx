/**
 * ConvertDBDialogWrapper Component
 * 
 * Wrapper component that manages state for ConvertDBDialog
 * This is needed because the dialog needs to maintain its own state
 * when shown imperatively via showEnhancedDialog
 */

import React, { useState } from 'react';
import { ConvertDBDialog, ConvertOptions } from './ConvertDBDialog';
import { MdxProfile } from '../types';

interface ConvertDBDialogWrapperProps {
  profile: MdxProfile;
  initialOptions: ConvertOptions;
  onOptionsReady: (options: ConvertOptions) => void;
}

export const ConvertDBDialogWrapper: React.FC<ConvertDBDialogWrapperProps> = ({
  profile,
  initialOptions,
  onOptionsReady,
}) => {
  const [options, setOptions] = useState<ConvertOptions>(initialOptions);

  // Update parent with latest options whenever they change
  React.useEffect(() => {
    onOptionsReady(options);
  }, [options, onOptionsReady]);

  return (
    <ConvertDBDialog
      profile={profile}
      options={options}
      onOptionsChange={setOptions}
    />
  );
};

