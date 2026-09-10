import { useEffect } from 'react';

/**
 * Iframe-side bridge for click-to-edit / inline visual editing in the
 * landing page admin editor. Activated only when URL contains ?editor=1.
 *
 * Behaviour:
 *  - Hover outlines any element with `data-edit-key`
 *  - Click on inline-editable HTML section text → contentEditable inline edit
 *  - Click on <img> inside inline-editable section → asks parent to open Media Center
 *  - Click on other sections → posts `lp-edit-select` so the parent can open
 *    the section settings panel
 *  - On edit blur, posts `lp-edit-content-update` with the section's new HTML
 *  - Suppresses navigation / form submits while edit mode is active
 */
export function useLandingEditorBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('editor') !== '1') return;

    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-lp-editor', '');
    styleEl.textContent = `
      [data-edit-key] { cursor: pointer; position: relative; }
      /* Block interactive elements in non-inline regions so clicks select the section */
      [data-edit-key] iframe,
      [data-edit-key] a,
      [data-edit-key] button,
      [data-edit-key] input,
      [data-edit-key] select,
      [data-edit-key] textarea,
      [data-edit-key] form { pointer-events: none !important; }
      /* Inline-editable HTML sections re-enable interaction so we can click into text/imgs */
      [data-inline-html],
      [data-inline-html] * { pointer-events: auto !important; }
      [data-inline-html] a { cursor: text !important; }
      [data-inline-html] [contenteditable="true"] {
        outline: 2px dashed #3b82f6 !important;
        outline-offset: 2px;
        background: rgba(255, 235, 130, 0.25) !important;
        min-height: 1em;
      }
      [data-inline-html] img {
        cursor: pointer !important;
        transition: outline 80ms linear;
      }
      [data-inline-html] img:hover {
        outline: 3px solid #3b82f6;
        outline-offset: 2px;
      }
      .__lp_edit_outline {
        position: fixed; pointer-events: none;
        border: 2px solid #3b82f6;
        background: rgba(59, 130, 246, 0.06);
        z-index: 2147483646;
        transition: all 60ms linear;
        border-radius: 4px;
      }
      .__lp_edit_label {
        position: fixed; pointer-events: none;
        background: #3b82f6; color: white;
        font-size: 11px; font-weight: 600;
        padding: 2px 8px; border-radius: 4px;
        z-index: 2147483647;
        font-family: system-ui, -apple-system, sans-serif;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      }
      .__lp_edit_banner {
        position: fixed; top: 8px; left: 50%;
        transform: translateX(-50%);
        background: #3b82f6; color: white;
        font-size: 12px; font-weight: 600;
        padding: 6px 14px; border-radius: 999px;
        z-index: 2147483647;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        pointer-events: none;
      }
    `;
    document.head.appendChild(styleEl);

    const outline = document.createElement('div');
    outline.className = '__lp_edit_outline';
    outline.style.display = 'none';
    document.body.appendChild(outline);

    const label = document.createElement('div');
    label.className = '__lp_edit_label';
    label.style.display = 'none';
    document.body.appendChild(label);

    const banner = document.createElement('div');
    banner.className = '__lp_edit_banner';
    banner.textContent = '✏️ এডিট মোড — টেক্সটে ক্লিক করে এডিট করুন, ছবিতে ক্লিক করে বদলান';
    document.body.appendChild(banner);

    let lastHover: HTMLElement | null = null;
    let activeEditable: HTMLElement | null = null;

    const findEditable = (el: HTMLElement | null): HTMLElement | null => {
      while (el && el !== document.body) {
        if (el.dataset && el.dataset.editKey) return el;
        el = el.parentElement;
      }
      return null;
    };

    const findInlineHost = (el: HTMLElement | null): HTMLElement | null => {
      while (el && el !== document.body) {
        if (el.hasAttribute && el.hasAttribute('data-inline-html')) return el;
        el = el.parentElement;
      }
      return null;
    };

    const getSectionId = (wrapper: HTMLElement): string | null => {
      const key = wrapper.dataset.editKey;
      if (!key) return null;
      if (key.startsWith('custom_')) return key.replace('custom_', '');
      return null;
    };

    const onMove = (e: MouseEvent) => {
      if (activeEditable) return;
      const target = findEditable(e.target as HTMLElement);
      if (!target) {
        outline.style.display = 'none';
        label.style.display = 'none';
        lastHover = null;
        return;
      }
      if (target === lastHover) return;
      lastHover = target;
      const r = target.getBoundingClientRect();
      outline.style.display = 'block';
      outline.style.left = r.left + 'px';
      outline.style.top = r.top + 'px';
      outline.style.width = r.width + 'px';
      outline.style.height = r.height + 'px';
      label.style.display = 'block';
      label.textContent = target.dataset.editLabel || target.dataset.editKey!;
      label.style.left = r.left + 'px';
      label.style.top = Math.max(0, r.top - 22) + 'px';
    };

    const sendUpdate = (host: HTMLElement) => {
      const wrapper = findEditable(host);
      if (!wrapper) return;
      const sectionId = getSectionId(wrapper);
      if (!sectionId) return;
      // Serialize the inner html minus our style tag
      const clone = host.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('style').forEach(s => s.remove());
      // Strip our editing attributes
      clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
      clone.querySelectorAll('[data-lp-img-id]').forEach(el => el.removeAttribute('data-lp-img-id'));
      const html = clone.innerHTML;
      try {
        window.parent?.postMessage({ type: 'lp-edit-content-update', sectionId, html }, '*');
      } catch {}
    };

    const finishEdit = () => {
      if (!activeEditable) return;
      const host = findInlineHost(activeEditable);
      activeEditable.removeAttribute('contenteditable');
      const target = activeEditable;
      activeEditable = null;
      if (host) sendUpdate(host);
      target.blur();
    };

    const onClick = (e: MouseEvent) => {
      const wrapper = findEditable(e.target as HTMLElement);
      if (!wrapper) {
        if (activeEditable) finishEdit();
        return;
      }

      const host = findInlineHost(e.target as HTMLElement);

      // Inline edit path
      if (host) {
        const tgt = e.target as HTMLElement;

        // Image click → request media center from parent
        if (tgt.tagName === 'IMG') {
          e.preventDefault();
          e.stopPropagation();
          const imgId = 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
          tgt.setAttribute('data-lp-img-id', imgId);
          const sectionId = getSectionId(wrapper);
          try {
            window.parent?.postMessage({
              type: 'lp-edit-image-request',
              sectionId,
              imgId,
              currentSrc: (tgt as HTMLImageElement).src,
            }, '*');
          } catch {}
          return;
        }

        // Text element click → make editable
        e.preventDefault();
        e.stopPropagation();

        // Walk up from clicked node to find a leaf-ish text container
        let editTarget: HTMLElement = tgt;
        while (editTarget && editTarget !== host) {
          // Prefer the nearest block/inline element directly containing text
          const hasText = Array.from(editTarget.childNodes).some(
            n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
          );
          if (hasText) break;
          if (editTarget.parentElement && editTarget.parentElement !== host) {
            editTarget = editTarget.parentElement;
          } else break;
        }
        // Don't allow editing the host itself directly — pick its closest meaningful child
        if (editTarget === host) {
          editTarget = (tgt.closest('h1,h2,h3,h4,h5,h6,p,span,a,button,div,li') as HTMLElement) || tgt;
        }

        if (activeEditable && activeEditable !== editTarget) finishEdit();
        if (activeEditable === editTarget) return;

        editTarget.setAttribute('contenteditable', 'plaintext-only');
        activeEditable = editTarget;
        outline.style.display = 'none';
        label.style.display = 'none';
        editTarget.focus();

        // Place caret at end
        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editTarget);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        } catch {}

        const onBlur = () => {
          editTarget.removeEventListener('blur', onBlur);
          editTarget.removeEventListener('keydown', onKey);
          finishEdit();
        };
        const onKey = (ev: KeyboardEvent) => {
          if (ev.key === 'Escape') {
            ev.preventDefault();
            finishEdit();
          }
          if (ev.key === 'Enter' && !ev.shiftKey) {
            ev.preventDefault();
            finishEdit();
          }
        };
        editTarget.addEventListener('blur', onBlur);
        editTarget.addEventListener('keydown', onKey);
        return;
      }

      // Default: open side panel for this section
      e.preventDefault();
      e.stopPropagation();
      try {
        window.parent?.postMessage({
          type: 'lp-edit-select',
          key: wrapper.dataset.editKey,
          label: wrapper.dataset.editLabel || wrapper.dataset.editKey,
        }, '*');
      } catch {}
    };

    // Parent → iframe message handler: image response from media center
    const onParentMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'lp-edit-image-response' && d.imgId && d.url) {
        const img = document.querySelector(`img[data-lp-img-id="${d.imgId}"]`) as HTMLImageElement | null;
        if (img) {
          img.src = d.url;
          img.removeAttribute('srcset');
          img.removeAttribute('data-lp-img-id');
          const host = findInlineHost(img);
          if (host) sendUpdate(host);
        }
      }
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('message', onParentMessage);

    const blocker = (e: Event) => {
      const t = findEditable(e.target as HTMLElement);
      if (t) { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('submit', blocker, true);

    try { window.parent?.postMessage({ type: 'lp-edit-ready' }, '*'); } catch {}

    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', blocker, true);
      window.removeEventListener('message', onParentMessage);
      styleEl.remove();
      outline.remove();
      label.remove();
      banner.remove();
    };
  }, []);
}
