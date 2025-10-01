/**
 * JSON Parser Web Worker
 * پردازش فایل‌های JSON و PFX بدون blocking UI thread
 */

export interface ParseTask {
  id: string;
  file: File;
  type: 'json' | 'pfx';
  maxSize?: number;
}

export interface ParseProgress {
  id: string;
  progress: number;
  stage: 'reading' | 'parsing' | 'validating' | 'complete';
  bytesProcessed: number;
  totalBytes: number;
}

export interface ParseResult {
  id: string;
  success: boolean;
  data?: any;
  errors?: string[];
  metadata: {
    fileName: string;
    fileSize: number;
    processingTime: number;
    recordCount?: number;
  };
}

export interface ParseError {
  id: string;
  error: string;
  details?: any;
}

// Constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const PROGRESS_THROTTLE = 100; // ms

class JSONParserWorker {
  private tasks: Map<string, ParseTask> = new Map();
  private lastProgressUpdate = 0;

  constructor() {
    self.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleMessage(event: MessageEvent) {
    const { type, payload } = event.data;

    switch (type) {
      case 'PARSE_FILE':
        this.parseFile(payload as ParseTask);
        break;
      case 'CANCEL_TASK':
        this.cancelTask(payload.id);
        break;
      case 'PING':
        this.postMessage({ type: 'PONG' });
        break;
      default:
        console.warn(`Unknown message type: ${type}`);
    }
  }

  private postMessage(message: any) {
    self.postMessage(message);
  }

  private async parseFile(task: ParseTask) {
    const startTime = performance.now();
    
    try {
      // Validate file size
      if (task.file.size > (task.maxSize || MAX_FILE_SIZE)) {
        throw new Error(`File size (${Math.round(task.file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round((task.maxSize || MAX_FILE_SIZE) / 1024 / 1024)}MB)`);
      }

      this.tasks.set(task.id, task);
      
      // Send initial progress
      this.sendProgress(task.id, 0, 'reading', 0, task.file.size);

      let result: any;
      
      switch (task.type) {
        case 'json':
          result = await this.parseJSONFile(task);
          break;
        case 'pfx':
          result = await this.parsePFXFile(task);
          break;
        default:
          throw new Error(`Unsupported file type: ${task.type}`);
      }

      const processingTime = performance.now() - startTime;

      const parseResult: ParseResult = {
        id: task.id,
        success: true,
        data: result.data,
        metadata: {
          fileName: task.file.name,
          fileSize: task.file.size,
          processingTime: Math.round(processingTime),
          recordCount: result.recordCount
        }
      };

      this.sendProgress(task.id, 100, 'complete', task.file.size, task.file.size);
      this.postMessage({ type: 'PARSE_SUCCESS', payload: parseResult });

    } catch (error) {
      const parseError: ParseError = {
        id: task.id,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
        details: error instanceof Error ? error.stack : error
      };

      this.postMessage({ type: 'PARSE_ERROR', payload: parseError });
    } finally {
      this.tasks.delete(task.id);
    }
  }

  private async parseJSONFile(task: ParseTask): Promise<{ data: any; recordCount?: number }> {
    const file = task.file;
    let processedBytes = 0;

    // برای فایل‌های کوچک، مستقیماً پارس کنیم
    if (file.size < CHUNK_SIZE) {
      this.sendProgress(task.id, 25, 'reading', processedBytes, file.size);
      
      const text = await file.text();
      processedBytes = file.size;
      
      this.sendProgress(task.id, 50, 'parsing', processedBytes, file.size);
      
      const data = JSON.parse(text);
      
      this.sendProgress(task.id, 75, 'validating', processedBytes, file.size);
      
      // Count records if it's an array
      const recordCount = Array.isArray(data) ? data.length : 
                         data && typeof data === 'object' && data.records ? data.records.length : 
                         undefined;

      return { data, recordCount };
    }

    // برای فایل‌های بزرگ، از streaming استفاده کنیم
    return this.parseJSONStream(task);
  }

  private async parseJSONStream(task: ParseTask): Promise<{ data: any; recordCount?: number }> {
    const file = task.file;
    const reader = file.stream().getReader();
    const decoder = new TextDecoder();
    
    let chunks: string[] = [];
    let processedBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        processedBytes += value.length;
        chunks.push(decoder.decode(value, { stream: true }));

        // Update progress (throttled)
        this.sendProgressThrottled(task.id, (processedBytes / file.size) * 60, 'reading', processedBytes, file.size);
      }

      // Final chunk
      chunks.push(decoder.decode());

      this.sendProgress(task.id, 70, 'parsing', processedBytes, file.size);

      const fullText = chunks.join('');
      const data = JSON.parse(fullText);

      this.sendProgress(task.id, 90, 'validating', processedBytes, file.size);

      const recordCount = Array.isArray(data) ? data.length : 
                         data && typeof data === 'object' && data.records ? data.records.length : 
                         undefined;

      return { data, recordCount };

    } finally {
      reader.releaseLock();
    }
  }

  private async parsePFXFile(task: ParseTask): Promise<{ data: any; recordCount?: number }> {
    // PFX files are typically binary certificates, but for this context
    // we'll treat them as JSON-like structured data files
    this.sendProgress(task.id, 25, 'reading', 0, task.file.size);

    const arrayBuffer = await task.file.arrayBuffer();
    
    this.sendProgress(task.id, 50, 'parsing', arrayBuffer.byteLength, task.file.size);

    // Convert to text and try to parse as JSON
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(arrayBuffer);

    this.sendProgress(task.id, 75, 'validating', arrayBuffer.byteLength, task.file.size);

    try {
      const data = JSON.parse(text);
      const recordCount = Array.isArray(data) ? data.length : undefined;
      return { data, recordCount };
    } catch {
      // If not JSON, return metadata about the file
      return {
        data: {
          type: 'pfx',
          size: arrayBuffer.byteLength,
          filename: task.file.name,
          lastModified: task.file.lastModified,
          // Basic analysis
          isTextBased: this.isTextBased(arrayBuffer),
          preview: this.getFilePreview(arrayBuffer)
        }
      };
    }
  }

  private isTextBased(buffer: ArrayBuffer): boolean {
    const view = new Uint8Array(buffer);
    const sample = view.slice(0, Math.min(1000, view.length));
    
    // Check for common text patterns
    let textChars = 0;
    for (const byte of sample) {
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        textChars++;
      }
    }
    
    return (textChars / sample.length) > 0.7;
  }

  private getFilePreview(buffer: ArrayBuffer): string {
    const view = new Uint8Array(buffer);
    const previewSize = Math.min(200, view.length);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    
    try {
      return decoder.decode(view.slice(0, previewSize));
    } catch {
      // Return hex preview for binary files
      return Array.from(view.slice(0, 32))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
    }
  }

  private sendProgress(id: string, progress: number, stage: ParseProgress['stage'], bytesProcessed: number, totalBytes: number) {
    const progressData: ParseProgress = {
      id,
      progress: Math.min(100, Math.max(0, progress)),
      stage,
      bytesProcessed,
      totalBytes
    };

    this.postMessage({ type: 'PARSE_PROGRESS', payload: progressData });
  }

  private sendProgressThrottled(id: string, progress: number, stage: ParseProgress['stage'], bytesProcessed: number, totalBytes: number) {
    const now = performance.now();
    if (now - this.lastProgressUpdate >= PROGRESS_THROTTLE) {
      this.sendProgress(id, progress, stage, bytesProcessed, totalBytes);
      this.lastProgressUpdate = now;
    }
  }

  private cancelTask(id: string) {
    if (this.tasks.has(id)) {
      this.tasks.delete(id);
      this.postMessage({ type: 'PARSE_CANCELLED', payload: { id } });
    }
  }
}

// Initialize worker
new JSONParserWorker();