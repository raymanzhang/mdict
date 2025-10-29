import React from 'react';
import { useTranslation } from 'react-i18next';

import { MdxIndex } from '../types';
import { ContentItem } from './ContentItem';

interface EntriesViewRenderProps {
  indexes: MdxIndex[];
  highlight?: string;
  getItemRef: (key: string) => React.RefObject<any>;
}

export const EntriesViewRender: React.FC<EntriesViewRenderProps> = ({
  indexes,
  highlight,
  getItemRef,
}) => {
  const { t } = useTranslation();
  
  const toggleExpanded = (legendElement: HTMLElement) => {
    // Get the next sibling element (ContentItem container)
    const contentItemDiv = legendElement.nextElementSibling as HTMLElement;
    if (contentItemDiv) {
      const currentDisplay = window.getComputedStyle(contentItemDiv).display;
      const newDisplay = currentDisplay === 'none' ? 'block' : 'none';
      contentItemDiv.style.display = newDisplay;
    }
  };

  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {indexes.map((mdxIndex) => {
        const key = `${mdxIndex.profile_id}_${mdxIndex.entry_no}`;
        const contentItemRef = getItemRef(key);

        return (
          <fieldset
            key={key}
            id={`content-item-${key}`}
            tabIndex={0}
            data-key={mdxIndex.key}
            data-entry-key={key}
            style={{
              marginBottom: '16px',
              marginTop: '8px',
              border: '1px solid var(--ion-color-primary)',
              borderRadius: '8px',
              padding: 0,
              marginLeft: 0,
              marginRight: 0,
              backgroundColor: 'var(--ion-background-color)',
              position: 'relative',
              transition: 'border-color 0.2s ease-in-out, background-color 0.2s ease-in-out',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--ion-color-primary)';
              e.currentTarget.style.outlineOffset = '-2px';
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--ion-color-primary-tint)';
              const legend = e.currentTarget.querySelector('legend') as HTMLElement;
              if (legend) {
                legend.style.borderColor = 'var(--ion-color-primary-tint)';
                legend.style.color = 'var(--ion-color-primary-shade)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--ion-color-step-200)';
              const legend = e.currentTarget.querySelector('legend') as HTMLElement;
              if (legend) {
                legend.style.borderColor = 'var(--ion-color-primary)';
                legend.style.color = 'var(--ion-color-primary)';
              }
            }}
          >
            <legend
              onClick={(e) => toggleExpanded(e.currentTarget)}
              style={{
                backgroundColor: 'var(--ion-background-color)',
                color: 'var(--ion-color-primary)',
                padding: '2px 6px',
                fontSize: '1.0rem',
                fontWeight: 600,
                maxWidth: '180px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                border: '1px solid var(--ion-color-primary)',
                borderRadius: '3px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                transition: 'all 0.2s ease-in-out',
                margin: 0,
                marginLeft: '6px',
                cursor: 'pointer',
              }}
              title={t('Click to toggle content display/hide')}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--ion-color-primary-tint)';
                e.currentTarget.style.color = 'var(--ion-color-primary-contrast)';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--ion-background-color)';
                e.currentTarget.style.color = 'var(--ion-color-primary)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
            >
              {mdxIndex.key}
            </legend>
            <ContentItem
              style={{ display: 'block' }}
              ref={contentItemRef}
              mdxIndex={mdxIndex}
              highlight={highlight}
            />
          </fieldset>
        );
      })}
    </div>
  );
};
