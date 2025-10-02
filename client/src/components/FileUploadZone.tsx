import React, { useCallback, useState } from 'react';
import { Upload, X, FileImage, FileVideo, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // in MB
  type: 'image' | 'video';
  currentFileUrl?: string;
  isUploading?: boolean;
  onRemove?: () => void;
}

export default function FileUploadZone({
  onFileSelect,
  accept = 'image/*',
  maxSize = 5,
  type,
  currentFileUrl,
  isUploading = false,
  onRemove
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentFileUrl || null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): string | null => {
    // بررسی نوع فایل
    if (type === 'image' && !file.type.startsWith('image/')) {
      return 'فقط فایل‌های تصویری مجاز هستند';
    }
    if (type === 'video' && !file.type.startsWith('video/')) {
      return 'فقط فایل‌های ویدئویی مجاز هستند';
    }

    // بررسی حجم فایل
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      return `حجم فایل نباید بیشتر از ${maxSize} مگابایت باشد`;
    }

    return null;
  };

  const handleFile = (file: File) => {
    setError(null);
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // ایجاد پیش‌نمایش
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    onFileSelect(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [onFileSelect]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setError(null);
    if (onRemove) {
      onRemove();
    }
  };

  return (
    <div className="space-y-3">
      {/* منطقه آپلود */}
      {!previewUrl && (
        <div
          className={cn(
            'relative border-2 border-dashed rounded-lg transition-colors duration-200',
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
            isUploading && 'pointer-events-none opacity-50'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          <div className="p-8 text-center">
            {isUploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                <p className="text-sm text-gray-600">در حال آپلود...</p>
              </div>
            ) : (
              <>
                {type === 'image' ? (
                  <FileImage className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                ) : (
                  <FileVideo className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                )}
                <p className="text-sm text-gray-600 mb-2">
                  فایل را اینجا بکشید یا کلیک کنید
                </p>
                <p className="text-xs text-gray-400">
                  حداکثر {maxSize} مگابایت
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* پیش‌نمایش */}
      {previewUrl && (
        <div className="relative rounded-lg overflow-hidden border border-gray-200">
          {type === 'image' ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-48 object-contain bg-gray-50"
            />
          ) : (
            <video
              src={previewUrl}
              controls
              className="w-full h-48 bg-black"
            />
          )}
          {!isUploading && (
            <button
              onClick={handleRemove}
              className="absolute top-2 left-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              title="حذف فایل"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* پیام خطا */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}
