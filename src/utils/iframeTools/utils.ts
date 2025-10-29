export function scrollToAnchor(doc: Document, anchor: string): void {
    if (doc) {
        const selectors = [
            `a[name="${anchor}"]`,
            `a[id="${anchor}"]`,
            `[id="${anchor}"]`,
        ];
      
        let targetElement: HTMLElement | null = null;
        
        for (const selector of selectors) {
            targetElement = doc.querySelector(selector);
            if (targetElement) {
                targetElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' //maybe 'start' is better?
                    });
                break;
            }
        }
    }
}

// For search and highlight
// @ts-ignore - Reserved for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function dimScreen(iframe: HTMLIFrameElement): void {
    const curtain = document.createElement("div");
    Object.assign(curtain.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        background: 'black',
        opacity: '0.2',
        zIndex: '999'
      });
    curtain.id = "__mdx_overlay_id";
    iframe.contentDocument?.body.appendChild(curtain);
}

// @ts-ignore - Reserved for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function undimScreen(iframe: HTMLIFrameElement): void {
    const element = iframe.contentDocument?.getElementById("__mdx_overlay_id");
    if (element && element.parentNode)
        element.parentNode.removeChild(element);
}