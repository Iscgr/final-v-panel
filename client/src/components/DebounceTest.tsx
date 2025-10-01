/**
 * Debounce Test Component
 * کامپوننت تست برای آزمایش عملکرد debounce در upload operations
 */

import React, { useState, useCallback } from 'react';
import { useUploadDebounce } from '../hooks/use-upload-debounce';
import { useDebounce } from '../hooks/use-debounce';

export function DebounceTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${message}`]);
  }, []);

  // Debounced search
  const debouncedSearch = useDebounce(
    (term: string) => {
      setDebouncedSearchTerm(term);
      addLog(`🔍 جستجو: "${term}"`);
    },
    { delay: 500 }
  );

  // Upload debounce hook
  const uploadDebounce = useUploadDebounce({
    config: {
      validationDelay: 300,
      errorDisplayDelay: 500,
      batchProcessDelay: 1000
    },
    onBatchChange: (items) => {
      addLog(`📊 Batch تغییر کرد: ${items.length} فایل`);
    },
    onUploadComplete: (item) => {
      addLog(`✅ تکمیل: ${item.file.name}`);
    },
    onError: (item, error) => {
      addLog(`❌ خطا: ${item.file.name} - ${error}`);
    },
    autoProcess: false // Manual processing for demo
  });

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    addLog(`⌨️ تایپ: "${value}"`);
    debouncedSearch(value);
  }, [debouncedSearch, addLog]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      addLog(`📁 انتخاب ${files.length} فایل`);
      uploadDebounce.addFiles(files);
    }
  }, [uploadDebounce, addLog]);

  const handleMultipleFiles = useCallback(() => {
    // Create mock files for testing
    const mockFiles = Array.from({ length: 5 }, (_, i) => {
      const content = JSON.stringify({ id: `test-${i}`, amount: Math.random() * 1000 });
      const blob = new Blob([content], { type: 'application/json' });
      return new File([blob], `test-file-${i}.json`, { type: 'application/json' });
    });

    addLog(`🎯 ایجاد ${mockFiles.length} فایل آزمایشی`);
    uploadDebounce.addFiles(mockFiles);
  }, [uploadDebounce, addLog]);

  const handleClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const summary = uploadDebounce.getSummary();

  return (
    <div className="p-6 bg-white rounded-lg border shadow-sm">
      <h3 className="text-lg font-semibold mb-4">🔧 تست Debounce - Upload Operations</h3>
      
      {/* Search Test */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-md font-medium mb-3">🔍 تست جستجوی Debounced</h4>
        <div className="space-y-2">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="تایپ کنید تا debounce را ببینید..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-between text-sm">
            <span>مقدار فوری: <strong>{searchTerm}</strong></span>
            <span>مقدار debounced: <strong>{debouncedSearchTerm}</strong></span>
          </div>
        </div>
      </div>

      {/* File Upload Test */}
      <div className="mb-6 p-4 bg-green-50 rounded-lg">
        <h4 className="text-md font-medium mb-3">📁 تست Upload Debounced</h4>
        <div className="space-y-3">
          <input
            type="file"
            onChange={handleFileSelect}
            multiple
            accept=".json,.csv,.xlsx"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
          />
          
          <div className="flex gap-2">
            <button
              onClick={handleMultipleFiles}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              🎯 ایجاد 5 فایل آزمایشی
            </button>
            <button
              onClick={uploadDebounce.processBatch}
              disabled={!uploadDebounce.canProcess()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
            >
              🚀 پردازش Batch
            </button>
            <button
              onClick={uploadDebounce.clearAll}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
            >
              🗑️ پاک‌سازی
            </button>
          </div>
        </div>
      </div>

      {/* Status Summary */}
      {summary.totalFiles > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
          <h4 className="text-md font-medium mb-3">📊 خلاصه وضعیت</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">{summary.totalFiles}</div>
              <div className="text-gray-600">کل فایل‌ها</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.validFiles}</div>
              <div className="text-gray-600">معتبر</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.invalidFiles}</div>
              <div className="text-gray-600">نامعتبر</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.completedFiles}</div>
              <div className="text-gray-600">تکمیل شده</div>
            </div>
          </div>
          
          {summary.overallProgress > 0 && (
            <div className="mt-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">پیشرفت کل</span>
                <span className="text-sm text-gray-600">{summary.overallProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${summary.overallProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Batch Items */}
      {uploadDebounce.batchItems.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-md font-medium mb-3">📋 فایل‌های Batch</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {uploadDebounce.batchItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                <span className="truncate">{item.file.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(item.status)}`}>
                    {getStatusText(item.status)}
                  </span>
                  {item.progress !== undefined && (
                    <span className="text-xs text-gray-500">{Math.round(item.progress)}%</span>
                  )}
                  <button
                    onClick={() => uploadDebounce.cancelItem(item.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    ❌
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="mb-6 p-4 bg-purple-50 rounded-lg">
        <h4 className="text-md font-medium mb-3">📈 آمار Debounce</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Pending:</span>
            <span className="ml-2 font-medium">{uploadDebounce.stats.pending}</span>
          </div>
          <div>
            <span className="text-gray-600">Validating:</span>
            <span className="ml-2 font-medium">{uploadDebounce.stats.validating}</span>
          </div>
          <div>
            <span className="text-gray-600">Uploading:</span>
            <span className="ml-2 font-medium">{uploadDebounce.stats.uploading}</span>
          </div>
          <div>
            <span className="text-gray-600">Failed:</span>
            <span className="ml-2 font-medium">{uploadDebounce.stats.failed}</span>
          </div>
          <div>
            <span className="text-gray-600">Active Debouncers:</span>
            <span className="ml-2 font-medium">{uploadDebounce.stats.activeDebouncers}</span>
          </div>
          <div>
            <span className="text-gray-600">Processing:</span>
            <span className="ml-2 font-medium">{uploadDebounce.isProcessing ? 'بله' : 'خیر'}</span>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-medium">📋 لاگ‌های Real-time</h4>
          <button
            onClick={handleClearLogs}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            پاک‌سازی
          </button>
        </div>
        <div className="bg-gray-50 rounded-md p-3 max-h-48 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500">هیچ لاگی ثبت نشده</p>
          ) : (
            logs.map((log, index) => (
              <p key={index} className="text-xs text-gray-700 font-mono">
                {log}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'validating': return 'bg-blue-100 text-blue-800';
    case 'valid': return 'bg-green-100 text-green-800';
    case 'invalid': return 'bg-red-100 text-red-800';
    case 'uploading': return 'bg-purple-100 text-purple-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'failed': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'pending': return 'انتظار';
    case 'validating': return 'اعتبارسنجی';
    case 'valid': return 'معتبر';
    case 'invalid': return 'نامعتبر';
    case 'uploading': return 'آپلود';
    case 'completed': return 'تکمیل';
    case 'failed': return 'خطا';
    default: return status;
  }
}

export default DebounceTest;