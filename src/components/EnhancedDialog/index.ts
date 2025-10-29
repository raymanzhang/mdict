/**
 * EnhancedDialog Module
 * 
 * A reusable modal dialog component with multiple API styles:
 * 
 * 1. Hook API (Recommended):
 *    ```tsx
 *    const [present, dismiss] = useEnhancedDialog({ ... });
 *    ```
 * 
 * 2. Imperative API (For non-React contexts):
 *    ```tsx
 *    const { dismiss } = showEnhancedDialog({ ... });
 *    ```
 * 
 * 3. Declarative API (Legacy, for backward compatibility):
 *    ```tsx
 *    <EnhancedDialog isOpen={isOpen} onCancel={...}>...</EnhancedDialog>
 *    ```
 * 
 * Features:
 * - Keyboard shortcuts (Enter to confirm, Escape to cancel)
 * - Backdrop dismiss
 * - Customizable buttons and labels
 * - Danger mode for destructive actions
 * - CSS modules for styling
 * - TypeScript support
 */

// Main exports
export { EnhancedDialog } from './EnhancedDialog';
export { useEnhancedDialog } from './useEnhancedDialog';
export { showEnhancedDialog } from './showEnhancedDialog';

// Type exports
export type {
  EnhancedDialogProps,
  EnhancedDialogOptions,
  EnhancedDialogContentProps,
  EnhancedDialogInstance,
  DismissRole,
} from './types';

// Internal component (not typically needed by consumers)
export { EnhancedDialogContent } from './EnhancedDialogContent';

