import { useEffect, useRef, useState, useMemo } from 'react';
import { sanitizeCss, sanitizeHtmlWithStyles } from '@/lib/sanitize';

interface Props {
  html: string;
  css?: string;
  bgColor?: string;
}

const HEIGHT_SCRIPT = `
<script>
(function(){
  var pending=null;
  function notifyHeight(){
    if(pending) cancelAnimationFrame(pending);
    pending=requestAnimationFrame(function(){
      var h=Math.max(
        document.documentElement.scrollHeight||0,
        document.body.scrollHeight||0,
        document.documentElement.offsetHeight||0,
        document.body.offsetHeight||0
      );
      window.parent.postMessage({type:'iframe-height',height:h},'*');
    });
  }
  new MutationObserver(notifyHeight).observe(document.body,{childList:true,subtree:true,attributes:true});
  if(window.ResizeObserver){new ResizeObserver(notifyHeight).observe(document.documentElement);}
  window.addEventListener('load',function(){notifyHeight();setTimeout(notifyHeight,300);setTimeout(notifyHeight,1000);});
  notifyHeight();

  function resolveTarget(el){
    if(!el) return null;
    var ds = el.getAttribute && el.getAttribute('data-scroll-to');
    if(ds) return ds.replace(/^#/,'');
    var href = el.getAttribute && el.getAttribute('href');
    if(href && href.charAt(0)==='#') return href.slice(1);
    return null;
  }
  document.addEventListener('click', function(e){
    var el = e.target;
    while(el && el !== document.body){
      if(el.tagName === 'A' || el.tagName === 'BUTTON' || (el.getAttribute && el.getAttribute('data-scroll-to'))){
        var target = resolveTarget(el);
        var isCta = el.classList && (el.classList.contains('cta-button') || el.classList.contains('cta') || el.hasAttribute('data-cta'));
        if(target || isCta){
          e.preventDefault();
          window.parent.postMessage({type:'iframe-scroll', target: target || 'order-form'}, '*');
          return;
        }
      }
      el = el.parentNode;
    }
  }, true);
})();
<\/script>`;

function isEditorMode() {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('editor') === '1';
  } catch { return false; }
}

/**
 * Production: renders content inside a sandboxed iframe (CSS isolation).
 * Editor mode (?editor=1): renders content inline so each element is clickable
 * and inline-editable. CSS is scoped via a wrapper id.
 */
export default function IsolatedHtmlSection({ html, css, bgColor }: Props) {
  const editor = isEditorMode();

  if (editor) {
    return <InlineEditableSection html={html} css={css} bgColor={bgColor} />;
  }

  return <IframeSection html={html} css={css} bgColor={bgColor} />;
}

/* -------- Production iframe renderer (unchanged behavior) -------- */
function IframeSection({ html, css, bgColor }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(300);

  const raw = html || '';
  const isFullDocument = /^\s*<!DOCTYPE|^\s*<html/i.test(raw);
  const sanitizedCss = css ? sanitizeCss(css) : '';

  let srcDoc: string;
  if (isFullDocument) {
    srcDoc = /<\/body>/i.test(raw) ? raw.replace(/<\/body>/i, `${HEIGHT_SCRIPT}</body>`) : raw + HEIGHT_SCRIPT;
  } else {
    srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>html,body{margin:0;padding:0;overflow:hidden;${bgColor ? `background:${bgColor};` : ''}}img{max-width:100%;height:auto;}${sanitizedCss}</style></head><body>${raw}${HEIGHT_SCRIPT}</body></html>`;
  }

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === 'iframe-height') setHeight(Math.max(e.data.height, 50));
      else if (e.data?.type === 'iframe-scroll') {
        const target: string = e.data.target || 'order-form';
        const el = document.getElementById(target) || document.querySelector(`[data-section="${target}"]`) || document.querySelector('#order-form') || document.querySelector('form');
        (el as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      className="w-full border-none block"
      style={{ height: `${height}px`, backgroundColor: bgColor || 'transparent' }}
      title="Landing page content"
    />
  );
}

/* -------- Editor inline renderer: editable in place -------- */
function InlineEditableSection({ html, css, bgColor }: Props) {
  const scopeId = useMemo(() => 'lp-inline-' + Math.random().toString(36).slice(2, 9), []);

  // Extract body content if full document
  const raw = html || '';
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const inner = bodyMatch ? bodyMatch[1] : raw;
  const headStyleMatch = raw.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  const inlineDocStyles = headStyleMatch ? headStyleMatch.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n') : '';

  const cleanHtml = sanitizeHtmlWithStyles(inner);
  const combinedCss = `${inlineDocStyles}\n${css ? sanitizeCss(css) : ''}`;
  // Scope CSS rules to our wrapper id so they don't leak.
  const scopedCss = combinedCss
    .replace(/([^{}]+)\{/g, (_m, sel) => {
      const scoped = sel.split(',').map((s: string) => {
        const t = s.trim();
        if (!t || t.startsWith('@')) return t;
        if (t === 'html' || t === 'body') return `#${scopeId}`;
        return `#${scopeId} ${t}`;
      }).join(', ');
      return `${scoped}{`;
    });

  return (
    <div
      id={scopeId}
      data-inline-html="1"
      style={{ backgroundColor: bgColor || 'transparent' }}
    >
      {combinedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}
      <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
    </div>
  );
}
