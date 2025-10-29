/**
 * Type definitions for EnhancedDialog component
 */

import { ReactNode } from 'react';

/**
 * Dismiss role types
 */
export type DismissRole = 'confirm' | 'cancel' | 'backdrop';

/**
 * Props for the EnhancedDialogContent component
 */
export interface EnhancedDialogContentProps {
  /** Function to dismiss the dialog */
  onDismiss: (role?: DismissRole) => void;
  /** Dialog content */
  children: ReactNode;
  /** Whether to show action buttons. Default: true */
  showButtons?: boolean;
  /** Label for confirm button. Default: "确定" */
  confirmLabel?: string;
  /** Label for cancel button. Default: "取消" */
  cancelLabel?: string;
  /** Whether this is a dangerous action (uses danger color). Default: false */
  danger?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Backdrop dismiss enabled. Default: true */
  backdropDismiss?: boolean;
  /** Whether to disable keyboard shortcuts (Enter/Escape). Default: false */
  disableKeyboardShortcuts?: boolean;
}

/**
 * Options for useEnhancedDialog hook
 */
export interface EnhancedDialogOptions {
  /** Dialog content */
  children: ReactNode;
  /** Custom CSS class */
  className?: string;
  /** Backdrop dismiss enabled. Default: true */
  backdropDismiss?: boolean;
  /** Whether to show action buttons. Default: true */
  showButtons?: boolean;
  /** Label for confirm button. Default: "确定" */
  confirmLabel?: string;
  /** Label for cancel button. Default: "取消" */
  cancelLabel?: string;
  /** Whether this is a dangerous action (uses danger color). Default: false */
  danger?: boolean;
  /** Whether to disable keyboard shortcuts (Enter/Escape). Default: false */
  disableKeyboardShortcuts?: boolean;
  /** Callback fired when dialog is dismissed */
  onDismiss?: (role?: DismissRole) => void;
  /** Callback fired when confirm button is clicked or Enter is pressed */
  onConfirm?: () => void;
  /** Callback fired when dialog is dismissed/cancelled */
  onCancel?: () => void;
}

/**
 * Props for the EnhancedDialog component (Legacy declarative API)
 */
export interface EnhancedDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback fired when dialog is dismissed/cancelled */
  onCancel: () => void;
  /** Callback fired when confirm button is clicked or Enter is pressed */
  onConfirm?: () => void;
  /** Dialog content */
  children: ReactNode;
  /** Custom CSS class */
  className?: string;
  /** Backdrop dismiss enabled. Default: true */
  backdropDismiss?: boolean;
  /** Whether to show action buttons. Default: true */
  showButtons?: boolean;
  /** Label for confirm button. Default: "确定" */
  confirmLabel?: string;
  /** Label for cancel button. Default: "取消" */
  cancelLabel?: string;
  /** Whether this is a dangerous action (uses danger color). Default: false */
  danger?: boolean;
  /** Whether to disable keyboard shortcuts (Enter/Escape). Default: false */
  disableKeyboardShortcuts?: boolean;
}

/**
 * Return type for showEnhancedDialog imperative API
 */
export interface EnhancedDialogInstance {
  dismiss: (role?: DismissRole) => void;
}

