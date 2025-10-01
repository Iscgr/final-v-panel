/**
 * Hook برای Upload Debounce
 * استفاده آسان از debounced upload operations
 */

import { useState, useCallback, useEffect } from 'react';
import uploadDebounceService, { 
  type BatchUploadItem, 
  type UploadDebounceConfig 
} from '../services/upload-debounce-service';
import { useDebounce } from './use-debounce';

export interface UseUploadDebounceOptions {
  /** تنظیمات debounce */
  config?: Partial<UploadDebounceConfig>;
  /** callback برای تغییرات batch */
  onBatchChange?: (items: BatchUploadItem[]) => void;
  /** callback برای تکمیل upload */
  onUploadComplete?: (item: BatchUploadItem) => void;
  /** callback برای خطا */
  onError?: (item: BatchUploadItem, error: string) => void;
  /** پردازش خودکار فایل‌های معتبر */
  autoProcess?: boolean;
}

export function useUploadDebounce(options: UseUploadDebounceOptions = {}) {
  const [batchItems, setBatchItems] = useState<BatchUploadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState(uploadDebounceService.getStats());

  // Debounced stats update
  const updateStats = useDebounce(
    () => setStats(uploadDebounceService.getStats()),
    { delay: 100 }
  );

  // Update config if provided
  useEffect(() => {
    if (options.config) {
      uploadDebounceService.updateConfig(options.config);
    }
  }, [options.config]);

  // Subscribe to batch changes
  useEffect(() => {
    const unsubscribe = uploadDebounceService.addListener((items) => {
      setBatchItems(items);
      updateStats();
      
      // Call external callback
      options.onBatchChange?.(items);

      // Check for completed/failed items
      items.forEach(item => {
        if (item.status === 'completed') {
          options.onUploadComplete?.(item);
        } else if (item.status === 'failed') {
          options.onError?.(item, item.error || 'Unknown error');
        }
      });

      // Auto-process valid items if enabled
      if (options.autoProcess) {
        const validItems = items.filter(item => item.status === 'valid');
        if (validItems.length > 0) {
          processBatch();
        }
      }
    });

    return unsubscribe;
  }, [options, updateStats]);

  /**
   * افزودن فایل‌ها به batch
   */
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const uploadPromises = fileArray.map(file => 
      uploadDebounceService.addFileToBatch(file)
    );
    
    const itemIds = await Promise.all(uploadPromises);
    return itemIds;
  }, []);

  /**
   * افزودن یک فایل
   */
  const addFile = useCallback(async (file: File) => {
    return await uploadDebounceService.addFileToBatch(file);
  }, []);

  /**
   * شروع پردازش batch
   */
  const processBatch = useCallback(async () => {
    setIsProcessing(true);
    try {
      await uploadDebounceService.startBatchProcessing();
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * لغو مورد خاص
   */
  const cancelItem = useCallback((itemId: string) => {
    uploadDebounceService.cancelItem(itemId);
  }, []);

  /**
   * پاک‌سازی همه موارد
   */
  const clearAll = useCallback(() => {
    uploadDebounceService.clearAll();
    setIsProcessing(false);
  }, []);

  /**
   * دریافت مورد خاص
   */
  const getItem = useCallback((itemId: string) => {
    return batchItems.find(item => item.id === itemId);
  }, [batchItems]);

  /**
   * فیلتر موارد بر اساس وضعیت
   */
  const getItemsByStatus = useCallback((status: BatchUploadItem['status']) => {
    return batchItems.filter(item => item.status === status);
  }, [batchItems]);

  /**
   * بررسی امکان پردازش
   */
  const canProcess = useCallback(() => {
    return stats.valid > 0 && !isProcessing;
  }, [stats.valid, isProcessing]);

  /**
   * بررسی وجود خطا
   */
  const hasErrors = useCallback(() => {
    return stats.invalid > 0 || stats.failed > 0;
  }, [stats.invalid, stats.failed]);

  /**
   * درصد پیشرفت کل
   */
  const overallProgress = useCallback(() => {
    if (batchItems.length === 0) return 0;
    
    const totalProgress = batchItems.reduce((sum, item) => {
      if (item.status === 'completed') return sum + 100;
      if (item.status === 'uploading') return sum + (item.progress || 0);
      if (item.status === 'valid') return sum + 50;
      if (item.status === 'validating') return sum + 25;
      return sum;
    }, 0);
    
    return Math.round(totalProgress / batchItems.length);
  }, [batchItems]);

  /**
   * خلاصه وضعیت
   */
  const getSummary = useCallback(() => {
    const summary = {
      totalFiles: stats.total,
      validFiles: stats.valid,
      invalidFiles: stats.invalid,
      completedFiles: stats.completed,
      failedFiles: stats.failed,
      isProcessing,
      canProcess: canProcess(),
      hasErrors: hasErrors(),
      overallProgress: overallProgress()
    };

    return summary;
  }, [stats, isProcessing, canProcess, hasErrors, overallProgress]);

  return {
    // State
    batchItems,
    isProcessing,
    stats,

    // Actions
    addFile,
    addFiles,
    processBatch,
    cancelItem,
    clearAll,

    // Getters
    getItem,
    getItemsByStatus,
    getSummary,

    // Status checks
    canProcess,
    hasErrors,
    overallProgress
  };
}

export default useUploadDebounce;