/**
 * تنظیمات و توابع کمکی برای React Query و درخواست‌های API
 */

import { QueryClient } from "@tanstack/react-query";

// ایجاد نمونه QueryClient واقعی
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 دقیقه
    },
  },
});

// تابع apiRequest برای درخواست‌های API
export async function apiRequest<T = any>(endpoint: string, options: RequestInit & { data?: any } = {}): Promise<T> {
  const url = endpoint.startsWith('/api/') ? endpoint : `/api${endpoint}`;
  
  const defaultOptions: RequestInit = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  // استخراج data از options و انتقال آن به body
  const { data, ...restOptions } = options as any;
  const fetchOptions = { 
    ...defaultOptions, 
    ...restOptions,
    body: data ? JSON.stringify(data) : restOptions.body 
  };
  
  // اگر body هنوز به صورت آبجکت باشد (و قبلاً از data استخراج نشده باشد)، آن را به JSON تبدیل می‌کنیم
  if (fetchOptions.body && typeof fetchOptions.body === 'object' && !(fetchOptions.body instanceof String)) {
    fetchOptions.body = JSON.stringify(fetchOptions.body);
  }
  
  try {
    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      // پاسخ غیر موفق
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed with status ${response.status}`);
    }
    
    // اگر محتوایی نباشد، آبجکت خالی بازگردان
    if (response.status === 204) {
      return {} as T;
    }
    
    // تلاش برای خواندن متن خام جهت هندل بدنه خالی
    const rawText = await response.text();
    if (!rawText) {
      // پاسخ 200 بدون بدنه: الگوی برخی روت‌های تنظیمات وقتی مقدار وجود ندارد
      return {} as T;
    }
    try {
      const data = JSON.parse(rawText);
      return data as T;
    } catch (parseErr) {
      console.error(`API parse error for ${endpoint}:`, parseErr, 'raw:', rawText);
      throw parseErr;
    }
  } catch (error) {
    console.error(`API request error for ${endpoint}:`, error);
    throw error;
  }
}

// تابع کمکی برای ایجاد تنظیمات query
export function getQueryFn<T = any>(endpoint: string, options: RequestInit = {}) {
  return async (): Promise<T> => {
    return apiRequest<T>(endpoint, options);
  };
}
