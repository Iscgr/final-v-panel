/**
 * Web Worker Test Component
 * کامپوننت تست برای آزمایش عملکرد JSON Parser Worker
 */

import React, { useState, useCallback } from 'react';
import { useJSONParser } from '../hooks/use-json-parser';

export function WebWorkerTest() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  }, []);

  const jsonParser = useJSONParser({
    onProgress: (progress, stage) => {
      addLog(`پیشرفت: ${Math.round(progress)}% - ${stage}`);
    },
    onComplete: (result, metadata) => {
      addLog(`✅ تکمیل شد - ${metadata.recordCount || 'نامشخص'} رکورد در ${metadata.processingTime}ms`);
    },
    onError: (error) => {
      addLog(`❌ خطا: ${error}`);
    }
  });

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      addLog(`📁 فایل انتخاب شد: ${file.name} (${Math.round(file.size / 1024)}KB)`);
    }
  }, [addLog]);

  const handleParseJSON = useCallback(() => {
    if (selectedFile) {
      addLog(`🚀 شروع پارس JSON با Web Worker...`);
      jsonParser.parseFile(selectedFile, 'json');
    }
  }, [selectedFile, jsonParser, addLog]);

  const handleParsePFX = useCallback(() => {
    if (selectedFile) {
      addLog(`🔧 شروع پارس PFX با Web Worker...`);
      jsonParser.parseFile(selectedFile, 'pfx');
    }
  }, [selectedFile, jsonParser, addLog]);

  const handleCancel = useCallback(() => {
    jsonParser.cancelParsing();
    addLog(`🚫 پردازش لغو شد`);
  }, [jsonParser, addLog]);

  const handleReset = useCallback(() => {
    jsonParser.reset();
    setSelectedFile(null);
    setLogs([]);
    addLog(`🔄 ریست کامل`);
  }, [jsonParser, addLog]);

  return (
    <div className="p-6 bg-white rounded-lg border shadow-sm">
      <h3 className="text-lg font-semibold mb-4">🔧 تست Web Worker - JSON Parser</h3>
      
      {/* File Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">انتخاب فایل:</label>
        <input
          type="file"
          onChange={handleFileSelect}
          accept=".json,.pfx,.p12,.txt"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {selectedFile && (
          <p className="text-sm text-gray-600 mt-1">
            📁 {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={handleParseJSON}
          disabled={!selectedFile || jsonParser.isProcessing}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
        >
          📊 پارس JSON
        </button>
        <button
          onClick={handleParsePFX}
          disabled={!selectedFile || jsonParser.isProcessing}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
        >
          🔐 پارس PFX
        </button>
        <button
          onClick={handleCancel}
          disabled={!jsonParser.canCancel}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
        >
          🚫 لغو
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
        >
          🔄 ریست
        </button>
      </div>

      {/* Status Display */}
      {jsonParser.isProcessing && (
        <div className="mb-4 p-3 bg-blue-50 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">
              {jsonParser.stage}
            </span>
            <span className="text-sm text-blue-700">
              {jsonParser.progressPercent}%
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${jsonParser.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Result Display */}
      {jsonParser.hasResult && (
        <div className="mb-4 p-3 bg-green-50 rounded-md">
          <h4 className="text-sm font-medium text-green-900 mb-2">✅ نتیجه:</h4>
          <pre className="text-xs text-green-800 bg-green-100 p-2 rounded overflow-auto max-h-32">
            {JSON.stringify(jsonParser.metadata, null, 2)}
          </pre>
        </div>
      )}

      {/* Error Display */}
      {jsonParser.hasError && (
        <div className="mb-4 p-3 bg-red-50 rounded-md">
          <h4 className="text-sm font-medium text-red-900 mb-2">❌ خطا:</h4>
          <p className="text-sm text-red-800">{jsonParser.error}</p>
        </div>
      )}

      {/* Logs */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-2">📋 لاگ‌ها:</h4>
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

export default WebWorkerTest;