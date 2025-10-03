import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCcw, Activity } from 'lucide-react';

interface ActiveActionsResponse {
  success: boolean;
  data: {
    activeJobs: any[];
    multiStageActive: { flag: string; state: string }[];
  };
}

export default function DebugActionsPanel() {
  const { data, refetch, isFetching } = useQuery<ActiveActionsResponse>({
    queryKey: ['/api/admin/active-actions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/active-actions');
      return res.json();
    },
    refetchInterval: 5000
  });

  const jobs = data?.data.activeJobs || [];
  const flags = data?.data.multiStageActive || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Activity className="w-5 h-5"/>پنل دیباگ اکشن‌ها</h1>
        <button onClick={() => refetch()} className="px-3 py-1.5 text-xs rounded border flex items-center gap-1 bg-white hover:bg-gray-50">
          <RefreshCcw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} /> بروزرسانی
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-3 text-gray-800">Import Jobs فعال</h2>
          {!jobs.length && <div className="text-xs text-gray-500">موردی نیست</div>}
          <ul className="space-y-2">
            {jobs.map(j => (
              <li key={j.id} className="text-[11px] border rounded p-2 flex flex-col gap-1">
                <div className="flex justify-between"><span className="font-mono">{j.jobCode}</span><span className="text-gray-500">{j.status}</span></div>
                <div className="text-gray-600">{j.processedRecords}/{j.totalRecords}</div>
                {j.lastError && <div className="text-red-600 line-clamp-1">{j.lastError}</div>}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-3 text-gray-800">فلگ‌های چندمرحله‌ای فعال</h2>
          {!flags.length && <div className="text-xs text-gray-500">موردی نیست (همه off)</div>}
          <ul className="space-y-2">
            {flags.map(f => (
              <li key={f.flag} className="text-[11px] border rounded p-2 flex justify-between items-center">
                <span className="font-mono">{f.flag}</span>
                <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">{f.state}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
