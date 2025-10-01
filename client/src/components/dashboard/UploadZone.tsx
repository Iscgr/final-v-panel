import React, { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  onFileAccepted?: (file: File) => void;
  disabled?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onFileAccepted, disabled }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const onSelect = useCallback((file: File) => {
    setFileName(file.name);
    onFileAccepted?.(file);
  }, [onFileAccepted]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onSelect(f);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onSelect(f);
  };

  return (
    <div className="space-y-2">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          dragActive ? 'border-primary bg-primary/5' : 'border-muted'
        )}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click(); }}
        aria-label="انتخاب یا رها کردن فایل JSON"
      >
        <p className="text-sm text-muted-foreground">
          {fileName ? `فایل انتخاب شده: ${fileName}` : 'فایل JSON را اینجا رها کنید یا کلیک کنید'}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
};

export default UploadZone;
