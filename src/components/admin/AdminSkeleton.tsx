import { Skeleton } from '@/components/ui/skeleton';

export default function AdminSkeleton() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar skeleton - desktop */}
      <aside className="w-60 bg-background border-r border-border p-4 hidden md:flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-3 mb-8">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </aside>

      {/* Mobile header skeleton */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center px-4 gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Main content skeleton */}
      <main className="flex-1 p-4 md:p-6 md:mt-0 mt-14">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-background rounded-xl border border-border p-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-2 w-12" />
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div className="bg-background rounded-xl border border-border p-4 mb-6">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>

        {/* Table */}
        <div className="bg-background rounded-xl border border-border p-4">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16 shrink-0" />
                <Skeleton className="h-6 w-20 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
