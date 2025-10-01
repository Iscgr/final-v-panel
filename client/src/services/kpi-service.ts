import { queryClient } from '@/lib/queryClient';

export interface KPIResponse {
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  collectionRate: number; // درصد
  periodGrowth: number; // درصد
  updatedAt: string; // ISO
}

// Mock fetch - بعداً به API واقعی متصل می‌شود
export async function fetchKPI(): Promise<KPIResponse> {
  await new Promise(r => setTimeout(r, 400));
  return {
    totalInvoices: 1280,
    paidInvoices: 930,
    overdueInvoices: 120,
    collectionRate: 72.4,
    periodGrowth: 5.8,
    updatedAt: new Date().toISOString()
  };
}

export const kpiQueryKey = ['kpi','summary'];

export function prefetchKPI() {
  return queryClient.prefetchQuery({ queryKey: kpiQueryKey, queryFn: fetchKPI, staleTime: 60_000 });
}
