// Service layer for Portal Content Blocks (Phase 1)
// Provides typed helpers + optimistic update patterns (extendable)

export interface PortalContentBlock {
  id: number;
  blockKey: string;
  title: string;
  body: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export async function fetchPortalContentBlocks(): Promise<PortalContentBlock[]> {
  const res = await fetch('/api/admin/portal-content-blocks');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'load_failed');
  return json.data || [];
}

export async function updatePortalContentBlock(blockKey: string, payload: { title: string; body: string }): Promise<void> {
  const res = await fetch(`/api/admin/portal-content-blocks/${blockKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'save_failed');
}
