/**
 * DriftJobService
 * Job ساعتی (قابل تنظیم) برای اجرای محاسبه drift (shadow) و ثبت در reconciliation_runs (اگر پرچم فعال باشد).
 * Phase A → Passive (record only)
 */
import { ReconciliationService } from './reconciliation-service.js';
import { featureFlagManager } from './feature-flag-manager.js';

export class DriftJobService {
  private static timer: NodeJS.Timeout | null = null;
  private static intervalMs = 60 * 60 * 1000; // 1h پیش‌فرض

  /**
   * راه‌اندازی job اگر حالت dry یا enforce فعال باشد.
   */
  static start(intervalMs?: number) {
    if (intervalMs) this.intervalMs = intervalMs;
    if (this.timer) return; // already started
    this.schedule();
    console.log('⏱️ DriftJobService scheduled every', this.intervalMs / 1000, 'seconds');
  }

  static stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private static schedule() {
    this.timer = setTimeout(async () => {
      try {
        const state = featureFlagManager.getMultiStageFlagState('active_reconciliation');
        if (state === 'dry' || state === 'enforce') {
          await ReconciliationService.runShadowDriftCheck({ record: true });
        } else {
          // حالت off → عدم ثبت، ولی می‌توان future debug log داشت
        }
      } catch (e:any) {
        console.error('DriftJobService run failed:', e.message);
      } finally {
        this.schedule();
      }
    }, this.intervalMs);
  }
}

// امکان راه‌اندازی خودکار در import سطح بالا (اختیاری – فعلاً غیرفعال برای کنترل دستی)
// DriftJobService.start();
