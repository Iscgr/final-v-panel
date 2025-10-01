/**
 * Upload Debounce Service
 * مدیریت debounce برای عملیات upload و validation
 */

import { DebounceManager } from '../utils/debounce';
import { observabilityService } from './observability-service';

export interface UploadDebounceConfig {
  /** تاخیر validation فایل (پیش‌فرض: 300ms) */
  validationDelay?: number;
  /** تاخیر نمایش خطاها (پیش‌فرض: 500ms) */
  errorDisplayDelay?: number;
  /** تاخیر پردازش batch (پیش‌فرض: 1000ms) */
  batchProcessDelay?: number;
  /** حداکثر زمان انتظار (پیش‌فرض: 5000ms) */
  maxWait?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface BatchUploadItem {
  id: string;
  file: File;
  status: 'pending' | 'validating' | 'valid' | 'invalid' | 'uploading' | 'completed' | 'failed';
  validation?: ValidationResult;
  progress?: number;
  error?: string;
}

class UploadDebounceService {
  private debounceManager = new DebounceManager();
  private config: Required<UploadDebounceConfig>;
  private batchItems = new Map<string, BatchUploadItem>();
  private listeners = new Set<(items: BatchUploadItem[]) => void>();

  constructor(config: UploadDebounceConfig = {}) {
    this.config = {
      validationDelay: config.validationDelay || 300,
      errorDisplayDelay: config.errorDisplayDelay || 500,
      batchProcessDelay: config.batchProcessDelay || 1000,
      maxWait: config.maxWait || 5000
    };

    this.initializeDebouncedFunctions();
  }

  private initializeDebouncedFunctions() {
    // Debounced validation function
    this.debounceManager.get(
      'validate',
      this.validateSingleItem.bind(this),
      {
        delay: this.config.validationDelay,
        maxWait: this.config.maxWait
      }
    );

    // Debounced error display
    this.debounceManager.get(
      'showErrors',
      this.displayErrors.bind(this),
      {
        delay: this.config.errorDisplayDelay,
        trailing: true
      }
    );

    // Debounced batch processing
    this.debounceManager.get(
      'processBatch',
      this.processBatchItems.bind(this),
      {
        delay: this.config.batchProcessDelay,
        maxWait: this.config.maxWait
      }
    );
  }

  /**
   * افزودن فایل به batch برای validation
   */
  async addFileToBatch(file: File): Promise<string> {
    const id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const batchItem: BatchUploadItem = {
      id,
      file,
      status: 'pending'
    };

    this.batchItems.set(id, batchItem);
    this.notifyListeners();

    // Log start
    observabilityService.logUploadStart(file.size, `debounced:${file.name}`);

    // Trigger debounced validation
    this.scheduleValidation(id);

    return id;
  }

  /**
   * برنامه‌ریزی validation با debounce
   */
  private scheduleValidation(itemId: string) {
    const validateFunc = this.debounceManager.get(
      `validate_${itemId}`,
      () => this.validateSingleItem(itemId),
      {
        delay: this.config.validationDelay,
        maxWait: this.config.maxWait
      }
    );

    validateFunc();
  }

  /**
   * validation یک فایل
   */
  private async validateSingleItem(itemId: string): Promise<void> {
    const item = this.batchItems.get(itemId);
    if (!item || item.status !== 'pending') return;

    try {
      item.status = 'validating';
      this.notifyListeners();

      const validation = await this.validateFile(item.file);
      
      item.validation = validation;
      item.status = validation.isValid ? 'valid' : 'invalid';
      
      this.notifyListeners();

      // اگر خطا دارد، برنامه‌ریزی نمایش خطا
      if (!validation.isValid) {
        this.scheduleErrorDisplay(itemId);
      }

    } catch (error) {
      item.status = 'invalid';
      item.error = error instanceof Error ? error.message : 'خطا در اعتبارسنجی';
      this.notifyListeners();
    }
  }

  /**
   * اعتبارسنجی فایل
   */
  private async validateFile(file: File): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // بررسی نوع فایل
    const validExtensions = ['.json', '.csv', '.xlsx', '.pfx', '.p12'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      errors.push(`نوع فایل ${fileExtension} پشتیبانی نمی‌شود`);
      suggestions.push('فقط فایل‌های JSON، CSV، Excel و PFX مجاز هستند');
    }

    // بررسی اندازه فایل
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      errors.push(`اندازه فایل (${Math.round(file.size / 1024 / 1024)}MB) بیش از حد مجاز (50MB) است`);
    } else if (file.size > 10 * 1024 * 1024) {
      warnings.push(`فایل بزرگ است (${Math.round(file.size / 1024 / 1024)}MB)، پردازش ممکن است کند باشد`);
      suggestions.push('از Web Worker برای پردازش استفاده می‌شود');
    }

    // بررسی نام فایل
    if (file.name.length > 100) {
      warnings.push('نام فایل خیلی طولانی است');
    }

    if (!/^[\w\-. ]+$/.test(file.name)) {
      warnings.push('نام فایل شامل کاراکترهای ویژه است');
    }

    // شبیه‌سازی بررسی محتوا برای فایل‌های کوچک
    if (file.size < 1024 * 1024 && fileExtension === '.json') {
      try {
        const text = await file.text();
        JSON.parse(text);
        suggestions.push('فایل JSON معتبر است');
      } catch {
        errors.push('فایل JSON نامعتبر است');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * برنامه‌ریزی نمایش خطا با debounce
   */
  private scheduleErrorDisplay(itemId: string) {
    const showErrorsFunc = this.debounceManager.get(
      'showErrors',
      this.displayErrors.bind(this),
      {
        delay: this.config.errorDisplayDelay,
        trailing: true
      }
    );

    showErrorsFunc(itemId);
  }

  /**
   * نمایش خطاها
   */
  private async displayErrors(itemId: string): Promise<void> {
    const item = this.batchItems.get(itemId);
    if (!item || !item.validation || item.validation.isValid) return;

    // Log validation errors
    observabilityService.logUploadFail(
      'validation',
      `${item.validation.errors.length} validation errors`
    );

    console.group(`🔍 Validation Errors for ${item.file.name}`);
    item.validation.errors.forEach(error => console.error(`❌ ${error}`));
    item.validation.warnings.forEach(warning => console.warn(`⚠️ ${warning}`));
    item.validation.suggestions.forEach(suggestion => console.info(`💡 ${suggestion}`));
    console.groupEnd();
  }

  /**
   * شروع پردازش batch
   */
  async startBatchProcessing(): Promise<void> {
    const processBatchFunc = this.debounceManager.get(
      'processBatch',
      this.processBatchItems.bind(this),
      {
        delay: this.config.batchProcessDelay,
        maxWait: this.config.maxWait
      }
    );

    await processBatchFunc();
  }

  /**
   * پردازش موارد batch
   */
  private async processBatchItems(): Promise<void> {
    const validItems = Array.from(this.batchItems.values()).filter(
      item => item.status === 'valid'
    );

    if (validItems.length === 0) {
      console.log('🔄 No valid items to process');
      return;
    }

    console.log(`🚀 Processing ${validItems.length} valid items...`);

    for (const item of validItems) {
      await this.processItem(item);
    }
  }

  /**
   * پردازش یک مورد
   */
  private async processItem(item: BatchUploadItem): Promise<void> {
    try {
      item.status = 'uploading';
      item.progress = 0;
      this.notifyListeners();

      // شبیه‌سازی آپلود
      await this.simulateUpload(item);

      item.status = 'completed';
      item.progress = 100;
      this.notifyListeners();

      observabilityService.logUploadSuccess(1);

    } catch (error) {
      item.status = 'failed';
      item.error = error instanceof Error ? error.message : 'خطا در پردازش';
      this.notifyListeners();

      observabilityService.logUploadFail('processing', item.error);
    }
  }

  /**
   * شبیه‌سازی آپلود
   */
  private async simulateUpload(item: BatchUploadItem): Promise<void> {
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      item.progress = (i / steps) * 100;
      this.notifyListeners();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * لغو مورد
   */
  cancelItem(itemId: string): void {
    const item = this.batchItems.get(itemId);
    if (item) {
      // Cancel debounced operations for this item
      this.debounceManager.cancel(`validate_${itemId}`);
      
      this.batchItems.delete(itemId);
      this.notifyListeners();
    }
  }

  /**
   * پاک‌سازی همه موارد
   */
  clearAll(): void {
    this.debounceManager.clear();
    this.batchItems.clear();
    this.notifyListeners();
  }

  /**
   * دریافت وضعیت batch
   */
  getBatchItems(): BatchUploadItem[] {
    return Array.from(this.batchItems.values());
  }

  /**
   * اضافه کردن listener
   */
  addListener(callback: (items: BatchUploadItem[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * اطلاع‌رسانی به listeners
   */
  private notifyListeners(): void {
    const items = this.getBatchItems();
    this.listeners.forEach(callback => {
      try {
        callback(items);
      } catch (error) {
        console.error('Error in batch listener:', error);
      }
    });
  }

  /**
   * تنظیم config
   */
  updateConfig(newConfig: Partial<UploadDebounceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.debounceManager.clear();
    this.initializeDebouncedFunctions();
  }

  /**
   * آمار عملکرد
   */
  getStats() {
    const items = this.getBatchItems();
    return {
      total: items.length,
      pending: items.filter(i => i.status === 'pending').length,
      validating: items.filter(i => i.status === 'validating').length,
      valid: items.filter(i => i.status === 'valid').length,
      invalid: items.filter(i => i.status === 'invalid').length,
      uploading: items.filter(i => i.status === 'uploading').length,
      completed: items.filter(i => i.status === 'completed').length,
      failed: items.filter(i => i.status === 'failed').length,
      activeDebouncers: this.debounceManager.size
    };
  }
}

// Create singleton instance
export const uploadDebounceService = new UploadDebounceService();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).uploadDebounceService = uploadDebounceService;
}

export default uploadDebounceService;