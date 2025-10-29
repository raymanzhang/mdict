/**
 * Setup click handler for links
 */
import { scrollToAnchor } from './utils';
import { useSystemStore } from '../../store/useSystemStore';
// Type definitions
interface NavigationMessage {
  type: 'navigate';
  url: string;
}

function mdxLinkHandler(anchor: HTMLAnchorElement, win: Window, event: Event): boolean {
    console.debug("MDX link element found:", anchor.href);
    event.preventDefault();
    
    // Check if it's an audio link
    let service_path = anchor.href.substring(useSystemStore.getState().baseUrl.length);
    if (service_path.startsWith('sound')) {
        console.debug("Audio link detected, playing audio:", anchor.href);
        // Create and play audio element
        const audio = new Audio(anchor.href);
        audio.play().catch(function(error: Error) {
            console.debug("Audio play failed:", error);
        });
    } else {
        // Send navigation message for non-audio links
        console.debug("Sending navigation message:", anchor.href);
        const message: NavigationMessage = {
            type: 'navigate',
            url: anchor.href
        };
        win.parent.postMessage(message, '*');
        console.debug("Navigation message sent:", message);
    }
    return true;
}

export function clickHandler(event: Event, cur_doc:Document, cur_win:Window): boolean {
    console.debug("Click event detected", event.target);
    // Find the closest anchor element
    let element = event.target as Element | null;
    while (element && element.tagName !== 'A') {
        element = element.parentElement;
    }

    if (element && element.tagName.toLowerCase() === 'a') {
        const anchor = element as HTMLAnchorElement;
        
        if (anchor.href) {
            // Check if it's a local fragment link (starts with #)
            const href = anchor.getAttribute('href');
            if (href && href.startsWith('#')) {
                event.preventDefault();
                console.debug("Local fragment link detected, allowing default behavior:", href);
                scrollToAnchor(cur_doc, href.substring(1));
                return true;
            }
            
            // Check if it's a same-page fragment link (same URL with #fragment)
            const currentUrl = cur_win.location.href;
            const linkUrl = anchor.href;
            
            // Remove fragment from both URLs for comparison
            const currentUrlWithoutFragment = currentUrl.split('#')[0];
            const linkUrlWithoutFragment = linkUrl.split('#')[0];
            
            // If base URLs are the same and link has a fragment, it's a same-page fragment link
            if (currentUrlWithoutFragment === linkUrlWithoutFragment && linkUrl.indexOf('#') !== -1) {
                console.debug("Same-page fragment link detected, allowing default behavior:", linkUrl);
                return true;
            }
            
            // Check if it's a link with http://mdict.cn/service/ href
            if (anchor.href.startsWith(useSystemStore.getState().baseUrl)) {
                 return mdxLinkHandler(anchor, cur_win, event);
            }
        }
    }
    return false;
}

// // Setup link click handler
// export function clickHandlerSetup(iframe: HTMLIFrameElement): void {
//     console.debug("Setting up click handler");
//     const doc = iframe.contentDocument;
//     if (!doc) {
//         console.error("Failed to get document");
//         return;
//     }
//     // Add event listener for all link clicks
//     doc.addEventListener('click', (event: MouseEvent) => clickHandler(event, iframe), true); 
// }