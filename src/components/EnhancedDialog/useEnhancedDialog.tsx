/**
 * useEnhancedDialog Hook
 * 
 * Custom hook for presenting EnhancedDialog using imperative API similar to useIonModal
 */

import { useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n/i18n';
import { EnhancedDialogContent } from './EnhancedDialogContent';
import { EnhancedDialogOptions, DismissRole } from './types';

/**
 * Custom hook for presenting EnhancedDialog using imperative API
 * 
 * @param options - Dialog configuration options
 * @returns [present, dismiss] - Functions to show and hide the dialog
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [present, dismiss] = useEnhancedDialog({
 *     children: <div>Dialog Content</div>,
 *     onConfirm: () => {
 *       console.log('Confirmed');
 *       dismiss();
 *     },
 *     onCancel: () => {
 *       console.log('Cancelled');
 *       dismiss();
 *     }
 *   });
 * 
 *   return <IonButton onClick={present}>Open Dialog</IonButton>;
 * }
 * ```
 */
export const useEnhancedDialog = (options: EnhancedDialogOptions) => {
  const {
    children,
    className,
    backdropDismiss = true,
    showButtons = true,
    confirmLabel = '确定',
    cancelLabel = '取消',
    danger = false,
    disableKeyboardShortcuts = false,
    onDismiss,
    onConfirm,
    onCancel,
  } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<ReactDOM.Root | null>(null);
  const optionsRef = useRef(options);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  /**
   * Dismiss the dialog
   * @param role - The role that triggered the dismiss (confirm, cancel, backdrop)
   */
  const dismiss = useCallback((role?: DismissRole) => {
    const currentRoot = rootRef.current;
    const currentContainer = containerRef.current;

    if (currentRoot && currentContainer) {
      // Call appropriate callbacks first
      onDismiss?.(role);
      if (role === 'confirm') {
        onConfirm?.();
      } else if (role === 'cancel' || role === 'backdrop') {
        onCancel?.();
      }

      // Unmount and cleanup asynchronously to avoid race condition
      setTimeout(() => {
        currentRoot.unmount();
        if (currentContainer.parentNode) {
          document.body.removeChild(currentContainer);
        }
        rootRef.current = null;
        containerRef.current = null;
      }, 0);
    }
  }, [onDismiss, onConfirm, onCancel]);

  /**
   * Present the dialog
   */
  const present = useCallback(() => {
    // If already open, update the content instead of creating new
    if (rootRef.current && containerRef.current) {
      rootRef.current.render(
        <I18nextProvider i18n={i18n}>
          <EnhancedDialogContent
            onDismiss={dismiss}
            children={children}
            showButtons={showButtons}
            confirmLabel={confirmLabel}
            cancelLabel={cancelLabel}
            danger={danger}
            className={className}
            backdropDismiss={backdropDismiss}
            disableKeyboardShortcuts={disableKeyboardShortcuts}
          />
        </I18nextProvider>
      );
      return;
    }

    // Create container
    const newContainer = document.createElement('div');
    newContainer.id = 'enhanced-dialog-container-' + Date.now();
    document.body.appendChild(newContainer);

    // Create root and render
    // Wrap with I18nextProvider to support internationalization in dialog content
    const newRoot = ReactDOM.createRoot(newContainer);
    newRoot.render(
      <I18nextProvider i18n={i18n}>
        <EnhancedDialogContent
          onDismiss={dismiss}
          children={children}
          showButtons={showButtons}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          danger={danger}
          className={className}
          backdropDismiss={backdropDismiss}
          disableKeyboardShortcuts={disableKeyboardShortcuts}
        />
      </I18nextProvider>
    );

    containerRef.current = newContainer;
    rootRef.current = newRoot;
  }, [children, className, backdropDismiss, showButtons, confirmLabel, cancelLabel, danger, disableKeyboardShortcuts, dismiss]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const currentRoot = rootRef.current;
      const currentContainer = containerRef.current;
      
      if (currentRoot && currentContainer) {
        currentRoot.unmount();
        if (currentContainer.parentNode) {
          document.body.removeChild(currentContainer);
        }
        rootRef.current = null;
        containerRef.current = null;
      }
    };
  }, []);

  return [present, dismiss] as const;
};

