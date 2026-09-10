import { useRef, useCallback, useMemo } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  language?: 'html' | 'css';
  fillHeight?: boolean;
}

/**
 * Safe single-pass HTML highlighter.
 * Escapes first, then highlights tags/attrs in one regex pass to avoid recursive mutation.
 */
function highlightHTML(code: string): string {
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Comments
  escaped = escaped.replace(
    /(&lt;!--[\s\S]*?--&gt;)/g,
    '<span style="color:#6a737d;font-style:italic">$1</span>'
  );

  // Tags — single pass: capture open bracket+tagname, the entire attribute string, close bracket
  escaped = escaped.replace(
    /(&lt;\/?)([\w-]+)([\s\S]*?)(\/?&gt;)/g,
    (_, open, tag, attrs, close) => {
      // Highlight attribute names (word before =) and string values (inside quotes)
      // We only do attr-name coloring, skip value coloring to prevent recursive issues
      const safeAttrs = attrs.replace(
        /([\w-]+)(\s*=\s*)(&quot;|&#39;)([\s\S]*?)(\3)/g,
        '<span style="color:#e36209">$1</span>$2<span style="color:#22863a">$3$4$5</span>'
      );
      return `<span style="color:#d73a49">${open}${tag}</span>${safeAttrs}<span style="color:#d73a49">${close}</span>`;
    }
  );

  return escaped;
}

function highlightCSS(code: string): string {
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  escaped = escaped.replace(
    /(\/\*[\s\S]*?\*\/)/g,
    '<span style="color:#6a737d;font-style:italic">$1</span>'
  );
  escaped = escaped.replace(
    /^([^{}\n]+?)(\{)/gm,
    '<span style="color:#d73a49">$1</span>$2'
  );
  escaped = escaped.replace(
    /([\w-]+)(\s*:\s*)/g,
    '<span style="color:#e36209">$1</span>$2'
  );
  escaped = escaped.replace(
    /:\s*([^;{}]+)(;)/g,
    ': <span style="color:#22863a">$1</span>$2'
  );

  return escaped;
}

const sharedStyle: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '20px',
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  wordBreak: 'break-all',
  boxSizing: 'border-box',
  tabSize: 2,
  letterSpacing: 'normal',
  wordSpacing: 'normal',
  padding: '12px',
  margin: 0,
  border: 'none',
};

export default function CodeEditor({ value, onChange, rows = 12, placeholder, language = 'html', fillHeight = false }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const highlighted = useMemo(() => {
    if (!value) return '';
    return language === 'css' ? highlightCSS(value) : highlightHTML(value);
  }, [value, language]);

  const minH = rows * 20 + 24;

  return (
    <div
      className={`relative rounded-md border border-input ${fillHeight ? 'h-full overflow-auto' : ''}`}
      style={fillHeight ? {} : { minHeight: minH, overflow: 'hidden' }}
    >
      {/* Grid stack: pre and textarea occupy the same cell */}
      <div style={{ display: 'grid', gridTemplate: '1fr / 1fr', ...(fillHeight ? { minHeight: '100%' } : { minHeight: minH }) }}>
        {/* Highlighted display layer */}
        <pre
          className="pointer-events-none"
          style={{
            ...sharedStyle,
            gridArea: '1 / 1',
            overflow: 'hidden',
            background: '#ffffff',
            color: '#24292e',
          }}
          aria-hidden="true"
          dangerouslySetInnerHTML={{
            __html: highlighted || `<span style="color:#959da5">${placeholder || ''}</span>`,
          }}
        />

        {/* Invisible textarea for editing */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="resize-none outline-none"
          style={{
            ...sharedStyle,
            gridArea: '1 / 1',
            background: 'transparent',
            color: 'transparent',
            caretColor: '#24292e',
            zIndex: 1,
            WebkitTextFillColor: 'transparent',
          }}
          placeholder=""
        />
      </div>

      {/* Selection visibility */}
      <style>{`
        .code-editor-ta::selection { background-color: rgba(3,102,214,0.3); -webkit-text-fill-color: rgba(3,102,214,0.01); }
      `}</style>
    </div>
  );
}
