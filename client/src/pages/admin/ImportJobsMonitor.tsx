import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCcw } from 'lucide-react';

interface ImportJob {
  id: number;
  jobCode: string;
  sourceFileName: string | null;
  status: string;
  totalRecords: number;
  processedRecords: number;
  errorCount: number;
  startedAt: string;
  finishedAt: string | null;
  lastError: string | null;
}

const STATUS_ORDER = ['pending','validating','ingesting','enriching','completed','failed'];
const STEP_LABELS: Record<string,string> = {
  pending: 'در صف',
  validating: 'اعتبارسنجی',
  ingesting: 'ورود دیتا',
  enriching: 'غنی‌سازی',
  completed: 'تکمیل',
  failed: 'شکست'
};

function JobProgress({ job }: { job: ImportJob }) {
  const currentIndex = STATUS_ORDER.indexOf(job.status);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-gray-600">
        <span>{job.jobCode}</span>
        <span className="font-mono">{job.processedRecords}/{job.totalRecords}</span>
      </div>
      <div className="flex items-center gap-1">
        {STATUS_ORDER.map((s, idx) => {
          const active = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          const failed = job.status === 'failed' && s === 'failed';
          return (
            <div key={s} className={`flex-1 h-2 rounded ${failed ? 'bg-red-500 animate-pulse' : active ? 'bg-blue-600' : 'bg-gray-200'} ${isCurrent && !failed ? 'shadow-inner' : ''}`}></div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] mt-1 text-gray-500">
        {STATUS_ORDER.map(s => (
          <span key={s} className={job.status === s ? 'text-blue-600 font-medium' : ''}>{STEP_LABELS[s]}</span>
        ))}
      </div>
      {job.lastError && <div className="text-[10px] text-red-600 line-clamp-2">Err: {job.lastError}</div>}
    </div>
  );
}

export default function ImportJobsMonitor() {
  const { data, refetch, isFetching } = useQuery<{ success: boolean; data: ImportJob[] }>({
    queryKey: ['/api/admin/import-jobs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/import-jobs');
      return res.json();
    },
    refetchInterval: 4000
  });

  const jobs = data?.data || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مانیتور پردازش فایل‌ها</h1>
          <p className="text-xs text-gray-500">Validating → Ingesting → Enriching → Completed</p>
        </div>
        <button onClick={() => refetch()} className="px-3 py-1.5 text-xs rounded border flex items-center gap-1 bg-white hover:bg-gray-50">
          <RefreshCcw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} /> بروزرسانی
        </button>
      </div>

      {!jobs.length && (
        <div className="text-sm text-gray-500 border border-dashed rounded p-8 text-center bg-white">هیچ Job فعالی وجود ندارد</div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {jobs.map(job => (
          <div key={job.id} className="bg-white border rounded-lg p-4 shadow-sm space-y-3">
            <JobProgress job={job} />
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
              <div><span className="text-gray-400">وضعیت:</span> {STEP_LABELS[job.status]||job.status}</div>
              <div><span className="text-gray-400">خطاها:</span> {job.errorCount}</div>
              <div className="col-span-2"><span className="text-gray-400">فایل:</span> {job.sourceFileName || '—'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
