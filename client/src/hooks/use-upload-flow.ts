import { useCallback, useReducer, useRef } from 'react';
import * as z from 'zod';
import { observabilityService } from '../services/observability-service';
import { useJSONParser } from './use-json-parser';
import { useDebounce } from './use-debounce';
import { createImportJob } from '@/services/import-jobs';

// مراحل وضعیت آپلود
export type UploadPhase = 'idle' | 'selecting' | 'validating' | 'uploading' | 'processing' | 'success' | 'error' | 'partial';

interface ValidationIssue { path: string; message: string; }
interface UploadState {
  phase: UploadPhase;
  file?: File;
  percent: number;
  issues: ValidationIssue[];
  error?: string;
  jobCode?: string; // کد job برای پیگیری در سرور
}

const initialState: UploadState = { phase: 'idle', percent: 0, issues: [] };

type Action =
  | { type: 'SELECT_FILE'; file: File }
  | { type: 'START_VALIDATION' }
  | { type: 'SET_ISSUES'; issues: ValidationIssue[] }
  | { type: 'START_UPLOAD'; jobCode?: string }
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
    case 'START_UPLOAD': return { ...state, phase: 'uploading', percent: 0, jobCode: action.jobCode };
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
  const jobCodeRef = useRef<string | null>(null);

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

  const validateAndProcessResult = useCallback(async (data: any, metadata?: any) => {
    if (!state.file) return;

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
      debouncedErrorDisplay(issues);

      if (issues.length > 10) { // اگر بیش از ۱۰ خطا در نمونه اولیه وجود داشت، ادامه نده
        throw new Error('فایل دارای خطاهای ساختاری زیادی است. لطفا آن را اصلاح کنید.');
      }

      // ایجاد یک Import Job واقعی در سرور
      const fileName = state.file.name;
      const jobCode = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      jobCodeRef.current = jobCode;

      const jobResult = await createImportJob({
        jobCode,
        sourceFileName: fileName,
        totalRecords: arr.length
      });

      if (!jobResult.success) {
        throw new Error(jobResult.error || 'ایجاد Job در سرور ناموفق بود.');
      }

      dispatch({ type: 'START_UPLOAD', jobCode });

      // شروع آپلود واقعی به سرور
      await uploadToServer(state.file, jobCode);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'خطا در اعتبارسنجی';
      observabilityService.logUploadFail(state.file?.name || 'unknown', errorMessage);
      dispatch({ type: 'ERROR', error: errorMessage });
    }
  }, [state.file, debouncedErrorDisplay]);

  const uploadToServer = async (file: File, jobCode: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('jobCode', jobCode);

    try {
      const response = await fetch('/api/admin/upload-json', {
        method: 'POST',
        body: formData,
        // هدر Content-Type توسط مرورگر به همراه boundary صحیح تنظیم می‌شود
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'خطای ناشناخته در سرور' }));
        throw new Error(errorData.message || `خطای سرور: ${response.statusText}`);
      }

      // پس از آپلود موفق، فاز به processing تغییر می‌کند
      // مانیتور زنده بقیه کار را انجام خواهد داد
      dispatch({ type: 'START_PROCESSING' });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'خطا در آپلود فایل';
      // خطا را با جزئیات بیشتر لاگ می‌کنیم
      observabilityService.logUploadFail(file.name, `${errorMessage} (Job: ${jobCode})`);
      dispatch({ type: 'ERROR', error: errorMessage });
      // TODO: شاید بهتر باشد job را در سرور نیز failed کنیم
    }
  };

  const selectFile = useCallback((selectedFile: File | null) => {
    if (!selectedFile) return;

    observabilityService.logUploadStart(selectedFile.size, selectedFile.name);
    
    dispatch({ type: 'SELECT_FILE', file: selectedFile });
    dispatch({ type: 'START_VALIDATION' });

    // استفاده از Worker برای خواندن و پارس کردن فایل
    jsonParser.parseFile(selectedFile, 'json');
  }, [jsonParser]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    jobCodeRef.current = null;
  }, []);

  return {
    ...state,
    jobCode: jobCodeRef.current ?? undefined,
    selectFile,
    reset,
  };
}

// تابع شبیه‌سازی شده حذف شد
