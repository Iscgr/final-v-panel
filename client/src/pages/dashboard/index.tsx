import { useEffect } from 'react';
import { CheckCircle2, RefreshCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUploadFlow } from '@/hooks/use-upload-flow';
import UploadZone from '@/components/dashboard/UploadZone';
import ProcessingProgressBar from '@/components/dashboard/ProcessingProgressBar';
import FileValidationList from '@/components/dashboard/FileValidationList';
import UploadErrorPanel from '@/components/dashboard/UploadErrorPanel';
import { LiveProcessingMonitor } from '@/components/dashboard/LiveProcessingMonitor';

export default function DashboardPage() {
  const { toast } = useToast();
  const { phase, percent, issues, error, jobCode, selectFile, reset, file } = useUploadFlow();

  useEffect(() => {
    if (phase === 'error' && error) {
      toast({
        title: 'خطای آپلود',
        description: error,
        variant: 'destructive',
      });
    }
  }, [phase, error, toast]);

  const showProgress = phase === 'validating' || phase === 'uploading';
  const showSuccess = phase === 'success' || phase === 'processing';
  const showError = phase === 'error';
  const showValidationIssues = phase === 'validating' && issues.length > 0;
  const showLiveMonitor = !!jobCode;
  const isUploading = phase === 'uploading';

  if (showLiveMonitor) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-800">وضعیت پردازش زنده</h1>
            <button onClick={reset} className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-1.5">
              <RefreshCcw className="w-3 h-3" />
              شروع مجدد
            </button>
          </div>
          <LiveProcessingMonitor jobCode={jobCode} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">پردازش فایل ریز جزئیات</h1>
            <p className="text-sm text-gray-500 mt-1">فایل JSON حاوی ریز جزئیات را برای پردازش و اعتبارسنجی بارگذاری کنید.</p>
          </div>
          {(showProgress || showSuccess || showError) && (
            <button onClick={reset} className="mt-2 sm:mt-0 text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-1.5">
              <RefreshCcw className="w-3 h-3" />
              شروع مجدد
            </button>
          )}
        </div>

        <div className="mt-6">
          {phase === 'idle' || phase === 'selecting' ? (
            <UploadZone onFileAccepted={selectFile} disabled={isUploading} />
          ) : showSuccess ? (
            <div className="text-center p-8 border-2 border-dashed border-green-200 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold text-green-800">آپلود موفق</h3>
              <p className="text-xs text-green-600 mt-1">فایل با موفقیت به سرور ارسال شد. پردازش در پس‌زمینه ادامه دارد...</p>
            </div>
          ) : showError ? (
            <UploadErrorPanel error={error} onReset={reset} />
          ) : (
            <div>
              <ProcessingProgressBar
                phase={phase}
                percent={percent}
              />
              {showValidationIssues && (
                <div className="mt-4">
                  <FileValidationList issues={issues} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
