/**
 * HotkeyInputDialog Component
 * 
 * A dialog component for capturing hotkey combinations.
 * Supports both component-based and imperative Promise-based API.
 * Listens for key presses and captures modifier keys + letter.
 * 
 * Features:
 * - Interactive hotkey recording
 * - Visual feedback during recording
 * - Clear button to reset hotkey
 * - Promise-based API for easy async/await usage
 */

import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import {
  IonApp,
  IonButton,
  IonChip,
  IonIcon,
  IonText,
} from '@ionic/react';
import { keypadOutline } from 'ionicons/icons';
import { useTranslation, I18nextProvider } from 'react-i18next';
import i18n from '../i18n/i18n';
import { EnhancedDialog } from './EnhancedDialog/';

export interface HotkeyInputDialogProps {
  /** Whether the dialog is open */
  isOpen?: boolean;
  /** @deprecated Use isOpen instead */
  open?: boolean;
  initialLetter?: string;
  initialModifier?: string;
  onClose: () => void;
  onConfirm: (letter: string, modifier: string) => void;
}

/**
 * Options for imperative hotkey input dialog
 */
export interface HotkeyInputDialogOptions {
  /** Initial hotkey letter */
  initialLetter?: string;
  /** Initial hotkey modifier (e.g., "Ctrl+Alt") */
  initialModifier?: string;
}

/**
 * Result from hotkey input dialog
 */
export interface HotkeyInputDialogResult {
  /** The captured letter/key */
  letter: string;
  /** The captured modifier combination (e.g., "Ctrl+Alt") */
  modifier: string;
}

/**
 * Internal content component that manages its own state
 * This prevents the parent dialog from re-rendering when state changes
 */
const HotkeyInputContent: React.FC<{
  initialLetter: string;
  initialModifier: string;
  onConfirm: (letter: string, modifier: string) => void;
}> = ({ initialLetter, initialModifier, onConfirm }) => {
  const { t } = useTranslation();
  const [letter, setLetter] = useState(initialLetter);
  const [modifier, setModifier] = useState(initialModifier);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only intercept when recording
      if (!isRecording) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // Stop all other listeners

      // Ignore modifier keys alone
      if (['Control', 'Alt', 'Shift', 'Meta', 'Command'].includes(e.key)) {
        return;
      }

      // Capture the letter/key
      const capturedLetter = e.key.toUpperCase();
      
      // Capture modifiers
      const modifiers: string[] = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.metaKey) modifiers.push('Cmd');

      setLetter(capturedLetter);
      setModifier(modifiers.join('+'));
      setIsRecording(false);
    };

    // Use capture phase to intercept keys before EnhancedDialog's handler
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isRecording]);

  const handleStartRecording = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setIsRecording(true);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setLetter('');
    setModifier('');
  };

  const getHotkeyDisplay = () => {
    if (!letter && !modifier) return t('Not set');
    if (!modifier) return letter;
    return `${modifier}+${letter}`;
  };

  // Expose confirm handler to parent via ref or callback
  useEffect(() => {
    (window as any).__hotkeyDialogConfirm = () => onConfirm(letter, modifier);
    return () => {
      delete (window as any).__hotkeyDialogConfirm;
    };
  }, [letter, modifier, onConfirm]);

  return (
    <div style={{ width: '450px', maxWidth: '90vw' }}>
      <h2 style={{ marginTop: 0, marginBottom: '24px', textAlign: 'center' }}>
        {t('Set Hotkey')}
      </h2>
      
      <IonText color="medium">
        <p style={{ marginBottom: '16px' }}>
          {t('Click the button below and press the key combination you want to set')}
        </p>
      </IonText>
      
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '24px',
          border: `2px dashed ${isRecording ? 'var(--ion-color-primary)' : 'var(--ion-color-medium)'}`,
          borderRadius: '8px',
          backgroundColor: isRecording ? 'var(--ion-color-light)' : 'var(--ion-background-color)',
          transition: 'all 0.3s',
        }}
      >
        <IonIcon 
          icon={keypadOutline}
          style={{ 
            fontSize: '48px', 
            color: isRecording ? 'var(--ion-color-primary)' : 'var(--ion-color-medium)' 
          }} 
        />
        
        {isRecording ? (
          <IonText color="primary">
            <h3 style={{ margin: 0 }}>{t('Please press a key...')}</h3>
          </IonText>
        ) : (
          <IonChip
            color={letter ? 'primary' : 'medium'}
            style={{ fontSize: '1.1rem', padding: '12px 16px', height: '48px' }}
          >
            {getHotkeyDisplay()}
          </IonChip>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <IonButton
          fill="outline"
          onClick={handleStartRecording}
          disabled={isRecording}
          expand="block"
          style={{ flex: 1 }}
        >
          {isRecording 
            ? t('Recording...')
            : t('Record Hotkey')
          }
        </IonButton>
        <IonButton
          fill="outline"
          onClick={handleClear}
          disabled={isRecording}
        >
          {t('Clear')}
        </IonButton>
      </div>
    </div>
  );
};

/**
 * Main HotkeyInputDialog component
 * Wraps content with I18nextProvider to support useTranslation() in HotkeyInputContent
 */
export const HotkeyInputDialog: React.FC<HotkeyInputDialogProps> = ({
  isOpen,
  open, // Deprecated, for backward compatibility
  initialLetter = '',
  initialModifier = '',
  onClose,
  onConfirm,
}) => {
  // Support both isOpen (new) and open (deprecated) props
  const dialogIsOpen = isOpen ?? open ?? false;
  
  const handleConfirm = () => {
    // Call the exposed confirm handler from content component
    if ((window as any).__hotkeyDialogConfirm) {
      (window as any).__hotkeyDialogConfirm();
    }
    onClose();
  };

  // Wrap with I18nextProvider because HotkeyInputContent uses useTranslation()
  // This handles both declarative usage (from SettingsView) and imperative usage
  return (
    <I18nextProvider i18n={i18n}>
      <EnhancedDialog
        isOpen={dialogIsOpen}
        onCancel={onClose}
        onConfirm={handleConfirm}
        className="hotkey-dialog settings-dialog"
      >
        <HotkeyInputContent
          initialLetter={initialLetter}
          initialModifier={initialModifier}
          onConfirm={onConfirm}
        />
      </EnhancedDialog>
    </I18nextProvider>
  );
};

/**
 * Internal Wrapper Component for Imperative API
 */
const HotkeyInputDialogWrapper: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (letter: string, modifier: string) => void;
  options: HotkeyInputDialogOptions;
}> = ({ isOpen, onClose, onConfirm, options }) => {
  return (
    <HotkeyInputDialog
      isOpen={isOpen}
      initialLetter={options.initialLetter}
      initialModifier={options.initialModifier}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
};

/**
 * Imperative API for showing hotkey input dialog
 * 
 * @param options - Dialog configuration options
 * @returns Promise that resolves to HotkeyInputDialogResult with letter and modifier, or null if cancelled
 * 
 * @example
 * ```tsx
 * const result = await hotkeyInputDialog({
 *   initialLetter: "F",
 *   initialModifier: "Ctrl+Alt"
 * });
 * 
 * if (result !== null) {
 *   // User confirmed with hotkey
 *   await setHotkey(result.letter, result.modifier);
 * }
 * ```
 */
export const hotkeyInputDialog = (options: HotkeyInputDialogOptions = {}): Promise<HotkeyInputDialogResult | null> => {
  return new Promise((resolve) => {
    // Try to mount to the portal root (inside React context) first, fallback to body
    const portalRoot = document.getElementById('dialog-portal-root');
    const mountPoint = portalRoot || document.body;
    
    // Create a temporary container
    const container = document.createElement('div');
    container.id = 'hotkey-input-dialog-container-' + Date.now();
    mountPoint.appendChild(container);

    const root = ReactDOM.createRoot(container);

    const cleanup = () => {
      setTimeout(() => {
        root.unmount();
        if (container.parentNode) {
          mountPoint.removeChild(container);
        }
      }, 300); // Wait for modal animation
    };

    const handleClose = () => {
      resolve(null);
      cleanup();
    };

    const handleConfirm = (letter: string, modifier: string) => {
      resolve({ letter, modifier });
      cleanup();
    };

    // Always wrap with I18nextProvider because HotkeyInputContent uses useTranslation()
    // Render based on mount point for IonApp wrapper
    if (portalRoot) {
      // Mount inside React context - no need for IonApp wrapper but need I18nextProvider
      root.render(
        <I18nextProvider i18n={i18n}>
          <HotkeyInputDialogWrapper
            isOpen={true}
            onClose={handleClose}
            onConfirm={handleConfirm}
            options={options}
          />
        </I18nextProvider>
      );
    } else {
      // Fallback: mount to body with full context
      root.render(
        <I18nextProvider i18n={i18n}>
          <IonApp>
            <HotkeyInputDialogWrapper
              isOpen={true}
              onClose={handleClose}
              onConfirm={handleConfirm}
              options={options}
            />
          </IonApp>
        </I18nextProvider>
      );
    }
  });
};
