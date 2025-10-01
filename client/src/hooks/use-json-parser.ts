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
      const errorMessage = error instanceof Error ? error.message : 'خطای ناشناخته';
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorMessage
      }));

      // Log error
      observabilityService.logUploadFail(`${type}_worker:${file.name}`, errorMessage);

      // Call error callback
      if (optionsRef.current.onError) {
        optionsRef.current.onError(errorMessage);
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