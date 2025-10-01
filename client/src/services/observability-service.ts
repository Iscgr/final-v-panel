import { useEffect } from 'react';

// لاگر ساختاری برای کنسول
const structuredLog = (category: string, event: string, payload: object = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `%c[OBS] %c${category} %c:: %c${event}`,
      'color: #999',
      'color: #3b82f6; font-weight: bold',
      'color: #999',
      'color: #fff',
      payload
    );
  }
  // در حالت production می‌توان به سرویس telemetry ارسال کرد
};

// هوک برای لاگ mount/unmount
export const useSectionMountLogger = (sectionId: string) => {
  useEffect(() => {
    structuredLog('Lifecycle', 'Mount', { sectionId });
    return () => {
      structuredLog('Lifecycle', 'Unmount', { sectionId });
    };
  }, [sectionId]);
};

// سرویس لاگ رویدادهای خاص
export const observabilityService = {
  logUploadStart: (fileSize: number, fileType: string) => {
    performance.mark('upload:start');
    structuredLog('Upload', 'Start', { fileSize, fileType });
  },
  logUploadSuccess: (recordCount: number) => {
    performance.mark('upload:end');
    const measure = performance.measure('upload_duration', 'upload:start', 'upload:end');
    structuredLog('Upload', 'Success', { recordCount, durationMs: measure.duration });
  },
  logUploadFail: (errorType: string, reason: string) => {
    performance.mark('upload:end');
    const measure = performance.measure('upload_duration', 'upload:start', 'upload:end');
    structuredLog('Upload', 'Fail', { errorType, reason, durationMs: measure.duration });
  },
};
