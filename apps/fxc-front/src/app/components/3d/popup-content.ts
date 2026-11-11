const LINE_AWESOME_CSS_URL = 'https://cdn.jsdelivr.net/npm/line-awesome@1/dist/line-awesome/css/line-awesome.min.css';

/**
 * Wraps popup HTML in a shadow DOM element so Line Awesome icons and matching
 * popup typography apply inside ArcGIS's Shadow DOM.
 */
export function createPopupContent(body: string): HTMLElement {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <link rel="stylesheet" href="${LINE_AWESOME_CSS_URL}" />
    <style>
      :host {
        display: block;
        font-size: 14px;
        line-height: 1.3;
      }
      a {
        color: var(--calcite-color-text-link, #0054e9);
      }
    </style>
    ${body}
  `;
  return host;
}
