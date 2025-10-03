/**
 * 🕐 Overdue Invoice Auto-Update Service
 * Scheduled Job for automatic invoice status update
 * 
 * فلسفه: فاکتورهایی که due_date آن‌ها گذشته و هنوز unpaid هستند، باید خودکار به overdue تبدیل شوند
 * 
 * Schedule: هر روز ساعت 00:00 (midnight) اجرا می‌شود
 */

import { db } from '../database-manager.js';
import { eq, and, lte, sql } from 'drizzle-orm';
import { invoices } from '../../shared/schema.js';
import cron from 'node-cron';
import { dashboardEventsService } from './dashboard-events-service.js';

// ✅ REMOVED: ConsolidatedFinancialSummaryService (5 widgets removed)

class OverdueInvoiceService {
  private isRunning: boolean = false;
  private lastRunTime: Date | null = null;
  private scheduledJobId: NodeJS.Timeout | null = null;

  /**
   * تبدیل خودکار فاکتورهای unpaid با due_date گذشته به overdue
   */
  async updateOverdueInvoices(): Promise<{
    updated: number;
    invoiceIds: number[];
    timestamp: string;
  }> {
    if (this.isRunning) {
      console.warn('⚠️ Overdue update job already running, skipping...');
      return { updated: 0, invoiceIds: [], timestamp: new Date().toISOString() };
    }

    this.isRunning = true;
    console.log('🕐 Starting overdue invoice auto-update job...');

    try {
      // پیدا کردن فاکتورهای unpaid که due_date آن‌ها گذشته
      const overdueInvoices = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.status, 'unpaid'),
            sql`${invoices.dueDate} < CURRENT_DATE` // فقط تاریخ‌های گذشته
          )
        );

      const invoiceIds = overdueInvoices.map(inv => inv.id);
      
      if (invoiceIds.length === 0) {
        console.log('✅ No unpaid invoices past due date found');
        this.lastRunTime = new Date();
        return { updated: 0, invoiceIds: [], timestamp: this.lastRunTime.toISOString() };
      }

      console.log(`📋 Found ${invoiceIds.length} invoices to mark as overdue:`, invoiceIds);

      // بروزرسانی وضعیت به overdue
      const result = await db
        .update(invoices)
        .set({ 
          status: 'overdue',
          updatedAt: new Date() // اگر ستون updatedAt داشته باشیم
        })
        .where(
          and(
            eq(invoices.status, 'unpaid'),
            sql`${invoices.dueDate} < CURRENT_DATE`
          )
        );

      console.log(`✅ Successfully updated ${invoiceIds.length} invoices to overdue status`);

      // 🔄 REAL-TIME DASHBOARD UPDATE: Notify overdue count change (simplified - widgets removed)
      dashboardEventsService.notifyInvoiceChange(
        invoiceIds[0], // نماینده یکی از فاکتورها (برای metadata)
        0, // totalDebt removed  
        invoiceIds.length // overdue count
      );

      console.log(`📡 Dashboard SSE: Overdue invoices update broadcasted (${invoiceIds.length} invoices) - minimal data`);


      this.lastRunTime = new Date();
      
      return {
        updated: invoiceIds.length,
        invoiceIds,
        timestamp: this.lastRunTime.toISOString()
      };

    } catch (error) {
      console.error('❌ Error in overdue invoice update job:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * شروع scheduled job (هر روز ساعت 00:00)
   */
  startScheduledJob(): void {
    // محاسبه زمان تا midnight بعدی
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // ساعت 00:00:00
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    console.log(`⏰ Scheduling first overdue check in ${Math.round(msUntilMidnight / 1000 / 60)} minutes (at midnight)`);

    // اجرای اولیه در midnight بعدی
    setTimeout(() => {
      this.updateOverdueInvoices();
      
      // سپس هر 24 ساعت یکبار تکرار
      this.scheduledJobId = setInterval(() => {
        this.updateOverdueInvoices();
      }, 24 * 60 * 60 * 1000); // هر 24 ساعت
      
    }, msUntilMidnight);

    console.log('✅ Overdue invoice auto-update job scheduled (daily at midnight)');
  }

  /**
   * توقف scheduled job
   */
  stopScheduledJob(): void {
    if (this.scheduledJobId) {
      clearInterval(this.scheduledJobId);
      this.scheduledJobId = null;
      console.log('🛑 Overdue invoice auto-update job stopped');
    }
  }

  /**
   * اجرای دستی (برای تست یا admin trigger)
   */
  async runManually(): Promise<{
    updated: number;
    invoiceIds: number[];
    timestamp: string;
  }> {
    console.log('🔧 Manual overdue invoice update triggered');
    return this.updateOverdueInvoices();
  }

  /**
   * دریافت وضعیت فعلی job
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime?.toISOString() || null,
      isScheduled: this.scheduledJobId !== null,
      nextRunTime: this.calculateNextRunTime()
    };
  }

  private calculateNextRunTime(): string | null {
    if (!this.scheduledJobId) return null;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    return tomorrow.toISOString();
  }
}

// Singleton instance
export const overdueInvoiceService = new OverdueInvoiceService();

// Auto-start on import (در production)
if (process.env.NODE_ENV === 'production') {
  overdueInvoiceService.startScheduledJob();
} else {
  console.log('ℹ️ Overdue job NOT auto-started in development mode. Use overdueInvoiceService.startScheduledJob() manually.');
}

export default overdueInvoiceService;
