import React from 'react';
import { useAnimatedNumber } from './useAnimatedNumber';

interface OverallProgressBarProps {
  percent: number; processed: number; total: number;
}

export const OverallProgressBar: React.FC<OverallProgressBarProps> = ({ percent, processed, total }) => {
  const tween = useAnimatedNumber(percent);
  return (
    <div className="json-progress-bar" aria-label="پیشرفت کلی">
      <div className="jp-bar-header">
        <span className="jp-bar-title">پیشرفت کلی</span>
        <span className="jp-bar-percent" aria-live="polite">{tween}%</span>
      </div>
      <div className="jp-bar-outer">
        <div className="jp-bar-inner" style={{ width: `${percent}%` }} />
        {percent < 100 && <div className="jp-bar-shimmer" />}
      </div>
      <div className="jp-bar-stats" aria-live="polite">
        <span>{processed.toLocaleString('fa-IR')} از {total.toLocaleString('fa-IR')} رکورد</span>
      </div>
    </div>
  );
};
