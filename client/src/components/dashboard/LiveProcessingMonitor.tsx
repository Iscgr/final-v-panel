/**
 * LiveProcessingMonitor Component
 * نمایش real-time پیشرفت پردازش فایل با اتصال به Import Jobs API
 * 
 * این کامپوننت جایگزین شبیه‌سازی قدیمی می‌شود و مستقیماً از job tracking واقعی استفاده می‌کند
 */

import React, { useEffect } from 'react';
import { useImportJobPolling, calculateProgress } from '@/services/import-jobs';
import { JobProgress } from '@/components/JobProgress';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface LiveProcessingMonitorProps {
  jobCode: string | null;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function LiveProcessingMonitor({ jobCode, onComplete, onError }: LiveProcessingMonitorProps) {
  const { data: job, isLoading } = useImportJobPolling(jobCode, !!jobCode);

  // Notify parent when job completes
  useEffect(() => {
    if (job?.status === 'completed' && onComplete) {
      onComplete();
    }
    if (job?.status === 'failed' && onError) {
      onError(job.lastError || 'پردازش با خطا مواجه شد');
    }
  }, [job?.status, onComplete, onError]);

  if (!jobCode || isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-4">
        <Clock className="w-4 h-4 animate-pulse" />
        <span>در حال آماده‌سازی...</span>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
        <AlertCircle className="w-4 h-4" />
        <span>Job یافت نشد</span>
      </div>
    );
  }

  const progress = calculateProgress(job);

  return (
    <div className="space-y-3 bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span className="font-medium">پردازش فایل: {job.sourceFileName || 'بدون نام'}</span>
        <span className="font-mono">{progress}%</span>
      </div>

      <JobProgress job={job} showDetails={true} />

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t text-[10px] text-gray-600">
        <div className="text-center">
          <div className="text-gray-500">کل رکوردها</div>
          <div className="font-semibold text-sm">{job.totalRecords.toLocaleString('fa-IR')}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">پردازش شده</div>
          <div className="font-semibold text-sm text-blue-600">{job.processedRecords.toLocaleString('fa-IR')}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">خطاها</div>
          <div className={`font-semibold text-sm ${job.errorCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {job.errorCount.toLocaleString('fa-IR')}
          </div>
        </div>
      </div>

      {/* Status badge */}
      {job.status === 'completed' && (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>پردازش با موفقیت تکمیل شد</span>
        </div>
      )}

      {job.status === 'failed' && job.lastError && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium mb-1">خطا در پردازش</div>
            <div className="text-[10px] text-red-600">{job.lastError}</div>
          </div>
        </div>
      )}
    </div>
  );
}
