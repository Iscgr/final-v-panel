import { useQuery } from '@tanstack/react-query';

export interface RecentActivityResponseItem {
  id: string;
  type: 'invoice_created' | 'invoice_updated' | 'invoice_deleted' | 'system_error';
  actor?: string;
  at: string;
  meta?: Record<string, any>;
}

interface RecentActivityAPIResponse {
  success: boolean;
  items: RecentActivityResponseItem[];
}

async function fetchRecentActivity(limit = 30): Promise<RecentActivityResponseItem[]> {
  const res = await fetch(`/api/activity/recent?limit=${limit}`, { credentials: 'include' });
  if (!res.ok) throw new Error('ACTIVITY_FETCH_FAILED');
  const data: RecentActivityAPIResponse = await res.json();
  return data.items || [];
}

export function useRecentActivity(options?: { limit?: number; refetchInterval?: number }) {
  const { limit = 30, refetchInterval = 30000 } = options || {};
  return useQuery({
    queryKey: ['recent-activity', limit],
    queryFn: () => fetchRecentActivity(limit),
    refetchInterval,
    refetchIntervalInBackground: true,
    staleTime: 15000,
    gcTime: 5 * 60 * 1000
  });
}

export const activityQueryKeys = { recent: (limit = 30) => ['recent-activity', limit] as const };
