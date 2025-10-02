// Phase C: E-C1 Telegram Outbox Service
// Purpose: تضمین تحویل پیام‌های تلگرام با retry mechanism و KPI tracking

import { db } from '../db.js';
import { outbox, guardMetricsEvents } from '../../shared/schema.js';
import { eq, and, lte, or, inArray, gte, sql } from 'drizzle-orm';

export interface OutboxMessage {
  type: 'TELEGRAM_MESSAGE' | 'EMAIL' | 'WEBHOOK';
  payload: {
    recipient: string;
    message: string;
    options?: Record<string, any>;
  };
}

export interface OutboxMetrics {
  totalMessages: number;
  sentMessages: number;
  failedMessages: number;
  pendingMessages: number;
  successRate: number;
  avgRetryCount: number;
}

export class OutboxService {
  private readonly MAX_RETRY_COUNT = 5;
  private readonly INITIAL_RETRY_DELAY = 30000; // 30 seconds
  private readonly MAX_RETRY_DELAY = 3600000; // 1 hour

  /**
   * ارسال پیام جدید به outbox برای پردازش
   */
  async enqueueMessage(message: OutboxMessage): Promise<number> {
    try {
      const [inserted] = await db.insert(outbox).values({
        type: message.type,
        payload: message.payload,
        status: 'PENDING',
        retryCount: 0,
        nextRetryAt: null
      }).returning({ id: outbox.id });

      // ثبت متریک در guard metrics
      await this.recordMetric('OUTBOX_MESSAGE_ENQUEUED', { type: message.type });
      
      return inserted.id;
    } catch (error: any) {
      await this.recordMetric('OUTBOX_ENQUEUE_ERROR', { error: error.message });
      throw new Error(`Failed to enqueue message: ${error.message}`);
    }
  }

  /**
   * دریافت پیام‌های آماده برای پردازش
   */
  async getReadyMessages(limit: number = 10): Promise<any[]> {
    const now = new Date();
    
    return await db.select()
      .from(outbox)
      .where(
        and(
          or(
            eq(outbox.status, 'PENDING'),
            and(
              eq(outbox.status, 'FAILED'),
              lte(outbox.nextRetryAt, now)
            )
          ),
          lte(outbox.retryCount, this.MAX_RETRY_COUNT)
        )
      )
      .orderBy(outbox.createdAt)
      .limit(limit);
  }

  /**
   * علامت‌گذاری پیام به عنوان در حال پردازش
   */
  async markAsProcessing(messageId: number): Promise<void> {
    await db.update(outbox)
      .set({ 
        status: 'PROCESSING',
        processedAt: new Date()
      })
      .where(eq(outbox.id, messageId));
  }

  /**
   * علامت‌گذاری پیام به عنوان ارسال شده
   */
  async markAsSent(messageId: number): Promise<void> {
    await db.update(outbox)
      .set({ 
        status: 'SENT',
        processedAt: new Date()
      })
      .where(eq(outbox.id, messageId));

    await this.recordMetric('OUTBOX_MESSAGE_SENT', { messageId });
  }

  /**
   * علامت‌گذاری پیام به عنوان ناموفق با برنامه‌ریزی retry
   */
  async markAsFailed(messageId: number, error: string): Promise<void> {
    const message = await db.select()
      .from(outbox)
      .where(eq(outbox.id, messageId))
      .limit(1);

    if (message.length === 0) {
      throw new Error(`Message ${messageId} not found`);
    }

    const currentRetryCount = message[0].retryCount;
    const newRetryCount = currentRetryCount + 1;

    if (newRetryCount > this.MAX_RETRY_COUNT) {
      // تعداد retry بیش از حد مجاز - پیام را cancelled کن
      await db.update(outbox)
        .set({ 
          status: 'CANCELLED',
            errorLast: error,
          retryCount: newRetryCount
        })
        .where(eq(outbox.id, messageId));

      await this.recordMetric('OUTBOX_MESSAGE_CANCELLED', { messageId, error });
    } else {
      // برنامه‌ریزی retry با exponential backoff
      const nextRetryDelay = Math.min(
        this.INITIAL_RETRY_DELAY * Math.pow(2, currentRetryCount),
        this.MAX_RETRY_DELAY
      );
      const nextRetryAt = new Date(Date.now() + nextRetryDelay);

      await db.update(outbox)
        .set({ 
          status: 'FAILED',
          errorLast: error,
          retryCount: newRetryCount,
          nextRetryAt: nextRetryAt
        })
        .where(eq(outbox.id, messageId));

      await this.recordMetric('OUTBOX_MESSAGE_RETRY_SCHEDULED', { 
        messageId, 
        retryCount: newRetryCount,
        nextRetryAt: nextRetryAt.toISOString()
      });
    }
  }

  /**
   * دریافت آمار outbox برای KPI monitoring (کلی)
   */
  async getMetrics(): Promise<OutboxMetrics> {
    const results = await db.select({
      status: outbox.status,
      retryCount: outbox.retryCount
    }).from(outbox);

    const totalMessages = results.length;
    const sentMessages = results.filter(r => r.status === 'SENT').length;
    const failedMessages = results.filter(r => r.status === 'CANCELLED').length;
    const pendingMessages = results.filter(r => r.status === 'PENDING' || r.status === 'FAILED').length;
    
    const successRate = totalMessages > 0 ? (sentMessages / totalMessages) * 100 : 0;
    const avgRetryCount = totalMessages > 0 ? (results.reduce((sum, r) => sum + (r.retryCount || 0), 0) / totalMessages) : 0;

    return {
      totalMessages,
      sentMessages,
      failedMessages,
      pendingMessages,
      successRate,
      avgRetryCount
    };
  }

  /**
   * Rolling window metrics (failure_rate / avg_retry) برای بازه دقیقه‌ای
   */
  async getWindowMetrics(windowMinutes: number = 60): Promise<any> {
    const cutoff = new Date(Date.now() - windowMinutes * 60000);
    const rows = await db.select({
      status: outbox.status,
      retryCount: outbox.retryCount,
      createdAt: outbox.createdAt
    }).from(outbox).where(gte(outbox.createdAt, cutoff));

    const totalWindowMessages = rows.length;
    const sent = rows.filter(r => r.status === 'SENT').length;
    const cancelled = rows.filter(r => r.status === 'CANCELLED').length;
    const pending = rows.filter(r => r.status === 'PENDING' || r.status === 'FAILED' || r.status === 'PROCESSING').length;

    const successRateWindow = totalWindowMessages > 0 ? (sent / totalWindowMessages) * 100 : 0;
    const failureRateWindow = totalWindowMessages > 0 ? (cancelled / totalWindowMessages) * 100 : 0;
    const avgRetryWindow = totalWindowMessages > 0 ? (rows.reduce((s, r) => s + (r.retryCount || 0), 0) / totalWindowMessages) : 0;

    return {
      windowMinutes,
      from: cutoff.toISOString(),
      to: new Date().toISOString(),
      totalWindowMessages,
      sentWindowMessages: sent,
      cancelledWindowMessages: cancelled,
      pendingWindowMessages: pending,
      successRateWindow,
      failureRateWindow,
      avgRetryWindow
    };
  }

  /**
   * Latency percentiles (P50/P95) derived from guard_metrics_events OUTBOX_MESSAGE_LATENCY events
   * Uses Postgres percentile_cont for accuracy. Window in minutes.
   */
  async getLatencyPercentiles(windowMinutes: number = 60): Promise<{ windowMinutes: number; p50: number | null; p95: number | null; sampleSize: number; }> {
    try {
      const result: any = await db.execute(sql`SELECT
          percentile_cont(0.5) WITHIN GROUP (ORDER BY (context->>'ms')::numeric) AS p50,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY (context->>'ms')::numeric) AS p95,
          COUNT(*) AS cnt
        FROM guard_metrics_events
        WHERE event_type = 'OUTBOX_MESSAGE_LATENCY'
          AND created_at >= NOW() - INTERVAL '${sql.raw(windowMinutes.toString())} minutes';`);
      const row = (result as any).rows?.[0];
      return {
        windowMinutes,
        p50: row && row.p50 !== null ? Number(row.p50) : null,
        p95: row && row.p95 !== null ? Number(row.p95) : null,
        sampleSize: row ? Number(row.cnt) : 0
      };
    } catch (e) {
      await this.recordMetric('OUTBOX_LATENCY_PERCENTILE_ERROR', { error: (e as any).message });
      return { windowMinutes, p50: null, p95: null, sampleSize: 0 };
    }
  }

  /**
   * ثبت متریک در guard metrics system
   */
  private async recordMetric(eventType: string, context: Record<string, any> = {}): Promise<void> {
    try {
      await db.insert(guardMetricsEvents).values({
        eventType,
        level: 'info',
        context
      });
    } catch (error) {
      console.error('Failed to record outbox metric:', error);
    }
  }

  /**
   * پاک‌سازی پیام‌های قدیمی (برای بهینه‌سازی فضای دیتابیس)
   */
  async cleanupOldMessages(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const deletedMessages = await db.delete(outbox)
      .where(
        and(
          inArray(outbox.status, ['SENT', 'CANCELLED']),
          lte(outbox.createdAt, cutoffDate)
        )
      )
      .returning({ id: outbox.id });

    await this.recordMetric('OUTBOX_CLEANUP_COMPLETED', { 
      deletedCount: deletedMessages.length,
      cutoffDate: cutoffDate.toISOString()
    });

    return deletedMessages.length;
  }
}