import { useState, useEffect, forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import { IonIcon, IonButton, IonText } from '@ionic/react';
import { chevronDownOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';

import { MdxIndex } from '../types';
import { scrollToAnchor } from '../utils/iframeTools/utils';



import { fetchContentFromUrl } from '../utils/iframeTools/mdxHtmlTools';
import { iframeSetup } from '../utils/iframeTools/iframeSetup';
import { HighlightAllOccurrencesOfString } from '../utils/iframeTools/highlight';

 

// fetchContentFromUrl moved to utils/MdxHtmlTools

/**
 * ContentItem Component
 * 
 * Individual dictionary entry content display with iframe rendering.
 * Handles content loading, height adjustment, and in-content navigation.
 * Purely presentational component with iframe management.
 */
export interface ContentItemProps {
  mdxIndex: MdxIndex;
  highlight?: string;
  style?: React.CSSProperties;
}

export interface ContentItemRef {
  profileId: number;
  entryNo: number;
  scrollToAnchor?: (fragment: string) => void;
  setHighlight?: (highlight: string) => Promise<number>;
  getIframe?: () => HTMLIFrameElement | null;
}

export const ContentItem = forwardRef<ContentItemRef, ContentItemProps>(({ 
  mdxIndex,
  highlight,
  style,
}, ref) => {
  const { t } = useTranslation();
  
  console.debug('Calling ContentItem with mdxIndex and highlight:', mdxIndex, highlight);
  const [contentHeight, setContentHeight] = useState<number>(200);
  const [content, setContent] = useState<string>('');
  const [contentLoading, setContentLoading] = useState<boolean>(false);
  const [contentError, setContentError] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const defaultHeight = 120;
  
  // Calculate URL and keyLabel from mdxIndex
  // const keyLabel = mdxIndex.key;
  const profileId = mdxIndex.profile_id;
  const entryNo = mdxIndex.entry_no;

  // Handle iframe onload to initialize height tracking and navigation
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentDocument || !iframe.contentWindow) {
      return;
    }
    
    // Initialize iframe content with height tracking and navigation handling
    iframeSetup(
      iframe,
      profileId,
      entryNo,
      highlight
    );
  }, [highlight, profileId, entryNo]);

  // Generate URL when component mounts or mdxIndex changes
  useEffect(() => {
    const generateUrl = async () => {
      try {
        const generatedUrl = await searchAPI.getUrlForIndex(mdxIndex);
        setUrl(generatedUrl);
      } catch (error) {
        console.error('Error generating URL for mdxIndex:', mdxIndex, error);
        setContentError('URL generation failed');
      }
    };

    generateUrl();
  }, [mdxIndex]);

  // Listen for messages from the specific iframe and handle height updates/navigation
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // const iframeWindow = iframeRef.current?.contentWindow;
      // if (!iframeWindow || event.source !== iframeWindow) {
      //   return; // Ignore messages not from this iframe
      // }

      const data = event.data as any;
      if (data && data.type === 'contentHeight' && typeof data.height === 'number') {
        event.stopPropagation();
        const baseHeight = data.height as number + 48;
        const finalHeight = Math.max(baseHeight, defaultHeight);
        setContentHeight(finalHeight);
      } 
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [defaultHeight]);

  // Function to increase iframe height by 100px
  const handleExpandClick = () => {
    const currentHeight = contentHeight;
    const newHeight = currentHeight + 100;
    setContentHeight(newHeight);
  };

  // Expose methods to parent through ref
  useImperativeHandle(ref, () => ({
    profileId,
    entryNo,
    scrollToAnchor: (fragment: string) => {
      if (!containerRef.current) {
        return;
      }
      
      // Find the iframe element
      const iframe = iframeRef.current;
      if (iframe) {
        scrollToAnchor(iframe.contentDocument as Document, fragment);
      }
    },
    setHighlight: async (highlight: string) => {
      return await HighlightAllOccurrencesOfString(iframeRef.current as HTMLIFrameElement, highlight, 100, false);
    },
    getIframe: () => {
      return iframeRef.current;
    }
  }), [profileId, entryNo, defaultHeight]);

  // Fetch content when URL changes
  useEffect(() => {
    const fetchContent = async () => {
      if (!url) {
        setContent('');
        setContentError('');
        return;
      }

      setContentLoading(true);
      setContentError('');
      setContentHeight(defaultHeight); // Reset to default height
      
      try {
        const fetchedContent = await fetchContentFromUrl(url);
        setContent(fetchedContent);
        setContentError('');
      } catch (error) {
        console.error('Failed to fetch content:', error);
        setContentError(error instanceof Error ? error.message : 'Failed to load content');
        setContent('');
      } finally {
        setContentLoading(false);
      }
    };

    fetchContent();
  }, [url]);

  return (
    <div
      ref={containerRef}
      style={{
        ...style,
        padding: '6px',
        position: 'relative'
      }}
    >
      { contentLoading ? (
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '24px'
          }}>
            <IonText color="medium">
              <p style={{ fontSize: '14px' }}>{t('Loading...')}</p>
            </IonText>
          </div>
        ) : contentError ? (
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '24px'
          }}>
            <IonText color="danger">
              <p style={{ fontSize: '14px', fontWeight: 600 }}>{t('Load failed')}</p>
            </IonText>
            <IonText color="medium">
              <p style={{ fontSize: '12px', marginTop: '8px' }}>{contentError}</p>
            </IonText>
          </div>
        ) : content ? (
          <iframe
            srcDoc={content}
            // src={url}
            data-profile-id={profileId}
            data-entry-no={entryNo}
            ref={iframeRef}
            onLoad={handleIframeLoad}
            style={{
              width: '100%',
              height: contentHeight,
              border: 'none',
              display: 'block'
            }}
            allow="fullscreen"
            // sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        ) : (
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '24px'
          }}>
            <IonText color="medium">
              <p style={{ fontSize: '14px' }}>{t('No content to display')}</p>
            </IonText>
          </div>
        )}

      {/* Expansion indicator at bottom border */}
      {content && (
        <div style={{
          position: 'absolute',
          bottom: '-12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1
        }}>
          <IonButton
            onClick={handleExpandClick}
            fill="solid"
            size="small"
            title={t('Expand content (increase height by 100px)')}
            style={{
              '--padding-start': '4px',
              '--padding-end': '4px',
              '--padding-top': '4px',
              '--padding-bottom': '4px',
              width: '24px',
              height: '24px',
              margin: 0,
            }}
          >
            <IonIcon icon={chevronDownOutline} style={{ fontSize: '16px' }} />
          </IonButton>
        </div>
      )}
    </div>
  );
});

// Add display name for debugging
ContentItem.displayName = 'ContentItem';


import * as searchAPI from '../api/search';

