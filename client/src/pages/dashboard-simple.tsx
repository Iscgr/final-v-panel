import { useQuery } from "@tanstack/react-query";
import { useSectionMountLogger } from "../services/observability-service";
import WebWorkerTest from "../components/WebWorkerTest";
import DebounceTest from "../components/DebounceTest";

interface DashboardData {
  summary: {
    totalRevenue: number;
    totalDebt: number;
    totalCredit: number;
    totalOutstanding: number;
    totalRepresentatives: number;
    activeRepresentatives: number;
    totalInvoices: number;
    paidInvoices: number;
    unpaidInvoices: number;
    overdueInvoices: number;
    systemIntegrityScore: number;
  };
}

async function fetchDashboard(): Promise<DashboardData> {
  const response = await fetch('/api/dashboard');
  if (!response.ok) {
    throw new Error('خطا در بارگذاری داده‌های داشبورد');
  }
  return response.json();
}

function StatCard({ title, value, description }: { title: string; value: string | number; description?: string }) {
  return (
    <div className="bg-white p-6 rounded-lg border shadow-sm">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      {description && <p className="text-sm text-gray-600">{description}</p>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-200 h-24 rounded-lg"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  useSectionMountLogger('dashboard');
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 60_000,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">خطا در بارگذاری</h2>
          <p className="text-red-600">
            {error instanceof Error ? error.message : 'خطای نامشخص رخ داده است'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">داشبورد مدیریت</h1>
        <p className="text-gray-600 mt-2">نمای کلی از وضعیت مالی و عملکرد سیستم</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="کل درآمد"
          value={`${data?.summary.totalRevenue?.toLocaleString('fa-IR') || '0'} ریال`}
          description="مجموع درآمدهای تخصیص یافته"
        />
        
        <StatCard
          title="کل بدهی"
          value={`${data?.summary.totalDebt?.toLocaleString('fa-IR') || '0'} ریال`}
          description="مجموع بدهی‌های سیستم"
        />
        
        <StatCard
          title="کل اعتبار"
          value={`${data?.summary.totalCredit?.toLocaleString('fa-IR') || '0'} ریال`}
          description="پرداخت‌های تخصیص نیافته"
        />
        
        <StatCard
          title="مطالبات معوق"
          value={`${data?.summary.totalOutstanding?.toLocaleString('fa-IR') || '0'} ریال`}
          description="فاکتورهای پرداخت نشده"
        />
        
        <StatCard
          title="نمایندگان"
          value={`${data?.summary.activeRepresentatives || 0} / ${data?.summary.totalRepresentatives || 0}`}
          description="فعال / کل نمایندگان"
        />
        
        <StatCard
          title="فاکتورهای پرداخت شده"
          value={`${data?.summary.paidInvoices || 0}`}
          description={`از ${data?.summary.totalInvoices || 0} فاکتور کل`}
        />
        
        <StatCard
          title="فاکتورهای معوق"
          value={`${data?.summary.overdueInvoices || 0}`}
          description="نیاز به پیگیری فوری"
        />
        
        <StatCard
          title="امتیاز سلامت سیستم"
          value={`${data?.summary.systemIntegrityScore || 0}%`}
          description="وضعیت کلی سیستم"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">📊 Observability فعال</h3>
          <p className="text-blue-600">
            سیستم نظارت و لاگ‌گیری فعال است. تمام عملیات upload و lifecycle بررسی و ثبت می‌شود.
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-green-800 mb-2">🔧 Web Worker آماده</h3>
          <p className="text-green-600">
            سیستم Web Worker برای پردازش فایل‌های JSON و PFX فعال و آماده است.
          </p>
        </div>
      </div>

      {/* Web Worker Test Component */}
      <WebWorkerTest />
      
      {/* Debounce Test Component */}
      <div className="mt-6">
        <DebounceTest />
      </div>
    </div>
  );
}