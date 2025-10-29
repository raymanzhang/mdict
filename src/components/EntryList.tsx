import { useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { List, useListCallbackRef, type RowComponentProps } from 'react-window';
import { useInfiniteLoader } from 'react-window-infinite-loader';
import { SearchResultEntry } from '../types';
import { useSearchStore } from '../store/useSearchStore';
import { EntryRow } from './EntryRow';

const ITEM_HEIGHT = 48;

/**
 * Props for the EntryList component
 * 
 * EntryList is now an uncontrolled component that manages its own data
 * by connecting directly to useSearchStore
 */
export interface EntryListProps {
  /** Callback when an item is selected/clicked */
  onItemSelect?: (item: SearchResultEntry, index: number) => void;
   
  /** Number of items to render outside of the visible area */
  overscanCount?: number;
  
  /** Minimum number of items to load in a single batch */
  minimumBatchSize?: number;
  
  /** Number of items from the end to start pre-fetching */
  threshold?: number;
  
  /** Custom CSS styles */
  style?: React.CSSProperties;
  
  /** Custom class name */
  className?: string;
}

/**
 * Methods exposed via ref for controlling the EntryList
 */
export interface EntryListRef {
  /** 
   * Scroll to a specific item by index
   * 
   * @param index - The index to scroll to
   * @param align - Alignment strategy ('start' places target at top of viewport)
   */
  scrollToIndex: (index: number, align?: 'auto' | 'center' | 'end' | 'start') => void;
  
  /** Select an item by index, triggering the selection handler */
  selectItem: (index: number) => void;
  
  /** Get the currently visible start index */
  getVisibleStartIndex: () => number;
}



export const EntryList = forwardRef<EntryListRef, EntryListProps>(
  (
    {
      onItemSelect,
      overscanCount = 5,
      minimumBatchSize = 20,
      threshold = 15,
      style,
      className,
    },
    ref
  ) => {
    const [listRef, setListRef] = useListCallbackRef(null);
    const visibleStartIndex = useRef(-1);

    // Get data from search store
    const  totalCount = useSearchStore((state) => state.totalCount);
    const getItem = useSearchStore((state) => state.getItem);
    const isItemLoaded = useSearchStore((state) => state.isItemLoaded);
    const loadPages = useSearchStore((state) => state.loadPages);
    const cacheVersion = useSearchStore((state) => state.entryCacheVersion);
    // Expose ref methods to parent component
    useImperativeHandle(
      ref,
      () => ({
        scrollToIndex: (index: number, align: 'auto' | 'center' | 'end' | 'start' = 'start') => {
          listRef?.scrollToRow({
            align: align,
            behavior: 'instant',
            index: index,
          });
        },
        selectItem: (index: number) => {
          const item = getItem(index);
          if (item && onItemSelect) {
            onItemSelect(item, index);
          }
        },
        getVisibleStartIndex: () => {
          return visibleStartIndex.current;
        },
      }),
      [getItem, onItemSelect, listRef]
    );

    // Setup infinite loader
    const onItemsRendered = useInfiniteLoader({
      isRowLoaded: isItemLoaded,
      loadMoreRows: async (startIndex: number, stopIndex: number) => {
        await loadPages(startIndex, stopIndex);
      },
      rowCount: totalCount,
      minimumBatchSize,
      threshold,
    });

    // Handle item click
    const handleItemClick = useCallback(
      (item: SearchResultEntry | undefined, index: number) => {
        if (item && onItemSelect) {
          onItemSelect(item, index);
        }
      },
      [onItemSelect]
    );

    // Render individual row using react-window 2.0 API
    const rowComponent = useCallback(
      (props: RowComponentProps) => {
        const { ariaAttributes, index, style } = props;
        const item = getItem(index);
        return (
          <EntryRow {...ariaAttributes} index={index} item={item!} isSelected={false} style={style} onClick={() => handleItemClick(item, index)} />
        );
      },
      [getItem, handleItemClick, cacheVersion] // Add cacheVersion to trigger re-render when data loads
    );

    return (
        <List
          listRef={setListRef}
          style={{
            height: '100%',
            width: '100%',
            ...(style || {})
          }}
          className={className}
          rowCount={totalCount}
          rowHeight={ITEM_HEIGHT}
          rowComponent={rowComponent}
          rowProps={ {} }
          overscanCount={overscanCount}
          onRowsRendered={(visibleRows, allRows) => {
            // visibleRows contains the currently visible row indices
            visibleStartIndex.current = visibleRows.startIndex;
            // Pass the overscan range (allRows) to infinite loader
            onItemsRendered({
              startIndex: allRows.startIndex,
              stopIndex: allRows.stopIndex,
            });
          }}
        />
    );
  }
);

EntryList.displayName = 'EntryList';

export default EntryList;
