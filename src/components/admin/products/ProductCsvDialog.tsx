import { useState, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Download, Upload, FileText, Loader2 } from 'lucide-react';
import {
  CSV_COLUMNS,
  productsToCsv,
  buildSampleCsv,
  parseCsv,
  buildProductPayload,
  downloadFile,
} from '@/lib/productCsv';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Product IDs to export (filtered/selected list from parent). */
  exportIds: string[];
  /** Whether current user is admin (controls cost_price import). */
  isAdmin: boolean;
}

const PRODUCT_FIELDS =
  'id, slug, name, name_bn, description, description_bn, category_id, price, original_price, clearance_price, clearance_active, stock, sizes, colors, images, video_url, video_file_url, variant_images, addon_config, bump_product_id, bump_discount, product_type, is_active, is_featured, is_hidden_from_shop, allow_pre_order, seo_title, seo_description, seo_keywords, feed_title, feed_description';

export function ProductCsvDialog({ open, onOpenChange, exportIds, isAdmin }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'export' | 'import' | 'sample'>('export');
  const [exporting, setExporting] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // ---------- EXPORT ----------
  const handleExport = async () => {
    if (exportIds.length === 0) {
      toast.error('কোনো পণ্য সিলেক্ট নেই');
      return;
    }
    setExporting(true);
    try {
      // Fetch in chunks to avoid URL length issues
      const all: any[] = [];
      const chunkSize = 100;
      for (let i = 0; i < exportIds.length; i += chunkSize) {
        const chunk = exportIds.slice(i, i + chunkSize);
        const { data, error } = await supabase.from('products').select(PRODUCT_FIELDS as any).in('id', chunk);
        if (error) throw error;
        all.push(...(data || []));
      }

      // cost_price via staff RPC (silent fail for non-admins)
      try {
        const { data: costRows } = await (supabase.rpc as any)('get_product_cost_prices', {
          p_ids: all.map((p) => p.id),
        });
        const costMap = new Map<string, number | null>();
        (costRows || []).forEach((r: any) => costMap.set(r.id, r.cost_price));
        all.forEach((p) => (p.cost_price = costMap.get(p.id) ?? null));
      } catch {
        /* non-admin — skip */
      }

      // Resolve category names
      const catIds = Array.from(new Set(all.map((p) => p.category_id).filter(Boolean)));
      const catNameById = new Map<string, string>();
      if (catIds.length > 0) {
        const { data: cats } = await supabase.from('categories').select('id, name').in('id', catIds);
        (cats || []).forEach((c: any) => catNameById.set(c.id, c.name));
      }

      // Map bump_product_id → slug (from already loaded set + extra fetch)
      const bumpSlugById = new Map<string, string>();
      all.forEach((p) => {
        bumpSlugById.set(p.id, p.slug);
      });
      const missingBump = Array.from(
        new Set(all.map((p) => p.bump_product_id).filter((id) => id && !bumpSlugById.has(id))),
      );
      if (missingBump.length > 0) {
        const { data: bp } = await supabase.from('products').select('id, slug').in('id', missingBump);
        (bp || []).forEach((p: any) => bumpSlugById.set(p.id, p.slug));
      }

      const csv = productsToCsv(all, catNameById, bumpSlugById);
      downloadFile(`shorno-suta-products-${dateStr}.csv`, csv);
      toast.success(`${all.length} টি পণ্য এক্সপোর্ট হয়েছে`);
    } catch (e: any) {
      toast.error('Export failed: ' + (e?.message || 'unknown'));
    } finally {
      setExporting(false);
    }
  };

  // ---------- SAMPLE ----------
  const handleSample = () => {
    downloadFile('shorno-suta-products-template.csv', buildSampleCsv());
  };

  // ---------- IMPORT ----------
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setResult(null);
    setParsedRows([]);
    setFile(f || null);
    if (!f) return;
    try {
      const text = await f.text();
      const { headers, rows } = parseCsv(text);
      const missing = (CSV_COLUMNS as readonly string[]).filter(
        (c) => !headers.includes(c) && c !== 'cost_price', // cost_price optional
      );
      if (missing.length > 5) {
        toast.warning(`কিছু কলাম পাওয়া যায়নি (${missing.length} টি) — পাওয়া কলামগুলো ইম্পোর্ট হবে`);
      }
      setParsedRows(rows);
    } catch (err: any) {
      toast.error('CSV parse failed: ' + (err?.message || 'unknown'));
    }
  };

  const runImport = async () => {
    if (parsedRows.length === 0) {
      toast.error('কোনো রো নেই');
      return;
    }
    setImporting(true);
    setProgress(0);
    setResult(null);

    try {
      // Pre-fetch lookup maps
      const { data: cats } = await supabase.from('categories').select('id, name');
      const categoryIdByName = new Map<string, string>();
      (cats || []).forEach((c: any) => categoryIdByName.set(c.name.toLowerCase(), c.id));

      const slugs = parsedRows.map((r) => (r.slug || '').trim()).filter(Boolean);
      const productIdBySlug = new Map<string, string>();
      const existingIdBySlug = new Map<string, string>();
      const chunkSize = 100;
      for (let i = 0; i < slugs.length; i += chunkSize) {
        const chunk = slugs.slice(i, i + chunkSize);
        const { data } = await supabase.from('products').select('id, slug').in('slug', chunk);
        (data || []).forEach((p: any) => {
          productIdBySlug.set(p.slug.toLowerCase(), p.id);
          existingIdBySlug.set(p.slug, p.id);
        });
      }
      // Also include bump references from anywhere in the table — fetch all slugs map for bump resolution
      // (limited: only resolve bumps that match slugs in this CSV)

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < parsedRows.length; i++) {
        const raw = parsedRows[i];
        const validation = buildProductPayload(raw, i + 2, categoryIdByName, productIdBySlug, isAdmin);

        if (validation.errors.length > 0) {
          skipped++;
          errors.push(`Row ${validation.index} (${validation.slug || '-'}): ${validation.errors.join('; ')}`);
        } else {
          try {
            const existingId = existingIdBySlug.get(validation.slug);
            if (existingId) {
              const { error } = await supabase.from('products').update(validation.payload as any).eq('id', existingId);
              if (error) throw error;
              updated++;
            } else {
              // Insert defaults
              const insertPayload: Record<string, any> = {
                is_active: true,
                stock: 0,
                variant_images: {},
                product_type: 'regular',
                bump_discount: 0,
                description: '',
                description_bn: '',
                ...validation.payload,
              };
              if (!insertPayload.name) {
                throw new Error('name required for new product');
              }
              if (insertPayload.price === undefined) {
                throw new Error('price required for new product');
              }
              const { error } = await supabase.from('products').insert(insertPayload as any);
              if (error) throw error;
              created++;
            }
          } catch (e: any) {
            skipped++;
            errors.push(`Row ${validation.index} (${validation.slug}): ${e?.message || 'insert/update failed'}`);
          }
        }
        if (validation.warnings.length > 0) {
          errors.push(`Row ${validation.index} (${validation.slug}) ⚠️: ${validation.warnings.join('; ')}`);
        }
        setProgress(Math.round(((i + 1) / parsedRows.length) * 100));
      }

      setResult({ created, updated, skipped, errors });
      toast.success(`Import সম্পন্ন: ${created} নতুন, ${updated} আপডেট, ${skipped} বাদ`);
      qc.invalidateQueries({ queryKey: ['admin-products'] });
    } catch (e: any) {
      toast.error('Import failed: ' + (e?.message || 'unknown'));
    } finally {
      setImporting(false);
    }
  };

  const downloadErrorReport = () => {
    if (!result || result.errors.length === 0) return;
    const csv = '\uFEFFerror\n' + result.errors.map((e) => `"${e.replace(/"/g, '""')}"`).join('\n');
    downloadFile(`import-errors-${dateStr}.csv`, csv);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>📊 CSV ম্যানেজমেন্ট</DialogTitle>
          <DialogDescription>পণ্য এক্সপোর্ট ও ইম্পোর্ট করুন</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="export">
              <Download className="h-4 w-4 mr-1" /> Export
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 mr-1" /> Import
            </TabsTrigger>
            <TabsTrigger value="sample">
              <FileText className="h-4 w-4 mr-1" /> Sample
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-3 pt-3">
            <p className="text-sm text-muted-foreground">
              বর্তমান ফিল্টার অনুযায়ী <b>{exportIds.length}</b> টি পণ্য ডাউনলোড হবে। (সিলেকশন থাকলে শুধু সিলেক্টেড।)
            </p>
            <Button onClick={handleExport} disabled={exporting || exportIds.length === 0} className="w-full">
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              CSV ডাউনলোড করুন
            </Button>
          </TabsContent>

          <TabsContent value="import" className="space-y-3 pt-3">
            <p className="text-sm text-muted-foreground">
              CSV আপলোড করুন। <b>slug</b> দিয়ে ম্যাচ করে existing product update হবে, নতুন slug হলে create হবে।
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {file && parsedRows.length > 0 && (
              <div className="text-sm bg-muted p-2 rounded">
                <b>{file.name}</b> — {parsedRows.length} টি রো পাওয়া গেছে
              </div>
            )}
            {importing && (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-xs text-center text-muted-foreground">{progress}%</p>
              </div>
            )}
            {result && (
              <div className="text-sm space-y-2 bg-muted p-3 rounded">
                <div>✅ নতুন তৈরি: <b>{result.created}</b></div>
                <div>🔄 আপডেট: <b>{result.updated}</b></div>
                <div>⚠️ বাদ পড়েছে: <b>{result.skipped}</b></div>
                {result.errors.length > 0 && (
                  <Button size="sm" variant="outline" onClick={downloadErrorReport}>
                    Error report ডাউনলোড ({result.errors.length})
                  </Button>
                )}
              </div>
            )}
            <Button
              onClick={runImport}
              disabled={importing || parsedRows.length === 0}
              className="w-full"
            >
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {parsedRows.length > 0 ? `${parsedRows.length} টি রো ইম্পোর্ট করুন` : 'প্রথমে CSV বাছাই করুন'}
            </Button>
          </TabsContent>

          <TabsContent value="sample" className="space-y-3 pt-3">
            <p className="text-sm text-muted-foreground">
              খালি টেমপ্লেট ডাউনলোড করুন — সব কলাম হেডার সহ।
            </p>
            <div className="text-xs bg-muted p-2 rounded font-mono break-all">{CSV_COLUMNS.join(', ')}</div>
            <Button onClick={handleSample} className="w-full" variant="outline">
              <FileText className="h-4 w-4 mr-2" /> Sample টেমপ্লেট ডাউনলোড
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
