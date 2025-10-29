/**
 * Iframe Height Fix Module
 * 
 * This module provides functions to initialize iframe content for proper height calculation
 * and navigation handling. Functions accept document and window as parameters to work
 * with the iframe's browsing context.
 */

/**
 * Calculate document height using multiple measurements
 */
function getDocHeight(doc: Document): number {
  let referenceHeight = 0;
  const bottomElement = doc.getElementById("__mdx_iframe_bottom_element");
  
  if (bottomElement) {
    referenceHeight = Math.round(bottomElement.getBoundingClientRect().bottom);
  }
  
  // Use multiple height measurements for accuracy
  const scrollHeight = doc.body.scrollHeight;
  const offsetHeight = doc.body.offsetHeight;
  const clientHeight = doc.body.clientHeight;
  const documentHeight = doc.documentElement.scrollHeight;
  
  console.debug(
    `scrollHeight:${scrollHeight} offsetHeight:${offsetHeight} clientHeight:${clientHeight} documentHeight:${documentHeight} referenceHeight:${referenceHeight}`
  );
  let finalHeight = referenceHeight;
  if (referenceHeight < 16) {
    finalHeight = Math.max(referenceHeight, documentHeight, scrollHeight);
  }
  return finalHeight;
}


/**
 * Fix body height and notify parent
 */
function fixHeight(iframe: HTMLIFrameElement): void {
  iframe.style.height = getDocHeight(iframe.contentDocument as Document) + 16 + "px";
}

/**
 * Setup DOM change observation using MutationObserver or fallback
 */
function setupObserveDOMChange(iframe: HTMLIFrameElement): void {
  console.debug("Setup observer");
  if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
    if (typeof MutationObserver !== 'undefined') {
      let mutationsObserver = new MutationObserver(function(_mutations: MutationRecord[], _observer: MutationObserver) {
        console.debug("DOM change detected by MutationObserver");
        fixHeight(iframe);
      });
      let mutationObserverOption = {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
      };
      mutationsObserver.observe(iframe.contentDocument.body, mutationObserverOption);
    } else {
      // Fallback for older browsers
      iframe.contentDocument?.addEventListener('DOMSubtreeModified', function() {
        console.debug("DOM change detected by DOMSubtreeModified event");
        fixHeight(iframe);
      } as EventListener);
    }
  }
}

/**
 * Setup ResizeObserver for body size changes
 * @deprecated Reserved for future use
 */
// @ts-ignore - Reserved for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _setupObserver(iframe: HTMLIFrameElement): void {
    // ResizeObserver for body size changes
    console.debug("Setting up ResizeObserver");
    const observer = new ResizeObserver(() => {
      console.debug("ResizeObserver triggered");
      fixHeight(iframe);
    });
    
    observer.observe(iframe.contentDocument?.body as Element);
    // Also observe document element for comprehensive coverage
    observer.observe(iframe.contentDocument?.documentElement as Element);
  }

/**
 * Initialize iframe content for height tracking and navigation
 * 
    * @param iframe - The iframe element
 */
export function fixHeightSetup(
  iframe: HTMLIFrameElement,
): void {
  console.debug("Initializing iframe fixHeight");
  
  // Immediate height calculation
  fixHeight(iframe);
  
  // Setup observers for dynamic content changes
  // Use shorter delay for better responsiveness
  setTimeout(function() {
    setupObserveDOMChange(iframe);
    //setupObserver(iframe);
    console.debug("All observers setup completed");
  }, 500);  
}