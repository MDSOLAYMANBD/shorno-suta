/**
 * Skeleton placeholders that mirror the final rendered layout of each
 * below-the-fold lazy section. They exist so the DOM reserves the exact
 * space the loaded section will occupy — preventing CLS without relying
 * on arbitrary min-heights.
 *
 * Keep the outer element (section + container padding) identical to the
 * loaded component so the transition is dimensionally stable.
 */

export function PopularCategoriesSkeleton() {
  return (
    <section className="py-8 sm:py-10 bg-muted/20 border-t border-border/40">
      <div className="max-w-7xl mx-auto px-3 md:px-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="h-3 w-40 bg-muted/70 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="w-full aspect-[16/9] bg-muted animate-pulse" />
              <div className="p-2.5 sm:p-3 space-y-1.5">
                <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-muted/70 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RecentlyViewedSkeleton() {
  // Mirrors RecentlyViewedSection: bg-muted/30 wrapper, header row, horizontal
  // scroller of w-32 sm:w-40 cards with square image + 2 text rows.
  return (
    <section className="bg-muted/30 border-y border-border/50 py-6 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-36 bg-muted rounded animate-pulse" />
              <div className="h-3 w-44 bg-muted/70 rounded animate-pulse hidden sm:block" />
            </div>
          </div>
          <div className="h-3 w-14 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-px bg-border/60 mb-4" />
        <div className="flex gap-3 sm:gap-4 overflow-hidden pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shrink-0 w-32 sm:w-40">
              <div className="aspect-square rounded-lg bg-muted animate-pulse" />
              <div className="mt-2 space-y-1.5">
                <div className="h-3 w-full bg-muted rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-muted/70 rounded animate-pulse" />
                <div className="h-3.5 w-16 bg-muted rounded animate-pulse mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CustomerShowcaseCompactSkeleton() {
  // Mirrors CustomerShowcaseCompact: 2-column stat card grid with live label.
  return (
    <section className="max-w-3xl mx-auto px-3 sm:px-4 mt-4">
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
        <span className="h-2.5 w-24 bg-muted rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-2.5 sm:p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                <div className="h-2.5 w-24 bg-muted/70 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CustomerShowcaseSkeleton() {
  // Mirrors CustomerShowcaseSection (homepage): header + 3 stat cards + top list.
  return (
    <section className="py-8 sm:py-10 bg-muted/10 border-t border-border/40">
      <div className="max-w-6xl mx-auto px-3 sm:px-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-40 bg-muted rounded animate-pulse" />
            <div className="h-3 w-56 bg-muted/70 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3 h-20 animate-pulse" />
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-2.5 w-1/2 bg-muted/70 rounded animate-pulse" />
              </div>
              <div className="h-4 w-8 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function GlobalReviewSkeleton() {
  // Mirrors GlobalReviewSection: header + carousel row of 1-3 testimonial cards.
  return (
    <section className="py-8 sm:py-12 bg-muted/10 border-t border-border/40">
      <div className="max-w-6xl mx-auto px-3 sm:px-4">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="h-5 w-48 bg-muted rounded animate-pulse" />
          <div className="h-3 w-64 bg-muted/70 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-2.5 w-16 bg-muted/70 rounded animate-pulse" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-full bg-muted rounded animate-pulse" />
                <div className="h-3 w-full bg-muted rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-muted/70 rounded animate-pulse" />
              </div>
              <div className="aspect-[3/4] max-h-48 rounded-lg bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
