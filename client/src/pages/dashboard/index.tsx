import React, { useMemo, Suspense, lazy } from 'react';
import StatCard from '@/components/dashboard/StatCard';
import UploadZone from '@/components/dashboard/UploadZone';
import ActivityFeed, { ActivityItem } from '@/components/dashboard/ActivityFeed';
import VirtualizedActivityFeed from '@/components/dashboard/VirtualizedActivityFeed';
import { useRecentActivity } from '@/services/activity-service';
import { useQuery } from '@tanstack/react-query';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';
import { fetchKPI, kpiQueryKey } from '@/services/kpi-service';
import { useUploadFlow } from '@/hooks/use-upload-flow';
import FileValidationList from '@/components/dashboard/FileValidationList';
import ProcessingProgressBar from '@/components/dashboard/ProcessingProgressBar';
import { LiveProcessingMonitor } from '@/components/dashboard/LiveProcessingMonitor';
import AlertBanner from '@/components/dashboard/AlertBanner';
import QuickActionsPanel from '@/components/dashboard/QuickActionsPanel';

// Lazy charts (S5 PFX: dynamic import)
const RevenueTrendChart = lazy(() => import('@/components/dashboard/charts/RevenueTrendChart'));
const AgingBucketChart = lazy(() => import('@/components/dashboard/charts/AgingBucketChart'));
import UploadErrorPanel from '@/components/dashboard/UploadErrorPanel';

// فعالیت اخیر اکنون از API با polling دریافت می‌شود

export default function DashboardPage() {
  const { data: kpi, isLoading, isFetching } = useQuery({ queryKey: kpiQueryKey, queryFn: fetchKPI, staleTime: 60_000 });
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity({ refetchInterval: 30000 });
  const { selectFile, reset: resetUpload, phase, percent, issues, error, jobCode } = useUploadFlow();

  const cards = useMemo(() => ([
    { title: 'مجموع فاکتورها', value: kpi?.totalInvoices?.toLocaleString('fa-IR') ?? '–', desc: 'کل ثبت شده', trend: undefined },
    { title: 'پرداخت شده', value: kpi?.paidInvoices?.toLocaleString('fa-IR') ?? '–', desc: 'تسویه شده', trend: undefined },
    { title: 'معوق', value: kpi?.overdueInvoices?.toLocaleString('fa-IR') ?? '–', desc: 'دارای تاخیر', trend: undefined },
    { title: 'نرخ وصول', value: kpi ? kpi.collectionRate.toFixed(1) + '%' : '–', desc: 'قرائت فعلی', trend: undefined },
  { title: 'رشد دوره‌ای', value: kpi ? kpi.periodGrowth.toFixed(1) + '%' : '–', desc: 'نسبت به دوره قبل', trend: kpi ? { value: kpi.periodGrowth, direction: (kpi.periodGrowth > 0 ? 'up' : kpi.periodGrowth < 0 ? 'down' : 'flat') as ('up'|'down'|'flat') } : undefined },
  ]), [kpi]);
  if (isLoading && !kpi) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="dashboard-grid space-y-6">
      <header role="banner" className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" role="heading" aria-level={1}>داشبورد</h1>
          <p className="text-sm text-muted-foreground mt-1" aria-live="polite">نمای کلی عملکرد مالی و فعالیت اخیر سیستم</p>
        </div>
      </header>

  {/* KPI Alerts */}
  <AlertBanner kpi={kpi} loading={isLoading} />

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5" aria-label="شاخص‌های کلیدی مالی">
        {cards.map(c => (
          <StatCard
            key={c.title}
            title={c.title}
            value={c.value}
            description={c.desc}
            loading={isLoading}
            trend={c.trend}
          />
        ))}
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-12">
        {/* Upload & Processing */}
        <div className="xl:col-span-4 space-y-4">
          <div className="rounded-lg border p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">بارگذاری JSON</h2>
            <UploadZone onFileAccepted={(f) => selectFile(f)} disabled={phase !== 'idle' && phase !== 'success' && phase !== 'error'} />
            <div className="mt-4 space-y-3">
              {issues.length > 0 && <FileValidationList issues={issues} />}
              
              {/* نمایش Live Monitor اگر jobCode موجود باشد */}
              {jobCode && (phase === 'uploading' || phase === 'processing') && (
                <LiveProcessingMonitor 
                  jobCode={jobCode}
                  onComplete={() => {
                    console.log('✅ پردازش با موفقیت تکمیل شد');
                    resetUpload(); // Reset بعد از تکمیل موفق
                  }}
                  onError={(err) => {
                    console.error('❌ خطای پردازش:', err);
                  }}
                />
              )}

              {/* Fallback Progress Bar برای حالات قدیمی */}
              {!jobCode && (phase === 'uploading' || phase === 'processing' || phase === 'success' || phase === 'partial') && (
                <ProcessingProgressBar percent={percent} phase={phase} />
              )}
              
              <UploadErrorPanel error={error} onReset={resetUpload} />
              {phase === 'success' && (
                <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded px-3 py-2">
                  ✓ فایل با موفقیت پردازش شد
                </div>
              )}
              {phase === 'partial' && (
                <div className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                  ⚠ فایل با موفقیت پردازش شد اما برخی موارد نادیده گرفته شدند
                </div>
              )}
              {(phase === 'success' || phase === 'error' || phase === 'partial') && (
                <button onClick={resetUpload} className="w-full mt-2 text-xs px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
                  شروع مجدد
                </button>
              )}
            </div>
          </div>
          <QuickActionsPanel role={'ADMIN'} />
          <div className="rounded-lg border p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3">فعالیت اخیر</h2>
            {activityLoading && <ActivityFeed items={[]} loading />}
            {!activityLoading && (
              <VirtualizedActivityFeed items={(recentActivity as ActivityItem[]) || []} height={300} />
            )}
          </div>
        </div>
        {/* Placeholder برای نمودارها */}
        <div className="xl:col-span-8 space-y-4">
          <div className="rounded-lg border p-4 h-72 bg-card flex flex-col">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">بارگذاری ماژول نمودار درآمد...</div>}>
              <RevenueTrendChart window="24h" />
            </Suspense>
          </div>
          <div className="rounded-lg border p-4 h-72 bg-card flex flex-col">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">بارگذاری ماژول نمودار سررسید...</div>}>
              <AgingBucketChart />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
