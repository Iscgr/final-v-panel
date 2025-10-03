/**
 * JobProgress Component
 * نمایش مرحله‌ای پیشرفت یک import job با progress bar و timeline
 */

import React from 'react';
import { ImportJob, STATUS_ORDER, STEP_LABELS } from '@/services/import-jobs';
import { toPersianDigits } from '@/lib/persian-date';

interface JobProgressProps {
  job: ImportJob;
  showDetails?: boolean;
  className?: string;
}

export function JobProgress({ job, showDetails = true, className = '' }: JobProgressProps) {
  const currentIndex = STATUS_ORDER.indexOf(job.status);
  
  return (
    <div className={`space-y-2 ${className}`}>
      {showDetails && (
        <div className="flex items-center justify-between text-[11px] text-gray-600">
          <span className="font-medium">{job.jobCode}</span>
          <span className="font-mono">
            {toPersianDigits(job.processedRecords.toString())}/{toPersianDigits(job.totalRecords.toString())}
          </span>
        </div>
      )}
      
      {/* Progress Bar */}
      <div className="flex items-center gap-1">
        {STATUS_ORDER.map((s, idx) => {
          const active = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          const failed = job.status === 'failed' && s === 'failed';
          
          return (
            <div
              key={s}
              className={`flex-1 h-2 rounded transition-all duration-300 ${
                failed
                  ? 'bg-red-500 animate-pulse'
                  : active
                  ? 'bg-blue-600'
                  : 'bg-gray-200'
              } ${isCurrent && !failed ? 'shadow-inner ring-2 ring-blue-300' : ''}`}
              title={STEP_LABELS[s]}
            />
          );
        })}
      </div>
      
      {/* Stage Labels */}
      <div className="flex justify-between text-[10px] mt-1 text-gray-500">
        {STATUS_ORDER.map(s => (
          <span
            key={s}
            className={`transition-colors ${
              job.status === s ? 'text-blue-600 font-medium' : ''
            }`}
          >
            {STEP_LABELS[s]}
          </span>
        ))}
      </div>
      
      {/* Error Display */}
      {job.lastError && (
        <div className="text-[10px] text-red-600 bg-red-50 rounded px-2 py-1 line-clamp-2 border border-red-200">
          خطا: {job.lastError}
        </div>
      )}
    </div>
  );
}
