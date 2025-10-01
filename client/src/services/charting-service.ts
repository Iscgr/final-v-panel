import { useQuery } from '@tanstack/react-query';

export interface RevenuePoint { timestamp: string; amount: number; }
export interface AgingBuckets { current: number; bucket_1_30: number; bucket_31_60: number; bucket_61_90: number; bucket_90_plus: number; }

async function fetchRevenueTrend(window: string = '24h'): Promise<RevenuePoint[]> {
  const res = await fetch(`/api/dashboard/revenue-trend?window=${window}`);
  if (!res.ok) throw new Error('failed_revenue_trend');
  const json = await res.json();
  return json.data || [];
}

async function fetchAgingBuckets(): Promise<AgingBuckets> {
  const res = await fetch('/api/dashboard/aging-buckets');
  if (!res.ok) throw new Error('failed_aging_buckets');
  const json = await res.json();
  return json.data;
}

export function useRevenueTrend(window: string = '24h') {
  return useQuery({ queryKey: ['revenue-trend', window], queryFn: () => fetchRevenueTrend(window), staleTime: 5 * 60_000 });
}

export function useAgingBuckets() {
  return useQuery({ queryKey: ['aging-buckets'], queryFn: fetchAgingBuckets, staleTime: 5 * 60_000 });
}
