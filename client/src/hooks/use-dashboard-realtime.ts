/**
 * 🔄 useDashboardRealtime Hook
 * Real-time Dashboard Updates via Server-Sent Events (SSE)
 * 
 * استفاده:
 * ```tsx
 * const Dashboard = () => {
 *   const { data, isLoading } = useQuery({ queryKey: ['/dashboard'], ... });
 *   const { isConnected, lastUpdate } = useDashboardRealtime();
 * 
 *   // Dashboard خودکار بروزرسانی می‌شود!
 * }
 * ```
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface DashboardEventData {
  type: 'full' | 'revenue' | 'debt' | 'overdue' | 'representatives' | 'health';
  timestamp: string;
  data: {
    totalRevenue?: number;
    totalDebt?: number;
    overdueInvoices?: number;
    activeRepresentatives?: number;
    systemIntegrityScore?: number;
    fullData?: any;
  };
  trigger: 'payment' | 'invoice' | 'allocation' | 'representative' | 'guard_event' | 'manual';
  metadata?: {
    representativeId?: number;
    invoiceId?: number;
    paymentId?: number;
  };
}

export function useDashboardRealtime() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // ایجاد SSE connection
    const eventSource = new EventSource('/api/dashboard/events');
    eventSourceRef.current = eventSource;

    // Event: Connected
    eventSource.addEventListener('connected', (e) => {
      const data = JSON.parse(e.data);
      console.log('📡 Dashboard SSE connected:', data);
      setIsConnected(true);
      setConnectionError(null);
      setLastUpdate(data.lastUpdate);
    });

    // Event: Full Dashboard Update
    eventSource.addEventListener('dashboard:updated', (e) => {
      const payload: DashboardEventData = JSON.parse(e.data);
      console.log('📊 Dashboard full update received:', payload);
      
      setLastUpdate(payload.timestamp);
      
      // Invalidate all dashboard queries
      queryClient.invalidateQueries({ queryKey: ['/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      
      // اگر representative مشخص است، آن را هم invalidate کن
      if (payload.metadata?.representativeId) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/representatives/${payload.metadata.representativeId}`] 
        });
      }
    });

    // Event: Revenue Widget Update
    eventSource.addEventListener('widget:revenue', (e) => {
      const payload: DashboardEventData = JSON.parse(e.data);
      console.log('💰 Revenue widget update:', payload.data.totalRevenue);
      
      setLastUpdate(payload.timestamp);
      
      // Optimistic update: به‌روزرسانی مستقیم cache بدون refetch
      queryClient.setQueryData(['/dashboard'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          totalRevenue: payload.data.totalRevenue
        };
      });
    });

    // Event: Debt Widget Update
    eventSource.addEventListener('widget:debt', (e) => {
      const payload: DashboardEventData = JSON.parse(e.data);
      console.log('📉 Debt widget update:', payload.data.totalDebt);
      
      setLastUpdate(payload.timestamp);
      
      queryClient.setQueryData(['/dashboard'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          totalDebt: payload.data.totalDebt
        };
      });
    });

    // Event: Overdue Widget Update
    eventSource.addEventListener('widget:overdue', (e) => {
      const payload: DashboardEventData = JSON.parse(e.data);
      console.log('⏰ Overdue widget update:', payload.data.overdueInvoices);
      
      setLastUpdate(payload.timestamp);
      
      queryClient.setQueryData(['/dashboard'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          overdueInvoices: payload.data.overdueInvoices
        };
      });
    });

    // Event: Representatives Widget Update
    eventSource.addEventListener('widget:representatives', (e) => {
      const payload: DashboardEventData = JSON.parse(e.data);
      console.log('👥 Representatives widget update:', payload.data.activeRepresentatives);
      
      setLastUpdate(payload.timestamp);
      
      queryClient.setQueryData(['/dashboard'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          activeRepresentatives: payload.data.activeRepresentatives
        };
      });
    });

    // Event: Health Score Widget Update
    eventSource.addEventListener('widget:health', (e) => {
      const payload: DashboardEventData = JSON.parse(e.data);
      console.log('💗 Health score update:', payload.data.systemIntegrityScore);
      
      setLastUpdate(payload.timestamp);
      
      queryClient.setQueryData(['/dashboard'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          systemIntegrityScore: payload.data.systemIntegrityScore
        };
      });
    });

    // Event: Heartbeat (keep-alive)
    eventSource.addEventListener('heartbeat', (e) => {
      const data = JSON.parse(e.data);
      console.log('💓 SSE Heartbeat:', data.timestamp);
      // فقط برای debug - نیازی به action نیست
    });

    // Error Handling
    eventSource.onerror = (error) => {
      console.error('❌ SSE Connection error:', error);
      setIsConnected(false);
      setConnectionError('Connection lost. Retrying...');
      
      // EventSource خودکار reconnect می‌کند
      // اما اگر بعد از 5 ثانیه reconnect نشد، fallback به polling
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          console.warn('⚠️ SSE reconnection failed. Falling back to polling.');
          queryClient.invalidateQueries({ queryKey: ['/dashboard'] });
        }
      }, 5000);
    };

    // Cleanup on unmount
    return () => {
      console.log('🔌 Closing SSE connection');
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, []); // فقط یکبار on mount

  return {
    isConnected,
    lastUpdate,
    connectionError,
    disconnect: () => {
      eventSourceRef.current?.close();
      setIsConnected(false);
    }
  };
}
