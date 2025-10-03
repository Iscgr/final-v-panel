import React from 'react';
import { ImportJobLite } from './types';

interface StageTimelineProps { job: ImportJobLite; }

const STAGES: { key: string; label: string; }[] = [
  { key: 'pending', label: 'در صف' },
  { key: 'validating', label: 'اعتبارسنجی' },
  { key: 'ingesting', label: 'ورود داده' },
  { key: 'enriching', label: 'غنی‌سازی' },
  { key: 'completed', label: 'اتمام' }
];

export const StageTimeline: React.FC<StageTimelineProps> = ({ job }) => {
  const activeIndex = STAGES.findIndex(s => s.key === (job.status === 'failed' ? 'enriching' : job.status));
  return (
    <div className="json-progress-timeline" aria-label="مراحل پردازش">
      {STAGES.map((s, idx) => {
        const state: 'done' | 'active' | 'upcoming' = idx < activeIndex ? 'done' : idx === activeIndex ? 'active' : 'upcoming';
        return (
          <div key={s.key} className={`jp-stage jp-${state}`}>
            <div className="jp-node">
              <span className="jp-node-core" />
              {state === 'active' && <span className="jp-pulse" />}
              {state === 'done' && <span className="jp-check">✓</span>}
            </div>
            <div className="jp-label">{s.label}</div>
            {idx < STAGES.length - 1 && <div className="jp-connector" />}
          </div>
        );
      })}
      {job.status === 'failed' && (
        <div className="jp-failed-badge">خطا</div>
      )}
    </div>
  );
};
