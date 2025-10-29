import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import './TabContainer.css';

// Tab item definition
export interface TabItem {
  id: string;
  title: string;
  tooltip?: string;
  data?: any; // Additional data passed to content renderer
  disabled?: boolean; // Whether this tab is disabled
  icon?: React.ReactNode; // Optional icon for the tab
  icon_url?: string; // Optional icon URL for the tab
}

// Content renderer function type
export type TabContentRenderer = (tabItem: TabItem, isActive: boolean) => React.ReactNode;

// Tab container props
export interface TabContainerProps {
  tabs: TabItem[];
  activeTabId?: string;
  onTabChange?: (tabId: string, tabItem: TabItem) => void;
  contentRenderer: TabContentRenderer;
  className?: string;
  showStatusBar?: boolean;
  getStatusText?: (tabItem: TabItem) => string;
  // Scroll-to-switch configuration
  enableScrollSwitch?: boolean;
  scrollSwitchThreshold?: number;
  scrollSwitchDelay?: number;
  // Tab bar position
  tabPosition?: 'top' | 'bottom' | 'left' | 'right';
}

// Tab container ref interface
export interface TabContainerRef {
  focus: () => void;
  blur: () => void;
  setActiveTab: (tabId: string) => void;
  getActiveTab: () => TabItem | undefined;
  getActiveTabIndex: () => number;
  canSwitchNext: () => boolean;
  canSwitchPrev: () => boolean;
  switchToNext: () => void;
  switchToPrev: () => void;
}

/**
 * TabContainer Component
 * 
 * A highly configurable and accessible tab container that provides:
 * - Keyboard navigation (left/right arrows when focused)
 * - Optional scroll-to-switch functionality (pull-to-refresh style)
 * - Auto focus management for active tab content
 * - Flexible content rendering through callbacks
 * - Tab switching through various methods (click, keyboard, programmatic, scroll)
 * - Performance optimized with memoization
 * - Comprehensive imperative API through refs
 * - Migrated to Ionic styling for consistent desktop experience
 * 
 * @example
 * ```tsx
 * const tabs: TabItem[] = [
 *   { id: '1', title: 'Tab 1', data: { content: 'Content 1' } },
 *   { id: '2', title: 'Tab 2', data: { content: 'Content 2' } }
 * ];
 * 
 * const renderContent: TabContentRenderer = (tabItem) => (
 *   <div>{tabItem.data.content}</div>
 * );
 * 
 * <TabContainer
 *   tabs={tabs}
 *   contentRenderer={renderContent}
 *   enableScrollSwitch={true}
 *   onTabChange={(id, item) => console.log('Tab changed:', id)}
 * />
 * ```
 */
export const TabContainer = forwardRef<TabContainerRef, TabContainerProps>(({
  tabs,
  activeTabId,
  onTabChange,
  contentRenderer,
  className,
  showStatusBar = false,
  getStatusText,
  enableScrollSwitch = false,
  scrollSwitchThreshold = 120,
  scrollSwitchDelay = 100,
  tabPosition = 'top'
}, ref) => {
  // State for active tab with proper initialization
  const [currentActiveTabId, setCurrentActiveTabId] = useState<string>('');
  const isInitialized = useRef<boolean>(false);
  
  // Ensure we always have a valid active tab ID when tabs exist
  const effectiveActiveTabId = useMemo(() => {
    if (!tabs.length) return '';
    if (currentActiveTabId && tabs.find(tab => tab.id === currentActiveTabId)) {
      return currentActiveTabId;
    }
    return tabs[0].id;
  }, [tabs, currentActiveTabId]);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Scroll-to-switch state and refs
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isAtBoundary, setIsAtBoundary] = useState<'none' | 'top' | 'bottom'>('none');
  const lastScrollTop = useRef<number>(0);
  const boundaryScrollStartRef = useRef<number>(0);
  const overScrollDistanceRef = useRef<number>(0);

  // Initialize with first tab only once when tabs are available
  useEffect(() => {
    if (tabs.length > 0 && !isInitialized.current) {
      const initialTabId = activeTabId && tabs.find(tab => tab.id === activeTabId) 
        ? activeTabId 
        : tabs[0].id;
      
      setCurrentActiveTabId(initialTabId);
      isInitialized.current = true;
      
      // Trigger the change callback for the initial tab
      const initialTabItem = tabs.find(tab => tab.id === initialTabId);
      if (initialTabItem) {
        onTabChange?.(initialTabId, initialTabItem);
      }
    }
  }, [tabs, activeTabId, onTabChange]);

  // Sync currentActiveTabId with effectiveActiveTabId when they differ
  useEffect(() => {
    if (effectiveActiveTabId && effectiveActiveTabId !== currentActiveTabId) {
      setCurrentActiveTabId(effectiveActiveTabId);
      
      // Trigger the change callback when syncing
      const syncTabItem = tabs.find(tab => tab.id === effectiveActiveTabId);
      if (syncTabItem) {
        onTabChange?.(effectiveActiveTabId, syncTabItem);
      }
    }
  }, [effectiveActiveTabId, currentActiveTabId, tabs, onTabChange]);

  // Handle external activeTabId changes after initialization
  useEffect(() => {
    if (isInitialized.current && activeTabId && activeTabId !== currentActiveTabId) {
      const tabExists = tabs.find(tab => tab.id === activeTabId);
      if (tabExists) {
        setCurrentActiveTabId(activeTabId);
      }
    }
  }, [activeTabId, currentActiveTabId, tabs]);

  // Get current active tab item - memoized for performance
  const activeTabItem = useMemo(() => {
    if (!tabs.length || !effectiveActiveTabId) return undefined;
    return tabs.find(tab => tab.id === effectiveActiveTabId);
  }, [tabs, effectiveActiveTabId]);

  const activeTabIndex = useMemo(() => {
    if (!effectiveActiveTabId || !tabs.length) return 0;
    const index = tabs.findIndex(tab => tab.id === effectiveActiveTabId);
    return index >= 0 ? index : 0;
  }, [tabs, effectiveActiveTabId]);

  // Helper function to focus first focusable element in active tab content
  const focusActiveTabContent = useCallback(() => {
    if (contentRef.current) {
      // Find the first focusable element in the content area
      const focusableElement = contentRef.current.querySelector('[tabindex="0"], input, textarea, button, [contenteditable="true"]') as HTMLElement;
      if (focusableElement) {
        focusableElement.focus();
      }
    }
  }, []);

  // Handle tab activation (common logic for all tab switching methods)
  const handleTabActivation = useCallback((tabId: string, resetScroll = true) => {
    const tabItem = tabs.find(tab => tab.id === tabId);
    if (!tabItem || tabId === currentActiveTabId) return;

    setCurrentActiveTabId(tabId);
    onTabChange?.(tabId, tabItem);

    // Reset scroll-to-switch state when manually changing tabs
    if (enableScrollSwitch) {
      setIsAtBoundary('none');
      overScrollDistanceRef.current = 0;
    }

    // Reset scroll position to top and focus content
    if (resetScroll) {
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = 0;
        }
        focusActiveTabContent();
      }, 50);
    } else {
      setTimeout(() => {
        focusActiveTabContent();
      }, 100);
    }
  }, [tabs, currentActiveTabId, onTabChange, focusActiveTabContent, enableScrollSwitch]);

  // Expose imperative methods through ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      containerRef.current?.focus();
    },
    blur: () => {
      containerRef.current?.blur();
    },
    setActiveTab: (tabId: string) => {
      handleTabActivation(tabId);
    },
    getActiveTab: () => activeTabItem,
    getActiveTabIndex: () => activeTabIndex,
    canSwitchNext: () => activeTabIndex < tabs.length - 1,
    canSwitchPrev: () => activeTabIndex > 0,
    switchToNext: () => {
      if (activeTabIndex < tabs.length - 1) {
        const nextTabId = tabs[activeTabIndex + 1].id;
        handleTabActivation(nextTabId);
      }
    },
    switchToPrev: () => {
      if (activeTabIndex > 0) {
        const prevTabId = tabs[activeTabIndex - 1].id;
        handleTabActivation(prevTabId);
      }
    }
  }), [activeTabItem, activeTabIndex, tabs, handleTabActivation]);

  // Handle tab click
  const handleTabClick = (tabId: string) => {
    handleTabActivation(tabId);
  };

  // Keyboard navigation for left/right arrow keys
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if we're the focused element or a child
      const focused = document.activeElement;
      const isOurElement = focused === containerRef.current || 
                          containerRef.current?.contains(focused);
      
      if (!isOurElement) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          if (activeTabIndex > 0) {
            const prevTabId = tabs[activeTabIndex - 1].id;
            handleTabActivation(prevTabId);
          }
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (activeTabIndex < tabs.length - 1) {
            const nextTabId = tabs[activeTabIndex + 1].id;
            handleTabActivation(nextTabId);
          }
          break;
        default:
          // Don't handle other keys
          break;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => {
        container.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [activeTabIndex, tabs, handleTabActivation]);

  // Auto focus content when active tab changes or content becomes available
  useEffect(() => {
    if (activeTabItem) {
      // Use longer delay for initial load to ensure content is rendered
      const delay = isInitialized.current ? 150 : 250;
      const timeoutId = setTimeout(() => {
        focusActiveTabContent();
      }, delay);
      
      return () => clearTimeout(timeoutId);
    }
  }, [activeTabItem, focusActiveTabContent]);

  // Handle scroll event to detect over-scroll and switch to next/previous tab
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (!enableScrollSwitch || tabs.length <= 1) return;

    const container = event.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const currentScrollTop = scrollTop;
    const scrollDirection = currentScrollTop > lastScrollTop.current ? 'down' : 'up';
    
    // Check if scrolled to bottom with some tolerance (5px)
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
    // Check if scrolled to top with some tolerance (5px)
    const isAtTop = scrollTop <= 5;
    
    // Handle bottom boundary detection and pull-to-switch
    if (isAtBottom && activeTabIndex < tabs.length - 1) {
      if (isAtBoundary !== 'bottom') {
        // First time reaching bottom - record the starting position
        setIsAtBoundary('bottom');
        boundaryScrollStartRef.current = currentScrollTop;
        overScrollDistanceRef.current = 0;
      } else if (scrollDirection === 'down') {
        // Calculate over-scroll distance (simulate pull effect)
        overScrollDistanceRef.current += Math.abs(currentScrollTop - lastScrollTop.current) * 2;
        
        // Check if user has "pulled" enough to trigger tab switch
        if (overScrollDistanceRef.current >= scrollSwitchThreshold) {
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }
          
          scrollTimeoutRef.current = setTimeout(() => {
            const nextTabId = tabs[activeTabIndex + 1]?.id;
            if (nextTabId) {
              handleTabActivation(nextTabId, true);
            }
            setIsAtBoundary('none');
            overScrollDistanceRef.current = 0;
          }, scrollSwitchDelay);
        }
      }
    } 
    // Handle top boundary detection and pull-to-switch
    else if (isAtTop && activeTabIndex > 0) {
      if (isAtBoundary !== 'top') {
        setIsAtBoundary('top');
        boundaryScrollStartRef.current = currentScrollTop;
        overScrollDistanceRef.current = 0;
      } else if (scrollDirection === 'up') {
        overScrollDistanceRef.current += Math.abs(lastScrollTop.current - currentScrollTop) * 2;
        
        if (overScrollDistanceRef.current >= scrollSwitchThreshold) {
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }
          
          scrollTimeoutRef.current = setTimeout(() => {
            const prevTabId = tabs[activeTabIndex - 1]?.id;
            if (prevTabId) {
              handleTabActivation(prevTabId, true);
            }
            setIsAtBoundary('none');
            overScrollDistanceRef.current = 0;
          }, scrollSwitchDelay);
        }
      }
    } 
    // Reset boundary state when not at boundaries
    else if (!isAtBottom && !isAtTop) {
      if (isAtBoundary !== 'none') {
        setIsAtBoundary('none');
        overScrollDistanceRef.current = 0;
      }
    }
    
    // Update last scroll position
    lastScrollTop.current = currentScrollTop;
  }, [enableScrollSwitch, tabs, activeTabIndex, isAtBoundary, scrollSwitchThreshold, scrollSwitchDelay, handleTabActivation]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Show placeholder if no tabs
  if (!tabs.length) {
    return (
      <div className={`tab-container-empty ${className || ''}`}>
        No tabs available
      </div>
    );
  }

  // Tab bar component
  const tabBar = (
    <div className={`tab-bar tab-bar-${tabPosition}`}>
      <div className="tab-list">
        {tabs.map((tabItem, index) => (
          <div
            key={tabItem.id}
            className={`tab-item ${activeTabIndex === index ? 'tab-item-active' : ''} ${tabItem.disabled ? 'tab-item-disabled' : ''}`}
            onClick={() => !tabItem.disabled && handleTabClick(tabItem.id)}
            title={tabItem.tooltip || tabItem.title}
            role="tab"
            aria-selected={activeTabIndex === index}
            tabIndex={tabItem.disabled ? -1 : 0}
          >
            <div className="tab-label">
              {tabItem.icon_url && (
                <img
                  src={tabItem.icon_url}
                  alt=""
                  className="tab-icon"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              {tabItem.icon && (
                <div className="tab-icon-container">
                  {tabItem.icon}
                </div>
              )}
              <div className="tab-title">
                {tabItem.title}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Content area component
  const contentArea = (
    <div 
      ref={contentRef}
      className="tab-content"
      onScroll={enableScrollSwitch ? handleScroll : undefined}
    >
      {activeTabItem && contentRenderer(activeTabItem, true)}
    </div>
  );

  // Status bar component
  const statusBar = showStatusBar && activeTabItem && getStatusText && (
    <div className="tab-status-bar">
      {getStatusText(activeTabItem)}
    </div>
  );

  return (
    <div 
      ref={containerRef}
      className={`tab-container ${className || ''}`}
      tabIndex={0}
    >
      {/* Render components in correct order based on tab position */}
      {(tabPosition === 'top' || tabPosition === 'left') && tabBar}
      {contentArea}
      {(tabPosition === 'bottom' || tabPosition === 'right') && tabBar}
      {statusBar}
    </div>
  );
});

// Add display name for debugging
TabContainer.displayName = 'TabContainer';

export default TabContainer;
