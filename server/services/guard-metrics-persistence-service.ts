import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { featureFlagManager } from './feature-flag-manager.js';

interface PendingEvent {
  type: string;
  level?: string;
  context?: any;
  ts: number;
}

/**
 * GuardMetricsPersistenceService
 * مرحله ۱ Persist: ذخیره رویدادهای گارد در جدول guard_metrics_events با صف in-memory.
 * حالت‌های فلگ guard_metrics_persistence:
 *   off: هیچ Persist ای انجام نمی‌شود.
 *   shadow: رویدادها در پس‌زمینه ذخیره می‌شوند اما summary در API اصلی استفاده نمی‌شود.
 *   enforce: summary persisted در خروجی API گنجانده می‌شود.
 */
class GuardMetricsPersistenceServiceClass {
  private queue: PendingEvent[] = [];
  private flushing = false;
  private flushIntervalMs = 15000; // هر ۱۵ ثانیه فلش
  private maxBatch = 200;
  private lastFlushError?: string;

  constructor() {
    setInterval(() => this.flushSafe(), this.flushIntervalMs).unref();
  }

  enqueue(type: string, level?: string, context?: any) {
    const state = featureFlagManager.getMultiStageFlagState('guard_metrics_persistence');
    if (state === 'off') return; // کاملاً غیرفعال
    this.queue.push({ type, level, context, ts: Date.now() });
    if (this.queue.length >= this.maxBatch) {
      this.flushSafe();
    }
  }

  async flushImmediate() {
    await this.flush();
  }

  private async flushSafe() {
    try { await this.flush(); } catch (e:any) { this.lastFlushError = e.message; }
  }

  private async flush() {
    if (this.flushing) return;
    if (this.queue.length === 0) return;
    this.flushing = true;
    const batch = this.queue.splice(0, this.maxBatch);
    try {
      // ساخت VALUES statement
      const values = batch.map(ev => sql`(${ev.type}, ${ev.level || null}, ${JSON.stringify(ev.context||null)}, to_timestamp(${Math.floor(ev.ts/1000)}) )`);
      // drizzle-orm محدودیت دارد؛ اجرای raw
      const insert = sql`INSERT INTO guard_metrics_events (event_type, level, context, created_at) VALUES ${sql.join(values, sql`, `)}`;
      await db.execute(insert);
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Summary ساده: شمارش بر اساس نوع در بازه اخیر (windowMinutes)
   */
  async getSummary(windowMinutes: number) {
    // از اینترپولیشن مستقیم داخل INTERVAL اجتناب می‌کنیم تا هم از نظر امنیتی ایمن‌تر باشد
    // و هم از بروز خطای احتمالی 08P01 (protocol violation در bind) جلوگیری شود.
    // الگو: NOW() - (<minutes>::int * interval '1 minute')
    const rows: any = await db.execute(sql`
      SELECT event_type, COUNT(*) AS c
      FROM guard_metrics_events
      WHERE created_at >= NOW() - (${windowMinutes}::int * interval '1 minute')
      GROUP BY event_type
    `);
    const out: Record<string, number> = {};
    for (const r of (rows as any).rows || []) {
      out[r.event_type] = Number(r.c);
    }
    return out;
  }

  /**
   * بازگرداندن شمارش چندگانه برای پنجره‌های مختلف در یک round-trip
   */
  async getMultiWindowSummary(windowsMinutes: number[]) {
    const result: Record<number, Record<string, number>> = {};
    for (const w of windowsMinutes) {
      result[w] = await this.getSummary(w);
    }
    return result;
  }

  getLastFlushError() { return this.lastFlushError; }
}

export const GuardMetricsPersistenceService = new GuardMetricsPersistenceServiceClass();
