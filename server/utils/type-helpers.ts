/**
 * Type Assertion Helper
 * این فایل helper هایی برای کمک به تایپ‌اسکریپت در تشخیص تایپ‌ها ارائه می‌دهد
 */

// Import original persian-date with any type
import PersianDateLib from 'persian-date';

/**
 * Helper function for dealing with task.aiContext in AI services
 */
export function assertAIContext<T = any>(context: unknown): T {
  if (typeof context !== 'object' || context === null) {
    return {} as T; // Return empty object as fallback
  }
  return context as T;
}

/**
 * Helper for session assertions
 */
export interface SessionWithUser {
  authenticated?: boolean;
  userId?: string;
  username?: string;
  userRole?: string;
  permissions?: string[];
  [key: string]: any;
}

/**
 * Create a type-safe wrapper around the persian-date library
 */
export function createPersianDate(input?: any): any {
  return new PersianDateLib(input);
}

// Export persian-date as class
export const PersianDate = PersianDateLib;

/**
 * Helper for error handling with proper types
 */
export function handleError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}