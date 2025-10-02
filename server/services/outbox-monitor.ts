/**
 * OutboxMonitor (Phase C � E-C4 wiring)
 * Periodically evaluates Outbox rolling window metrics + latency percentiles
 * and emits guard_metrics_events when thresholds (warn/critical) are crossed.
 * 
 * Metrics mapped:
 *  - failureRateWindow  ? metric_code: outbox_failure_rate (percent)
 *  - avgRetryWindow     ? metric_code: outbox_avg_retry (average count)
 *  - p95 latency        ? metric_code: outbox_latency_p95 (milliseconds)
 *
 * Activation conditions:
 *  - featureFlagManager.getMultiStageFlagState('outbox_enabled') === 'on'
 *  - featureFlagManager.getMultiStageFlagState('guard_metrics_alerts') === 'on'
 *
 * Emission policy (anti-noise):
 *  - Only emit an event when level transitions: none ? warn, warn ? critical, critical ? warn (downgrade optional event),
 *    or value returns below warn (reset state silently).
 */
import { db } from '../db.js';
import { guardMetricsEvents } from '../../shared/schema.js';
import { featureFlagManager } from './feature-flag-manager.js';
import { OutboxService } from './outbox.js';
import { getThresholdFor } from './guard-metrics-thresholds.js';

interface MetricState {
  level: 'warn' | 'critical' | 'none';
  lastValue: number;
  lastEmittedAt: number;
}

export class OutboxMonitor {
  private intervalMs = 60_000; // 1 minute cadence (aligned with window semantics)
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private states: Record<string, MetricState> = {
    outbox_failure_rate: { level: 'none', lastValue: 0, lastEmittedAt: 0 },
    outbox_avg_retry: { level: 'none', lastValue: 0, lastEmittedAt: 0 },
    outbox_latency_p95: { level: 'none', lastValue: 0, lastEmittedAt: 0 }
  };

  constructor(private outboxService: OutboxService) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async loop() {
    if (!this.running) return;
    try {
      const outboxFlag = featureFlagManager.getMultiStageFlagState('outbox_enabled');
      const alertsFlag = featureFlagManager.getMultiStageFlagState('guard_metrics_alerts');
      if (outboxFlag === 'on' && alertsFlag === 'on') {
        await this.evaluateOnce();
      }
    } catch (e:any) {
      console.warn('OutboxMonitor evaluate error:', e.message);
    } finally {
      this.timer = setTimeout(() => this.loop(), this.intervalMs).unref();
    }
  }

  private async evaluateOnce() {
    // 1. Gather window metrics (60m) + latency percentiles
    const window = await this.outboxService.getWindowMetrics(60);
    const latency = await this.outboxService.getLatencyPercentiles(60);

    // Map values
    const values: Record<string, number | null> = {
      outbox_failure_rate: window.failureRateWindow,         // percent
      outbox_avg_retry: window.avgRetryWindow,               // average retry count
      outbox_latency_p95: latency.p95                        // ms (can be null if no sample)
    };

    for (const [metric, value] of Object.entries(values)) {
      if (value === null || Number.isNaN(value)) {
        // If no sample, reset state to none silently (prevents stale alerts lingering)
        if (this.states[metric].level !== 'none') {
          this.states[metric].level = 'none';
        }
        continue;
      }
      await this.processMetric(metric, value);
    }
  }

  private async processMetric(metric: string, currentValue: number) {
    const thresholds = getThresholdFor(metric);
    const state = this.states[metric];
    let newLevel: 'warn' | 'critical' | 'none' = 'none';
    if (currentValue >= thresholds.critical) newLevel = 'critical';
    else if (currentValue >= thresholds.warn) newLevel = 'warn';

    const transitioned = newLevel !== state.level;
    state.lastValue = currentValue;

    if (transitioned) {
      // Emit event only on transition (noise suppression)
      if (newLevel === 'none') {
        // Optional: emit recovery event (kept for audit clarity)
        await this.emitEvent(metric + '_RECOVERED', 'info', {
          previousLevel: state.level,
          value: currentValue,
          warn: thresholds.warn,
          critical: thresholds.critical
        });
      } else {
        await this.emitEvent(metric, newLevel, {
          value: currentValue,
          warn: thresholds.warn,
          critical: thresholds.critical,
          transition: state.level + '?' + newLevel
        });
      }
      state.level = newLevel;
      state.lastEmittedAt = Date.now();
    }
  }

  private async emitEvent(eventType: string, level: string, context: Record<string, any>) {
    try {
      await db.insert(guardMetricsEvents).values({
        eventType,
        level,
        context
      });
    } catch (e) {
      console.error('OutboxMonitor emit error:', (e as any).message);
    }
  }
}

export default OutboxMonitor;
