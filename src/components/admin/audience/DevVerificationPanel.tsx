// ───────────────────────────────────────────────────────────────────────────
// Developer Verification Panel — temporary diagnostic surface for the
// Audience Engine. Visible only when:
//   - import.meta.env.DEV is true, OR
//   - localStorage flag `audience_dev_panel = '1'` is set (so the admin
//     can flip it on in production for one-off verification).
//
// Surfaces:
//   • Live counters (matched / unique / dup / excluded / invalid / final)
//   • Active filter state (presets, districts, statuses, manual exclude, mode)
//   • Per-card source descriptions + live counts
//   • Preview pipeline diagnostics
//   • Export-vs-Final parity check
//   • Console assertions for invariants
//
// Remove this file (and its import in SmsAudienceEngineTab) before final
// production release. The engine helpers it consumes (`diagnoseAudienceFilter`,
// `describePresetSource`) are safe to keep.
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bug, RefreshCcw, ChevronDown, ChevronUp, PlayCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { diagnoseAudienceFilter, describePresetSource, getDistrictBuckets } from '@/lib/audience/engine';
import { fetchAudienceForExport } from '@/lib/audience/export';
import { getThresholds, type AudienceThresholds } from '@/lib/audience/thresholds';
import { PRESETS } from '@/lib/audience/presets';
import { VARIABLES as TEMPLATE_VARS } from '@/lib/audience/templates';
import { useAllPresetCounts } from '@/hooks/useAudienceCounts';
import type { AudienceFilter, AudienceSummary, PresetId } from '@/lib/audience/types';

export function isDevPanelEnabled(): boolean {
  try { return localStorage.getItem('audience_dev_panel') === '1'; } catch { return false; }
}

interface Props {
  filter: AudienceFilter;
  summary?: AudienceSummary;
  exportCount?: number;       // length of fetchAudienceForExport result
  template?: string;          // optional SMS body for token validation
}

interface DiagCheck { name: string; pass: boolean; detail?: string }

export default function DevVerificationPanel({ filter, summary, exportCount, template }: Props) {
  const enabled = isDevPanelEnabled();
  const [open, setOpen] = useState(true);
  const [thresholds, setThresholds] = useState<AudienceThresholds | null>(null);
  useEffect(() => {
    if (!enabled) return;
    getThresholds().then(setThresholds);
  }, [enabled]);

  const filterIsEmpty =
    (filter.include.length + filter.exclude.length + filter.districts.length + filter.parcelStatuses.length) === 0;

  const { data: diag, isFetching, refetch } = useQuery({
    queryKey: ['audience-dev-diagnostics', filter],
    queryFn: () => diagnoseAudienceFilter(filter),
    enabled: enabled && !filterIsEmpty,
    staleTime: 15_000,
  });

  const { data: cardCounts } = useAllPresetCounts(enabled);

  // Independent export count for parity (only when filter active).
  const { data: liveExportCount } = useQuery({
    queryKey: ['audience-dev-export-count', filter],
    queryFn: async () => (await fetchAudienceForExport(filter)).length,
    enabled: enabled && !filterIsEmpty,
    staleTime: 30_000,
  });
  const finalExportCount = exportCount ?? liveExportCount ?? 0;

  // ── runtime assertions (dev console) ─────────────────────────────────
  useEffect(() => {
    if (!summary || !diag) return;
    const warn = (m: string, extra?: any) => console.warn(`[AudienceEngine] ${m}`, extra ?? '');
    if (diag.finalCount !== summary.finalCount) warn('diag.finalCount ≠ summary.finalCount', { diag: diag.finalCount, summary: summary.finalCount });
    if (summary.finalCount > summary.matchedCustomers) warn('finalCount > matchedCustomers (impossible)');
    if (summary.duplicatePhones < 0) warn('duplicatePhones is negative');
    if (summary.invalid > diag.totalCustomers) warn('invalid > totalCustomers');
    if (finalExportCount && finalExportCount !== summary.finalCount) warn('exportCount ≠ summary.finalCount', { finalExportCount, summary: summary.finalCount });
  }, [summary, diag, finalExportCount]);

  // ── "Run Audience Diagnostics" (DEV only) ────────────────────────────
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<DiagCheck[] | null>(null);

  async function runDiagnostics() {
    setRunning(true);
    const out: DiagCheck[] = [];
    try {
      const d = await diagnoseAudienceFilter(filter);
      const exportRows = await fetchAudienceForExport(filter);
      const exportLen = exportRows.length;
      const cards = cardCounts || {};

      // 1. Card Count == Preview Count (per active include preset)
      if (filter.include.length === 1) {
        const id = filter.include[0];
        const cc = cards[id] ?? null;
        const ok = cc !== null && cc === d.matched - d.duplicatePhones + 0; // soft compare
        out.push({
          name: 'Card Count ≈ Preview Count',
          pass: cc !== null && Math.abs((cc as number) - d.uniquePhones) <= Math.max(2, (cc as number) * 0.02),
          detail: `card=${cc} preview(unique)=${d.uniquePhones}`,
        });
      } else {
        out.push({ name: 'Card Count ≈ Preview Count', pass: true, detail: 'skipped — needs exactly 1 include preset' });
      }

      // 2. Preview Count == Summary Count
      out.push({
        name: 'Preview Count == Summary Count',
        pass: !!summary && d.finalCount === summary.finalCount,
        detail: `diag.final=${d.finalCount} summary.final=${summary?.finalCount}`,
      });

      // 3. Summary Count == Export Count
      out.push({
        name: 'Summary Count == Export Count',
        pass: !!summary && summary.finalCount === exportLen,
        detail: `summary.final=${summary?.finalCount} export=${exportLen}`,
      });

      // 4. Duplicate Count >= 0
      out.push({
        name: 'Duplicate Count >= 0',
        pass: (summary?.duplicatePhones ?? 0) >= 0 && d.duplicatePhones >= 0,
        detail: `dup=${d.duplicatePhones}`,
      });

      // 5. Invalid Count <= Total
      out.push({
        name: 'Invalid Count <= Total',
        pass: d.invalidPhones <= d.totalCustomers,
        detail: `invalid=${d.invalidPhones} total=${d.totalCustomers}`,
      });

      // 6. Final SMS <= Matched Customers
      out.push({
        name: 'Final SMS <= Matched Customers',
        pass: !!summary && summary.finalCount <= summary.matchedCustomers,
        detail: `final=${summary?.finalCount} matched=${summary?.matchedCustomers}`,
      });

      // 7. AND / OR logic consistency (OR >= AND when 2+ includes)
      if (filter.include.length >= 2) {
        const andD = await diagnoseAudienceFilter({ ...filter, includeMode: 'AND' });
        const orD  = await diagnoseAudienceFilter({ ...filter, includeMode: 'OR'  });
        out.push({
          name: 'AND / OR logic consistency',
          pass: orD.finalCount >= andD.finalCount,
          detail: `AND=${andD.finalCount} OR=${orD.finalCount}`,
        });
      } else {
        out.push({ name: 'AND / OR logic consistency', pass: true, detail: 'skipped — needs 2+ include presets' });
      }

      // 8. District bucket integrity (sum of buckets <= total customers)
      try {
        const buckets = await getDistrictBuckets();
        const sum = Object.values(buckets).reduce((a, b) => a + (b || 0), 0);
        out.push({
          name: 'District bucket integrity',
          pass: Object.keys(buckets).length > 0 && sum <= d.totalCustomers * 1.05,
          detail: `${Object.keys(buckets).length} districts, sum=${sum}, total=${d.totalCustomers}`,
        });
      } catch (e: any) {
        out.push({ name: 'District bucket integrity', pass: false, detail: e?.message || 'fetch failed' });
      }

      // 9. Export parity (every export phone is valid BD phone)
      const phoneOk = exportRows.every((r) => /^8801\d{9}$/.test((r as any).phone || ''));
      out.push({
        name: 'Export parity (valid normalized phones)',
        pass: phoneOk,
        detail: phoneOk ? `${exportLen} rows OK` : 'invalid phones in export',
      });

      // 10. Template variable validation (unknown {{tokens}})
      if (template && template.trim()) {
        const known = new Set(TEMPLATE_VARS.map((v) => v.token));
        const used = template.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) || [];
        const unknown = used.filter((t) => !known.has(t.replace(/\s+/g, '')));
        out.push({
          name: 'Template variable validation',
          pass: unknown.length === 0,
          detail: unknown.length ? `unknown: ${unknown.join(', ')}` : `${used.length} tokens OK`,
        });
      } else {
        out.push({ name: 'Template variable validation', pass: true, detail: 'no template provided' });
      }

      setChecks(out);
    } catch (e: any) {
      setChecks([{ name: 'Diagnostics runner', pass: false, detail: e?.message || 'unknown error' }]);
    } finally {
      setRunning(false);
    }
  }

  if (!enabled) return null;

  return (
    <Card className="border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <Bug className="h-3.5 w-3.5" /> Developer Verification Panel
          <Badge variant="outline" className="text-[10px] h-4">DEV ONLY</Badge>
        </CardTitle>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCcw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 text-xs">
          {filterIsEmpty && <div className="text-muted-foreground italic">Select at least one preset / district / status to see diagnostics.</div>}

          {!filterIsEmpty && (
            <>
              {/* Live counters */}
              <Section title="Live Counters">
                <Grid>
                  <Metric label="Total Customers"    value={diag?.totalCustomers} />
                  <Metric label="Fetched (pool)"     value={diag?.fetched} />
                  <Metric label="Matched"            value={summary?.matchedCustomers} />
                  <Metric label="Unique Customers"   value={summary?.uniqueCustomers} />
                  <Metric label="Unique Phones"      value={summary?.uniquePhones} />
                  <Metric label="Duplicate Phones"   value={summary?.duplicatePhones} />
                  <Metric label="Excluded"           value={summary?.excluded} />
                  <Metric label="Invalid"            value={summary?.invalid} />
                  <Metric label="Final SMS Count"    value={summary?.finalCount} highlight />
                </Grid>
              </Section>

              {/* Pipeline */}
              <Section title="Preview Pipeline">
                <Grid>
                  <Metric label="Fetched"              value={diag?.fetched} />
                  <Metric label="Removed (invalid)"    value={diag?.invalidPhones} />
                  <Metric label="Removed by Include"   value={diag?.removedByInclude} />
                  <Metric label="Removed by Exclude"   value={diag?.removedByExclude} />
                  <Metric label="Removed by Manual"    value={diag?.removedByManual} />
                  <Metric label="Removed by District"  value={diag?.removedByDistrict} />
                  <Metric label="Removed by Duplicate" value={diag?.duplicatePhones} />
                  <Metric label="Surviving"            value={diag?.matched} />
                  <Metric label="Final"                value={diag?.finalCount} highlight />
                </Grid>
              </Section>

              {/* Export parity */}
              <Section title="Export Verification">
                <Grid>
                  <Metric label="Final SMS Count" value={summary?.finalCount} />
                  <Metric label="Export Count"    value={finalExportCount} />
                  <Metric
                    label="Parity"
                    value={summary?.finalCount === finalExportCount ? 'OK' : 'MISMATCH'}
                    highlight={summary?.finalCount === finalExportCount}
                    danger={summary && summary.finalCount !== finalExportCount}
                  />
                </Grid>
              </Section>
            </>
          )}

          {/* Run Audience Diagnostics — DEV only */}
          {import.meta.env.DEV && (
            <Section title="Run Audience Diagnostics">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="default" className="h-7" onClick={runDiagnostics} disabled={running || filterIsEmpty}>
                  {running ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <PlayCircle className="h-3 w-3 mr-1" />}
                  Run Audience Diagnostics
                </Button>
                {checks && (
                  <Badge variant="outline" className="text-[10px]">
                    {checks.filter((c) => c.pass).length}/{checks.length} PASS
                  </Badge>
                )}
                {filterIsEmpty && <span className="text-[10px] text-muted-foreground">activate a filter first</span>}
              </div>
              {checks && (
                <div className="mt-2 space-y-1">
                  {checks.map((c, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded border p-1.5 ${c.pass ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20' : 'border-red-300 bg-red-50/60 dark:bg-red-950/20'}`}>
                      {c.pass
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        : <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium flex items-center gap-2">
                          {c.name}
                          <Badge variant="outline" className={`text-[9px] h-4 ${c.pass ? 'text-emerald-700' : 'text-red-700'}`}>
                            {c.pass ? 'PASS' : 'FAIL'}
                          </Badge>
                        </div>
                        {c.detail && <div className="text-[10px] text-muted-foreground font-mono break-all">{c.detail}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}



          {/* Active filter state */}
          <Section title="Active Filter State">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <KV k="Include Mode" v={filter.includeMode || 'AND'} />
              <KV k="Active Presets" v={filter.include.join(', ') || '—'} />
              <KV k="Excluded Presets" v={filter.exclude.join(', ') || '—'} />
              <KV k="Active Districts" v={filter.districts.join(', ') || '—'} />
              <KV k="Delivery Statuses" v={filter.parcelStatuses.join(', ') || '—'} />
              <KV k="Manual Exclude" v={String(filter.manualExclude.length)} />
            </div>
          </Section>

          {/* Card diagnostics */}
          <Section title={`Card Diagnostics (${PRESETS.length})`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-72 overflow-auto pr-1">
              {PRESETS.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-2 rounded border bg-background/60 p-1.5">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.title} <span className="text-muted-foreground">[{p.id}]</span></div>
                    <div className="text-[10px] text-muted-foreground font-mono break-all">
                      {describePresetSource(p.id, thresholds || undefined)}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {cardCounts?.[p.id] ?? '–'}
                  </Badge>
                </div>
              ))}
            </div>
          </Section>

          <div className="text-[10px] text-muted-foreground">
            Assertions logged to browser console. Toggle in prod with{' '}
            <code>localStorage.setItem('audience_dev_panel','1')</code>.
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── tiny presentational helpers ─────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">{children}</div>;
}
function Metric({ label, value, highlight, danger }: { label: string; value: number | string | undefined; highlight?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded border p-1.5 ${danger ? 'border-red-400 bg-red-50 dark:bg-red-950/30' : highlight ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'bg-background/60'}`}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-mono tabular-nums text-sm">{value ?? '–'}</div>
    </div>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded border bg-background/60 p-1.5">
      <div className="text-[10px] text-muted-foreground">{k}</div>
      <div className="font-mono text-[11px] break-all">{v}</div>
    </div>
  );
}
