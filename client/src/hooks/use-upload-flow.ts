import { useCallback, useReducer } from 'react';
import * as z from 'zod';
import { observabilityService } from '../services/observability-service';
import { useJSONParser } from './use-json-parser';
import { useDebounce } from './use-debounce';

// مراحل وضعیت آپلود
export type UploadPhase = 'idle' | 'selecting' | 'validating' | 'uploading' | 'processing' | 'success' | 'error' | 'partial';

interface ValidationIssue { path: string; message: string; }
interface UploadState {
  phase: UploadPhase;
  file?: File;
  percent: number;
  issues: ValidationIssue[];
  error?: string;
}

const initialState: UploadState = { phase: 'idle', percent: 0, issues: [] };

type Action =
  | { type: 'SELECT_FILE'; file: File }
  | { type: 'START_VALIDATION' }
  | { type: 'SET_ISSUES'; issues: ValidationIssue[] }
  | { type: 'START_UPLOAD' }
  | { type: 'SET_PROGRESS'; value: number }
  | { type: 'START_PROCESSING' }
  | { type: 'SUCCESS' }
  | { type: 'PARTIAL' }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' };

function reducer(state: UploadState, action: Action): UploadState {
  switch (action.type) {
    case 'SELECT_FILE': return { ...initialState, phase: 'selecting', file: action.file };
    case 'START_VALIDATION': return { ...state, phase: 'validating', issues: [], error: undefined };
    case 'SET_ISSUES': return { ...state, issues: action.issues };
    case 'START_UPLOAD': return { ...state, phase: 'uploading', percent: 0 };
    case 'SET_PROGRESS': return { ...state, percent: action.value };
    case 'START_PROCESSING': return { ...state, phase: 'processing' };
    case 'SUCCESS': return { ...state, phase: 'success', percent: 100 };
    case 'PARTIAL': return { ...state, phase: 'partial', percent: 100 };
    case 'ERROR': return { ...state, phase: 'error', error: action.error };
    case 'RESET': return { ...initialState };
    default: return state;
  }
}

// اسکیمای نمونه (بعداً سفارشی می‌شود)
const sampleSchema = z.object({ id: z.string(), amount: z.number().nonnegative() });

export function useUploadFlow(options?: { onComplete?: () => void }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // استفاده از JSON Parser Worker برای فایل‌های بزرگ
  const jsonParser = useJSONParser({
    onProgress: (progress, stage) => {
      if (state.phase === 'validating' || state.phase === 'uploading') {
        dispatch({ type: 'SET_PROGRESS', value: progress });
      }
    },
    onComplete: (result, metadata) => {
      // Use debounced validation for result processing
      debouncedValidation(result, metadata);
    },
    onError: (error) => {
      observabilityService.logUploadFail(state.file?.name || 'unknown', error);
      dispatch({ type: 'ERROR', error });
    }
  });

  // Debounced validation function
  const debouncedValidation = useDebounce(
    (data: any, metadata?: any) => validateAndProcessResult(data, metadata),
    { 
      delay: 300, // 300ms delay for validation
      maxWait: 2000 // maximum 2 seconds wait
    }
  );

  // Debounced error display
  const debouncedErrorDisplay = useDebounce(
    (issues: ValidationIssue[]) => {
      if (issues.length > 0) {
        console.group('🔍 Validation Issues (Debounced)');
        issues.forEach(issue => console.warn(`⚠️ ${issue.path}: ${issue.message}`));
        console.groupEnd();
      }
    },
    { 
      delay: 500, // 500ms delay for error display
      trailing: true 
    }
  );

  const validateAndProcessResult = useCallback((data: any, metadata?: any) => {
    try {
      const issues: ValidationIssue[] = [];
      const arr = Array.isArray(data) ? data : [data];
      
      // اعتبارسنجی نمونه‌ای برای 50 رکورد اول
      for (const item of arr.slice(0, 50)) {
        const result = sampleSchema.safeParse(item);
        if (!result.success) {
          result.error.issues.forEach(issue => 
            issues.push({ 
              path: issue.path.join('.'), 
              message: issue.message 
            })
          );
        }
      }

      dispatch({ type: 'SET_ISSUES', issues });
      dispatch({ type: 'START_UPLOAD' });

      // Debounced error display برای نمایش خطاهای فایل‌های خطادار
      debouncedErrorDisplay(issues);

      // شبیه‌سازی آپلود به سرور
      simulateServerUpload(data, metadata, issues, arr);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'خطا در اعتبارسنجی';
      observabilityService.logUploadFail(state.file?.name || 'unknown', errorMessage);
      dispatch({ type: 'ERROR', error: errorMessage });
    }
  }, [state.file?.name, debouncedErrorDisplay]);

  const parseFileLocally = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const json = JSON.parse(text);
        // Use debounced validation for local parsing too
        debouncedValidation(json, { 
          fileName: file.name, 
          fileSize: file.size, 
          processingTime: 0,
          method: 'local'
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'خطا در پارس فایل';
        observabilityService.logUploadFail(file.name, errorMessage);
        dispatch({ type: 'ERROR', error: errorMessage });
      }
    };
    reader.onerror = () => {
      observabilityService.logUploadFail(file.name, 'خواندن فایل ناموفق بود');
      dispatch({ type: 'ERROR', error: 'خواندن فایل ناموفق بود' });
    };
    reader.readAsText(file);
  }, [debouncedValidation]);

  const simulateServerUpload = useCallback((data: any, metadata: any, issues: ValidationIssue[], arr: any[]) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        dispatch({ type: 'START_PROCESSING' });
        
        setTimeout(() => {
          if (issues.length > 0) {
            dispatch({ type: 'PARTIAL' });
            observabilityService.logUploadFail('validation_issues', `${issues.length} validation errors`);
          } else {
            dispatch({ type: 'SUCCESS' });
            observabilityService.logUploadSuccess(arr.length);
            options?.onComplete?.();
          }
        }, 500);
      } else {
        dispatch({ type: 'SET_PROGRESS', value: Math.round(progress) });
      }
    }, 100);
  }, [options, state.file?.name]);

  const selectFile = useCallback((file: File) => {
    observabilityService.logUploadStart(file.size, file.name);
    
    dispatch({ type: 'SELECT_FILE', file });
    dispatch({ type: 'START_VALIDATION' });

    // تشخیص نوع فایل و انتخاب روش پردازش
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const fileType = ['pfx', 'p12'].includes(fileExtension || '') ? 'pfx' : 'json';
    
    // استفاده از Web Worker برای فایل‌های بزرگ (>1MB) یا همیشه برای PFX
    if (file.size > 1024 * 1024 || fileType === 'pfx') {
      console.log(`🔧 Using Web Worker for ${fileType} file: ${file.name} (${Math.round(file.size / 1024)}KB)`);
      jsonParser.parseFile(file, fileType);
    } else {
      // پردازش محلی برای فایل‌های کوچک JSON
      parseFileLocally(file);
    }
  }, [jsonParser, parseFileLocally]);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return { ...state, selectFile, reset };
}
