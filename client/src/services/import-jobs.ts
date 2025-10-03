/**
 * Import Jobs Service
 * مدیریت مرکزی ارتباط با API import-jobs برای پیگیری پردازش فایل‌های JSON
 */

import { useQuery } from '@tanstack/react-query';

export interface ImportJob {
  id: number;
  jobCode: string;
  sourceFileName: string | null;
  status: 'pending' | 'validating' | 'ingesting' | 'enriching' | 'completed' | 'failed';
  totalRecords: number;
  processedRecords: number;
  errorCount: number;
  startedAt: string;
  finishedAt: string | null;
  lastError: string | null;
}

export const STATUS_ORDER = ['pending', 'validating', 'ingesting', 'enriching', 'completed', 'failed'] as const;

export const STEP_LABELS: Record<string, string> = {
  pending: 'در صف',
  validating: 'اعتبارسنجی',
  ingesting: 'ورود دیتا',
  enriching: 'غنی‌سازی',
  completed: 'تکمیل',
  failed: 'شکست'
};

/**
 * ایجاد یک job جدید در سرور
 */
export async function createImportJob(params: {
  jobCode: string;
  sourceFileName?: string;
  totalRecords?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/admin/import-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobCode: params.jobCode,
        sourceFileName: params.sourceFileName || null,
        totalRecords: params.totalRecords || 0
      })
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to create import job:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * بروزرسانی وضعیت یک job
 */
export async function updateImportJob(
  jobCode: string,
  updates: {
    status?: ImportJob['status'];
    processedRecords?: number;
    errorIncrement?: number;
    lastError?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/admin/import-jobs/${jobCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to update import job:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Hook برای polling وضعیت یک job خاص (استفاده در Modal آپلود)
 */
export function useImportJobPolling(jobCode: string | null, enabled: boolean = true) {
  return useQuery<ImportJob | null>({
    queryKey: ['/api/admin/import-jobs', jobCode],
    queryFn: async () => {
      if (!jobCode) return null;
      const response = await fetch('/api/admin/import-jobs');
      const data = await response.json();
      if (!data.success) return null;
      const jobs: ImportJob[] = data.data || [];
      return jobs.find(j => j.jobCode === jobCode) || null;
    },
    enabled: enabled && !!jobCode,
    refetchInterval: (query) => {
      const job = query.state.data;
      // اگر تکمیل شد یا شکست خورد، polling متوقف شود
      if (!job || job.status === 'completed' || job.status === 'failed') {
        return false;
      }
      return 3000; // هر 3 ثانیه polling
    },
    retry: 2
  });
}

/**
 * Hook برای لیست همه job ها (استفاده در صفحه مانیتور)
 */
export function useImportJobs() {
  return useQuery<{ success: boolean; data: ImportJob[] }>({
    queryKey: ['/api/admin/import-jobs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/import-jobs');
      return res.json();
    },
    refetchInterval: 4000
  });
}

/**
 * محاسبه درصد پیشرفت بر اساس وضعیت و تعداد رکوردها
 */
export function calculateProgress(job: ImportJob | null): number {
  if (!job) return 0;
  
  // اگر تکمیل شده 100%
  if (job.status === 'completed') return 100;
  
  // اگر شکست خورده، بر اساس رکوردهای پردازش شده
  if (job.status === 'failed') {
    if (job.totalRecords === 0) return 0;
    return Math.min(Math.floor((job.processedRecords / job.totalRecords) * 100), 99);
  }
  
  // محاسبه بر اساس مرحله و رکوردهای پردازش شده
  const stageIndex = STATUS_ORDER.indexOf(job.status);
  const stageWeight = stageIndex / (STATUS_ORDER.length - 2); // از pending تا enriching
  
  if (job.totalRecords > 0 && job.processedRecords > 0) {
    const recordProgress = job.processedRecords / job.totalRecords;
    return Math.min(Math.floor((stageWeight * 40 + recordProgress * 60)), 99);
  }
  
  // فقط بر اساس مرحله
  return Math.floor(stageWeight * 100);
}
