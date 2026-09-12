import { AlertTriangle, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const REDIRECT_URI = 'https://www.shornosuta.com/admin/oauth/callback';
const APP_DOMAINS = 'shornosuta.com';

export type ParsedError = {
  title: string;
  steps: string[];
  copy?: { label: string; value: string }[];
  link?: { label: string; url: string };
  raw?: string;
};

export function parseMetaError(params: URLSearchParams): ParsedError {
  const code = params.get('error_code') || '';
  const msg = decodeURIComponent(params.get('error_message') || params.get('error_description') || params.get('error') || '');
  const reason = params.get('error_reason') || '';
  const lower = (msg + ' ' + reason).toLowerCase();

  if (code === '1349048' || /domain/.test(lower) || /url/.test(lower)) {
    return {
      title: 'App Domain বা Redirect URI whitelist করা নেই',
      steps: [
        'Meta Developer Console → Settings → Basic → App Domains-এ দুটো ডোমেইন যোগ করুন',
        'Facebook Login → Settings → Valid OAuth Redirect URIs-এ callback URL যোগ করুন',
        'Save করে আবার Connect চাপুন',
      ],
      copy: [
        { label: 'App Domains', value: APP_DOMAINS },
        { label: 'Redirect URI', value: REDIRECT_URI },
      ],
      link: { label: 'Open Meta Console', url: 'https://developers.facebook.com/apps/' },
      raw: msg || code,
    };
  }
  if (/permission/.test(lower) || code === '200') {
    return {
      title: 'Required permission গুলো App Review-তে approved নয়',
      steps: [
        'App Review → Permissions and Features-এ যান',
        'pages_messaging, pages_manage_metadata, instagram_manage_messages permissions request করুন',
        'Approval পাওয়ার পর আবার Connect চাপুন',
      ],
      link: { label: 'Open App Review', url: 'https://developers.facebook.com/apps/' },
      raw: msg,
    };
  }
  if (/business verification|verify your business/.test(lower)) {
    return {
      title: 'Business Verification incomplete',
      steps: [
        'Meta Business Settings → Security Center-এ যান',
        'Business Verification complete করুন',
        'Approval পাওয়ার পর আবার Connect চাপুন',
      ],
      link: { label: 'Open Business Settings', url: 'https://business.facebook.com/settings' },
      raw: msg,
    };
  }
  if (/access_denied|user denied|user cancelled/i.test(lower) || params.get('error') === 'access_denied') {
    return {
      title: 'আপনি OAuth cancel করেছেন',
      steps: ['Connect বাটনে আবার ক্লিক করে Facebook dialog-এ Continue চাপুন'],
      raw: msg,
    };
  }
  return {
    title: 'OAuth ব্যর্থ হয়েছে',
    steps: ['নিচের raw error দেখে সমাধান করুন বা আবার চেষ্টা করুন'],
    raw: msg || reason || code || 'unknown',
  };
}

export function OAuthErrorCard({ err, onRetry, onBack }: { err: ParsedError; onRetry?: () => void; onBack: () => void }) {
  const copy = async (v: string, label: string) => {
    await navigator.clipboard.writeText(v);
    toast.success(`${label} কপি হয়েছে`);
  };
  return (
    <div className="text-left space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
        <div className="font-semibold text-destructive">{err.title}</div>
      </div>
      <ol className="list-decimal pl-5 space-y-1 text-sm">
        {err.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      {err.copy && err.copy.length > 0 && (
        <div className="space-y-2">
          {err.copy.map((c, i) => (
            <div key={i}>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{c.label}</div>
              <div className="flex gap-2">
                <code className="flex-1 min-w-0 text-xs bg-muted rounded px-2 py-1.5 truncate">{c.value}</code>
                <Button size="sm" variant="outline" onClick={() => copy(c.value, c.label)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {err.raw && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Raw Meta error</summary>
          <pre className="mt-2 whitespace-pre-wrap break-all bg-muted/60 p-2 rounded">{err.raw}</pre>
        </details>
      )}
      <div className="flex gap-2 flex-wrap">
        {err.link && (
          <Button size="sm" variant="outline" asChild>
            <a href={err.link.url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> {err.link.label}
            </a>
          </Button>
        )}
        {onRetry && <Button size="sm" onClick={onRetry}>Retry Connect</Button>}
        <Button size="sm" variant="ghost" onClick={onBack}>Back</Button>
      </div>
    </div>
  );
}
