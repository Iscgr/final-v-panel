/**
 * JSON Parser Service
 * مدیریت Web Worker برای پردازش فایل‌های JSON و PFX
 */

import type { ParseTask, ParseProgress, ParseResult, ParseError } from '../workers/json-parser.worker';

export interface JSONParserConfig {
  maxConcurrentTasks?: number;
  maxFileSize?: number;
  workerCount?: number;
}

export interface TaskStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'cancelled';
  progress?: ParseProgress;
  result?: ParseResult;
  error?: ParseError;
  createdAt: number;
}

class JSONParserService {
  private workers: Worker[] = [];
  private taskQueue: ParseTask[] = [];
  private activeTasks = new Map<string, TaskStatus>();
  private workerBusy = new Set<number>();
  private config: Required<JSONParserConfig>;
  private listeners = new Map<string, Set<(status: TaskStatus) => void>>();
  private globalListeners = new Set<(status: TaskStatus) => void>();

  constructor(config: JSONParserConfig = {}) {
    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks || 2,
      maxFileSize: config.maxFileSize || 50 * 1024 * 1024, // 50MB
      workerCount: config.workerCount || Math.min(2, navigator.hardwareConcurrency || 2)
    };

    this.initializeWorkers();
  }

  private initializeWorkers() {
    const workerUrl = new URL('../workers/json-parser.worker.ts', import.meta.url);
    
    for (let i = 0; i < this.config.workerCount; i++) {
      try {
        const worker = new Worker(workerUrl, { type: 'module' });
        worker.addEventListener('message', (event) => this.handleWorkerMessage(i, event));
        worker.addEventListener('error', (error) => this.handleWorkerError(i, error));
        
        this.workers.push(worker);
        
        // Test worker with ping
        worker.postMessage({ type: 'PING' });
      } catch (error) {
        console.error(`Failed to create worker ${i}:`, error);
      }
    }

    console.log(`🔧 JSON Parser Service initialized with ${this.workers.length} workers`);
  }

  private handleWorkerMessage(workerIndex: number, event: MessageEvent) {
    const { type, payload } = event.data;

    switch (type) {
      case 'PONG':
        console.log(`📡 Worker ${workerIndex} ready`);
        break;

      case 'PARSE_PROGRESS':
        this.updateTaskProgress(payload as ParseProgress);
        break;

      case 'PARSE_SUCCESS':
        this.completeTask(payload as ParseResult);
        this.workerBusy.delete(workerIndex);
        this.processQueue();
        break;

      case 'PARSE_ERROR':
        this.errorTask(payload as ParseError);
        this.workerBusy.delete(workerIndex);
        this.processQueue();
        break;

      case 'PARSE_CANCELLED':
        this.cancelTaskComplete(payload.id);
        this.workerBusy.delete(workerIndex);
        this.processQueue();
        break;

      default:
        console.warn(`Unknown worker message type: ${type}`);
    }
  }

  private handleWorkerError(workerIndex: number, error: ErrorEvent) {
    console.error(`Worker ${workerIndex} error:`, error);
    this.workerBusy.delete(workerIndex);
    
    // Find tasks assigned to this worker and mark them as error
    for (const [taskId, status] of this.activeTasks) {
      if (status.status === 'processing') {
        this.errorTask({
          id: taskId,
          error: 'Worker crashed during processing',
          details: error.message
        });
      }
    }
  }

  /**
   * پردازش فایل JSON یا PFX
   */
  async parseFile(file: File, type: 'json' | 'pfx' = 'json'): Promise<string> {
    const taskId = `parse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate file size
    if (file.size > this.config.maxFileSize) {
      throw new Error(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(this.config.maxFileSize / 1024 / 1024)}MB)`);
    }

    // Create task
    const task: ParseTask = {
      id: taskId,
      file,
      type,
      maxSize: this.config.maxFileSize
    };

    // Initialize task status
    const taskStatus: TaskStatus = {
      id: taskId,
      status: 'pending',
      createdAt: Date.now()
    };

    this.activeTasks.set(taskId, taskStatus);
    this.notifyListeners(taskStatus);

    // Add to queue
    this.taskQueue.push(task);
    this.processQueue();

    console.log(`📤 Task ${taskId} queued for ${type} parsing: ${file.name} (${Math.round(file.size / 1024)}KB)`);

    return taskId;
  }

  /**
   * لغو وظیفه
   */
  cancelTask(taskId: string): void {
    const taskStatus = this.activeTasks.get(taskId);
    if (!taskStatus) return;

    if (taskStatus.status === 'processing') {
      // Send cancel message to all workers
      this.workers.forEach(worker => {
        worker.postMessage({ type: 'CANCEL_TASK', payload: { id: taskId } });
      });
    } else if (taskStatus.status === 'pending') {
      // Remove from queue
      const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
      if (queueIndex !== -1) {
        this.taskQueue.splice(queueIndex, 1);
      }
      this.cancelTaskComplete(taskId);
    }
  }

  /**
   * دریافت وضعیت وظیفه
   */
  getTaskStatus(taskId: string): TaskStatus | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * دریافت لیست تمام وظایف فعال
   */
  getActiveTasks(): TaskStatus[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * اضافه کردن listener برای وظیفه خاص
   */
  onTaskUpdate(taskId: string, callback: (status: TaskStatus) => void): () => void {
    if (!this.listeners.has(taskId)) {
      this.listeners.set(taskId, new Set());
    }
    this.listeners.get(taskId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const taskListeners = this.listeners.get(taskId);
      if (taskListeners) {
        taskListeners.delete(callback);
        if (taskListeners.size === 0) {
          this.listeners.delete(taskId);
        }
      }
    };
  }

  /**
   * اضافه کردن listener برای تمام وظایف
   */
  onAnyTaskUpdate(callback: (status: TaskStatus) => void): () => void {
    this.globalListeners.add(callback);
    return () => this.globalListeners.delete(callback);
  }

  /**
   * پاک‌سازی سرویس
   */
  dispose(): void {
    // Terminate all workers
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    
    // Clear all data
    this.taskQueue = [];
    this.activeTasks.clear();
    this.workerBusy.clear();
    this.listeners.clear();
    this.globalListeners.clear();

    console.log('🛑 JSON Parser Service disposed');
  }

  private processQueue(): void {
    // Find available worker
    const availableWorkerIndex = this.findAvailableWorker();
    if (availableWorkerIndex === -1 || this.taskQueue.length === 0) {
      return;
    }

    // Get next task
    const task = this.taskQueue.shift()!;
    const taskStatus = this.activeTasks.get(task.id);
    
    if (!taskStatus || taskStatus.status !== 'pending') {
      // Task was cancelled or removed
      this.processQueue();
      return;
    }

    // Mark worker as busy
    this.workerBusy.add(availableWorkerIndex);

    // Update task status
    taskStatus.status = 'processing';
    this.notifyListeners(taskStatus);

    // Send task to worker
    this.workers[availableWorkerIndex].postMessage({
      type: 'PARSE_FILE',
      payload: task
    });

    console.log(`🚀 Task ${task.id} started on worker ${availableWorkerIndex}`);

    // Process next task if available
    setTimeout(() => this.processQueue(), 0);
  }

  private findAvailableWorker(): number {
    for (let i = 0; i < this.workers.length; i++) {
      if (!this.workerBusy.has(i)) {
        return i;
      }
    }
    return -1;
  }

  private updateTaskProgress(progress: ParseProgress): void {
    const taskStatus = this.activeTasks.get(progress.id);
    if (taskStatus) {
      taskStatus.progress = progress;
      this.notifyListeners(taskStatus);
    }
  }

  private completeTask(result: ParseResult): void {
    const taskStatus = this.activeTasks.get(result.id);
    if (taskStatus) {
      taskStatus.status = 'completed';
      taskStatus.result = result;
      this.notifyListeners(taskStatus);
      
      console.log(`✅ Task ${result.id} completed in ${result.metadata.processingTime}ms`);
      
      // Clean up after delay
      setTimeout(() => this.activeTasks.delete(result.id), 30000);
    }
  }

  private errorTask(error: ParseError): void {
    const taskStatus = this.activeTasks.get(error.id);
    if (taskStatus) {
      taskStatus.status = 'error';
      taskStatus.error = error;
      this.notifyListeners(taskStatus);
      
      console.error(`❌ Task ${error.id} failed:`, error.error);
      
      // Clean up after delay
      setTimeout(() => this.activeTasks.delete(error.id), 30000);
    }
  }

  private cancelTaskComplete(taskId: string): void {
    const taskStatus = this.activeTasks.get(taskId);
    if (taskStatus) {
      taskStatus.status = 'cancelled';
      this.notifyListeners(taskStatus);
      
      console.log(`🚫 Task ${taskId} cancelled`);
      
      // Clean up immediately for cancelled tasks
      setTimeout(() => this.activeTasks.delete(taskId), 5000);
    }
  }

  private notifyListeners(taskStatus: TaskStatus): void {
    // Notify task-specific listeners
    const taskListeners = this.listeners.get(taskStatus.id);
    if (taskListeners) {
      taskListeners.forEach(callback => {
        try {
          callback(taskStatus);
        } catch (error) {
          console.error('Error in task listener:', error);
        }
      });
    }

    // Notify global listeners
    this.globalListeners.forEach(callback => {
      try {
        callback(taskStatus);
      } catch (error) {
        console.error('Error in global task listener:', error);
      }
    });
  }
}

// Create singleton instance
export const jsonParserService = new JSONParserService();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).jsonParserService = jsonParserService;
}

export default jsonParserService;