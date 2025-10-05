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
    
    // تلاش برای خواندن متن خام جهت هندل بدنه خالی یا فقط whitespace
    const rawText = await response.text();
    const trimmed = rawText.trim();

    // سناریوهای معمول:
    // 1) تنظیم وجود ندارد => storage.getSetting برمی‌گرداند undefined => Express res.json(undefined) بدنه‌ای ارسال نمی‌کند (یا فقط CRLF)
    // 2) پاسخ 204 => قبلاً هندل شد
    // 3) پاسخ معتبر JSON
    if (!trimmed.length) {
      // بازگشت آبجکت خالی به عنوان placeholder سازگار
      return {} as T;
    }

    // اگر هدر content-type JSON نیست ولی بدنه داریم، یک پیام هشدار ثبت کنیم (ممکن است HTML خطای reverse proxy باشد)
    const contentType = response.headers.get('content-type') || '';
    if (!/application\/json/i.test(contentType)) {
      // اگر هدر HTML است، یا بدنه شبیه HTML است، هشدار بده و آبجکت خالی برگردان
      if (/text\/html|application\/xhtml\+xml/i.test(contentType) ||
          /^\s*(<!DOCTYPE html>|<html[\s>]|<body[\s>])/i.test(trimmed)) {
        console.warn(`⚠️ Non-JSON response (HTML-like) دریافت شد از ${endpoint}. بدنه کوتاه شده:`, trimmed.slice(0,120));
        return {} as T; // عدم پرتاب خطا برای پایداری UI؛ می‌توان بعداً مسیر خاص افزود
      }
    }

    try {
      const data = JSON.parse(trimmed);
      return data as T;
    } catch (parseErr) {
      console.error(`API parse error for ${endpoint}:`, parseErr, 'raw (first 120 chars):', trimmed.slice(0,120));
      // به جای پرتاب خطا که باعث spam در تب تنظیمات می‌شود، مقدار خالی بازمی‌گردانیم تا فرم‌ها بتوانند defaultValues را نگه دارند
      return {} as T;
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
