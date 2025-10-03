import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RefreshCcw, FileText, Megaphone, Download, Eye } from 'lucide-react';

interface PortalContentBlock {
  id: number;
  blockKey: string;
  title: string;
  body: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

// Initial simple tab enum
const tabs = [
  { key: 'blocks', label: 'بلوک‌های محتوایی', icon: <FileText className="w-4 h-4" /> },
  { key: 'announcements', label: 'اطلاعیه‌ها', icon: <Megaphone className="w-4 h-4" /> },
  { key: 'downloads', label: 'دانلود اپ‌ها', icon: <Download className="w-4 h-4" /> },
  { key: 'preview', label: 'پیش‌نمایش', icon: <Eye className="w-4 h-4" /> }
];

export default function PortalContentManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('blocks');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editTitle, setEditTitle] = useState('');

  // Fetch blocks
  const { data, isLoading, refetch, isFetching } = useQuery<{ success: boolean; data: PortalContentBlock[] }>({
    queryKey: ['/api/admin/portal-content-blocks'],
    queryFn: async () => {
      const res = await fetch('/api/admin/portal-content-blocks');
      return res.json();
    }
  });

  const blocks: PortalContentBlock[] = data?.data || [];

  // Mutation for save
  const saveMutation = useMutation({
    mutationFn: async (payload: { blockKey: string; title: string; body: string }) => {
      const res = await fetch(`/api/admin/portal-content-blocks/${payload.blockKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: payload.title, body: payload.body })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal-content-blocks'] });
    }
  });

  const startEdit = (b: PortalContentBlock) => {
    setSelectedKey(b.blockKey);
    setEditBody(b.body || '');
    setEditTitle(b.title || '');
  };

  const handleSave = () => {
    if (!selectedKey) return;
    saveMutation.mutate({ blockKey: selectedKey, title: editTitle, body: editBody });
  };

  // Derived for editor
  const currentBlock = selectedKey ? blocks.find(b => b.blockKey === selectedKey) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">مدیریت محتوای پرتال</h1>
        <p className="text-gray-600 text-sm">Phase 1: فقط ذخیره‌سازی بلوک‌های متنی – پرتال عمومی هنوز از settings قدیمی می‌خواند.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 border transition ${activeTab === t.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{t.icon}{t.label}</button>
        ))}
      </div>

      {activeTab === 'blocks' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* List */}
          <div className="md:col-span-1 bg-white rounded-lg shadow p-4 border border-gray-200 h-fit">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800 text-sm">بلوک‌ها</h2>
              <button onClick={() => refetch()} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 flex items-center gap-1"><RefreshCcw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />بارگذاری</button>
            </div>
            <ul className="space-y-2">
              {isLoading && <li className="text-xs text-gray-500">در حال بارگذاری...</li>}
              {!isLoading && blocks.map(b => (
                <li key={b.blockKey}>
                  <button onClick={() => startEdit(b)} className={`w-full text-right px-3 py-2 rounded border text-xs flex flex-col items-start ${selectedKey === b.blockKey ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'}`}>
                    <span className="font-medium text-gray-800">{b.title}</span>
                    <span className="text-[10px] text-gray-500 ltr:font-mono rtl:font-sans">{b.blockKey}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Editor */}
          <div className="md:col-span-3 bg-white rounded-lg shadow p-6 border border-gray-200 min-h-[400px]">
            {!currentBlock && <div className="text-center text-gray-500 text-sm">یک بلوک را از لیست انتخاب کنید</div>}
            {currentBlock && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">{currentBlock.title}</h2>
                    <p className="text-xs text-gray-500">ویرایش محتوای بلوک - آخرین بروزرسانی: {currentBlock.updatedAt ? new Date(currentBlock.updatedAt).toLocaleString('fa-IR') : '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button disabled={saveMutation.isPending} onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50">
                      <Save className="w-4 h-4" /> ذخیره
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">عنوان نمایشی</label>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">محتوا (Markdown ساده یا متن)</label>
                  <textarea value={editBody} onChange={e => setEditBody(e.target.value)} className="w-full px-3 py-2 border rounded-lg font-mono text-xs leading-relaxed" rows={14} />
                </div>
                {saveMutation.isError && (
                  <div className="text-xs text-red-600">خطا در ذخیره. دوباره تلاش کنید.</div>
                )}
                {saveMutation.isSuccess && (
                  <div className="text-xs text-green-600">ذخیره شد.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab !== 'blocks' && (
        <div className="bg-white rounded-lg shadow p-10 text-center text-sm text-gray-500 border border-dashed border-gray-300">
          <p>تب «{tabs.find(t => t.key === activeTab)?.label}» در فاز بعدی یکپارچه خواهد شد.</p>
          <p className="mt-2 text-xs">(Phase 1 scope محدود به بلوک‌های متنی است)</p>
        </div>
      )}
    </div>
  );
}
