// EntriesViewContainer.tsx  — 容器组件（包含逻辑与命令式 API）
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { MdxIndex, TargetInfo } from '../types';
import { EntriesViewRender } from './EntriesView.ui';
import { 
  setMatchCursor,
  getMatchCursorIndex,
  getMatchCount,
  clearMatchCursor,
} from '../utils/iframeTools/highlight';

export interface EntriesViewRef {
  scrollToEntry: (entryNo: number, fragment?: string) => void;
  setHighlight: (highlight: string) => Promise<void>;
  hasNextMatch: () => boolean;
  hasPrevMatch: () => boolean;
  scrollToNextMatch: () => void;
  scrollToPrevMatch: () => void;
}

export interface EntriesViewProps {
  indexes: MdxIndex[];
  targetInfo?: TargetInfo;
  highlight?: string;
}

export const EntriesView = forwardRef<EntriesViewRef, EntriesViewProps>(({
  indexes,
  targetInfo,
  highlight,
}, ref) => {
  // Map<key, ref>：容器维护所有 ContentItem 的 ref
  const contentItemRefs = useRef<Map<string, React.RefObject<any>>>(new Map());

  const makeKey = useCallback((entryNo: number) => {
    const idx = indexes.find(i => i.entry_no === entryNo);
    return idx ? `${idx.profile_id}_${entryNo}` : undefined;
  }, [indexes]); // 容器专职 key 生成，展示层不关心[web:3][web:12]

  const getItemRef = useCallback((key: string) => {
    if (!contentItemRefs.current.has(key)) {
      contentItemRefs.current.set(key, React.createRef());
    }
    return contentItemRefs.current.get(key)!;
  }, []); // 提供给展示层的 ref 工厂函数[web:3][web:14]

  const scrollToEntry = useCallback((entryNo: number, fragment?: string) => {
    const key = makeKey(entryNo);
    if (!key) return;
    const itemRef = contentItemRefs.current.get(key);

    if (itemRef?.current) {
      const element = document.getElementById(`content-item-${key}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } // 官方示例中也建议直接对目标节点调用 scrollIntoView[web:7]

      if (fragment && itemRef.current.scrollToAnchor) {
        setTimeout(() => {
          itemRef.current.scrollToAnchor(fragment);
        }, 300);
      } // 命令式 API 由子项暴露，上层协调时序[web:8][web:11]
    }
  }, [makeKey]); // 依赖精简，避免不必要变更[web:8]

  // Get all iframes from all ContentItems
  const getAllIframes = useCallback((): { iframe: HTMLIFrameElement, itemRef: any }[] => {
    const result: { iframe: HTMLIFrameElement, itemRef: any }[] = [];
    contentItemRefs.current.forEach((itemRef) => {
      if (itemRef.current?.getIframe) {
        const iframe = itemRef.current.getIframe();
        if (iframe) {
          result.push({ iframe, itemRef: itemRef.current });
        }
      }
    });
    return result;
  }, []);

  const setHighlight = useCallback(async (next: string) => {
    // Wait for all highlights to complete
    console.debug("EntriesView setHighlight", next);
    const promises: Promise<number>[] = [];
    contentItemRefs.current.forEach(itemRef => {
      if (itemRef.current?.setHighlight) {
        promises.push(itemRef.current.setHighlight(next));
      }
    });
    
    await Promise.all(promises);
    
    // After all highlights are done, scroll to the first match
    const firstMatchIframe = findInitialMatchFrame(getAllIframes(), 'next');
    if (firstMatchIframe) {
      setMatchCursor(firstMatchIframe.iframe, 0, true);
    }
  }, [getAllIframes]); // 跨子项广播调用，保持容器内聚[web:8][web:3]

  // Helper function to find the iframe with current active match
  const findActiveMatchIndex = useCallback((iframes: { iframe: HTMLIFrameElement, itemRef: any }[]): number => {
    return iframes.findIndex(item => getMatchCursorIndex(item.iframe) >= 0);
  }, []);

  // Common function to check if there's a match in a specific direction
  const hasMatchInDirection = useCallback((direction: 'next' | 'prev'): boolean => {
    const iframes = getAllIframes();
    const activeIndex = findActiveMatchIndex(iframes);

    // If no active match, check if any iframe has matches
    if (activeIndex === -1) {
      return iframes.some(item => getMatchCount(item.iframe) > 0);
    }

    const currentMatchIndex = getMatchCursorIndex(iframes[activeIndex].iframe);
    const currentMatchCount = getMatchCount(iframes[activeIndex].iframe);
    
    // Check if current iframe has more matches in the specified direction
    if (direction === 'next') {
      // Can move to next match within current iframe
      if (currentMatchIndex < currentMatchCount - 1) {
        return true;
      }
      // Check if any subsequent iframe has matches
      return iframes.slice(activeIndex + 1).some(item => getMatchCount(item.iframe) > 0);
    } else {
      // Can move to previous match within current iframe
      if (currentMatchIndex > 0) {
        return true;
      }
      // Check if any previous iframe has matches
      return iframes.slice(0, activeIndex).some(item => getMatchCount(item.iframe) > 0);
    }
  }, [getAllIframes, findActiveMatchIndex]);

  // Check if there's a next match across all ContentItems
  const hasNextMatch = useCallback((): boolean => {
    return hasMatchInDirection('next');
  }, [hasMatchInDirection]);

  // Check if there's a previous match across all ContentItems
  const hasPrevMatch = useCallback((): boolean => {
    return hasMatchInDirection('prev');
  }, [hasMatchInDirection]);

  // Helper function to find first/last iframe with matches when no active match exists
  const findInitialMatchFrame = useCallback((iframes: { iframe: HTMLIFrameElement, itemRef: any }[], direction: 'next' | 'prev') => {
    if (direction === 'next') {
      return iframes.find(item => getMatchCount(item.iframe) > 0);
    } else {
      // Find from end to start
      for (let i = iframes.length - 1; i >= 0; i--) {
        if (getMatchCount(iframes[i].iframe) > 0) {
          return iframes[i];
        }
      }
    }
    return null;
  }, []);

  // Helper function to find next/previous iframe with matches from current position
  const findAdjacentMatchFrame = useCallback((iframes: { iframe: HTMLIFrameElement, itemRef: any }[], activeIndex: number, direction: 'next' | 'prev') => {
    const searchFrames = direction === 'next' 
      ? iframes.slice(activeIndex + 1)
      : iframes.slice(0, activeIndex).reverse();
    
    return searchFrames.find(item => getMatchCount(item.iframe) > 0) || null;
  }, []);

  // Common function to scroll to a match in a specific direction
  const scrollToMatchInDirection = useCallback((direction: 'next' | 'prev') => {
    const iframes = getAllIframes();
    const activeIndex = findActiveMatchIndex(iframes);

    // If no current match, start from the first/last iframe with matches
    if (activeIndex === -1) {
      const initialFrame = findInitialMatchFrame(iframes, direction);
      if (initialFrame) {
        const matchCount = getMatchCount(initialFrame.iframe);
        const targetMatchIndex = direction === 'next' ? 0 : matchCount - 1;
        setMatchCursor(initialFrame.iframe, targetMatchIndex, true);
      }
      return;
    }

    const currentMatchIndex = getMatchCursorIndex(iframes[activeIndex].iframe);
    const currentMatchCount = getMatchCount(iframes[activeIndex].iframe);
    
    // Try to move within current iframe first
    const canMoveWithinCurrent = direction === 'next' 
      ? currentMatchIndex < currentMatchCount - 1
      : currentMatchIndex > 0;
    
    if (canMoveWithinCurrent) {
      const nextIndex = direction === 'next' ? currentMatchIndex + 1 : currentMatchIndex - 1;
      setMatchCursor(iframes[activeIndex].iframe, nextIndex, true);
      return;
    }

    // Move to adjacent iframe with matches
    const adjacentFrame = findAdjacentMatchFrame(iframes, activeIndex, direction);
    if (adjacentFrame) {
      clearMatchCursor(iframes[activeIndex].iframe);
      const matchCount = getMatchCount(adjacentFrame.iframe);
      const targetMatchIndex = direction === 'next' ? 0 : matchCount - 1;
      setMatchCursor(adjacentFrame.iframe, targetMatchIndex, true);
    }
  }, [getAllIframes, findActiveMatchIndex, findInitialMatchFrame, findAdjacentMatchFrame]);

  // Scroll to next match across all ContentItems
  const scrollToNextMatch = useCallback(() => {
    scrollToMatchInDirection('next');
  }, [scrollToMatchInDirection]);

  // Scroll to previous match across all ContentItems
  const scrollToPrevMatch = useCallback(() => {
    scrollToMatchInDirection('prev');
  }, [scrollToMatchInDirection]);

  useEffect(() => {
    if (highlight) {
      console.debug("EntriesView useEffect highlight", highlight);
      setHighlight(highlight);
    }
  }, [highlight, setHighlight]);

  useEffect(() => {
    if (targetInfo !== undefined) {
      scrollToEntry(targetInfo.entry_no, targetInfo.fragment);
    }
  }, [targetInfo, scrollToEntry]);

  useImperativeHandle(ref, () => ({
    scrollToEntry,
    setHighlight,
    hasNextMatch,
    hasPrevMatch,
    scrollToNextMatch,
    scrollToPrevMatch,
  }), [scrollToEntry, setHighlight, hasNextMatch, hasPrevMatch, scrollToNextMatch, scrollToPrevMatch]);

  return (
    <EntriesViewRender
      indexes={indexes}
      highlight={highlight}
      getItemRef={getItemRef}
    />
  );
});
EntriesView.displayName = 'EntriesView';

export default EntriesView;