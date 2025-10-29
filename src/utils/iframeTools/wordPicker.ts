/**
 * Word Picker Module for Dictionary Content
 * 
 * Provides touch/click word selection functionality for dictionary entries.
 * Allows users to tap or click on words to look them up in the dictionary.
 */

// Type definitions
import { getIframeGlobals } from './iframeSetup';
import { clickHandler } from './clickHandler';

interface WordPickerContext {
    touchStartPoint: TouchPoint | null;
    TouchTimerID: number;
    lastTouchUpTimeStamp: number;
}
// let iOS = ( navigator.userAgent.match(/(iPad|iPhone|iPod)/g) ? true : false );
// let MacOS =  ( navigator.userAgent.match(/(Macintosh)/g) ? true : false );

function getContext(cur_win: Window): WordPickerContext {
    return (cur_win as any).wordPickerContext as WordPickerContext;
}

interface TouchPoint {
    screenX: number;
    screenY: number;
    target: Element | null;
}

// For touch word pickup
// Don't encodeURI(word) when calling this function, because mdx_url_func will encode it.
function mdx_click(word: string, posX: number, posY: number, cur_doc:Document, cur_win: Window): void {
    const global=getIframeGlobals(cur_win);
    const factor = (cur_doc.body.getBoundingClientRect().width + 16) / cur_win.innerWidth; // top.window.devicePixelRatio;
    const x = parseInt(String(posX * factor));
    const y = parseInt(String(posY * factor));
    const message: any=
    {
        type: 'lookup',
        word: word, 
        anchor: {x:x, y:y}, 
        fromEntry: {profile_id:global.profileId, entry_no:global.entryNo }
    };
    cur_win.parent.postMessage( message, "*");
}

const specialAlpha = "ùçœæàâïéèêëîôöüûäß''ñáíúóÙÇŒÆÀÂÏÉÈÊËÎÔÖÜÛÄßÑÁÍÚÓ";

function mdx_isAlpha(c: string): boolean {
    const charCode = c.charCodeAt(0);
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c === '\'') || (charCode > 200 && charCode < 300)) {
        return true;
    } else {
        return specialAlpha.indexOf(c) >= 0;
    }
}


function mdx_processNode(cur_doc: Document, node: Text): void {
    const parentNode = node.parentNode;
    const nodeValue = node.nodeValue || '';
    const str = nodeValue.toLowerCase();
    if (str && str.length > 0 && parentNode) {
        let headPos = 0;
        while (headPos < str.length) {
            let tailPos = headPos;
            while (tailPos < str.length && !mdx_isAlpha(str.charAt(tailPos)))
                tailPos++;

            if (tailPos > headPos) {
                parentNode.insertBefore(cur_doc.createTextNode(nodeValue.substr(headPos, tailPos - headPos)), node);
                headPos = tailPos;
            }

            while (tailPos < str.length && mdx_isAlpha(str.charAt(tailPos)))
                tailPos++;

            if (tailPos > headPos) {
                const word = nodeValue.substr(headPos, tailPos - headPos);
                const link = cur_doc.createElement('MDICT');
                link.className = 'mdx_word';
                // link.setAttribute('onclick', null);
                link.appendChild(cur_doc.createTextNode(word));
                parentNode.insertBefore(link, node);
                headPos = tailPos;
            }
        }

        parentNode.removeChild(node);
    }
}

function mdx_walk(cur_doc: Document, node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
        if (node.parentNode?.nodeName && 
            (node.parentNode.nodeName === 'HEAD' || 
             node.parentNode.nodeName === 'SCRIPT' || 
             node.parentNode.nodeName === 'STYLE'))
            return;
        if ((node as any).visited || (node as any).className === 'mdx_word')
            return;
        (node as any).visited = true;
    }

    if (!node.childNodes || node.childNodes.length === 0) {
        if (node.nodeType === Node.TEXT_NODE) mdx_processNode(cur_doc, node as Text);
    } else if ((node as HTMLElement).onclick) {
        // Skip nodes with onclick handlers
    } else {
        let currentNode: ChildNode | null = node.firstChild;
        while (currentNode) {
            const nextSibling = currentNode.nextSibling;
            const anchor = currentNode as HTMLAnchorElement;
            if (!(currentNode.nodeName && currentNode.nodeName === 'A' && anchor.href && anchor.href !== ''))
                mdx_walk(cur_doc, currentNode);
            currentNode = nextSibling;
        }
    }
}

// @ts-ignore - Reserved for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _GetHighlightedElement(cur_win: Window): Node | null {
    const sel = cur_win.getSelection();
    if (sel && sel.rangeCount > 0)
        return sel.getRangeAt(0).startContainer;
    else
        return null;
}

function HasSelectionContent(cur_win: Window): boolean {
    const a = cur_win.getSelection();
    return !!(a && !a.isCollapsed);
}

// Call by App to lookup selected content
// @ts-ignore - Reserved for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _LookupSelection (cur_doc:Document, cur_win: Window, x: number, y: number): string {
    console.debug("Has valid window, try get selection");
    const sel = cur_win.getSelection();
    const txt = sel?.toString() || "";
    console.debug("Get selection:" + txt);
    if (sel && txt) {
        let posX: number | undefined;
        let posY: number | undefined;
        if (x && y) {
            posX = x;
            posY = y;
        } else {
            if (sel.rangeCount > 0) {
                const rect = sel.getRangeAt(0).getBoundingClientRect();
                posX = rect.left + rect.width / 2;
                posY = rect.top + rect.height / 2;
                console.debug("X:" + posX + " Y:" + posY);
            }
        }
        if (posX !== undefined && posY !== undefined){
            mdx_click(txt, CalTouchX(cur_win, posX), CalTouchY(cur_win, posY), cur_doc, cur_win);
        }
    }
    return txt;
};

function shouldSkipCurrentElement(cur_win: Window, obj: HTMLElement | null): boolean {
    for (; obj != null; obj = obj.parentNode as HTMLElement | null) {
        if ((obj.tagName === 'a' || obj.tagName === 'A') && (obj as HTMLAnchorElement).href) {
            return true;
        }
        if ((obj as any).name && (obj as any).name.indexOf('__mdx_name') === 0)
            return true;

        if (obj.onclick != null) {
            return true;
        }

        if (typeof (cur_win as any).jQuery !== 'undefined') {
            if (typeof (cur_win as any).$ !== 'undefined' && (cur_win as any).$._data !== 'undefined') {
                const tempE = (cur_win as any).$._data((cur_win as any).$(obj)[0], "events");
                if (tempE && tempE["click"]) {
                    console.debug("Skip element for jQuery event");
                    return true;
                }
            }
        }
    }   
    return false;
}

function CalTouchY(cur_win: Window, posY: number): number {
    if ((cur_win as any).iframe_id) {
        const iframe = cur_win.parent.document.getElementById((cur_win as any).iframe_id) as HTMLIFrameElement;
        if (iframe) {
            const clientRect = iframe.getBoundingClientRect();
            const top = clientRect.top;
            return posY + top;
        }
    }
    return posY;
}

function CalTouchX(cur_win: Window, posX: number): number {
    if ((cur_win as any).iframe_id) {
        const iframe = cur_win.parent.document.getElementById((cur_win as any).iframe_id) as HTMLIFrameElement;
        if (iframe) {
            const clientRect = iframe.getBoundingClientRect();
            const left = clientRect.left;
            return posX + left;
        }
    }
    return posX;
}

function OnTouchWord(event: Event, wordNode: HTMLElement, posX: number, posY: number, cur_doc:Document, cur_win: Window): boolean {
    if (shouldSkipCurrentElement(cur_win, wordNode)) {
        return false;
    }
    let context = getContext(cur_win);
    // @ts-ignore - Reserved for future use
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (event as any).cancelBubble = true;
    event.preventDefault();

    const word = wordNode.innerText;
    console.debug("Touch word:" + word + ", X=" + posX + ", Y=" + posY);

    context.TouchTimerID = cur_win.setTimeout(function () { 
        context.TouchTimerID = 0; 
        mdx_click(word, CalTouchX(cur_win, posX), CalTouchY(cur_win, posY), cur_doc, cur_win); 
    }, 250);
    return true;
}

function OnClickImpl(event: MouseEvent, cur_doc: Document, cur_win: Window): boolean {
    if (!HasSelectionContent(cur_win) && !clickHandler(event, cur_doc, cur_win)) {
        const clientX = event.clientX;
        const clientY = event.clientY;
        const element = cur_doc.elementFromPoint(clientX, clientY);
        if (element != null) {
            console.debug("Check target element:", element);
            console.debug("Element class name:", element.className);
            if (element.className != null && element.className === 'mdx_word') {
                // var Word=WordNode.innerHTML.replace('/<.+?>/gim','');
                return OnTouchWord(event, element as HTMLElement, clientX, clientY, cur_doc, cur_win);
            } else {
                mdx_walk(cur_doc, element);
                const NewElement = cur_doc.elementFromPoint(clientX, clientY);
                if (NewElement != null && NewElement.className != null && NewElement.className === 'mdx_word')
                    return OnTouchWord(event, NewElement as HTMLElement, clientX, clientY, cur_doc, cur_win);
                else
                    return handleNoneMdxEle(event.target as HTMLElement, event, cur_doc, cur_win);
            }
        }
    }
    return false;
}

function handleNoneMdxEle(o: HTMLElement, _event: Event, _cur_doc: Document, _cur_win: Window): boolean {
    // Show big picture
    console.debug("Handle none mdx element:" + o.nodeName.toLowerCase());
    if (o.nodeName.toLowerCase() === 'img') {
        try {
            const img = o as HTMLImageElement;
            if ((typeof (img.onmousedown) === 'undefined' || img.onmousedown === null)
                && (typeof (img.onclick) === 'undefined' || img.onclick === null)) {
                if (img.clientWidth > 120 && img.clientHeight > 120){
                    //showBigMddPicture?.(img.src);
                    //TODO: should show big picture in iframe
                    return true;
                }
            }
        } catch (e: any) {
            console.warn(e.message);
        }
    }
    return false;
}

function wordPickerSetup(iframe: HTMLIFrameElement): void {
    let wordPickerContext: WordPickerContext = {
        touchStartPoint: null,
        TouchTimerID: 0,
        lastTouchUpTimeStamp: 0
    };
    (iframe.contentWindow as any).wordPickerContext = wordPickerContext;

    let cur_doc = iframe.contentDocument as Document;
    let cur_win = iframe.contentWindow as Window;

    const clickCheck = function (event: MouseEvent) {
        console.debug("Got click:" , event);
        OnClickImpl(event, cur_doc, cur_win);
    };

    iframe.contentDocument?.addEventListener('mouseup', () => {
        // 获取当前选中的文本
        const selection = cur_win.getSelection();
        if (selection){
            const selectedText = selection?.toString().trim();
            if (selectedText?.trim()) {
                const range = selection.getRangeAt(0); // 获取第一个范围
                const rect = range.getBoundingClientRect(); // 获取边界框 
                const global=getIframeGlobals(cur_win);
                console.debug("Selected text:" + selectedText + ", X:" + rect.left + ", Y:" + rect.top);
                const message: any=
                {
                    type: 'has_selection',
                    word: selectedText.trim(), 
                    anchor: {x:rect.left, y:rect.top}, 
                    fromEntry: {profile_id:global.profileId, entry_no:global.entryNo }
                };
                cur_win.parent.postMessage( message, "*");
            }
        }
    });
    iframe.contentDocument?.body.addEventListener('click', clickCheck, false);
    console.debug("Touch event listener setuped");
}

export {
    wordPickerSetup
}