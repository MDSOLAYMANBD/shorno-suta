import DOMPurify from 'dompurify';

const SAFE_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'b', 'i', 's', 'del', 'ins', 'mark',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'div', 'span', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'a', 'img', 'picture', 'source', 'video', 'iframe',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'blockquote', 'pre', 'code', 'hr', 'figure', 'figcaption',
  'details', 'summary', 'abbr', 'sub', 'sup', 'small',
];

const SAFE_ATTRS = [
  'href', 'src', 'alt', 'title', 'class', 'style', 'id', 'name',
  'target', 'rel', 'width', 'height', 'loading', 'decoding',
  'colspan', 'rowspan', 'scope', 'align', 'valign',
  'data-*', 'aria-*', 'role',
  'allow', 'allowfullscreen', 'frameborder',
  'type', 'media', 'srcset', 'sizes',
  'open',
];

/**
 * Sanitize HTML — blocks <style> tags to prevent CSS leaking into global scope.
 * Use for header/footer/custom_html snippets.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    FORCE_BODY: true,
    ALLOWED_TAGS: SAFE_TAGS,
    ALLOWED_ATTR: SAFE_ATTRS,
    ALLOW_DATA_ATTR: true,
    ADD_ATTR: ['target'],
  });
}

/**
 * Sanitize HTML WITH <style> tags allowed.
 * Only use inside fully isolated containers (iframe srcDoc) where CSS cannot leak.
 */
export function sanitizeHtmlWithStyles(dirty: string): string {
  if (!dirty) return '';
  const clean = DOMPurify.sanitize(dirty, {
    FORCE_BODY: true,
    ALLOWED_TAGS: [...SAFE_TAGS, 'style', 'html', 'head', 'body', 'link', 'meta', 'title'],
    ALLOWED_ATTR: [...SAFE_ATTRS, 'charset', 'lang', 'content', 'http-equiv', 'property'],
    ALLOW_DATA_ATTR: true,
    ADD_ATTR: ['target'],
    WHOLE_DOCUMENT: true,
  });
  // Sanitize CSS inside any <style> blocks that passed through
  return clean.replace(/<style>([\s\S]*?)<\/style>/gi, (_match, css) => {
    return `<style>${sanitizeCss(css)}</style>`;
  });
}

/**
 * Sanitize CSS content - remove dangerous patterns.
 */
export function sanitizeCss(css: string): string {
  if (!css) return '';
  return css
    .replace(/javascript\s*:/gi, '')
    .replace(/@import/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/url\s*\(\s*['"]?\s*javascript\s*:/gi, 'url(')
    .replace(/-moz-binding/gi, '')
    .replace(/behavior\s*:/gi, '');
}
