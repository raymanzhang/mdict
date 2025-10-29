import {fixHeightSetup} from './fixHeight';
import {HighlightAllOccurrencesOfString, highlightSetup} from './highlight';
import {wordPickerSetup} from './wordPicker';

export interface IframeGlobals {
    profileId: number;
    entryNo: number;
}

export function getIframeGlobals(cur_win: Window): IframeGlobals {
    return (cur_win as any).iframeGlobals as IframeGlobals;
}

export function iframeSetup(
    iframe: HTMLIFrameElement,
    profileId: number,
    entryNo: number,
    highlight?: string
  ): void {
    console.debug("Initializing iframe for profile_id:", profileId, "entry_no:", entryNo, "highlight:", highlight);
    let iframeGlobals: IframeGlobals = {
        profileId:profileId,
        entryNo:entryNo
    };
    (iframe.contentWindow as any).iframeGlobals = iframeGlobals;
    fixHeightSetup(iframe);
    highlightSetup(iframe);
    wordPickerSetup(iframe);
    // clickHandlerSetup(iframe);
    if (highlight) {
        HighlightAllOccurrencesOfString(iframe, highlight, 100, false);
    }
  }