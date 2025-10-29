/**
 * ConfirmDialog - Text-based Confirmation Dialog
 * 
 * A simple confirmation dialog that uses EnhancedDialog internally.
 * Supports imperative Promise-based API for easy use.
 * 
 * Features:
 * - Enter key to confirm
 * - Escape key to cancel
 * - Customizable title, message, and button labels
 * - Danger mode for destructive actions (red confirm button)
 */

import { showEnhancedDialog } from './EnhancedDialog/';

/**
 * Options for imperative confirm dialog
 */
export interface ConfirmDialogOptions {
  /** Dialog title */
  title: string;
  /** Confirmation message */
  message: string;
  /** Label for confirm button. Default: "确定" */
  confirmLabel?: string;
  /** Label for cancel button. Default: "取消" */
  cancelLabel?: string;
  /** Whether this is a dangerous action (uses danger color). Default: false */
  danger?: boolean;
}

/**
 * Imperative API for showing confirmation dialog
 * 
 * @param options - Dialog configuration options
 * @returns Promise that resolves to true if confirmed, false if cancelled
 * 
 * @example
 * ```tsx
 * const confirmed = await confirmDialog({
 *   title: "确认删除",
 *   message: "确定要删除吗？此操作不可撤销。",
 *   confirmLabel: "删除",
 *   danger: true
 * });
 * 
 * if (confirmed) {
 *   // Proceed with deletion
 * }
 * ```
 */
export const confirmDialog = (options: ConfirmDialogOptions): Promise<boolean> => {
  return new Promise((resolve) => {
    showEnhancedDialog({
      children: (
        <div>
          <h2 style={{ 
            marginTop: 0, 
            marginBottom: '16px', 
            fontSize: '20px', 
            fontWeight: 600 
          }}>
            {options.title}
          </h2>
          <p style={{ 
            margin: 0,
            lineHeight: '1.5'
          }}>
            {options.message}
          </p>
        </div>
      ),
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel,
      danger: options.danger,
      showButtons: true,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
};
