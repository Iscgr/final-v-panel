// Service ماژولار برای مدیریت محتوای پرتال (بلوک‌ها، اطلاعیه‌ها، دانلودها)
// هدف: جداسازی concerns و قابل تست کردن منطق API

export interface PortalContentBlockDTO {
  id: number;
  blockKey: string;
  title: string;
  body: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface AnnouncementDTO {
  id: number;
  title: string;
  content: string;
  priority: number;
  type: string;
  isActive: boolean;
  expiresAt: string | null;
}

export interface AppDownloadDTO {
  id: number;
  title: string;
  description: string | null;
  downloadLink: string;
  qrCodeUrl: string | null;
  videoUrl: string | null;
  displayOrder: number;
  isActive: boolean;
}

// Generic fetch helper with error handling
async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const message = json.error || res.statusText || 'API Error';
    throw new Error(message);
  }
  return json as T;
}

// Blocks
export const PortalBlocksAPI = {
  list: () => apiFetch<{ success: boolean; data: PortalContentBlockDTO[] }>(`/api/admin/portal-content-blocks`),
  update: (blockKey: string, payload: { title: string; body: string }) =>
    apiFetch<{ success: boolean }>(`/api/admin/portal-content-blocks/${blockKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
  full: () => apiFetch<{ success: boolean; data: any }>(`/api/admin/portal-content-blocks/full`),
  status: () => apiFetch<{ success: boolean; data: { contentVersion: number; lastPublishedAt: string | null; lastPublishedBy: string | null } }>(`/api/admin/portal-content-blocks/status`),
  publish: () => apiFetch<{ success: boolean; data: { contentVersion: number; lastPublishedAt: string; lastPublishedBy: string | null } }>(`/api/admin/portal-content-blocks/publish`, { method: 'POST' })
};

// Announcements
export const AnnouncementsAPI = {
  list: () => apiFetch<{ success: boolean; data: AnnouncementDTO[] }>(`/api/admin/announcements`),
  create: (payload: Partial<AnnouncementDTO>) => apiFetch<{ success: boolean; data: AnnouncementDTO }>(`/api/admin/announcements`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  }),
  update: (id: number, payload: Partial<AnnouncementDTO>) => apiFetch<{ success: boolean }>(`/api/admin/announcements/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  }),
  delete: (id: number) => apiFetch<{ success: boolean }>(`/api/admin/announcements/${id}`, { method: 'DELETE' })
};

// App Downloads
export const AppDownloadsAPI = {
  list: () => apiFetch<{ success: boolean; data: AppDownloadDTO[] }>(`/api/admin/app-downloads`),
  create: (payload: Partial<AppDownloadDTO>) => apiFetch<{ success: boolean; data: AppDownloadDTO }>(`/api/admin/app-downloads`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  }),
  update: (id: number, payload: Partial<AppDownloadDTO>) => apiFetch<{ success: boolean }>(`/api/admin/app-downloads/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  }),
  delete: (id: number) => apiFetch<{ success: boolean }>(`/api/admin/app-downloads/${id}`, { method: 'DELETE' }),
  reorder: (order: { id: number; displayOrder: number }[]) => apiFetch<{ success: boolean; updated?: number }>(`/api/admin/app-downloads/reorder`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order })
  })
};

export const PortalContentService = {
  blocks: PortalBlocksAPI,
  announcements: AnnouncementsAPI,
  downloads: AppDownloadsAPI
};

// کلیدهای ثابت کوئری برای تمرکز در invalidate ها
export const portalContentQueryKeys = {
  blocks: ['/api/admin/portal-content-blocks'] as const,
  announcements: ['/api/admin/announcements'] as const,
  downloads: ['/api/admin/app-downloads'] as const,
  full: ['/api/admin/portal-content-blocks/full'] as const
};

/**
 * Helper واحد برای invalidation کوئری‌های محتوای پرتال.
 * مزایا:
 *  - جلوگیری از تکرار queryKey ها در فایل‌های متعدد
 *  - آماده‌سازی برای اضافه شدن publish/status در آینده (Task های Phase 4)
 *  - امکان گسترش جهت prefetch یا refetch مشروط
 */
export async function invalidatePortalContent(
  queryClient: import('@tanstack/react-query').QueryClient,
  scope: { blocks?: boolean; announcements?: boolean; downloads?: boolean; full?: boolean } = {}
) {
  const { blocks = true, announcements = true, downloads = true, full = true } = scope;
  const tasks: Promise<any>[] = [];
  if (blocks) tasks.push(queryClient.invalidateQueries({ queryKey: portalContentQueryKeys.blocks }));
  if (announcements) tasks.push(queryClient.invalidateQueries({ queryKey: portalContentQueryKeys.announcements }));
  if (downloads) tasks.push(queryClient.invalidateQueries({ queryKey: portalContentQueryKeys.downloads }));
  if (full) tasks.push(queryClient.invalidateQueries({ queryKey: portalContentQueryKeys.full }));
  await Promise.all(tasks);
}

// ملاحظات آینده:
// - افزودن endpoint تنظیمات تجمیعی برای Save All
// - کش کردن پایه‌ای با AbortController
// - ادغام با سیستم feature flag برای سویچ shadow/full
// - افزودن Zod schema برای اعتبارسنجی شدیدتر پاسخ‌ها
