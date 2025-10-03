import { useQuery } from "@tanstack/react-query";
import InvoiceUpload from "@/components/invoice-upload";
import GuardMetricsPanel from "@/components/guard-metrics-panel";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";

/**
 * Dashboard - Simplified version without 5 statistical widgets
 * ✅ REMOVED: FinancialSummaryPanel containing:
 * - کل دریافت‌ها (Total Revenue)
 * - کل بدهی سیستم (Total Debt)
 * - فاکتورهای معوق (Overdue Invoices)
 * - نمایندگان فعال (Active Representatives)
 * - امتیاز سلامت (Health Score)
 */

export default function Dashboard() {
  // 🔄 Real-time Dashboard Updates via SSE (kept for future use)
  const { isConnected, lastUpdate, connectionError } = useDashboardRealtime();

  return (
    <div className="space-y-8">
      {/* Guard Metrics Observability Panel */}
      <div className="max-w-5xl mx-auto">
        <GuardMetricsPanel />
      </div>
      
      {/* Invoice Upload Component */}
      <div className="max-w-5xl mx-auto">
        <InvoiceUpload />
      </div>
    </div>
  );
}