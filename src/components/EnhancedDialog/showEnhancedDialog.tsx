/**
 * showEnhancedDialog - Imperative API
 * 
 * Function for showing EnhancedDialog without needing to use a hook
 * This is useful for showing dialogs from non-React contexts or event handlers
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation, I18nextProvider } from 'react-i18next';
import i18n from '../../i18n/i18n';
import { useEnhancedDialog } from './useEnhancedDialog';
import { EnhancedDialogOptions, EnhancedDialogInstance, DismissRole } from './types';

/**
 * Imperative API for showing EnhancedDialog
 * This function handles all the container creation and cleanup internally
 * 
 * @param options - Dialog configuration options
 * @returns Object with dismiss function
 * 
 * @example
 * ```tsx
 * // Simple usage
 * const { dismiss } = showEnhancedDialog({
 *   children: <div>Dialog Content</div>,
 *   onConfirm: () => console.log('Confirmed'),
 *   onCancel: () => console.log('Cancelled')
 * });
 * 
 * // With Promise pattern for async operations
 * const result = await new Promise((resolve) => {
 *   showEnhancedDialog({
 *     children: <div>Confirm deletion?</div>,
 *     onConfirm: () => resolve(true),
 *     onCancel: () => resolve(false)
 *   });
 * });
 * 
 * if (result) {
 *   // User confirmed
 * }
 * ```
 */
export const showEnhancedDialog = (options: EnhancedDialogOptions): EnhancedDialogInstance => {
  let wrapperContainerRef: HTMLDivElement | null = null;
  let wrapperRootRef: ReturnType<typeof createRoot> | null = null;
  let dismissFn: ((role?: DismissRole) => void) | null = null;

  const {
    children,
    className,
    backdropDismiss = true,
    showButtons = true,
    confirmLabel,
    cancelLabel,
    danger = false,
    disableKeyboardShortcuts = false,
    onDismiss,
    onConfirm,
    onCancel,
  } = options;

  /**
   * Wrapper component to use the hook
   * This is necessary because hooks can only be used inside React components
   */
  const DialogWrapper: React.FC = () => {
    const { t } = useTranslation();
    const [present, dismiss] = useEnhancedDialog({
      children,
      className,
      backdropDismiss,
      showButtons,
      confirmLabel: confirmLabel || t('Confirm'),
      cancelLabel: cancelLabel || t('Cancel'),
      danger,
      disableKeyboardShortcuts,
      onDismiss: (role) => {
        // Call user callbacks
        onDismiss?.(role);
        if (role === 'confirm') {
          onConfirm?.();
        } else if (role === 'cancel' || role === 'backdrop') {
          onCancel?.();
        }
        
        // Clean up the wrapper container after dialog is dismissed
        // This needs to happen after the inner dialog's cleanup
        setTimeout(() => {
          if (wrapperRootRef && wrapperContainerRef) {
            wrapperRootRef.unmount();
            if (wrapperContainerRef.parentNode) {
              wrapperContainerRef.parentNode.removeChild(wrapperContainerRef);
            }
            wrapperRootRef = null;
            wrapperContainerRef = null;
          }
        }, 200); // Give the inner dialog time to clean up first
      },
    });

    // Store dismiss function for external use
    dismissFn = dismiss;

    // Auto-present when component mounts
    React.useEffect(() => {
      present();
    }, [present]);

    return null;
  };

  // Create wrapper container and render
  // Try to mount to the portal root (inside React context) first, fallback to body
  const portalRoot = document.getElementById('dialog-portal-root');
  const mountPoint = portalRoot || document.body;
  
  wrapperContainerRef = document.createElement('div');
  wrapperContainerRef.id = 'enhanced-dialog-wrapper-' + Date.now();
  mountPoint.appendChild(wrapperContainerRef);
  
  wrapperRootRef = createRoot(wrapperContainerRef);
  
  // Always wrap with I18nextProvider because DialogWrapper uses useTranslation()
  // Even if mounted to portal root, we need our own I18nextProvider instance
  wrapperRootRef.render(
    <I18nextProvider i18n={i18n}>
      <DialogWrapper />
    </I18nextProvider>
  );

  // Return dismiss function for external control
  return {
    dismiss: (role?: DismissRole) => {
      if (dismissFn) {
        dismissFn(role);
      }
    }
  };
};

