/**
 * Components - Reusable base UI components
 * 
 * These are presentation components with minimal business logic.
 * They are highly reusable and compose to build features and pages.
 * 
 * All components are now simplified into single-file components.
 */

export { ContentItem } from './ContentItem';
export type { ContentItemRef, ContentItemProps } from './ContentItem';

// EntriesView - Combined Component
export { EntriesView } from './EntriesView';
export type { EntriesViewRef, EntriesViewProps } from './EntriesView';

export { default as ProfileListMenu } from './ProfileListMenu';

export { SearchBox } from './SearchBox';
export type { SearchBoxRef, SearchBoxProps } from './SearchBox';

// TabContainer - Custom tab implementation with Ionic styling
export { TabContainer } from './TabContainer';
export type { TabContainerRef, TabItem, TabContentRenderer } from './TabContainer';

// EntryList - Virtual list with infinite loading (replaces VirtualList)
export { EntryList } from './EntryList';
export type { EntryListRef, EntryListProps } from './EntryList';

// Dialog Components
export { confirmDialog } from './ConfirmDialog';
export type { ConfirmDialogOptions } from './ConfirmDialog';

export { EnhancedDialog, useEnhancedDialog, showEnhancedDialog } from './EnhancedDialog';
export type { 
  EnhancedDialogProps, 
  EnhancedDialogOptions,
  EnhancedDialogContentProps,
  EnhancedDialogInstance,
  DismissRole
} from './EnhancedDialog';

// Hotkey Input Dialog - Component and Promise API
export { HotkeyInputDialog, hotkeyInputDialog } from './HotkeyInputDialog';
export type { 
  HotkeyInputDialogProps, 
  HotkeyInputDialogOptions, 
  HotkeyInputDialogResult 
} from './HotkeyInputDialog';

// Email Input Dialog - Component and Promise API
export { textInputDialog } from './TextInputDialog';
export type { 
  TextInputDialogOptions 
} from './TextInputDialog';

// Color Picker Dialog - Component and Promise API
export { colorPickerDialog } from './ColorPickerDialog';
export type { 
  ColorPickerDialogOptions 
} from './ColorPickerDialog';

// Convert DB Dialog - Component for converting dictionary database with collation options
export { ConvertDBDialog, useConvertDBDialog } from './ConvertDBDialog';
export type { CollationOptions, ConvertOptions } from './ConvertDBDialog';
