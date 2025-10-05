// Unified Portal Content Service (Phase 2)
// این سرویس تمام درخواست‌های CRUD و انتشار را برای سند واحد پرتال مدیریت می‌کند.

export interface UnifiedSection { id: string; title: string; body: string; order: number; }
export interface UnifiedAnnouncement { id: string; title: string; content: string; priority: number; type: 'info'|'warning'|'success'|'error'; isActive: boolean; }
export interface UnifiedDownload { id: string; title: string; description?: string; downloadLink: string; qrCodeUrl?: string|null; videoUrl?: string|null; isActive: boolean; displayOrder: number; }
export interface UnifiedDraft {
  displayTitle: string;
  sections: UnifiedSection[];
  announcements: UnifiedAnnouncement[];
  downloads: UnifiedDownload[];
  metadata?: Record<string, any>;
}

export interface UnifiedDraftEnvelope {
  success: boolean;
  data: { draftJson: UnifiedDraft; draftVersion: number; publishedVersion: number; status: string };
}

async function http<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...options });
  if(!res.ok) throw new Error(`request_failed:${res.status}`);
  return res.json();
}

export const PortalContentUnifiedService = {
  getDraft(): Promise<UnifiedDraftEnvelope> { return http('/api/admin/portal-content-unified/draft'); },
  saveDraft(draftJson: UnifiedDraft) { return http('/api/admin/portal-content-unified/draft', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ draftJson }) }); },
  publish() { return http('/api/admin/portal-content-unified/publish', { method:'POST' }); },
  getStatus() { return http('/api/admin/portal-content-unified/status'); },
  getDiff() { return http('/api/admin/portal-content-unified/diff'); }
};
