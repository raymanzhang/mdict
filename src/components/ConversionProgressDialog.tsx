/**
 * ConversionProgressDialog Component
 * 
 * Self-contained dialog for MDX/MDD conversion and fulltext index generation
 * Shows progress for all stages and switches to completion mode when done
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonLabel,
  IonProgressBar,
  IonNote,
  IonButton,
  IonFooter,
  IonAlert,
} from '@ionic/react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface ConversionProgress {
  stage: 'mdx' | 'mdd' | 'idx';
  subStage: string;
  current: number;
  total: number;
  message?: string;
}

interface StageInfo {
  current: number;
  total: number;
  subStage: string;
}

interface StageProgress {
  mdx: StageInfo;
  mdd: StageInfo;
  idx: StageInfo;
}

interface ConversionProgressDialogProps {
  isOpen: boolean;
  profileTitle: string;
  showFulltextIndex?: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onComplete: () => void;
}

export const ConversionProgressDialog: React.FC<ConversionProgressDialogProps> = ({
  isOpen,
  profileTitle,
  showFulltextIndex = true,
  errorMessage: externalErrorMessage,
  onCancel,
  onComplete,
}) => {
  const { t } = useTranslation();
  const [stageProgress, setStageProgress] = useState<StageProgress>({
    mdx: { current: 0, total: 100, subStage: '' },
    mdd: { current: 0, total: 100, subStage: '' },
    idx: { current: 0, total: 100, subStage: '' },
  });
  const [currentStage, setCurrentStage] = useState<'mdx' | 'mdd' | 'idx'>('mdx');
  const [currentMessage, setCurrentMessage] = useState<string | undefined>();
  const [isCompleted, setIsCompleted] = useState(false);
  const [showCancelAlert, setShowCancelAlert] = useState(false);
  
  // Use external error message if provided
  const hasError = !!externalErrorMessage;
  const errorMessage = externalErrorMessage || '';

  useEffect(() => {
    if (!isOpen) {
      // Reset state when dialog closes
      setStageProgress({
        mdx: { current: 0, total: 100, subStage: '' },
        mdd: { current: 0, total: 100, subStage: '' },
        idx: { current: 0, total: 100, subStage: '' },
      });
      setCurrentStage('mdx');
      setCurrentMessage(undefined);
      setIsCompleted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    if (isOpen) {
      // Listen for progress updates from backend
      const setupListener = async () => {
        unlisten = await listen<ConversionProgress>('conversion-progress', (event) => {
          const { stage, subStage, current, total, message } = event.payload;
          
          console.log('Progress update:', { stage, subStage, current, total, message });
          
          setCurrentStage(stage);
          setCurrentMessage(message);
          
          setStageProgress(prev => ({
            ...prev,
            [stage]: { current, total, subStage },
          }));
        });
      };

      setupListener();
    }

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [isOpen]);

  const getStageLabel = (stage: 'mdx' | 'mdd' | 'idx') => {
    switch (stage) {
      case 'mdx':
        return t('Converting MDX file');
      case 'mdd':
        return t('Converting MDD file');
      case 'idx':
        return t('Generating fulltext index');
      default:
        return t('Processing');
    }
  };

  const getSubStageLabel = (subStage: string) => {
    if (!subStage) return '';
    
    // Replace :: with __ to avoid i18next namespace interpretation
    const normalizedSubStage = subStage.replace(/::/g, '__');
    const key = `substage_${normalizedSubStage}`;
    const translated = t(key);
    const found = translated !== key;
    
    console.log('[SubStage] Translation:', { 
      subStage, 
      normalizedSubStage,
      key, 
      translated, 
      found
    });
    
    // If translation not found, format the substage name nicely
    if (!found) {
      // Extract the function name after :: if present
      const nameOnly = subStage.includes('::') ? subStage.split('::').pop() || subStage : subStage;
      const formatted = nameOnly.replace(/_/g, ' ');
      return formatted;
    }
    return translated;
  };

  const getProgressPercent = (stage: 'mdx' | 'mdd' | 'idx') => {
    const { current, total } = stageProgress[stage];
    return total > 0 ? current / total : 0;
  };

  const isStageComplete = (stage: 'mdx' | 'mdd' | 'idx') => {
    const { subStage } = stageProgress[stage];
    // Check if the stage has reached "completed" or "skipped" substage
    return subStage === 'completed' || subStage === 'skipped';
  };

  const handleCancelClick = () => {
    if (isCompleted || hasError) {
      // If completed or has error, directly close
      if (isCompleted) {
        onComplete();
      } else {
        onCancel();
      }
    } else {
      // If not completed and no error, show confirmation dialog
      setShowCancelAlert(true);
    }
  };

  const handleCancelConfirm = () => {
    setShowCancelAlert(false);
    onCancel();
  };

  // Mark as completed when all stages are done
  useEffect(() => {
    const mdxComplete = isStageComplete('mdx');
    const mddComplete = isStageComplete('mdd');
    const idxComplete = showFulltextIndex ? isStageComplete('idx') : true;
    
    if (mdxComplete && mddComplete && idxComplete && !isCompleted) {
      setIsCompleted(true);
      setCurrentMessage(t('Conversion completed successfully'));
    }
  }, [stageProgress, showFulltextIndex, isCompleted, t]);

  return (
    <>
      <IonModal 
        isOpen={isOpen} 
        backdropDismiss={false}
      >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('Rebuild Index')}: {profileTitle}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ 
          minHeight: '200px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          paddingTop: '20px'
        }}>
          {/* MDX Stage */}
          <div>
            <IonLabel>
              <h3 style={{ margin: '0 0 4px 0' }}>
                {getStageLabel('mdx')}
                {isStageComplete('mdx') && ' ✓'}
              </h3>
              {stageProgress.mdx.subStage && (
                <IonNote style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                  {getSubStageLabel(stageProgress.mdx.subStage)}
                </IonNote>
              )}
            </IonLabel>
            <IonProgressBar 
              value={getProgressPercent('mdx')}
              color={currentStage === 'mdx' ? 'primary' : 'medium'}
              style={{ height: '6px' }}
            />
            <IonNote style={{ fontSize: '12px' }}>
              {stageProgress.mdx.current} / {stageProgress.mdx.total}
              {' '}({Math.round(getProgressPercent('mdx') * 100)}%)
            </IonNote>
          </div>

          {/* MDD Stage */}
          <div>
            <IonLabel>
              <h3 style={{ margin: '0 0 4px 0' }}>
                {getStageLabel('mdd')}
                {isStageComplete('mdd') && ' ✓'}
              </h3>
              {stageProgress.mdd.subStage && (
                <IonNote style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                  {getSubStageLabel(stageProgress.mdd.subStage)}
                </IonNote>
              )}
            </IonLabel>
            <IonProgressBar 
              value={getProgressPercent('mdd')}
              color={currentStage === 'mdd' ? 'primary' : 'medium'}
              style={{ height: '6px' }}
            />
            <IonNote style={{ fontSize: '12px' }}>
              {stageProgress.mdd.current} / {stageProgress.mdd.total}
              {' '}({Math.round(getProgressPercent('mdd') * 100)}%)
            </IonNote>
          </div>

          {/* IDX Stage - Only show if fulltext index is enabled */}
          {showFulltextIndex && (
            <div>
              <IonLabel>
                <h3 style={{ margin: '0 0 4px 0' }}>
                  {getStageLabel('idx')}
                  {isStageComplete('idx') && ' ✓'}
                </h3>
                {stageProgress.idx.subStage && (
                  <IonNote style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                    {getSubStageLabel(stageProgress.idx.subStage)}
                  </IonNote>
                )}
              </IonLabel>
              <IonProgressBar 
                value={getProgressPercent('idx')}
                color={currentStage === 'idx' ? 'primary' : 'medium'}
                style={{ height: '6px' }}
              />
              <IonNote style={{ fontSize: '12px' }}>
                {stageProgress.idx.current} / {stageProgress.idx.total}
                {' '}({Math.round(getProgressPercent('idx') * 100)}%)
              </IonNote>
            </div>
          )}

        {/* Message */}
        {currentMessage && !hasError && (
          <IonNote 
            color={isCompleted ? 'success' : 'primary'} 
            style={{ textAlign: 'center', marginTop: '10px' }}
          >
            {currentMessage}
          </IonNote>
        )}

        {/* Error Message */}
        {hasError && (
          <div style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: 'var(--ion-color-danger-tint)',
            borderRadius: '8px',
            border: '1px solid var(--ion-color-danger)'
          }}>
            <IonLabel>
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--ion-color-danger)' }}>
                {t('Conversion failed')}
              </h3>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '14px' }}>
                {errorMessage}
              </p>
            </IonLabel>
          </div>
        )}
      </div>
    </IonContent>

      <IonFooter>
        <IonToolbar>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px' }}>
            <IonButton 
              color={isCompleted ? 'primary' : hasError ? 'medium' : 'danger'}
              onClick={handleCancelClick}
            >
              {isCompleted ? t('OK') : hasError ? t('Close') : t('Cancel')}
            </IonButton>
          </div>
        </IonToolbar>
      </IonFooter>
    </IonModal>

    {/* Cancel Confirmation Alert */}
    <IonAlert
      isOpen={showCancelAlert}
      onDidDismiss={() => setShowCancelAlert(false)}
      header={t('Confirm Cancellation')}
      message={t('Are you sure you want to cancel the conversion? All progress will be lost.')}
      buttons={[
        {
          text: t('No'),
          role: 'cancel',
          handler: () => setShowCancelAlert(false)
        },
        {
          text: t('Yes'),
          role: 'destructive',
          handler: handleCancelConfirm
        }
      ]}
    />
    </>
  );
};
