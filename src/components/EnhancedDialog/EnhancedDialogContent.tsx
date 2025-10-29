/**
 * EnhancedDialogContent Component
 * 
 * Internal dialog content component that renders the actual dialog UI
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { IonButton, IonFooter, IonToolbar } from '@ionic/react';
import { EnhancedDialogContentProps } from './types';
import styles from './EnhancedDialog.module.css';

/**
 * Internal dialog content component
 * Handles keyboard interactions, backdrop clicks, and rendering
 */
export const EnhancedDialogContent: React.FC<EnhancedDialogContentProps> = ({
  onDismiss,
  children,
  showButtons = true,
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  className,
  backdropDismiss = true,
  disableKeyboardShortcuts = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  /**
   * Handle keyboard shortcuts
   * - Enter: Confirm (unless in textarea or contenteditable)
   * - Escape: Cancel
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Skip if keyboard shortcuts are disabled
    if (disableKeyboardShortcuts) return;

    const target = event.target as HTMLElement;
    const isInputElement = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' ||
                          target.isContentEditable;

    switch (event.key) {
      case 'Enter':
        // Only handle Enter if focus is not in a textarea or contenteditable
        // Single-line inputs can submit on Enter
        if (!isInputElement || target.tagName === 'INPUT') {
          event.preventDefault();
          event.stopPropagation();
          onDismiss('confirm');
        }
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        onDismiss('cancel');
        break;
      default:
        break;
    }
  }, [onDismiss, disableKeyboardShortcuts]);

  // Add global keydown listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  /**
   * Handle backdrop click to dismiss
   */
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only trigger if clicking directly on backdrop (not its children)
    if (backdropDismiss && e.target === e.currentTarget) {
      onDismiss('backdrop');
    }
  };

  const handleConfirmClick = () => {
    onDismiss('confirm');
  };

  const handleCancelClick = () => {
    onDismiss('cancel');
  };

  // Combine CSS module class with custom className
  const dialogClassName = className 
    ? `${styles.dialog} ${className}` 
    : styles.dialog;

  return (
    <div 
      className={styles.overlay}
      onClick={handleBackdropClick}
    >
      <div 
        ref={dialogRef}
        className={dialogClassName}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.content}>
          {children}
        </div>
        
        {showButtons && (
          <IonFooter className={styles.footer}>
            <IonToolbar>
              <div className={styles.buttonContainer}>
                <IonButton fill="clear" onClick={handleCancelClick}>
                  {cancelLabel}
                </IonButton>
                <IonButton 
                  color={danger ? 'danger' : 'primary'} 
                  onClick={handleConfirmClick}
                >
                  {confirmLabel}
                </IonButton>
              </div>
            </IonToolbar>
          </IonFooter>
        )}
      </div>
    </div>
  );
};

