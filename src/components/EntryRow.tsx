import { IonItem, IonLabel, IonText } from "@ionic/react";
import { SearchResultEntry } from "../types";

/**
 * EntryRow Component
 * 
 * Internal component for rendering individual entry rows
 */

interface EntryRowProps {
    index: number;
    item: SearchResultEntry;
    isSelected: boolean;
    style: React.CSSProperties;
    onClick: (item: SearchResultEntry, index: number) => void;
  }
  
  export const EntryRow: React.FC<EntryRowProps> = ({ index, item, isSelected, style, onClick }) => {
    if (!item) {
      return (
        <div style={{ 
          ...style, 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
        }}>
          <IonText color="medium">
            <p style={{ fontSize: 'var(--ion-font-size-medium)' }}>加载中...</p>
          </IonText>
        </div>
      );
    }
  
    return (
      <IonItem
        button={true} detail={false} lines="full"
        color={isSelected ? 'light' : undefined}
        style={{ 
          width: '100%',
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'center',
          ...style, 
        }} 
          onClick={() => onClick(item, index)}
        >
        <IonLabel>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: 'var(--ion-font-size-base)'
            }}>
              {item.keyword}
            </span>
            {item.entry_count > 1 && (
              <span style={{ 
                color: 'var(--ion-color-medium)', 
                fontSize: 'var(--ion-font-size-small)',
                fontWeight: 'var(--ion-font-weight-regular)'
              }}>
                ({item.entry_count})
              </span>
            )}
          </div>
        </IonLabel>
      </IonItem>
    );
  };