/**
 * Hook برای استفاده از JSON Parser Service
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import jsonParserService, { type TaskStatus } from '../services/json-parser-service';
import { observabilityService } from '../services/observability-service';

export interface UseJSONParserOptions {
  onProgress?: (progress: number, stage: string) => void;
  onComplete?: (result: any, metadata: any) => void;
  onError?: (error: string) => void;
  autoCleanup?: boolean;
}

export interface JSONParserState {
  isProcessing: boolean;
  progress: number;
  stage: string;
  error: string | null;
  result: any | null;
  metadata: any | null;
  taskId: string | null;
}

export function useJSONParser(options: UseJSONParserOptions = {}) {
  const [state, setState] = useState<JSONParserState>({
    isProcessing: false,
    progress: 0,
    stage: 'idle',
    error: null,
    result: null,
    metadata: null,
    taskId: null
  });

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Cleanup function
  const cleanup = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  // Parse file function
  const parseFile = useCallback(async (file: File, type: 'json' | 'pfx' = 'json') => {
    try {
      // Reset state
      setState({
        isProcessing: true,
        progress: 0,
        stage: 'قرار گیری در صف',
        error: null,
        result: null,
        metadata: null,
        taskId: null
      });

      // Log start
      observabilityService.logUploadStart(file.size, `${type}_worker:${file.name}`);

      // Start parsing
      const taskId = await jsonParserService.parseFile(file, type);
      
      setState(prev => ({ ...prev, taskId }));

      // Cleanup previous subscription
      cleanup();

      // Subscribe to task updates
      unsubscribeRef.current = jsonParserService.onTaskUpdate(taskId, (taskStatus: TaskStatus) => {
        const { status, progress, result, error } = taskStatus;

        switch (status) {
          case 'pending':
            setState(prev => ({
              ...prev,
              isProcessing: true,
              stage: 'در انتظار'
            }));
            break;

          case 'processing':
            const currentProgress = progress?.progress || 0;
            const currentStage = progress?.stage || 'پردازش';
            
            setState(prev => ({
              ...prev,
              isProcessing: true,
              progress: currentProgress,
              stage: getStageText(currentStage)
            }));

            // Call progress callback
            if (optionsRef.current.onProgress) {
              optionsRef.current.onProgress(currentProgress, getStageText(currentStage));
            }
            break;

          case 'completed':
            if (result) {
              setState(prev => ({
                ...prev,
                isProcessing: false,
                progress: 100,
                stage: 'تکمیل شده',
                result: result.data,
                metadata: result.metadata
              }));

              // Log success
              observabilityService.logUploadSuccess(result.metadata.recordCount || 0);

              // Call complete callback
              if (optionsRef.current.onComplete) {
                optionsRef.current.onComplete(result.data, result.metadata);
              }
            }
            break;

          case 'error':
            if (error) {
              setState(prev => ({
                ...prev,
                isProcessing: false,
                error: error.error
              }));

              // Log error
              observabilityService.logUploadFail(`${type}_worker:${file.name}`, error.error);

              // Call error callback
              if (optionsRef.current.onError) {
                optionsRef.current.onError(error.error);
              }
            }
            break;

          case 'cancelled':
            setState(prev => ({
              ...prev,
              isProcessing: false,
              stage: 'لغو شده'
            }));
            break;
        }
      });

    } catch (error) {
      console.error('JSON parser worker failed, attempting fallback parsing...', error);

      try {
        const fallback = await parseFileDirectly(file, type);

        setState(prev => ({
          ...prev,
          isProcessing: false,
          progress: 100,
          stage: 'تکمیل شده',
          error: null,
          result: fallback.data,
          metadata: fallback.metadata
        }));

        observabilityService.logUploadSuccess(fallback.metadata.recordCount || 0);

        optionsRef.current.onProgress?.(100, 'تکمیل شده');
        optionsRef.current.onComplete?.(fallback.data, fallback.metadata);
      } catch (fallbackError) {
        const errorMessage = fallbackError instanceof Error ? fallbackError.message : 'خطای ناشناخته';

        setState(prev => ({
          ...prev,
          isProcessing: false,
          error: errorMessage
        }));

        observabilityService.logUploadFail(`${type}_fallback:${file.name}`, errorMessage);
        optionsRef.current.onError?.(errorMessage);
      }
    }
  }, [cleanup]);

  // Cancel function
  const cancelParsing = useCallback(() => {
    if (state.taskId) {
      jsonParserService.cancelTask(state.taskId);
    }
  }, [state.taskId]);

  // Reset function
  const reset = useCallback(() => {
    cleanup();
    setState({
      isProcessing: false,
      progress: 0,
      stage: 'idle',
      error: null,
      result: null,
      metadata: null,
      taskId: null
    });
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (optionsRef.current.autoCleanup !== false) {
        cleanup();
      }
    };
  }, [cleanup]);

  return {
    ...state,
    parseFile,
    cancelParsing,
    reset,
    // Utility functions
    canCancel: state.isProcessing && (state.stage !== 'تکمیل شده'),
    progressPercent: Math.round(state.progress),
    hasResult: !!state.result,
    hasError: !!state.error
  };
}

async function parseFileDirectly(file: File, type: 'json' | 'pfx') {
  const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());

  if (type === 'json') {
    const text = await file.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error('فایل JSON نامعتبر است');
    }

    const recordCount = Array.isArray(data)
      ? data.length
      : Array.isArray((data as any)?.records)
        ? (data as any).records.length
        : undefined;

    const duration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;

    return {
      data,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        processingTime: Math.round(duration),
        recordCount,
        mode: 'fallback'
      }
    };
  }

  if (type === 'pfx') {
    const arrayBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    let data: any;
    let recordCount: number | undefined;

    try {
      data = JSON.parse(decoder.decode(arrayBuffer));
      recordCount = Array.isArray(data) ? data.length : undefined;
    } catch {
      const view = new Uint8Array(arrayBuffer);
      const sample = view.slice(0, Math.min(1000, view.length));
      let textChars = 0;
      for (const byte of sample) {
        if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
          textChars++;
        }
      }
      const isTextBased = sample.length ? (textChars / sample.length) > 0.7 : false;
      const previewSlice = view.slice(0, Math.min(200, view.length));
      let preview: string;
      try {
        preview = decoder.decode(previewSlice);
      } catch {
        preview = Array.from(view.slice(0, 32))
          .map(b => b.toString(16).padStart(2, '0'))
          .join(' ');
      }

      data = {
        type: 'pfx',
        size: arrayBuffer.byteLength,
        filename: file.name,
        lastModified: file.lastModified,
        isTextBased,
        preview
      };
    }

    const duration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;

    return {
      data,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        processingTime: Math.round(duration),
        recordCount,
        mode: 'fallback'
      }
    };
  }

  throw new Error(`نوع فایل پشتیبانی نمی‌شود: ${type}`);
}

function getStageText(stage: string): string {
  switch (stage) {
    case 'reading':
      return 'خواندن فایل';
    case 'parsing':
      return 'تجزیه داده‌ها';
    case 'validating':
      return 'اعتبارسنجی';
    case 'complete':
      return 'تکمیل شده';
    default:
      return stage;
  }
}

export default useJSONParser;