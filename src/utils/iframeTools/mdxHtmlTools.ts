/**
 * MdxHtmlTools
 *
 * Utilities for loading dictionary entry HTML and applying templates.
 * Height tracking and navigation handling are initialized via iframe onload in ContentItem.
 */
import { useSystemStore } from '../../store/useSystemStore';
/**
 * Fetch content from a URL and return a complete HTML document string.
 * Wraps the content in HTML structure. Height tracking is initialized via iframe onload.
 */
export const fetchContentFromUrl = async (
  url: string
): Promise<string> => {
  try {
    console.log('Fetching content from URL:', url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Determine how to handle response by content-type
    const contentType = response.headers.get('content-type') || '';
    let rawContent: string;
    if (contentType.includes('text/html') || contentType.includes('text/plain')) {
      rawContent = await response.text();
    } else {
      // For other content types, still try to interpret as text
      rawContent = await response.text();
    }

    // Wrap content in basic HTML structure
    // Initialization is handled via iframe onload in ContentItem
    const wrappedContent = `
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <style type="text/css">
      body{
          html,body{
              width: 100%;
              height: auto; /* Allow natural content height */
              word-wrap: break-word;
          }
      }
      .__mdx_css_highlight {
          border-radius: 4px;
          position: relative !important;
          z-index: 1000;
      }
  </style>
</head>
<body>
${rawContent}
<div id="__mdx_iframe_bottom_element" style="position:relative; bottom:0; height:0px;"> </div>
</body>
</html>`;

    return wrappedContent;
  } catch (error) {
    console.error('Error fetching content from URL:', url, error);
    throw error;
  }
};

export const getIconUrl = (profileId: number): string => {
  return `${useSystemStore.getState().baseUrl}mdd?profile_id=${profileId}&key=%2F$MdxDictIcon`;
};