/**
 * MARFANET SLA DASHBOARD API v1.5 (E-C5)
 * 
 * هدف: Real-time monitoring dashboard برای Outbox SLA metrics
 * ویژگی‌ها:
 * - Latency percentiles (P50, P95, P99)
 * - Success rates and failure tracking
 * - Threshold violations alerting
 * - Historical trend analysis
 * - Live performance metrics
 */

import express from 'express';
import { eq, sql, desc, and, gte } from 'drizzle-orm';
import { db } from '../db.js';
import { outbox, guardMetricsEvents, thresholdConfig } from '../../shared/schema.js';

const router = express.Router();

/**
 * SLA Overview - کلیدی‌ترین متریک‌ها
 */
router.get('/sla/overview', async (req, res) => {
  try {
    const windowHours = parseInt(req.query.window as string) || 24;
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    // Outbox Success Rate
    const [outboxStats] = await db.select({
      total: sql<number>`COUNT(*)`,
      successful: sql<number>`COUNT(CASE WHEN ${outbox.status} = 'SENT' THEN 1 END)`,
      failed: sql<number>`COUNT(CASE WHEN ${outbox.status} = 'FAILED' THEN 1 END)`,
      pending: sql<number>`COUNT(CASE WHEN ${outbox.status} = 'PENDING' THEN 1 END)`,
      avgRetries: sql<number>`AVG(${outbox.retryCount})`,
      maxRetries: sql<number>`MAX(${outbox.retryCount})`
    })
    .from(outbox)
    .where(gte(outbox.createdAt, windowStart));

    // Guard Metrics - Latency Analysis
    const [latencyStats] = await db.select({
      p50: sql<number>`
        percentile_cont(0.5) WITHIN GROUP (ORDER BY (context->>'ms')::numeric)
      `,
      p95: sql<number>`
        percentile_cont(0.95) WITHIN GROUP (ORDER BY (context->>'ms')::numeric)  
      `,
      p99: sql<number>`
        percentile_cont(0.99) WITHIN GROUP (ORDER BY (context->>'ms')::numeric)
      `,
      count: sql<number>`COUNT(*)`,
      avgLatency: sql<number>`AVG((context->>'ms')::numeric)`
    })
    .from(guardMetricsEvents)
    .where(
      and(
        eq(guardMetricsEvents.eventType, 'OUTBOX_MESSAGE_LATENCY'),
        gte(guardMetricsEvents.createdAt, windowStart)
      )
    );

    // Current Thresholds
    const thresholds = await db.select()
      .from(thresholdConfig)
      .where(eq(thresholdConfig.enabled, true));

    const thresholdMap = Object.fromEntries(
      thresholds.map(t => [t.metricCode, {
        warn: parseFloat(t.warnThreshold),
        critical: parseFloat(t.criticalThreshold)
      }])
    );

    // Calculate SLA Status
    const successRate = outboxStats.total > 0 ? (outboxStats.successful / outboxStats.total) * 100 : 100;
    const avgRetries = parseFloat(outboxStats.avgRetries?.toString() || '0');
    const p95Latency = parseFloat(latencyStats.p95?.toString() || '0');

    // SLA Violations Check
    const violations = [];
    if (thresholdMap['outbox_failure_rate'] && (100 - successRate) > thresholdMap['outbox_failure_rate'].critical) {
      violations.push({ metric: 'failure_rate', level: 'CRITICAL', value: 100 - successRate });
    }
    if (thresholdMap['outbox_avg_retry'] && avgRetries > thresholdMap['outbox_avg_retry'].critical) {
      violations.push({ metric: 'avg_retry', level: 'CRITICAL', value: avgRetries });
    }
    if (thresholdMap['outbox_latency_p95'] && p95Latency > thresholdMap['outbox_latency_p95'].critical) {
      violations.push({ metric: 'latency_p95', level: 'CRITICAL', value: p95Latency });
    }

    res.json({
      success: true,
      data: {
        window: `${windowHours}h`,
        timestamp: new Date().toISOString(),
        sla_status: violations.length > 0 ? 'VIOLATION' : 'HEALTHY',
        violations,
        metrics: {
          outbox: {
            total_messages: outboxStats.total,
            success_rate: Math.round(successRate * 100) / 100,
            failure_rate: Math.round((100 - successRate) * 100) / 100,
            pending_count: outboxStats.pending,
            avg_retries: Math.round(avgRetries * 100) / 100,
            max_retries: outboxStats.maxRetries
          },
          latency: {
            p50_ms: Math.round(parseFloat(latencyStats.p50?.toString() || '0')),
            p95_ms: Math.round(parseFloat(latencyStats.p95?.toString() || '0')),
            p99_ms: Math.round(parseFloat(latencyStats.p99?.toString() || '0')),
            avg_ms: Math.round(parseFloat(latencyStats.avgLatency?.toString() || '0')),
            sample_count: latencyStats.count
          }
        },
        thresholds: thresholdMap
      }
    });

  } catch (error) {
    console.error('❌ SLA Overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate SLA overview'
    });
  }
});

/**
 * Historical Trends - نمودار تاریخی متریک‌ها
 */
router.get('/sla/trends', async (req, res) => {
  try {
    const windowHours = parseInt(req.query.window as string) || 24;
    const intervalMinutes = parseInt(req.query.interval as string) || 60;
    
    // Success Rate Trend (hourly buckets)
    const successTrend = await db.select({
      hour: sql<string>`date_trunc('hour', ${outbox.createdAt})`,
      total: sql<number>`COUNT(*)`,
      successful: sql<number>`COUNT(CASE WHEN ${outbox.status} = 'SENT' THEN 1 END)`,
      failed: sql<number>`COUNT(CASE WHEN ${outbox.status} = 'FAILED' THEN 1 END)`
    })
    .from(outbox)
    .where(gte(outbox.createdAt, new Date(Date.now() - windowHours * 60 * 60 * 1000)))
    .groupBy(sql`date_trunc('hour', ${outbox.createdAt})`)
    .orderBy(sql`date_trunc('hour', ${outbox.createdAt})`);

    // Latency Trend (hourly P95)
    const latencyTrend = await db.select({
      hour: sql<string>`date_trunc('hour', ${guardMetricsEvents.createdAt})`,
      p95: sql<number>`percentile_cont(0.95) WITHIN GROUP (ORDER BY (context->>'ms')::numeric)`,
      count: sql<number>`COUNT(*)`
    })
    .from(guardMetricsEvents)
    .where(
      and(
        eq(guardMetricsEvents.eventType, 'OUTBOX_MESSAGE_LATENCY'),
        gte(guardMetricsEvents.createdAt, new Date(Date.now() - windowHours * 60 * 60 * 1000))
      )
    )
    .groupBy(sql`date_trunc('hour', ${guardMetricsEvents.createdAt})`)
    .orderBy(sql`date_trunc('hour', ${guardMetricsEvents.createdAt})`);

    res.json({
      success: true,
      data: {
        window: `${windowHours}h`,
        interval: `${intervalMinutes}m`,
        success_rate_trend: successTrend.map(item => ({
          timestamp: item.hour,
          success_rate: item.total > 0 ? (item.successful / item.total) * 100 : 0,
          total_messages: item.total,
          failed_messages: item.failed
        })),
        latency_trend: latencyTrend.map(item => ({
          timestamp: item.hour,
          p95_latency_ms: Math.round(parseFloat(item.p95?.toString() || '0')),
          sample_count: item.count
        }))
      }
    });

  } catch (error) {
    console.error('❌ SLA Trends error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate SLA trends'
    });
  }
});

/**
 * Threshold Violations History
 */
router.get('/sla/violations', async (req, res) => {
  try {
    const windowHours = parseInt(req.query.window as string) || 168; // 7 days default

    // Get threshold violations from guard metrics
    const violations = await db.select({
      timestamp: guardMetricsEvents.createdAt,
      eventType: guardMetricsEvents.eventType,
      level: guardMetricsEvents.level,
      context: guardMetricsEvents.context
    })
    .from(guardMetricsEvents)
    .where(
      and(
        sql`${guardMetricsEvents.eventType} LIKE '%THRESHOLD_VIOLATION%'`,
        gte(guardMetricsEvents.createdAt, new Date(Date.now() - windowHours * 60 * 60 * 1000))
      )
    )
    .orderBy(desc(guardMetricsEvents.createdAt))
    .limit(100);

    res.json({
      success: true,
      data: {
        window: `${windowHours}h`,
        violations: violations.map(v => ({
          timestamp: v.timestamp,
          metric: v.eventType.replace('_THRESHOLD_VIOLATION', ''),
          level: v.level,
          details: v.context
        }))
      }
    });

  } catch (error) {
    console.error('❌ SLA Violations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get violation history'
    });
  }
});

/**
 * Real-time Live Feed - WebSocket alternative
 */
router.get('/sla/live', async (req, res) => {
  try {
    // Last 5 minutes of activity
    const recentActivity = await db.select({
      timestamp: guardMetricsEvents.createdAt,
      eventType: guardMetricsEvents.eventType,
      level: guardMetricsEvents.level,
      context: guardMetricsEvents.context
    })
    .from(guardMetricsEvents)
    .where(gte(guardMetricsEvents.createdAt, new Date(Date.now() - 5 * 60 * 1000)))
    .orderBy(desc(guardMetricsEvents.createdAt))
    .limit(20);

    // Recent outbox activity
    const recentOutbox = await db.select({
      id: outbox.id,
      type: outbox.type,
      status: outbox.status,
      retryCount: outbox.retryCount,
      createdAt: outbox.createdAt,
      processedAt: outbox.processedAt
    })
    .from(outbox)
    .where(gte(outbox.createdAt, new Date(Date.now() - 5 * 60 * 1000)))
    .orderBy(desc(outbox.createdAt))
    .limit(10);

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        recent_events: recentActivity,
        recent_outbox: recentOutbox
      }
    });

  } catch (error) {
    console.error('❌ SLA Live Feed error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get live feed'
    });
  }
});

/**
 * SLA Configuration Management
 */
router.get('/sla/config', async (req, res) => {
  try {
    const configs = await db.select()
      .from(thresholdConfig)
      .orderBy(thresholdConfig.metricCode);

    res.json({
      success: true,
      data: {
        thresholds: configs.map(config => ({
          metric: config.metricCode,
          warn_threshold: parseFloat(config.warnThreshold),
          critical_threshold: parseFloat(config.criticalThreshold),
          window_minutes: config.windowMinutes,
          comparison: config.comparisonOperator,
          enabled: config.enabled,
          auto_suspend: config.autoSuspendOnBreach,
          meta: config.meta
        }))
      }
    });

  } catch (error) {
    console.error('❌ SLA Config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SLA configuration'
    });
  }
});

export default router;