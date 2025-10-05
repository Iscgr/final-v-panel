import React from 'react';
import { Loader2, CheckCircle, AlertCircle, Upload } from 'lucide-react';

interface ProcessingProgressBarProps {
  percent: number;
  phase: string;
}

export const ProcessingProgressBar: React.FC<ProcessingProgressBarProps> = ({ percent, phase }) => {
  const getPhaseIcon = () => {
    switch (phase) {
      case 'uploading':
        return <Upload className="w-4 h-4 animate-pulse" />;
      case 'validating':
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'partial':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'success':
        return 'bg-green-600';
      case 'partial':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-600';
      case 'uploading':
        return 'bg-blue-500';
      case 'validating':
      case 'processing':
        return 'bg-blue-600';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-2 bg-gray-50 rounded-lg p-3 border" aria-label="پیشرفت پردازش">
      <div className="flex justify-between items-center text-xs text-gray-700">
        <div className="flex items-center gap-2">
          {getPhaseIcon()}
          <span className="font-medium">{phaseLabel(phase)}</span>
        </div>
        <span className="font-mono text-sm font-semibold">{percent}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden shadow-inner">
        <div 
          className={`h-full transition-all duration-500 ease-out ${getPhaseColor()} relative`}
          style={{ width: `${percent}%` }}
        >
          {/* Shimmer effect for active processing */}
          {(phase === 'uploading' || phase === 'processing' || phase === 'validating') && percent < 100 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" 
                 style={{
                   backgroundSize: '200% 100%',
                   animation: 'shimmer 2s infinite'
                 }}
            />
          )}
        </div>
      </div>
      {/* Progress stages indicator */}
      {(phase === 'validating' || phase === 'processing' || phase === 'uploading') && (
        <div className="flex justify-between text-[10px] text-gray-500 pt-1">
          <span className={phase === 'validating' ? 'text-blue-600 font-medium' : ''}>اعتبارسنجی</span>
          <span className={phase === 'uploading' ? 'text-blue-600 font-medium' : ''}>آپلود</span>
          <span className={phase === 'processing' ? 'text-blue-600 font-medium' : ''}>پردازش</span>
        </div>
      )}
    </div>
  );
};

function phaseLabel(p: string) {
  switch (p) {
    case 'validating': return 'در حال اعتبارسنجی...';
    case 'uploading': return 'در حال آپلود...';
    case 'processing': return 'در حال پردازش...';
    case 'success': return 'پردازش موفق';
    case 'partial': return 'پردازش ناقص';
    case 'error': return 'خطا در پردازش';
    default: return 'آماده';
  }
}

export default ProcessingProgressBar;
