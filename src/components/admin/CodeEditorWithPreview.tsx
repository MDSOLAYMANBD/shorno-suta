import { useState, useEffect, useRef, useMemo } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Monitor, Smartphone, ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import CodeEditor from './CodeEditor';
import { useIsMobile } from '@/hooks/use-mobile';

interface Props {
  htmlValue: string;
  onHtmlChange: (value: string) => void;
  cssValue?: string;
  onCssChange?: (value: string) => void;
  height?: number | 'fill';
  htmlRows?: number;
  cssRows?: number;
  htmlPlaceholder?: string;
  cssPlaceholder?: string;
  onSave?: () => void;
  onBack?: () => void;
  saveDisabled?: boolean;
}

export default function CodeEditorWithPreview({
  htmlValue,
  onHtmlChange,
  cssValue,
  onCssChange,
  height = 450,
  htmlRows = 14,
  cssRows = 6,
  htmlPlaceholder = '<div>আপনার HTML এখানে লিখুন...</div>',
  cssPlaceholder = '.my-class { color: red; }',
  onSave,
  onBack,
  saveDisabled,
}: Props) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(true);
  const isMobile = useIsMobile();
  const [debouncedHtml, setDebouncedHtml] = useState(htmlValue);
  const [debouncedCss, setDebouncedCss] = useState(cssValue || '');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedHtml(htmlValue);
      setDebouncedCss(cssValue || '');
    }, 400);
    return () => clearTimeout(timerRef.current);
  }, [htmlValue, cssValue]);

  const srcdoc = useMemo(() => {
    return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 12px; color: #333; }
  img { max-width: 100%; height: auto; }
  ${debouncedCss}
</style>
</head>
<body>${debouncedHtml}</body>
</html>`;
  }, [debouncedHtml, debouncedCss]);

  const isFill = height === 'fill';

  const editorPanel = (fullscreen: boolean) => (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      <div className="px-3 py-1.5 border-b border-border flex items-center gap-2">
        <span className="text-[10px] font-mono text-muted-foreground">HTML</span>
        {onCssChange && <span className="text-[10px] text-muted-foreground/60">+ CSS</span>}
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-0">
        <CodeEditor
          value={htmlValue}
          onChange={onHtmlChange}
          rows={fullscreen ? 30 : htmlRows}
          language="html"
          placeholder={htmlPlaceholder}
          fillHeight={fullscreen || isFill}
        />
        {onCssChange && (
          <>
            <div className="px-3 py-1 border-t border-border">
              <span className="text-[10px] font-mono text-muted-foreground">CSS</span>
            </div>
            <CodeEditor
              value={cssValue || ''}
              onChange={onCssChange}
              rows={fullscreen ? 10 : cssRows}
              language="css"
              placeholder={cssPlaceholder}
            />
          </>
        )}
      </div>
    </div>
  );

  const previewToolbar = (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-background">
      <span className="text-[10px] font-medium text-muted-foreground">লাইভ প্রিভিউ</span>
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
          <button
            onClick={() => setViewMode('desktop')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${viewMode === 'desktop' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            <Monitor className="h-3 w-3" />
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${viewMode === 'mobile' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            <Smartphone className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );

  const previewPanel = (
    <div className="flex-1 min-h-0 flex items-start justify-center p-2 overflow-auto">
      <div
        className="bg-white rounded shadow overflow-hidden h-full transition-all duration-200"
        style={{ width: isMobile ? '100%' : (viewMode === 'mobile' ? '390px' : '100%'), maxWidth: '100%' }}
      >
        <iframe
          srcDoc={srcdoc}
          className="w-full h-full border-0"
          title="HTML Preview"
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Fullscreen dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-0 gap-0 border-0 [&>button.absolute]:hidden">
          <DialogTitle className="sr-only">কোড এডিটর ফুল স্ক্রিন</DialogTitle>
          {(onBack || onSave) && (
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background">
              <div>
                {onBack && (
                  <Button variant="ghost" size="sm" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> ফিরে যান
                  </Button>
                )}
              </div>
              <div>
                {onSave && (
                  <Button size="sm" onClick={onSave} disabled={saveDisabled}>
                    <Save className="h-4 w-4 mr-1" /> সেভ করুন
                  </Button>
                )}
              </div>
            </div>
          )}
          <ResizablePanelGroup direction={isMobile ? 'vertical' : 'horizontal'} className="h-full">
            <ResizablePanel defaultSize={50} minSize={25}>
              {editorPanel(true)}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} minSize={25}>
              <div className="h-full flex flex-col bg-muted/20">
                {previewToolbar}
                {previewPanel}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </DialogContent>
      </Dialog>
    </>
  );
}
