// Phase C: E-C1 Outbox API Routes
// Purpose: API endpoints برای مدیریت outbox و monitoring

import { Router } from 'express';
import { OutboxService, OutboxMessage } from '../services/outbox';
import { OutboxWorker } from '../services/outbox-worker';
import { FeatureFlagManager } from '../services/feature-flag-manager';
import { z } from 'zod';
import { db } from '../db';
import { outbox } from '../../shared/schema';
import { inArray } from 'drizzle-orm';

const router = Router();

// Validation schemas
const enqueueMessageSchema = z.object({
  type: z.enum(['TELEGRAM_MESSAGE', 'EMAIL', 'WEBHOOK']),
  payload: z.object({
    recipient: z.string(),
    message: z.string(),
    options: z.record(z.any()).optional()
  })
});

let outboxService: OutboxService;
let outboxWorker: OutboxWorker;
let featureFlagManager: FeatureFlagManager;

/**
 * Initialize outbox routes with dependencies
 */
export function initializeOutboxRoutes(
  _outboxService: OutboxService,
  _outboxWorker: OutboxWorker,
  _featureFlagManager: FeatureFlagManager
) {
  outboxService = _outboxService;
  outboxWorker = _outboxWorker;
  featureFlagManager = _featureFlagManager;
}

/**
 * POST /api/outbox/enqueue
 */
router.post('/enqueue', async (req, res) => {
  try {
    const isEnabled = featureFlagManager.getMultiStageFlagState('outbox_enabled') === 'on';
    if (!isEnabled) {
      return res.status(503).json({ success: false, error: 'Outbox service is disabled' });
    }

    const validationResult = enqueueMessageSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: 'Invalid request data', details: validationResult.error.issues });
    }

    const parsed = validationResult.data as OutboxMessage; // cast after schema validation
    const messageId = await outboxService.enqueueMessage(parsed);

    res.json({ success: true, data: { messageId, status: 'enqueued' } });
  } catch (error: any) {
    console.error('Outbox enqueue error:', error);
    res.status(500).json({ success: false, error: 'Failed to enqueue message', details: error.message });
  }
});

/**
 * GET /api/outbox/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const windowParam = parseInt(req.query.windowMinutes as string) || 60;
    const metrics = await outboxService.getMetrics();
    const workerStatus = outboxWorker.getStatus();
    const windowMetrics = await outboxService.getWindowMetrics(windowParam);
    const latencyPercentiles = await outboxService.getLatencyPercentiles(windowParam);

    res.json({ success: true, data: { outbox: metrics, worker: workerStatus, window: windowMetrics, latency: latencyPercentiles, timestamp: new Date().toISOString() } });
  } catch (error: any) {
    console.error('Outbox metrics error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve metrics', details: error.message });
  }
});

/**
 * GET /api/outbox/status (health enrichment)
 */
router.get('/status', async (req, res) => {
  try {
    const enabled = featureFlagManager.getMultiStageFlagState('outbox_enabled') === 'on';
    const workerStatus = outboxWorker.getStatus();
    const metrics = await outboxService.getMetrics();

    // Queue depth & classification counts
    const pendingStatuses = ['PENDING', 'FAILED', 'PROCESSING'];
    const retryingStatuses = ['FAILED'];
    const cancelledStatuses = ['CANCELLED'];

    const [queue] = await db.select({ count: outbox.id }).from(outbox).where(inArray(outbox.status, pendingStatuses));
    const [retrying] = await db.select({ count: outbox.id }).from(outbox).where(inArray(outbox.status, retryingStatuses));
    const [cancelled] = await db.select({ count: outbox.id }).from(outbox).where(inArray(outbox.status, cancelledStatuses));

    const health = {
      successRate: metrics.successRate,
      pendingMessages: metrics.pendingMessages,
      failedMessages: metrics.failedMessages,
      queueDepth: queue?.count || 0,
      retryingCount: retrying?.count || 0,
      cancelledCount: cancelled?.count || 0
    };

    res.json({ success: true, data: { enabled, worker: workerStatus, health, timestamp: new Date().toISOString() } });
  } catch (error: any) {
    console.error('Outbox status error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve status', details: error.message });
  }
});

/**
 * POST /api/outbox/worker/start
 */
router.post('/worker/start', async (_req, res) => {
  try {
    await outboxWorker.start();
    res.json({ success: true, message: 'Outbox worker started' });
  } catch (error: any) {
    console.error('Worker start error:', error);
    res.status(500).json({ success: false, error: 'Failed to start worker', details: error.message });
  }
});

/**
 * POST /api/outbox/worker/stop
 */
router.post('/worker/stop', async (_req, res) => {
  try {
    await outboxWorker.stop();
    res.json({ success: true, message: 'Outbox worker stopped' });
  } catch (error: any) {
    console.error('Worker stop error:', error);
    res.status(500).json({ success: false, error: 'Failed to stop worker', details: error.message });
  }
});

/**
 * POST /api/outbox/cleanup
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { olderThanDays = 30 } = req.body;
    const deletedCount = await outboxService.cleanupOldMessages(olderThanDays);
    res.json({ success: true, data: { deletedCount, olderThanDays } });
  } catch (error: any) {
    console.error('Outbox cleanup error:', error);
    res.status(500).json({ success: false, error: 'Failed to cleanup messages', details: error.message });
  }
});

export default router;