import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImportJobLite, ProcessingEvent, EngineInfo } from './types';
import { OverallProgressBar } from './OverallProgressBar';
import { StageTimeline } from './StageTimeline';
import { RecordStatsPanel } from './RecordStatsPanel';
import { EventStream } from './EventStream';
import { EngineIndicator } from './EngineIndicator';
import { X } from 'lucide-react';
import { useImportJobPolling, calculateProgress } from '@/services/import-jobs';

interface Props {
  jobCode: string; open: boolean; onOpenChange: (v:boolean)=>void; fileName?: string; fileSize?: number;
}

// فعلاً موتور را Node.js فرض می‌کنیم (در آینده می‌توان dynamic کرد)
const DEFAULT_ENGINE: EngineInfo = { name: 'Node.js Pipeline', runtime: 'node' };

export const JsonProcessingDialog: React.FC<Props> = ({ jobCode, open, onOpenChange, fileName, fileSize }) => {
  // polling را مستقل از open انجام می‌دهیم تا اگر دیالوگ سریع باز شد داده دیر نرسد
  const { data: job } = useImportJobPolling(jobCode, true);
  const [events, setEvents] = useState<ProcessingEvent[]>([]);
  const lastProcessedRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const initialProbeRef = useRef(false);

  const progress = job ? calculateProgress(job as any) : 0;

  // ایجاد رویدادهای مرحله‌ای
  useEffect(() => {
    if (!job) return;
    if (!startedAtRef.current && job.startedAt) startedAtRef.current = new Date(job.startedAt).getTime();
    const base: ProcessingEvent | null = job.status ? {
      id: 'stage-'+job.status,
      ts: Date.now(),
      label: `مرحله: ${translateStatus(job.status)}`,
      kind: 'stage'
    } : null;
    setEvents(prev => {
      const exists = base && prev.some(p => p.id === base.id);
      const next = exists || !base ? prev : [...prev, base];
      // رویداد رکوردهای جدید
      if (job.processedRecords > lastProcessedRef.current) {
        const diff = job.processedRecords - lastProcessedRef.current;
        const synthetic: ProcessingEvent = {
          id: 'rec-'+job.processedRecords+'-'+Date.now(),
            ts: Date.now(),
            label: `${diff.toLocaleString('fa-IR')} رکورد جدید پردازش شد` ,
            kind: 'record'
        };
        lastProcessedRef.current = job.processedRecords;
  // نگهداری حداکثر 1000 رویداد اخیر (درخواست کاربر)
  return [...next, synthetic].slice(-1000);
      }
      if (job.status === 'failed' && job.lastError && !next.some(e => e.id === 'err-final')) {
        return [...next, { id:'err-final', ts: Date.now(), label: 'خطا: '+job.lastError, kind:'error' }];
      }
      if (job.status === 'completed' && !next.some(e => e.id === 'sum-final')) {
        return [...next, { id:'sum-final', ts: Date.now(), label: 'اتمام پردازش – '+job.processedRecords.toLocaleString('fa-IR')+' رکورد', kind:'summary'}];
      }
      return next;
    });
  }, [job?.status, job?.processedRecords, job?.lastError, job]);

  // Fallback: اگر بعد از 5 ثانیه هنوز job دریافت نشده، یک پیام هشدار و پیشنهاد رفرش
  useEffect(() => {
    if (job) return;
    if (initialProbeRef.current) return;
    const t = setTimeout(() => {
      if (!job) {
        setEvents(prev => prev.some(e=>e.id==='warn-missing') ? prev : [...prev, { id:'warn-missing', ts: Date.now(), label:'Job هنوز در سرور یافت نشد – احتمال تأخیر ایجاد/ثبت. چند ثانیه دیگر صبر کنید یا صفحه را رفرش کنید.', kind:'stage' }]);
      }
    }, 5000);
    return () => clearTimeout(t);
  }, [job]);

  useEffect(()=>{
    if(job) return;
    const t2 = setTimeout(()=>{
      if(!job){
        setEvents(prev => prev.some(e=>e.id==='warn-auth') ? prev : [...prev, { id:'warn-auth', ts: Date.now(), label:'هشدار: Job دریافت نشد. احتمال مشکل احراز هویت یا کوکی. لطفاً ورود مجدد یا باز کردن تب جدید.', kind:'error' }]);
      }
    }, 8000);
    return () => clearTimeout(t2);
  }, [job]);

  const percent = useMemo(() => progress, [progress]);
  const engine = DEFAULT_ENGINE;

  return open ? (
    <div className="json-progress-dialog" role="dialog" aria-modal="true">
      <div className="jp-panel">
        <div className="jp-header">
          <div className="jp-title">پردازش JSON</div>
          <button className="jp-close" onClick={() => onOpenChange(false)}><X className="w-4 h-4"/></button>
        </div>
        <div className="jp-section jp-fileinfo">
          <div className="jp-file-name" title={fileName}>{fileName}</div>
          {fileSize != null && <div className="jp-file-size">{Math.round(fileSize/1024).toLocaleString('fa-IR')} KB</div>}
          <EngineIndicator engine={engine} />
        </div>
        {job && (
          <>
            <OverallProgressBar percent={percent} processed={job.processedRecords} total={job.totalRecords} />
            <StageTimeline job={job as ImportJobLite} />
            <RecordStatsPanel processed={job.processedRecords} total={job.totalRecords} errors={job.errorCount} startedAt={job.startedAt} />
            <EventStream events={events} />
          </>
        )}
        {!job && <div className="jp-loading">در حال بارگذاری اطلاعات Job...</div>}
      </div>
      <div className="jp-overlay" onClick={() => onOpenChange(false)} />
    </div>
  ) : null;
};

function translateStatus(s: string) {
  switch (s) {
    case 'pending': return 'در صف';
    case 'validating': return 'اعتبارسنجی';
    case 'ingesting': return 'ورود';
    case 'enriching': return 'غنی‌سازی';
    case 'completed': return 'اتمام';
    case 'failed': return 'شکست';
    default: return s;
  }
}
