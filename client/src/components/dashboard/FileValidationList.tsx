import React from 'react';

interface FileValidationListProps {
  issues: { path: string; message: string }[];
  limit?: number;
}

export const FileValidationList: React.FC<FileValidationListProps> = ({ issues, limit = 10 }) => {
  if (!issues.length) return null;
  return (
    <div className="rounded border p-2 bg-muted/30 max-h-40 overflow-auto text-[11px] leading-relaxed" aria-label="نتایج اعتبارسنجی">
      {issues.slice(0, limit).map((i, idx) => (
        <div key={idx} className="flex gap-2">
          <span className="text-red-500 font-medium">{i.path}</span>
          <span className="text-muted-foreground">{i.message}</span>
        </div>
      ))}
      {issues.length > limit && <div className="text-xs text-muted-foreground mt-2">{issues.length - limit} مورد دیگر ...</div>}
    </div>
  );
};

export default FileValidationList;
