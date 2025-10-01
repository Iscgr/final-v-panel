/**
 * Debounce Utility
 * ابزار کاربردی برای debounce کردن توابع
 */

export interface DebounceOptions {
  /** زمان تاخیر به میلی‌ثانیه */
  delay: number;
  /** حداکثر زمان تاخیر (trailing debounce) */
  maxWait?: number;
  /** اجرای فوری در شروع (leading) */
  leading?: boolean;
  /** اجرای در انتها (trailing) - پیش‌فرض true */
  trailing?: boolean;
}

export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): Promise<ReturnType<T>>;
  cancel(): void;
  flush(): Promise<ReturnType<T> | undefined>;
  pending(): boolean;
}

/**
 * ایجاد تابع debounced
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  options: DebounceOptions
): DebouncedFunction<T> {
  const { delay, maxWait, leading = false, trailing = true } = options;
  
  let timeoutId: NodeJS.Timeout | null = null;
  let maxTimeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;
  let lastInvokeTime = 0;
  let lastArgs: Parameters<T>;
  let lastThis: any;
  let result: ReturnType<T>;
  let pending = false;
  let resolvers: Array<{
    resolve: (value: ReturnType<T>) => void;
    reject: (reason: any) => void;
  }> = [];

  function invokeFunc(): ReturnType<T> {
    const args = lastArgs;
    const thisBinding = lastThis;
    
    lastArgs = undefined as any;
    lastThis = undefined;
    lastInvokeTime = Date.now();
    pending = false;
    
    try {
      result = func.apply(thisBinding, args);
      
      // Resolve all pending promises
      const currentResolvers = resolvers;
      resolvers = [];
      currentResolvers.forEach(({ resolve }) => resolve(result));
      
      return result;
    } catch (error) {
      // Reject all pending promises
      const currentResolvers = resolvers;
      resolvers = [];
      currentResolvers.forEach(({ reject }) => reject(error));
      throw error;
    }
  }

  function leadingEdge(): ReturnType<T> {
    lastInvokeTime = Date.now();
    timeoutId = setTimeout(timerExpired, delay);
    return leading ? invokeFunc() : result;
  }

  function remainingWait(time: number): number {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = delay - timeSinceLastCall;
    
    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }

  function shouldInvoke(time: number): boolean {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    
    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= delay ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired(): ReturnType<T> | undefined {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timeoutId = setTimeout(timerExpired, remainingWait(time));
    return undefined;
  }

  function trailingEdge(time: number): ReturnType<T> | undefined {
    timeoutId = null;
    
    if (trailing && lastArgs) {
      return invokeFunc();
    }
    lastArgs = undefined as any;
    lastThis = undefined;
    return result;
  }

  function cancel(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (maxTimeoutId !== null) {
      clearTimeout(maxTimeoutId);
      maxTimeoutId = null;
    }
    
    lastInvokeTime = 0;
    lastCallTime = 0;
    lastArgs = undefined as any;
    lastThis = undefined;
    pending = false;
    
    // Reject all pending promises
    const currentResolvers = resolvers;
    resolvers = [];
    currentResolvers.forEach(({ reject }) => 
      reject(new Error('Debounced function was cancelled'))
    );
  }

  function flush(): Promise<ReturnType<T> | undefined> {
    return new Promise((resolve, reject) => {
      if (timeoutId === null) {
        resolve(result);
        return;
      }
      
      resolvers.push({ resolve, reject });
      trailingEdge(Date.now());
    });
  }

  function debounced(this: any, ...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise((resolve, reject) => {
      const time = Date.now();
      const isInvoking = shouldInvoke(time);
      
      lastArgs = args;
      lastThis = this;
      lastCallTime = time;
      pending = true;
      
      resolvers.push({ resolve, reject });
      
      if (isInvoking) {
        if (timeoutId === null) {
          try {
            const leadResult = leadingEdge();
            if (leading) {
              const currentResolvers = resolvers;
              resolvers = [];
              currentResolvers.forEach(({ resolve }) => resolve(leadResult));
              return;
            }
          } catch (error) {
            const currentResolvers = resolvers;
            resolvers = [];
            currentResolvers.forEach(({ reject }) => reject(error));
            return;
          }
        }
      }
      
      if (timeoutId === null) {
        timeoutId = setTimeout(timerExpired, delay);
      }
      
      if (maxWait !== undefined && maxTimeoutId === null) {
        maxTimeoutId = setTimeout(() => {
          maxTimeoutId = null;
          if (pending) {
            trailingEdge(Date.now());
          }
        }, maxWait);
      }
    });
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.pending = () => pending;

  return debounced;
}

/**
 * Throttle تابع (debounce با leading=true و trailing=false)
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): DebouncedFunction<T> {
  return debounce(func, {
    delay,
    leading: true,
    trailing: false
  });
}

/**
 * کلاس مدیریت Debounce
 */
export class DebounceManager {
  private debouncedFunctions = new Map<string, DebouncedFunction<any>>();

  /**
   * ایجاد یا دریافت تابع debounced
   */
  get<T extends (...args: any[]) => any>(
    key: string,
    func: T,
    options: DebounceOptions
  ): DebouncedFunction<T> {
    if (!this.debouncedFunctions.has(key)) {
      this.debouncedFunctions.set(key, debounce(func, options));
    }
    return this.debouncedFunctions.get(key)!;
  }

  /**
   * لغو تابع debounced
   */
  cancel(key: string): void {
    const debouncedFunc = this.debouncedFunctions.get(key);
    if (debouncedFunc) {
      debouncedFunc.cancel();
    }
  }

  /**
   * اجرای فوری تابع debounced
   */
  async flush(key: string): Promise<any> {
    const debouncedFunc = this.debouncedFunctions.get(key);
    if (debouncedFunc) {
      return await debouncedFunc.flush();
    }
  }

  /**
   * بررسی pending بودن تابع
   */
  pending(key: string): boolean {
    const debouncedFunc = this.debouncedFunctions.get(key);
    return debouncedFunc ? debouncedFunc.pending() : false;
  }

  /**
   * حذف تابع debounced
   */
  remove(key: string): void {
    const debouncedFunc = this.debouncedFunctions.get(key);
    if (debouncedFunc) {
      debouncedFunc.cancel();
      this.debouncedFunctions.delete(key);
    }
  }

  /**
   * پاک‌سازی همه توابع
   */
  clear(): void {
    this.debouncedFunctions.forEach(func => func.cancel());
    this.debouncedFunctions.clear();
  }

  /**
   * تعداد توابع فعال
   */
  get size(): number {
    return this.debouncedFunctions.size;
  }
}

export default debounce;