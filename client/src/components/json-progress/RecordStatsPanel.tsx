import React, { useMemo } from 'react';

interface RecordStatsPanelProps {
  processed: number; total: number; errors: number; startedAt?: string | null;
}

export const RecordStatsPanel: React.FC<RecordStatsPanelProps> = ({ processed, total, errors, startedAt }) => {
  const speed = useMemo(() => {
    if (!startedAt) return 0;
    const elapsedSec = (Date.now() - new Date(startedAt).getTime()) / 1000;
    if (elapsedSec <= 0) return 0;
    return Math.round(processed / elapsedSec);
  }, [processed, startedAt]);

  const eta = useMemo(() => {
    if (!speed || speed === 0 || total === 0) return '—';
    const remaining = total - processed;
    if (remaining <= 0) return '0s';
    const sec = Math.round(remaining / speed);
    if (sec < 60) return sec + 's';
    const m = Math.floor(sec / 60); const s = sec % 60;
    return `${m}m ${s}s`;
  }, [speed, processed, total]);

  return (
    <div className="json-progress-stats" aria-label="آمار پردازش">
      <div className="jp-stat"><span className="jp-stat-label">کل</span><span className="jp-stat-value">{total.toLocaleString('fa-IR')}</span></div>
      <div className="jp-stat"><span className="jp-stat-label">پردازش</span><span className="jp-stat-value jp-blue">{processed.toLocaleString('fa-IR')}</span></div>
      <div className="jp-stat"><span className="jp-stat-label">خطا</span><span className={`jp-stat-value ${errors? 'jp-red':'jp-green'}`}>{errors.toLocaleString('fa-IR')}</span></div>
      <div className="jp-stat"><span className="jp-stat-label">سرعت</span><span className="jp-stat-value">{speed.toLocaleString('fa-IR')}/s</span></div>
      <div className="jp-stat"><span className="jp-stat-label">ETA</span><span className="jp-stat-value">{eta}</span></div>
    </div>
  );
};
