/**
 * ColorPickerDialog Component
 * 
 * A reusable color picker dialog component using @uiw/react-color Sketch picker.
 * Supports both component-based and imperative Promise-based API.
 * 
 * Features:
 * - Interactive color selection with Sketch-style picker
 * - Customizable title
 * - Confirm/cancel buttons
 * - Enter key to confirm, Escape key to cancel
 * - Promise-based API for easy async/await usage
 */

import { showEnhancedDialog } from './EnhancedDialog/';
import { Sketch } from '@uiw/react-color';
import type { ColorResult } from '@uiw/react-color';

/**
 * Options for imperative color picker dialog
 */
export interface ColorPickerDialogOptions {
  /** Dialog title */
  title: string;
  /** Initial color value (hex format, e.g., "#FF0000") */
  initialColor: string;
}


/**
 * Imperative API for showing color picker dialog
 * 
 * @param options - Dialog configuration options
 * @returns Promise that resolves to the selected color string (hex format), or null if cancelled
 * 
 * @example
 * ```tsx
 * const color = await colorPickerDialog({
 *   title: "选择字体颜色",
 *   initialColor: "#000000"
 * });
 * 
 * if (color !== null) {
 *   // User confirmed with color value
 *   await setFontColor(color);
 * }
 * ```
 */
export const colorPickerDialog = (options: ColorPickerDialogOptions): Promise<string | null> => {
  return new Promise((resolve) => {
    let selectedColor = options.initialColor;

    const handleColorChange = (colorResult: ColorResult) => {
      selectedColor = colorResult.hex;
    };

    showEnhancedDialog({
      children: (
        <div style={{ maxWidth: '90vw' }}>
          <h2 style={{ marginTop: 0, marginBottom: '16px' }}>{options.title}</h2>
          <Sketch
            color={selectedColor}
            onChange={handleColorChange}
            style={{
              boxShadow: 'none',
              border: '1px solid var(--ion-color-light-shade)',
              borderRadius: '8px',
            }}
          />
        </div>
      ),
      confirmLabel: "确定",
      cancelLabel: "取消",
      className: 'color-picker-dialog',
      onConfirm: () => resolve(selectedColor),
      onCancel: () => resolve(null),
    });
  });
};
