import React, { useCallback, useRef, forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { IonSearchbar } from '@ionic/react';

/**
 * Props for the SearchBox component
 * Following industry best practices for search input components
 */
export interface SearchBoxProps {
  /** Current search value */
  defaultValue: string;
  /** Callback when search value changes */
  onValueChange: (value: string) => void;
  /** Callback when search is triggered (Enter key or search button click) */
  onSearch?: () => void;
  /** Callback when clear button is clicked */
  onClear?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS styles */
  sx?: any;
  /** Input size variant */
  size?: 'smallest' | 'small' | 'medium';
  /** Input variant */
  variant?: 'outlined' | 'filled' | 'standard';
}

/**
 * SearchBox ref interface for imperative actions
 */
export interface SearchBoxRef {
  focus: () => void;
  blur: () => void;
  selectAll: () => void;
  setValue: (value: string) => void;
  getValue: () => string;
  isFocused: () => boolean;
}

/**
 * SearchBox Component
 * 
 * A reusable search input component that provides:
 * - Configurable search and clear functionality
 * - Keyboard shortcuts (Enter to search, Escape to clear)
 * - Customizable appearance and behavior
 * - Migrated to Ionic Framework for consistent desktop experience
 */
export const SearchBox = forwardRef<SearchBoxRef, SearchBoxProps>(({
  defaultValue,
  onValueChange,
  onSearch,
  onClear,
  placeholder = '搜索...',
  sx,
  size = 'small',
  // variant is kept for API compatibility but not used in Ionic implementation
}, ref) => {
  const ionSearchbarRef = useRef<HTMLIonSearchbarElement>(null);
  const [value, setValue] = useState(defaultValue);
  const hadFocusRef = useRef(false);

  // Sync internal value with prop changes
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const getValue = useCallback(() => {
    return value;
  }, [value]);

  // Expose imperative methods through ref
  useImperativeHandle(ref, () => ({
    focus: async () => {
      await ionSearchbarRef.current?.setFocus();
    },
    blur: () => {
      ionSearchbarRef.current?.getInputElement().then(input => input?.blur());
    },
    selectAll: () => {
      ionSearchbarRef.current?.getInputElement().then(input => input?.select());
    },
    setValue: (newValue: string) => {
      setValue(newValue);
    },
    getValue: getValue,
    isFocused: () => {
      // Check if the searchbar's input is focused
      const activeElement = document.activeElement;
      if (!activeElement) return false;
      
      // Check if active element is within the searchbar
      return ionSearchbarRef.current?.contains(activeElement) ?? false;
    }
  }), [getValue]);

  // Handle focus event - select all text when regaining focus
  const handleFocus = useCallback(() => {
    if (hadFocusRef.current && getValue()) {
      // If the input had focus before and there's content, select all
      setTimeout(() => {
        ionSearchbarRef.current?.getInputElement().then(input => input?.select());
      }, 0);
    }
    hadFocusRef.current = true;
  }, [getValue]);

  // Handle input change
  const handleChange = useCallback((event: CustomEvent) => {
    const newValue = event.detail.value || '';
    console.log('Search value changed:', newValue);
    setValue(newValue);
    onValueChange(newValue);
  }, [onValueChange]);

  // Handle key down events
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        onSearch?.();
        break;
      case 'Escape':
        event.preventDefault();
        if (getValue() && onClear) {
          setValue('');
          onClear();
        }
        break;
    }
  }, [getValue, onSearch, onClear]);

  // Handle clear button click
  const handleClear = useCallback(() => {
    setValue('');
    onValueChange('');
    onClear?.();
  }, [onValueChange, onClear]);

  // Compute CSS custom properties for size variants
  const sizeStyles: React.CSSProperties = (() => {
    switch (size) {
      case 'smallest':
        return {
          '--height': '28px',
          '--padding-top': '4px',
          '--padding-bottom': '4px',
          '--font-size': '13px',
        } as React.CSSProperties;
      case 'small':
        return {
          '--height': '36px',
          '--padding-top': '6px',
          '--padding-bottom': '6px',
          '--font-size': '14px',
        } as React.CSSProperties;
      case 'medium':
      default:
        return {
          '--height': '44px',
          '--padding-top': '8px',
          '--padding-bottom': '8px',
          '--font-size': '16px',
        } as React.CSSProperties;
    }
  })();

  return (
    <div style={{ width: '100%', ...sx }}>
      <IonSearchbar
        ref={ionSearchbarRef}
        value={value}
        onIonInput={handleChange}
        onIonClear={handleClear}
        onIonFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        showClearButton="focus"
        style={sizeStyles}
        className={`searchbox-${size}`}
      />
    </div>
  );
});

// Add display name for debugging
SearchBox.displayName = 'SearchBox';

export default SearchBox;
