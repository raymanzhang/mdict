/**
 * EmailInputDialog Component
 * 
 * A reusable dialog for entering email addresses.
 * Supports both component-based and imperative Promise-based API.
 * 
 * Features:
 * - Email input field with validation
 * - Confirm/cancel buttons
 * - Enter key to confirm, Escape key to cancel
 * - Promise-based API for easy async/await usage
 */

import { IonInput } from '@ionic/react';
import { showEnhancedDialog } from './EnhancedDialog/';



/**
 * Options for imperative email input dialog
 */
export interface TextInputDialogOptions {
  /** Dialog title. Default: "" */
  title?: string;
  /** Initial text value */
  value?: string;
  /** Additional props for IonInput */
  inputProps?: React.ComponentProps<typeof IonInput>;
}

/**
 * Imperative API for showing email input dialog
 * 
 * @param options - Dialog configuration options
 * @returns Promise that resolves to the entered email string, or null if cancelled
 * 
 * @example
 * ```tsx
 * const email = await emailInputDialog({
 *   title: "设置使用者邮箱",
 *   initialEmail: "user@example.com"
 * });
 * 
 * if (email !== null) {
 *   // User confirmed with email value
 *   await saveEmail(email);
 * }
 * ```
 */
export const textInputDialog = (options: TextInputDialogOptions = {}): Promise<string | null> => {
  const {
    title = '',
    value = '',
    inputProps = {},
  } = options;

  return new Promise((resolve) => {
    let text = value;
    showEnhancedDialog({
      children: (
        <div style={{ minWidth: '280px', minHeight: '80px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '24px' }}>{title}</h2>
          <IonInput
            value={text}
            onIonInput={(e) => text = e.detail.value || ''}
            {...inputProps}
          />
        </div>
      ),
      confirmLabel: "确定",
      cancelLabel: "取消",
      onConfirm: () => resolve(text),
      onCancel: () => resolve(null),
    });
  });
};
