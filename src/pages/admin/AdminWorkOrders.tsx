import { useParams, useNavigate } from 'react-router-dom';
import { useUnits } from '@/hooks/useAccounting';
import { usePersons } from '@/hooks/usePersons';
import { useMemo, useState, useRef, useCallback } from 'react';
import { useSiteConfig, DEFAULT_NAVBAR_CONFIG } from '@/hooks/useSiteConfig';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Package, Receipt, ClipboardList, ChevronLeft, ChevronRight, Pin } from 'lucide-react';
import { WorkOrderContent } from '@/components/admin/WorkOrderSection';

// ========== UNIT COLOR MAPPING ==========
function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
}

function getUnitStyle(unitId: string | null, unitName?: string | null): { color: string; label: string } {
  const name = (unitName || '').toLowerCase();
  if (name.includes('অফিস') || name.includes('office')) return { color: '#16a34a', label: unitName || 'অফিস' };
  if (name.includes('সাপ্লায়ার') || name.includes('supplier')) return { color: '#ea580c', label: unitName || 'সাপ্লায়ার' };
  if (name.includes('সেউইং') || name.includes('কারখানা') || name.includes('factory') || name.includes('sewing')) return { color: '#6B1E2B', label: unitName || 'সেউইং ফ্যাক্টরি' };
  if (name.includes('print') || name.includes('প্রিন্ট')) return { color: '#7c3aed', label: unitName || 'Print' };
  return { color: hashColor(unitName || 'unit'), label: unitName || 'Staff' };
}

function BrandedHeader({ unitId, unitName, isPrint }: { unitId: string; unitName: string; isPrint: boolean }) {
  const { data: navbarConfig } = useSiteConfig('navbar_config');
  const merged = { ...DEFAULT_NAVBAR_CONFIG, ...(navbarConfig || {}) };
  const logoUrl = merged.logo_url;
  const unitStyle = getUnitStyle(unitId, unitName);

  const isOffice = unitName === 'অফিস' || unitName.toLowerCase().includes('office');

  return (
    <div
      className="rounded-t-xl overflow-hidden shadow-lg"
      style={{ borderTop: `5px solid ${unitStyle.color}`, background: `linear-gradient(135deg, ${unitStyle.color}30 0%, ${unitStyle.color}08 100%)` }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: unitStyle.color }} />
          ) : (
            <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: unitStyle.color }}>S</div>
          )}
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">SHORNO SUTA</div>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground font-medium">{isOffice ? 'পণ্য কেনার শীট' : isPrint ? 'প্রিন্টের কাজ' : 'কারখানার কাজ'}</div>
      </div>
      <div className="flex flex-col items-center justify-center py-6">
        <div className="text-4xl font-black tracking-wide drop-shadow-sm" style={{ color: unitStyle.color }}>{isOffice ? 'পণ্য কেনার শীট' : isPrint ? 'প্রিন্টের কাজ' : 'কারখানার কাজ'}</div>
        <div className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-medium">{unitStyle.label}</div>
      </div>
    </div>
  );
}

export default function AdminWorkOrders() {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const { data: units = [] } = useUnits();
  const { data: persons = [] } = usePersons({ unit_id: unitId });

  const unit = useMemo(() => units.find(u => u.id === unitId), [units, unitId]);
  const unitSettings: any = unit?.settings || {};
  const isOfficeUnit = unit?.name === 'অফিস' || (unit?.name || '').toLowerCase().includes('office');
  const isPrintUnit = (unit?.name || '').includes('প্রিন্ট') || (unit?.name || '').toLowerCase().includes('print');
  const workLabel = isOfficeUnit ? 'পণ্য কেনার শীট' : isPrintUnit ? 'প্রিন্টের কাজ' : 'কারখানার কাজ';

  const activePersons = useMemo(() => persons.filter(p => p.is_active), [persons]);
  const employees = useMemo(() => activePersons.filter(p => p.type === 'employee'), [activePersons]);
  const productionStaff = useMemo(() => activePersons.filter(p => p.type === 'production_staff'), [activePersons]);
  const parties = useMemo(() => activePersons.filter(p => p.type === 'party' || p.type === 'supplier'), [activePersons]);

  const hasModules = unitSettings.has_materials || unitSettings.has_fixed_expenses || (unitSettings.custom_modules || []).length > 0;
  const hasChips = activePersons.length > 0 || hasModules;

  // Build combined nav list (same as AdminUnitModuleProfile)
  type NavItem = { type: 'person' | 'module'; id: string; name: string; navigateTo: string };
  const allSorted: NavItem[] = useMemo(() => {
    const items: NavItem[] = [];
    [...employees, ...productionStaff, ...parties].forEach(p =>
      items.push({ type: 'person', id: p.id, name: p.name, navigateTo: `/admin/accounting/persons/${p.id}` })
    );
    if (unitSettings.has_materials) items.push({ type: 'module', id: 'materials', name: 'ম্যাটেরিয়াল', navigateTo: `/admin/accounting/units/${unitId}/modules/materials` });
    if (unitSettings.has_fixed_expenses) items.push({ type: 'module', id: 'fixed_expenses', name: 'নিয়মিত খরচ', navigateTo: `/admin/accounting/units/${unitId}/modules/fixed_expenses` });
    for (const m of (unitSettings.custom_modules || [])) {
      items.push({ type: 'module', id: `custom-${m}`, name: m, navigateTo: `/admin/accounting/units/${unitId}/modules/custom-${m}` });
    }
    items.push({ type: 'module', id: 'work-orders', name: workLabel, navigateTo: `/admin/accounting/units/${unitId}/work-orders` });
    return items;
  }, [employees, productionStaff, parties, unitSettings, unitId, isOfficeUnit, workLabel]);

  const currentIdx = allSorted.findIndex(item => item.id === 'work-orders');
  const prevItem = currentIdx > 0 ? allSorted[currentIdx - 1] : null;
  const nextItem = currentIdx < allSorted.length - 1 ? allSorted[currentIdx + 1] : null;

  // Pin support
  const pinKey = `pinned-chips-${unitId}`;
  const [pinnedItems, setPinnedItems] = useState<{ type: string; id: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem(pinKey) || '[]'); } catch { return []; }
  });
  const togglePin = (type: string, itemId: string) => {
    setPinnedItems(prev => {
      const exists = prev.some(p => p.type === type && p.id === itemId);
      const next = exists ? prev.filter(p => !(p.type === type && p.id === itemId)) : [...prev, { type, id: itemId }];
      localStorage.setItem(pinKey, JSON.stringify(next));
      return next;
    });
  };
  const isPinned = (type: string, itemId: string) => pinnedItems.some(p => p.type === type && p.id === itemId);

  // Swipe navigation
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) < 60) return;
    if (diff < 0 && nextItem) navigate(nextItem.navigateTo);
    if (diff > 0 && prevItem) navigate(prevItem.navigateTo);
  }, [nextItem, prevItem, navigate]);

  if (!unitId) return null;

  const chipBase = "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium whitespace-nowrap border transition-colors hover:opacity-80 shrink-0";
  const sep = <div className="w-px bg-border shrink-0 my-1" />;

  return (
    <div className="min-h-screen bg-background" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 space-y-3">
        {/* Toolbar with nav controls */}
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/accounting/units/${unitId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> পেছনে যান
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!prevItem} onClick={() => prevItem && navigate(prevItem.navigateTo)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground min-w-[36px] text-center">
              {currentIdx + 1}/{allSorted.length}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!nextItem} onClick={() => nextItem && navigate(nextItem.navigateTo)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> প্রিন্ট
          </Button>
        </div>

        {/* Chips Bar — persons & modules */}
        {hasChips && (
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-1.5 print:hidden">
            <div className="flex gap-1.5 overflow-x-auto pb-1 px-1 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
              {/* Unit chip */}
              <button onClick={() => navigate(`/admin/accounting/units/${unitId}`)}
                className={`${chipBase} border-muted-foreground/30 bg-muted text-muted-foreground hover:bg-muted/80`}>
                🏠 ইউনিট
              </button>
              {sep}
              {/* Salary/Employee group */}
              {employees.length > 0 && (
                <>
                  <span className="inline-flex items-center h-7 px-1.5 text-[9px] font-bold uppercase tracking-wider text-blue-500 shrink-0">💼 বেতন</span>
                  {employees.map(p => (
                    <button key={p.id} onClick={() => navigate(`/admin/accounting/persons/${p.id}`)}
                      onContextMenu={(e) => { e.preventDefault(); togglePin('person', p.id); }}
                      className={`${chipBase} border-blue-300/50 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-700/30`}>
                      {isPinned('person', p.id) && <Pin className="h-2.5 w-2.5" />}
                      {p.name}
                    </button>
                  ))}
                </>
              )}
              {/* Production staff group */}
              {productionStaff.length > 0 && (
                <>
                  {employees.length > 0 && sep}
                  <span className="inline-flex items-center h-7 px-1.5 text-[9px] font-bold uppercase tracking-wider text-green-600 shrink-0">⚙️ প্রোডাকশন</span>
                  {productionStaff.map(p => (
                    <button key={p.id} onClick={() => navigate(`/admin/accounting/persons/${p.id}`)}
                      onContextMenu={(e) => { e.preventDefault(); togglePin('person', p.id); }}
                      className={`${chipBase} border-green-300/50 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-700/30`}>
                      {isPinned('person', p.id) && <Pin className="h-2.5 w-2.5" />}
                      {p.name}
                    </button>
                  ))}
                </>
              )}
              {/* Party/Supplier group */}
              {parties.length > 0 && (
                <>
                  {(employees.length > 0 || productionStaff.length > 0) && sep}
                  <span className="inline-flex items-center h-7 px-1.5 text-[9px] font-bold uppercase tracking-wider text-orange-600 shrink-0">🤝 পার্টি</span>
                  {parties.map(p => (
                    <button key={p.id} onClick={() => navigate(`/admin/accounting/persons/${p.id}`)}
                      onContextMenu={(e) => { e.preventDefault(); togglePin('person', p.id); }}
                      className={`${chipBase} border-orange-300/50 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-700/30`}>
                      {isPinned('person', p.id) && <Pin className="h-2.5 w-2.5" />}
                      {p.name}
                    </button>
                  ))}
                </>
              )}
              {/* Separator before modules */}
              {activePersons.length > 0 && hasModules && sep}
              {/* Module chips */}
              {unitSettings.has_materials && (
                <button onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/materials`)}
                  className={`${chipBase} border-amber-300/50 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700/30`}>
                  <Package className="h-3 w-3" /> ম্যাটেরিয়াল
                </button>
              )}
              {unitSettings.has_fixed_expenses && (
                <button onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/fixed_expenses`)}
                  className={`${chipBase} border-blue-300/50 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-700/30`}>
                  <Receipt className="h-3 w-3" /> নিয়মিত খরচ
                </button>
              )}
              {(unitSettings.custom_modules || []).map((modName: string) => (
                <button key={modName} onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/custom-${modName}`)}
                  className={`${chipBase} border-purple-300/50 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-700/30`}>
                  🚀 {modName}
                </button>
              ))}
              {/* Work Order — current page, highlighted */}
              <button className={`${chipBase} border-indigo-500 bg-indigo-100 text-indigo-800 ring-1 ring-indigo-400 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-500`}>
                <ClipboardList className="h-3 w-3" /> {workLabel}
              </button>
            </div>
          </div>
        )}

        <BrandedHeader unitId={unitId} unitName={unit?.name || ''} isPrint={isPrintUnit} />

        {/* Work Order Content */}
        <WorkOrderContent unitId={unitId} persons={persons} />
      </div>
    </div>
  );
}
