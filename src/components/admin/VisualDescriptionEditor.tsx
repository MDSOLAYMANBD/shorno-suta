import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Bold, Italic, List, Undo, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VisualDescriptionEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
}

const VisualDescriptionEditor: React.FC<VisualDescriptionEditorProps> = ({ value, onChange, className }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showCode, setShowCode] = useState(false);
  // Track the last value we pushed to parent to avoid re-setting innerHTML from our own edits
  const lastEmittedRef = useRef<string>(value);

  // Only update innerHTML when value changes externally (e.g. AI generate, initial load)
  useEffect(() => {
    if (editorRef.current && value !== lastEmittedRef.current) {
      editorRef.current.innerHTML = value;
      lastEmittedRef.current = value;
    }
  }, [value]);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastEmittedRef.current = html;
      onChange(html);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastEmittedRef.current = html;
      onChange(html);
    }
  }, [onChange]);

  const toolbarButtons = [
    { icon: Bold, command: 'bold', title: 'Bold' },
    { icon: Italic, command: 'italic', title: 'Italic' },
    { icon: List, command: 'insertUnorderedList', title: 'List' },
    { icon: Undo, command: 'undo', title: 'Undo' },
  ];

  if (showCode) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowCode(false)}>
            <Code className="h-3 w-3" /> ভিজ্যুয়াল মোডে ফিরুন
          </Button>
        </div>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full border border-input rounded-md px-3 py-2 text-xs bg-background min-h-[200px] resize-y font-mono"
          placeholder="HTML কোড..."
        />
      </div>
    );
  }

  return (
    <div className={cn("border border-input rounded-md overflow-hidden bg-background", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-muted/50 flex-wrap">
        {toolbarButtons.map(({ icon: Icon, command, title }) => (
          <button
            key={command}
            type="button"
            title={title}
            onMouseDown={e => { e.preventDefault(); exec(command); }}
            className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          title="HTML কোড দেখুন"
          onClick={() => setShowCode(true)}
          className="h-7 px-2 inline-flex items-center justify-center rounded hover:bg-accent hover:text-accent-foreground transition-colors text-xs gap-1 text-muted-foreground"
        >
          <Code className="h-3 w-3" /> কোড
        </button>
      </div>

      {/* Editable area — innerHTML set via ref, NOT dangerouslySetInnerHTML, to preserve cursor */}
      <div
        ref={(el) => {
          (editorRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          if (el && !el.innerHTML) {
            el.innerHTML = value;
            lastEmittedRef.current = value;
          }
        }}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        className="sd-product-desc w-full px-3 py-2 text-sm min-h-[150px] max-h-[400px] overflow-auto outline-none focus:ring-1 focus:ring-ring focus:ring-inset cursor-text"
        style={{ wordBreak: 'break-word' }}
      />
    </div>
  );
};

export default VisualDescriptionEditor;
