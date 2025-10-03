import React from 'react';
import { RefreshCcw } from 'lucide-react';
import { useImportJobs } from '@/services/import-jobs';
import { JobProgress } from '@/components/JobProgress';
import type { ImportJob } from '@/services/import-jobs';
import { STEP_LABELS } from '@/services/import-jobs';

export default function ImportJobsMonitor() {
  const { data, refetch, isFetching } = useImportJobs();

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
            <JobProgress job={job} showDetails={true} />
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
              <div><span className="text-gray-400">وضعیت:</span> {STEP_LABELS[job.status] || job.status}</div>
              <div><span className="text-gray-400">خطاها:</span> {job.errorCount}</div>
              <div className="col-span-2"><span className="text-gray-400">فایل:</span> {job.sourceFileName || '—'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
