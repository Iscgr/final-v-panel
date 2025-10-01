import React from 'react';

interface ProcessingProgressBarProps {
  percent: number;
  phase: string;
}

export const ProcessingProgressBar: React.FC<ProcessingProgressBarProps> = ({ percent, phase }) => {
  return (
    <div className="space-y-1" aria-label="پیشرفت پردازش">
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{phaseLabel(phase)}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 rounded bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

function phaseLabel(p: string) {
  switch (p) {
    case 'validating': return 'اعتبارسنجی';
    case 'uploading': return 'آپلود';
    case 'processing': return 'پردازش';
    case 'success': return 'موفق';
    case 'partial': return 'موفق (ناقص)';
    case 'error': return 'خطا';
    default: return '—';
  }
}

export default ProcessingProgressBar;
