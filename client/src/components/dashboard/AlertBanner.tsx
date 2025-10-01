import React, { useEffect, useState } from 'react';
import type { KPIResponse } from '@/services/kpi-service';

interface AlertBannerProps {
  kpi?: KPIResponse;
  loading?: boolean;
}

interface DerivedAlert {
  id: string;
  level: 'warning' | 'critical';
  message: string;
  rationale: string;
}

const DISMISS_KEY = 'dashboard_alerts_dismissed_v1';

function loadDismissed(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}
function saveDismissed(map: Record<string, number>) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ kpi, loading }) => {
  const [dismissed, setDismissed] = useState<Record<string, number>>({});

  useEffect(() => { setDismissed(loadDismissed()); }, []);

  const alerts: DerivedAlert[] = [];
  if (kpi && !loading) {
    if (kpi.collectionRate < 60) {
      alerts.push({
        id: 'collectionRateLow',
        level: kpi.collectionRate < 45 ? 'critical' : 'warning',
        message: 'نرخ وصول پایین است',
        rationale: `مقدار فعلی ${kpi.collectionRate.toFixed(1)}% (هدف >= 60%)`
      });
    }
    if (kpi.periodGrowth < 0) {
      alerts.push({
        id: 'negativeGrowth',
        level: kpi.periodGrowth < -5 ? 'critical' : 'warning',
        message: 'رشد دوره‌ای منفی',
        rationale: `رشد ${kpi.periodGrowth.toFixed(1)}% نسبت به دوره قبل`
      });
    }
    const overdueRatio = kpi.overdueInvoices / Math.max(1, kpi.totalInvoices);
    if (overdueRatio > 0.15) {
      alerts.push({
        id: 'overdueHigh',
        level: overdueRatio > 0.25 ? 'critical' : 'warning',
        message: 'نسبت فاکتورهای معوق بالا است',
        rationale: `معوق ${kpi.overdueInvoices} از ${kpi.totalInvoices} (${(overdueRatio*100).toFixed(1)}%)`
      });
    }
  }

  const activeAlerts = alerts.filter(a => !dismissed[a.id]);

  function dismiss(id: string) {
    const next = { ...dismissed, [id]: Date.now() };
    setDismissed(next); saveDismissed(next);
  }

  if (loading) {
    return (
      <div aria-busy="true" className="rounded-md border p-3 text-xs text-muted-foreground">در حال محاسبه وضعیت هشدار...</div>
    );
  }
  if (activeAlerts.length === 0) return null;

  return (
    <div className="space-y-2" aria-label="هشدارهای KPI" role="region">
      {activeAlerts.map(alert => (
        <div
          key={alert.id}
          className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${alert.level === 'critical' ? 'bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-300' : 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300'}`}
          role="alert"
          aria-live="polite"
        >
          <div>
            <div className="font-semibold text-xs mb-0.5">{alert.message}</div>
            <div className="text-[11px] opacity-90 leading-relaxed">{alert.rationale}</div>
          </div>
            <button
              onClick={() => dismiss(alert.id)}
              className="text-[10px] px-2 py-1 rounded bg-muted hover:bg-muted/70 transition"
              aria-label="بستن هشدار"
            >بستن</button>
        </div>
      ))}
    </div>
  );
};

export default AlertBanner;