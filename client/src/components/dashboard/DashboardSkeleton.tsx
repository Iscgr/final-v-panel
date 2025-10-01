import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6" aria-hidden="true">
      {/* Header placeholder height ثابت */}
      <div className="flex items-start justify-between gap-4 min-h-[64px]">
        <div className="space-y-2 w-1/2 max-w-sm">
          <div className="h-6 bg-muted/40 rounded w-2/3 animate-pulse" />
          <div className="h-4 bg-muted/30 rounded w-full animate-pulse" />
        </div>
      </div>
      {/* KPI Strip Skeleton */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5" aria-label="در حال بارگذاری شاخص‌ها">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 bg-card flex flex-col gap-3 min-h-[110px] animate-pulse">
            <div className="h-3 w-1/2 bg-muted/40 rounded" />
            <div className="h-7 w-2/3 bg-muted/30 rounded" />
            <div className="h-3 w-1/3 bg-muted/20 rounded" />
          </div>
        ))}
      </div>
      {/* Lower grid placeholder */}
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-12">
        <div className="xl:col-span-4 space-y-4">
          <div className="rounded-lg border p-4 bg-card space-y-4 min-h-[340px]">
            <div className="h-4 w-28 bg-muted/40 rounded" />
            <div className="h-40 bg-muted/20 rounded" />
            <div className="h-24 bg-muted/10 rounded" />
          </div>
          <div className="rounded-lg border p-4 bg-card min-h-[120px]">
            <div className="h-4 w-32 bg-muted/40 rounded mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-3 bg-muted/20 rounded w-full" />
              ))}
            </div>
          </div>
        </div>
        <div className="xl:col-span-8 space-y-4">
          <div className="rounded-lg border p-4 h-72 bg-card flex items-center justify-center">
            <div className="h-10 w-10 rounded-full bg-muted/20 animate-pulse" />
          </div>
          <div className="rounded-lg border p-4 h-72 bg-card flex items-center justify-center">
            <div className="h-10 w-10 rounded-full bg-muted/20 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;