import React, { useState } from 'react';
import { useRevenueTrend } from '@/services/charting-service';

// سادۀ اولیه - بعداً با کتابخانه نمودار جایگزین می‌شود
export default function RevenueTrendChart({ window = '24h' }: { window?: string }) {
  const { data, isLoading, error } = useRevenueTrend(window);
  const [showTable, setShowTable] = useState(false);

  if (isLoading) return <div className="text-xs text-muted-foreground">بارگذاری نمودار...</div>;
  if (error) return <div className="text-xs text-red-600">خطا در دریافت داده روند</div>;
  if (!data || data.length === 0) return <div className="text-xs text-muted-foreground">داده‌ای موجود نیست</div>;

  // Render ساده SVG (sparklike)
  const max = Math.max(...data.map(p => p.amount));
  const min = Math.min(...data.map(p => p.amount));
  const range = max - min || 1;
  const points = data.map((p, idx) => {
    const x = (idx / (data.length - 1)) * 100;
    const y = 100 - ((p.amount - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">روند درآمد</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTable(v => !v)}
            className="text-[10px] px-2 py-1 rounded bg-muted hover:bg-muted/70 transition"
            aria-expanded={showTable}
            aria-controls="revenue-trend-table"
          >{showTable ? 'مخفی نمودار جدولی' : 'نمایش جدول داده'}</button>
          <span className="text-[10px] text-muted-foreground">بازه: {window}</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-40" aria-label="نمودار روند درآمد" role="img">
          <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} points={points} />
          <desc>نمای ساده روند درآمد بر اساس {data.length} نقطه</desc>
        </svg>
      </div>
      {showTable && (
        <div className="mt-3 overflow-x-auto">
          <table id="revenue-trend-table" className="w-full text-[11px] border" role="table" aria-label="جدول داده روند درآمد">
            <thead>
              <tr className="bg-muted/30" role="row">
                <th role="columnheader" className="p-1 text-right">شماره</th>
                <th role="columnheader" className="p-1 text-right">زمان</th>
                <th role="columnheader" className="p-1 text-right">مبلغ</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p, idx) => (
                <tr key={p.timestamp} role="row" className="odd:bg-muted/10">
                  <td role="cell" className="p-1">{idx + 1}</td>
                  <td role="cell" className="p-1 ltr:font-mono rtl:font-mono">{new Date(p.timestamp).toLocaleString('fa-IR')}</td>
                  <td role="cell" className="p-1 font-semibold">{p.amount.toLocaleString('fa-IR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
