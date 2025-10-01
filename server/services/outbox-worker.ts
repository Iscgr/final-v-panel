// Phase C: E-C1 Telegram Outbox Worker
// Purpose: پردازش پیام‌های outbox با exponential backoff strategy + latency metrics + health tracking

import { OutboxService } from './outbox.js';
import { FeatureFlagManager } from './feature-flag-manager.js';
import { db } from '../db';
import { guardMetricsEvents } from '../../shared/schema';

export interface TelegramAPI {
  sendMessage(chatId: string, message: string, options?: any): Promise<void>;
}

export class OutboxWorker {
  private readonly outboxService: OutboxService;
  private readonly featureFlagManager: FeatureFlagManager;
  private readonly telegramAPI: TelegramAPI;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly PROCESSING_INTERVAL = 10000; // 10 seconds
  private readonly BATCH_SIZE = 5;
  private lastBatchProcessedAt: Date | null = null;

  constructor(
    outboxService: OutboxService,
    featureFlagManager: FeatureFlagManager,
    telegramAPI: TelegramAPI
  ) {
    this.outboxService = outboxService;
    this.featureFlagManager = featureFlagManager;
    this.telegramAPI = telegramAPI;
  }

  /**
   * بررسی فعال بودن پرچم چندمرحله‌ای outbox
   */
  private isOutboxEnabled(): boolean {
    try {
      return this.featureFlagManager.getMultiStageFlagState('outbox_enabled') === 'on';
    } catch {
      return false;
    }
  }

  /**
   * شروع پردازش پیام‌های outbox
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('OutboxWorker is already running');
      return;
    }

    if (!this.isOutboxEnabled()) {
      console.log('Outbox worker disabled by multi-stage flag');
      return;
    }

    this.isRunning = true;
    console.log('Starting OutboxWorker...');

    await this.recordMetric('OUTBOX_WORKER_STARTED');

    this.intervalId = setInterval(async () => {
      try {
        await this.processMessages();
      } catch (error) {
        console.error('Error in OutboxWorker processing:', error);
        await this.recordMetric('OUTBOX_WORKER_ERROR', { error: (error as any).message });
      }
    }, this.PROCESSING_INTERVAL);
  }

  /**
   * توقف پردازش پیام‌های outbox
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('OutboxWorker stopped');
    await this.recordMetric('OUTBOX_WORKER_STOPPED');
  }

  /**
   * پردازش دسته‌ای پیام‌های آماده
   */
  private async processMessages(): Promise<void> {
    if (!this.isOutboxEnabled()) {
      await this.stop();
      return;
    }

    const readyMessages = await this.outboxService.getReadyMessages(this.BATCH_SIZE);
    
    if (readyMessages.length === 0) {
      return;
    }

    console.log(`Processing ${readyMessages.length} outbox messages`);
    await this.recordMetric('OUTBOX_BATCH_PROCESSING_STARTED', { 
      messageCount: readyMessages.length 
    });

    const processPromises = readyMessages.map(message => 
      this.processMessage(message).catch(error => {
        console.error(`Failed to process message ${message.id}:`, error);
        return { success: false, messageId: message.id, error: (error as any).message };
      })
    );

    const results = await Promise.allSettled(processPromises);
    
    const successCount = results.filter(r => 
      r.status === 'fulfilled' && r.value && (r.value as any).success
    ).length;

    this.lastBatchProcessedAt = new Date();

    await this.recordMetric('OUTBOX_BATCH_PROCESSING_COMPLETED', {
      totalMessages: readyMessages.length,
      successCount,
      failureCount: readyMessages.length - successCount
    });
  }

  /**
   * پردازش یک پیام منفرد
   */
  private async processMessage(message: any): Promise<{ success: boolean; messageId: number; error?: string }> {
    const startTime = Date.now();
    const createdAt = message.createdAt ? new Date(message.createdAt).getTime() : startTime;
    
    try {
      await this.outboxService.markAsProcessing(message.id);

      switch (message.type) {
        case 'TELEGRAM_MESSAGE':
          await this.processTelegramMessage(message);
          break;
        case 'EMAIL':
          await this.processEmailMessage(message);
          break;
        case 'WEBHOOK':
          await this.processWebhookMessage(message);
          break;
        default:
          throw new Error(`Unsupported message type: ${message.type}`);
      }

      await this.outboxService.markAsSent(message.id);

      const processingTime = Date.now() - startTime;
      const endToEndLatency = Date.now() - createdAt;
      const bucket = this.classifyLatency(endToEndLatency);

      await this.recordMetric('OUTBOX_MESSAGE_PROCESSED_SUCCESS', {
        messageId: message.id,
        type: message.type,
        processingTimeMs: processingTime,
        endToEndLatencyMs: endToEndLatency,
        latencyBucket: bucket
      });

      await this.recordMetric('OUTBOX_MESSAGE_LATENCY', {
        messageId: message.id,
        ms: endToEndLatency,
        bucket
      });

      return { success: true, messageId: message.id };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      await this.outboxService.markAsFailed(message.id, error.message);
      await this.recordMetric('OUTBOX_MESSAGE_PROCESSED_FAILURE', {
        messageId: message.id,
        type: message.type,
        error: error.message,
        processingTimeMs: processingTime
      });
      return { success: false, messageId: message.id, error: error.message };
    }
  }

  /**
   * طبقه‌بندی latency برای تحلیل KPI
   */
  private classifyLatency(ms: number): string {
    if (ms < 1000) return '<1s';
    if (ms < 3000) return '1-3s';
    if (ms < 5000) return '3-5s';
    if (ms < 10000) return '5-10s';
    return '>=10s';
  }

  private async processTelegramMessage(message: any): Promise<void> {
    const { payload } = message;
    if (!payload.recipient || !payload.message) {
      throw new Error('Invalid telegram message payload: missing recipient or message');
    }
    await this.telegramAPI.sendMessage(
      payload.recipient,
      payload.message,
      payload.options || {}
    );
  }

  private async processEmailMessage(_message: any): Promise<void> {
    throw new Error('Email processing not implemented yet');
  }

  private async processWebhookMessage(_message: any): Promise<void> {
    throw new Error('Webhook processing not implemented yet');
  }

  private async recordMetric(eventType: string, context: Record<string, any> = {}): Promise<void> {
    try {
      await db.insert(guardMetricsEvents).values({
        eventType,
        level: 'info',
        context
      });
    } catch (error) {
      console.error('Failed to record worker metric:', error);
    }
  }

  /**
   * وضعیت worker شامل آخرین زمان پردازش batch
   */
  getStatus(): { isRunning: boolean; processingInterval: number; batchSize: number; lastBatchProcessedAt: string | null } {
    return {
      isRunning: this.isRunning,
      processingInterval: this.PROCESSING_INTERVAL,
      batchSize: this.BATCH_SIZE,
      lastBatchProcessedAt: this.lastBatchProcessedAt ? this.lastBatchProcessedAt.toISOString() : null
    };
  }
}