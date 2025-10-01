/**
 * React Hook برای Debounce
 * استفاده آسان از debounce در کامپوننت‌های React
 */

import { useCallback, useEffect, useRef } from 'react';
import { debounce, throttle, type DebounceOptions, type DebouncedFunction } from '../utils/debounce';

/**
 * Hook برای debounce کردن تابع
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  options: DebounceOptions
): DebouncedFunction<T> {
  const callbackRef = useRef(callback);
  const debouncedRef = useRef<DebouncedFunction<T>>();

  // به‌روزرسانی callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // ایجاد debounced function
  if (!debouncedRef.current) {
    debouncedRef.current = debounce(
      (...args: Parameters<T>) => callbackRef.current(...args),
      options
    );
  }

  // پاک‌سازی در unmount
  useEffect(() => {
    return () => {
      debouncedRef.current?.cancel();
    };
  }, []);

  return debouncedRef.current;
}

/**
 * Hook برای throttle کردن تابع
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): DebouncedFunction<T> {
  return useDebounce(callback, {
    delay,
    leading: true,
    trailing: false
  });
}

/**
 * Hook برای debounce کردن مقدار
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  const updateValue = useDebounce(
    (newValue: T) => setDebouncedValue(newValue),
    { delay }
  );

  React.useEffect(() => {
    updateValue(value);
  }, [value, updateValue]);

  return debouncedValue;
}

/**
 * Hook برای debounce کردن callback با dependencies
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList,
  options: DebounceOptions
): DebouncedFunction<T> {
  const memoizedCallback = useCallback(callback, deps);
  return useDebounce(memoizedCallback, options);
}

/**
 * Hook برای مدیریت debounce state
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number
): [T, T, (value: T) => void, boolean] {
  const [immediateValue, setImmediateValue] = React.useState(initialValue);
  const [debouncedValue, setDebouncedValue] = React.useState(initialValue);
  const [isPending, setIsPending] = React.useState(false);

  const updateDebouncedValue = useDebounce(
    (newValue: T) => {
      setDebouncedValue(newValue);
      setIsPending(false);
    },
    { delay }
  );

  const setValue = useCallback((newValue: T) => {
    setImmediateValue(newValue);
    setIsPending(true);
    updateDebouncedValue(newValue);
  }, [updateDebouncedValue]);

  return [immediateValue, debouncedValue, setValue, isPending];
}

/**
 * Hook برای debounce async operations
 */
export function useAsyncDebounce<T extends (...args: any[]) => Promise<any>>(
  asyncCallback: T,
  options: DebounceOptions & { 
    onSuccess?: (result: Awaited<ReturnType<T>>) => void;
    onError?: (error: any) => void;
  }
): {
  execute: DebouncedFunction<T>;
  loading: boolean;
  error: any;
  cancel: () => void;
} {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<any>(null);
  const { onSuccess, onError, ...debounceOptions } = options;

  const wrappedCallback = useCallback(async (...args: Parameters<T>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await asyncCallback(...args);
      onSuccess?.(result);
      return result;
    } catch (err) {
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [asyncCallback, onSuccess, onError]);

  const debouncedExecute = useDebounce(wrappedCallback, debounceOptions);

  const cancel = useCallback(() => {
    debouncedExecute.cancel();
    setLoading(false);
    setError(null);
  }, [debouncedExecute]);

  return {
    execute: debouncedExecute,
    loading,
    error,
    cancel
  };
}

// Import React for hooks
import React from 'react';

export default useDebounce;