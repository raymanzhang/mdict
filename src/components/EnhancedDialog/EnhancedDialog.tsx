/**
 * EnhancedDialog Component (Legacy Declarative API)
 * 
 * This component provides a declarative API for backward compatibility.
 * New code should use useEnhancedDialog hook directly.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { useEnhancedDialog } from './useEnhancedDialog';
import { EnhancedDialogProps } from './types';

/**
 * EnhancedDialog Component
 * 
 * A declarative wrapper around useEnhancedDialog hook for backward compatibility.
 * 
 * @example
 * ```tsx
 * <EnhancedDialog
 *   isOpen={isOpen}
 *   onCancel={() => setIsOpen(false)}
 *   onConfirm={() => handleConfirm()}
 *   confirmLabel="保存"
 * >
 *   <h2>对话框标题</h2>
 *   <p>对话框内容...</p>
 * </EnhancedDialog>
 * ```
 */
export const EnhancedDialog: React.FC<EnhancedDialogProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  children,
  className,
  backdropDismiss = true,
  showButtons = true,
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  disableKeyboardShortcuts = false,
}) => {
  const modalPresentedRef = useRef(false);
  const presentRef = useRef<(() => void) | null>(null);
  const dismissRef = useRef<(() => void) | null>(null);
  
  // Memoize dialog options to prevent unnecessary re-renders
  const dialogOptions = useMemo(() => ({
    children,
    className,
    backdropDismiss,
    showButtons,
    confirmLabel,
    cancelLabel,
    danger,
    disableKeyboardShortcuts,
    onCancel,
    onConfirm,
  }), [children, className, backdropDismiss, showButtons, confirmLabel, cancelLabel, danger, disableKeyboardShortcuts, onCancel, onConfirm]);

  const [present, dismiss] = useEnhancedDialog(dialogOptions);

  // Store present and dismiss in refs to avoid triggering effects
  useEffect(() => {
    presentRef.current = present;
    dismissRef.current = dismiss;
  }, [present, dismiss]);

  // Auto-present/dismiss based on isOpen prop
  useEffect(() => {
    if (isOpen && !modalPresentedRef.current) {
      presentRef.current?.();
      modalPresentedRef.current = true;
    } else if (!isOpen && modalPresentedRef.current) {
      dismissRef.current?.();
      modalPresentedRef.current = false;
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (modalPresentedRef.current && dismissRef.current) {
        dismissRef.current();
      }
    };
  }, []);

  // This component doesn't render anything itself
  return null;
};

