/**
 * Highlight Module for Dictionary Content
 * 
 * Provides text search and highlighting functionality for dictionary entries.
 * Uses mark.js library for efficient text highlighting and navigation.
 */

import Mark from 'mark.js';

// Type definitions
interface HighlightContext {
    keyword: string;
    currentMatchIndex: number;
    matchedNode: HTMLElement[];
    markInstance: Mark | null;
}

const mdx_css_highlight = "__mdx_css_highlight";

function getContext(iframe: HTMLIFrameElement): HighlightContext {
    return (iframe.contentWindow as any).highlightContext as HighlightContext;
}

const matchedTextColor: string = "black";
const matchedTextBackgroundColor: string = "Yellow";
const matchedTextHighLightColor: string = "black";
const matchedTextHighLightBackgroundColor: string = "Coral";

// Main entry point to start the search using mark.js
// Returns a Promise that resolves with the total number of matches found
function HighlightAllOccurrencesOfString(
    iframe: HTMLIFrameElement, 
    keyword: string, 
    _maxMatchCount: number, 
    highLightFirstMatch?: boolean
): Promise<number> {
    let context = getContext(iframe);
    console.debug("Highlighting words:" + keyword);
    
    RemoveAllHighlights(iframe);
    
    if (!iframe.contentDocument?.body) {
        return Promise.resolve(0);
    }

    // Create mark.js instance for the iframe content
    context.markInstance = new Mark(iframe.contentDocument.body);
    context.keyword = keyword;
    context.matchedNode = [];
    context.currentMatchIndex = -1;

    return new Promise<number>((resolve) => {
        // Use mark.js to highlight the keyword
        context.markInstance!.mark(keyword, {
            element: "span",
            className: mdx_css_highlight,
            exclude: ["script", "style"],
            iframes: true,
            iframesTimeout: 5000,
            acrossElements: false,
            caseSensitive: false,
            separateWordSearch: false,
            accuracy: "partially",
            each: function(element: HTMLElement) {
                // Apply default highlighting styles
                element.style.backgroundColor = matchedTextBackgroundColor;
                element.style.color = matchedTextColor;
                context.matchedNode.push(element);
            },
            done: function(totalMarks: number) {
                console.debug("Total match found:" + totalMarks);
                if (totalMarks > 0 && (highLightFirstMatch === undefined || highLightFirstMatch)) {
                    clearMatchCursor(iframe);
                    setMatchCursor(iframe, 0, false);
                }
                resolve(totalMarks);
            }
        });
    });
}

// Main entry point to remove the highlights using mark.js
function RemoveAllHighlights(iframe: HTMLIFrameElement): void {
    let context = getContext(iframe);
    if (context && context.markInstance) {
        context.markInstance.unmark();
        context.matchedNode = [];
        context.currentMatchIndex = -1;
        context.markInstance = null;
    }
}

function clearMatchCursor(iframe: HTMLIFrameElement): boolean {
    let context = getContext(iframe);
    if (context.currentMatchIndex >= 0 && context.currentMatchIndex < context.matchedNode.length && context.matchedNode[context.currentMatchIndex]) {
        context.matchedNode[context.currentMatchIndex].style.color = matchedTextColor;
        context.matchedNode[context.currentMatchIndex].style.backgroundColor = matchedTextBackgroundColor;
        context.currentMatchIndex = -1;
        return true;
    }else{
        context.currentMatchIndex = -1;
        return false;
    }
}

function setMatchCursor(iframe: HTMLIFrameElement, pos: number, scrollTo: boolean): boolean {
    console.debug("setMatchCursor", pos, scrollTo);
    clearMatchCursor(iframe);
    let context = getContext(iframe);
    context.currentMatchIndex = pos;
    if (pos >= 0 && pos < context.matchedNode.length && context.matchedNode[context.currentMatchIndex]) {
        console.debug("setMatchCursor", context.matchedNode[context.currentMatchIndex]);
        context.matchedNode[context.currentMatchIndex].style.color = matchedTextHighLightColor;
        context.matchedNode[context.currentMatchIndex].style.backgroundColor = matchedTextHighLightBackgroundColor;
        if (scrollTo) {
            context.matchedNode[context.currentMatchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return true;
    }else{
        context.currentMatchIndex = -1;
        return false;
    }
 }

function getMatchCursorIndex(iframe: HTMLIFrameElement): number {
    let context = getContext(iframe);
    return context.currentMatchIndex;
}

function getMatchCount(iframe: HTMLIFrameElement): number {
    let context = getContext(iframe);
    return context.matchedNode.length;
}

function highlightSetup(iframe: HTMLIFrameElement) {
    (iframe.contentWindow as any).highlightContext = {
        keyword: "",
        currentMatchIndex: -1,
        matchedNode: new Array<HTMLElement>(),
        markInstance: null,
    };
    console.debug("Highlight setup completed");
}

export {
    highlightSetup,
    HighlightAllOccurrencesOfString,
    RemoveAllHighlights,
    clearMatchCursor,
    getMatchCursorIndex,
    setMatchCursor,
    getMatchCount
}