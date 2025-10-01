/**
 * MARAFNET STATE MANAGEMENT SERVICE v2.1 (E-C6)
 * 
 * هدف: مدیریت وضعیت فرایندهای ingestion و resumable processes
 * ویژگی‌ها:
 * - Checkpoint-based recovery
 * - Step-by-step progress tracking  
 * - Error recovery و retry logic
 * - State persistence in database
 * - Atomic state transitions
 */

import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { ingestionState, processSteps, type IngestionState, type ProcessStep, type InsertIngestionState, type InsertProcessStep } from '../../shared/schema.js';

export type StateType = 'PENDING' | 'PROCESSING' | 'PAUSED' | 'FAILED' | 'COMPLETED' | 'ROLLBACK' | 'CANCELLED';
export type StepStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface StateCheckpoint {
  lastProcessedId?: number;
  currentTable?: string;
  processed_count?: number;
  current_offset?: number;
  error_context?: any;
  [key: string]: any;
}

export interface ProcessDefinition {
  batchId: string;
  totalRecords: number;
  steps: Array<{
    stepNumber: number;
    stepName: string;
    stepType: string;
    config?: any;
  }>;
}

class StateManagerService {
  /**
   * ایجاد یک فرایند جدید با تعریف steps
   */
  async createProcess(definition: ProcessDefinition): Promise<IngestionState> {
    try {
      // ایجاد state record اصلی
      const [stateRecord] = await db.insert(ingestionState).values({
        batchId: definition.batchId,
        state: 'PENDING',
        totalSteps: definition.steps.length,
        totalRecords: definition.totalRecords,
        checkpointData: {} as any
      }).returning();

      // ایجاد step records
      const stepInserts: InsertProcessStep[] = definition.steps.map(step => ({
        batchId: definition.batchId,
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        stepType: step.stepType,
        stepConfig: step.config || {},
        status: 'PENDING'
      }));

      await db.insert(processSteps).values(stepInserts);

      console.log(`🏁 E-C6: Created process ${definition.batchId} with ${definition.steps.length} steps`);
      return stateRecord;
    } catch (error) {
      console.error(`❌ E-C6: Failed to create process ${definition.batchId}:`, error);
      throw error;
    }
  }

  /**
   * شروع یک فرایند
   */
  async startProcess(batchId: string): Promise<void> {
    try {
      await db.update(ingestionState)
        .set({
          state: 'PROCESSING',
          updatedAt: new Date()
        })
        .where(eq(ingestionState.batchId, batchId));

      console.log(`🚀 E-C6: Started process ${batchId}`);
    } catch (error) {
      console.error(`❌ E-C6: Failed to start process ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * به‌روزرسانی checkpoint یک فرایند
   */
  async updateCheckpoint(batchId: string, checkpoint: StateCheckpoint, processedRecords?: number): Promise<void> {
    try {
      const updateData: any = {
        checkpointData: checkpoint,
        updatedAt: new Date()
      };

      if (processedRecords !== undefined) {
        updateData.processedRecords = processedRecords;
      }

      await db.update(ingestionState)
        .set(updateData)
        .where(eq(ingestionState.batchId, batchId));

      console.log(`📍 E-C6: Updated checkpoint for ${batchId}, processed: ${processedRecords || 'N/A'}`);
    } catch (error) {
      console.error(`❌ E-C6: Failed to update checkpoint for ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * ثبت خطا برای یک فرایند
   */
  async recordError(batchId: string, error: string, incrementErrorCount = true): Promise<void> {
    try {
      const updateData: any = {
        lastError: error,
        updatedAt: new Date()
      };

      if (incrementErrorCount) {
        updateData.errorCount = sql`${ingestionState.errorCount} + 1`;
      }

      await db.update(ingestionState)
        .set(updateData)
        .where(eq(ingestionState.batchId, batchId));

      console.log(`⚠️ E-C6: Recorded error for ${batchId}: ${error.substring(0, 100)}...`);
    } catch (error) {
      console.error(`❌ E-C6: Failed to record error for ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * تغییر وضعیت step خاص
   */
  async updateStepStatus(
    batchId: string, 
    stepNumber: number, 
    status: StepStatus, 
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        ...(status === 'PROCESSING' && { startedAt: new Date() }),
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
        ...(status === 'FAILED' && { 
          errorMessage,
          retryCount: sql`${processSteps.retryCount} + 1`
        })
      };

      await db.update(processSteps)
        .set(updateData)
        .where(
          and(
            eq(processSteps.batchId, batchId),
            eq(processSteps.stepNumber, stepNumber)
          )
        );

      // اگر step کامل شد، current_step را آپدیت کن
      if (status === 'COMPLETED') {
        await db.update(ingestionState)
          .set({
            currentStep: stepNumber,
            updatedAt: new Date()
          })
          .where(eq(ingestionState.batchId, batchId));
      }

      console.log(`📈 E-C6: Step ${stepNumber} of ${batchId} → ${status}`);
    } catch (error) {
      console.error(`❌ E-C6: Failed to update step ${stepNumber} for ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * تکمیل یک فرایند
   */
  async completeProcess(batchId: string): Promise<void> {
    try {
      await db.update(ingestionState)
        .set({
          state: 'COMPLETED',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(ingestionState.batchId, batchId));

      console.log(`✅ E-C6: Completed process ${batchId}`);
    } catch (error) {
      console.error(`❌ E-C6: Failed to complete process ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * متوقف کردن یک فرایند با قابلیت resume
   */
  async pauseProcess(batchId: string, reason?: string): Promise<void> {
    try {
      await db.update(ingestionState)
        .set({
          state: 'PAUSED',
          lastError: reason,
          updatedAt: new Date()
        })
        .where(eq(ingestionState.batchId, batchId));

      console.log(`⏸️ E-C6: Paused process ${batchId}: ${reason || 'Manual pause'}`);
    } catch (error) {
      console.error(`❌ E-C6: Failed to pause process ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * resume یک فرایند متوقف شده
   */
  async resumeProcess(batchId: string): Promise<IngestionState | null> {
    try {
      const [process] = await db.select()
        .from(ingestionState)
        .where(eq(ingestionState.batchId, batchId))
        .limit(1);

      if (!process) {
        throw new Error(`Process ${batchId} not found`);
      }

      if (process.state !== 'PAUSED' && process.state !== 'FAILED') {
        throw new Error(`Process ${batchId} is not resumable (current state: ${process.state})`);
      }

      await db.update(ingestionState)
        .set({
          state: 'PROCESSING',
          updatedAt: new Date()
        })
        .where(eq(ingestionState.batchId, batchId));

      console.log(`▶️ E-C6: Resumed process ${batchId} from step ${process.currentStep}`);
      return { ...process, state: 'PROCESSING' };
    } catch (error) {
      console.error(`❌ E-C6: Failed to resume process ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * دریافت وضعیت کامل یک فرایند
   */
  async getProcessState(batchId: string): Promise<{
    process: IngestionState;
    steps: ProcessStep[];
  } | null> {
    try {
      const [process] = await db.select()
        .from(ingestionState)
        .where(eq(ingestionState.batchId, batchId))
        .limit(1);

      if (!process) return null;

      const steps = await db.select()
        .from(processSteps)
        .where(eq(processSteps.batchId, batchId))
        .orderBy(processSteps.stepNumber);

      return { process, steps };
    } catch (error) {
      console.error(`❌ E-C6: Failed to get process state for ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * لیست فرایندهای در حال اجرا یا resumable
   */
  async getActiveProcesses(): Promise<IngestionState[]> {
    try {
      return await db.select()
        .from(ingestionState)
        .where(sql`${ingestionState.state} IN ('PROCESSING', 'PAUSED', 'FAILED')`)
        .orderBy(ingestionState.updatedAt);
    } catch (error) {
      console.error('❌ E-C6: Failed to get active processes:', error);
      throw error;
    }
  }

  /**
   * آمار عملکرد state management
   */
  async getStats(): Promise<{
    total: number;
    byState: Record<string, number>;
    avgCompletionTime: number;
    errorRate: number;
  }> {
    try {
      const [stats] = await db.select({
        total: sql<number>`COUNT(*)`,
        completed: sql<number>`COUNT(CASE WHEN ${ingestionState.state} = 'COMPLETED' THEN 1 END)`,
        failed: sql<number>`COUNT(CASE WHEN ${ingestionState.state} = 'FAILED' THEN 1 END)`,
        processing: sql<number>`COUNT(CASE WHEN ${ingestionState.state} = 'PROCESSING' THEN 1 END)`,
        pending: sql<number>`COUNT(CASE WHEN ${ingestionState.state} = 'PENDING' THEN 1 END)`,
        paused: sql<number>`COUNT(CASE WHEN ${ingestionState.state} = 'PAUSED' THEN 1 END)`,
        avgDuration: sql<number>`
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) 
          FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL)
        `
      }).from(ingestionState);

      return {
        total: Number(stats.total),
        byState: {
          COMPLETED: Number(stats.completed),
          FAILED: Number(stats.failed),
          PROCESSING: Number(stats.processing),
          PENDING: Number(stats.pending),
          PAUSED: Number(stats.paused)
        },
        avgCompletionTime: Number(stats.avgDuration) || 0,
        errorRate: stats.total > 0 ? Number(stats.failed) / Number(stats.total) : 0
      };
    } catch (error) {
      console.error('❌ E-C6: Failed to get stats:', error);
      throw error;
    }
  }
}

export const stateManager = new StateManagerService();
export default stateManager;