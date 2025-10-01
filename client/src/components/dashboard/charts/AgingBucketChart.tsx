import React, { useState } from 'react';
import { useAgingBuckets } from '@/services/charting-service';

export default function AgingBucketChart() {
  const { data, isLoading, error } = useAgingBuckets();
  const [showTable, setShowTable] = useState(false);

  if (isLoading) return <div className="text-xs text-muted-foreground">بارگذاری توزیع سررسید...</div>;
  if (error) return <div className="text-xs text-red-600">خطا در دریافت داده سررسید</div>;
  if (!data) return null;

  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([k,v]) => v as number));

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">توزیع سررسید بدهی</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTable(v => !v)}
            className="text-[10px] px-2 py-1 rounded bg-muted hover:bg-muted/70 transition"
            aria-expanded={showTable}
            aria-controls="aging-buckets-table"
          >{showTable ? 'مخفی جدول داده' : 'نمایش جدول داده'}</button>
          <span className="text-[10px] text-muted-foreground">درصد نسبی</span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 items-end h-40" aria-label="نمودار ستونی سررسید" role="img">
        {entries.map(([bucket, value]) => {
          const heightPct = (value as number) / max * 100;
          return (
            <div key={bucket} className="flex flex-col items-center">
              <div className="w-full bg-primary/20 rounded-t flex items-end" style={{height: '100%'}}>
                <div className="w-full bg-primary rounded-t" style={{height: `${heightPct}%`}} aria-label={`${bucket} مقدار ${value}`}></div>
              </div>
              <span className="mt-1 text-[10px] text-muted-foreground text-center">{bucket.replace('bucket_','').replace('_','-')}</span>
            </div>
          );
        })}
      </div>
      <desc>نمودار ساده توزیع مبلغ در باکت‌های سررسید</desc>
      {showTable && (
        <div className="mt-3 overflow-x-auto">
          <table id="aging-buckets-table" className="w-full text-[11px] border" role="table" aria-label="جدول داده سررسید">
            <thead>
              <tr className="bg-muted/30" role="row">
                <th role="columnheader" className="p-1 text-right">باکت</th>
                <th role="columnheader" className="p-1 text-right">مقدار</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([bucket, value]) => (
                <tr key={bucket} role="row" className="odd:bg-muted/10">
                  <td role="cell" className="p-1">{bucket}</td>
                  <td role="cell" className="p-1 font-semibold">{(value as number).toLocaleString('fa-IR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
