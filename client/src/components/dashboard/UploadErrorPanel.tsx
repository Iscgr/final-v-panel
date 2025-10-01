import React from 'react';

interface UploadErrorPanelProps { error?: string; onReset?: () => void; }

export const UploadErrorPanel: React.FC<UploadErrorPanelProps> = ({ error, onReset }) => {
  if (!error) return null;
  return (
    <div className="rounded-md border border-red-400/40 bg-red-500/10 p-3 text-[12px] space-y-2" role="alert" aria-live="assertive">
      <div className="font-medium text-red-500">خطا در فرآیند</div>
      <div className="text-red-400">{error}</div>
      {onReset && <button onClick={onReset} className="px-2 py-1 rounded bg-red-500 text-white text-[11px]">شروع مجدد</button>}
    </div>
  );
};

export default UploadErrorPanel;
