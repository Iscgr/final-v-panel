import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RefreshCcw, FileText, Megaphone, Download, Eye, Plus, Trash2 } from 'lucide-react';
import { PortalContentService } from '@/services/portal-content';
import { useToast } from '@/hooks/use-toast';

interface PortalContentBlock {
  id: number;
  blockKey: string;
  title: string;
  body: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: number;
  type: string;
  isActive: boolean;
  expiresAt: string | null;
}

interface AppDownload {
  id: number;
  title: string;
  description: string | null;
  downloadLink: string;
  qrCodeUrl: string | null;
  videoUrl: string | null;
  displayOrder: number;
  isActive: boolean;
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
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('blocks');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [originalBody, setOriginalBody] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');

  // Announcements state
  const [newAnn, setNewAnn] = useState({ title: '', content: '', priority: 0, type: 'info' });
  const annErrors = (() => {
    const errs: string[] = [];
    if(newAnn.title.trim().length < 3) errs.push('عنوان حداقل ۳ کاراکتر');
    if(newAnn.title.length > 120) errs.push('عنوان حداکثر ۱۲۰ کاراکتر');
    if(newAnn.content.trim().length < 5) errs.push('محتوا حداقل ۵ کاراکتر');
    if(newAnn.content.length > 1000) errs.push('محتوا حداکثر ۱۰۰۰ کاراکتر');
    if(newAnn.priority < 0 || newAnn.priority>9999) errs.push('اولویت بین 0 تا 9999');
    return errs;
  })();
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  // Downloads state
  const [newDownload, setNewDownload] = useState({ title: '', downloadLink: '', description: '' });
  const downloadErrors = (() => {
    const errs: string[] = [];
    if(newDownload.title.trim().length < 2) errs.push('عنوان دانلود حداقل ۲ کاراکتر');
    if(newDownload.title.length > 120) errs.push('عنوان دانلود حداکثر ۱۲۰ کاراکتر');
    if(!/^https?:\/\//i.test(newDownload.downloadLink.trim())) errs.push('لینک باید با http/https شروع شود');
    if(newDownload.downloadLink.length > 500) errs.push('طول لینک بیش از ۵۰۰');
    if(newDownload.description && newDownload.description.length > 500) errs.push('توضیح حداکثر ۵۰۰ کاراکتر');
    return errs;
  })();
  const [editingDownload, setEditingDownload] = useState<AppDownload | null>(null);

  // Fetch blocks
  const { data, isLoading, refetch, isFetching } = useQuery<{ success: boolean; data: PortalContentBlock[] }>({
    queryKey: ['/api/admin/portal-content-blocks'],
    queryFn: () => PortalContentService.blocks.list()
  });

  const blocks: PortalContentBlock[] = data?.data || [];

  // Mutation for save
  const saveMutation = useMutation({
    mutationFn: async (payload: { blockKey: string; title: string; body: string }) => {
      return PortalContentService.blocks.update(payload.blockKey, { title: payload.title, body: payload.body });
    },
    onMutate: async (payload) => {
      // Optimistic update cache
      await queryClient.cancelQueries({ queryKey: ['/api/admin/portal-content-blocks'] });
      const prev = queryClient.getQueryData<any>(['/api/admin/portal-content-blocks']);
      if (prev?.data) {
        const newData = prev.data.map((b: PortalContentBlock) => b.blockKey === payload.blockKey ? { ...b, title: payload.title, body: payload.body, updatedAt: new Date().toISOString() } : b);
        queryClient.setQueryData(['/api/admin/portal-content-blocks'], { ...prev, data: newData });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['/api/admin/portal-content-blocks'], ctx.prev);
      toast({ title: 'خطا در ذخیره', description: 'عملیات ذخیره بلوک انجام نشد', variant: 'destructive' });
    },
    onSuccess: (_data, vars) => {
      toast({ title: 'ذخیره شد', description: `بلوک ${vars.blockKey} با موفقیت بروزرسانی شد` });
      setOriginalBody(editBody);
      setOriginalTitle(editTitle);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal-content-blocks'] });
    }
  });

  const startEdit = (b: PortalContentBlock) => {
    setSelectedKey(b.blockKey);
    setEditBody(b.body || '');
    setEditTitle(b.title || '');
    setOriginalBody(b.body || '');
    setOriginalTitle(b.title || '');
  };

  const handleSave = useCallback(() => {
    if (!selectedKey) return;
    if (!isDirty) return;
    saveMutation.mutate({ blockKey: selectedKey, title: editTitle.trim(), body: editBody });
  }, [selectedKey, editTitle, editBody, saveMutation, editBody, editTitle]);

  // Auto-select first block once loaded
  useEffect(() => {
    if (!selectedKey && blocks.length) {
      startEdit(blocks[0]);
    }
  }, [blocks, selectedKey]);

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const isDirty = selectedKey && (editBody !== originalBody || editTitle !== originalTitle);
  const isSaving = saveMutation.isPending;
  const [dirtyMap, setDirtyMap] = useState<Record<string, { title: string; body: string }>>({});

  // Track dirty changes per block for future batch save
  useEffect(() => {
    if(selectedKey){
      if(editBody !== originalBody || editTitle !== originalTitle){
        setDirtyMap(m => ({ ...m, [selectedKey]: { title: editTitle, body: editBody } }));
      } else {
        setDirtyMap(m => { const clone = { ...m }; delete clone[selectedKey]; return clone; });
      }
    }
  }, [selectedKey, editBody, editTitle, originalBody, originalTitle]);

  const batchSave = async () => {
    const entries = Object.entries(dirtyMap);
    if(!entries.length) return;
    for(const [blockKey, value] of entries){
      await saveMutation.mutateAsync({ blockKey, title: value.title.trim(), body: value.body });
    }
    setDirtyMap({});
    toast({ title: 'همه تغییرات ذخیره شد' });
  };

  // Fetch announcements
  const { data: announcementsData, refetch: refetchAnnouncements } = useQuery<{ success: boolean; data: Announcement[] }>({
    queryKey: ['/api/admin/announcements'],
    queryFn: () => PortalContentService.announcements.list()
  });
  const announcements = announcementsData?.data || [];

  // Fetch downloads
  const { data: downloadsData, refetch: refetchDownloads } = useQuery<{ success: boolean; data: AppDownload[] }>({
    queryKey: ['/api/admin/app-downloads'],
    queryFn: () => PortalContentService.downloads.list()
  });
  const downloads = downloadsData?.data || [];
  const [localDownloads, setLocalDownloads] = useState<AppDownload[]>([]);

  // sync local state for DnD
  useEffect(() => {
    setLocalDownloads(downloads.slice().sort((a,b)=>a.displayOrder - b.displayOrder));
  }, [downloads]);

  // Full content for preview
  const { data: fullContentData, refetch: refetchFull } = useQuery<{ success: boolean; data: any }>({
    queryKey: ['/api/admin/portal-content-blocks/full'],
    queryFn: () => PortalContentService.blocks.full(),
    enabled: activeTab === 'preview'
  });

  // Announcement mutations
  const createAnnMutation = useMutation({
    mutationFn: async () => {
      return PortalContentService.announcements.create({ ...newAnn, priority: Number(newAnn.priority) || 0 });
    },
    onSuccess: (r: any) => {
      if (r.success) {
        toast({ title: 'اطلاعیه ایجاد شد' });
        setNewAnn({ title: '', content: '', priority: 0, type: 'info' });
        refetchAnnouncements();
      } else toast({ title: 'خطا', description: r.error, variant: 'destructive' });
    }
  });
  const updateAnnMutation = useMutation({
    mutationFn: async (ann: Announcement) => {
      return PortalContentService.announcements.update(ann.id, ann);
    },
    onSuccess: (r: any) => { if (r.success) { toast({ title: 'ویرایش اطلاعیه' }); setEditingAnnouncement(null); refetchAnnouncements(); } }
  });
  const deleteAnnMutation = useMutation({
  mutationFn: async (id: number) => PortalContentService.announcements.delete(id),
    onSuccess: (r: any) => { if (r.success) { toast({ title: 'حذف شد' }); refetchAnnouncements(); } }
  });

  // Download mutations
  const createDownloadMutation = useMutation({
    mutationFn: async () => {
      return PortalContentService.downloads.create({ ...newDownload });
    },
    onSuccess: (r: any) => { if (r.success) { toast({ title: 'اپ افزوده شد' }); setNewDownload({ title: '', downloadLink: '', description: '' }); refetchDownloads(); } }
  });
  const updateDownloadMutation = useMutation({
    mutationFn: async (d: AppDownload) => {
      return PortalContentService.downloads.update(d.id, d);
    },
    onSuccess: (r: any) => { if (r.success) { toast({ title: 'اپ ویرایش شد' }); setEditingDownload(null); refetchDownloads(); } }
  });
  const deleteDownloadMutation = useMutation({
  mutationFn: async (id: number) => PortalContentService.downloads.delete(id),
    onSuccess: (r: any) => { if (r.success) { toast({ title: 'اپ حذف شد' }); refetchDownloads(); } }
  });

  // Derived for editor
  const currentBlock = selectedKey ? blocks.find(b => b.blockKey === selectedKey) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">مدیریت محتوای پرتال</h1>
        <p className="text-gray-600 text-sm">
          مدیریت یکپارچه بلوک‌های متنی، اطلاعیه‌ها، لینک‌های دانلود اپلیکیشن‌ها و پیش‌نمایش کامل محتوای پرتال عمومی
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap border-b pb-2">
        {tabs.map(t => (
          <button 
            key={t.key} 
            onClick={() => setActiveTab(t.key)} 
            className={`px-4 py-2 rounded-t-lg text-sm flex items-center gap-2 transition-all ${
              activeTab === t.key 
                ? 'bg-blue-600 text-white shadow-md -mb-2 border-b-2 border-blue-600' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
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
                  <button onClick={() => startEdit(b)} className={`w-full text-right px-3 py-2 rounded border text-xs flex flex-col items-start transition ${selectedKey === b.blockKey ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'}`}>
                    <span className="font-medium text-gray-800 flex items-center gap-2">{b.title}{selectedKey === b.blockKey && isDirty && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">ویرایش نشده</span>}</span>
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
                    <button disabled={!isDirty || isSaving} onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50">
                      <Save className="w-4 h-4" /> {isSaving ? 'در حال ذخیره...' : isDirty ? 'ذخیره' : 'ذخیره شده'}
                    </button>
                    <button
                      disabled={!Object.keys(dirtyMap).length || isSaving}
                      onClick={batchSave}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs flex items-center gap-1 hover:bg-indigo-700 disabled:opacity-50"
                      title="ذخیره همه بلوک‌های تغییر کرده"
                    >
                      <Save className="w-3 h-3" /> Save All ({Object.keys(dirtyMap).length})
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
                <div className="flex items-center gap-4 pt-2 text-[11px]">
                  {isDirty && !isSaving && <span className="text-amber-600">تغییرات ذخیره نشده</span>}
                  {isSaving && <span className="text-blue-600 animate-pulse">در حال ذخیره...</span>}
                  {!isDirty && !isSaving && selectedKey && <span className="text-green-600">همه تغییرات ذخیره شده‌اند</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab !== 'blocks' && (
        <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-700 border border-gray-200 min-h-[360px]">
          {activeTab === 'announcements' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">اطلاعیه‌ها</h2>
                <button onClick={() => refetchAnnouncements()} className="text-xs px-2 py-1 border rounded flex items-center gap-1"><RefreshCcw className="w-3 h-3" />تازه‌سازی</button>
              </div>
              {/* Create */}
              <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
                <div className="grid md:grid-cols-6 gap-2">
                  <input value={newAnn.title} onChange={e => setNewAnn(a => ({ ...a, title: e.target.value }))} placeholder="عنوان" className="px-2 py-1 border rounded col-span-2 text-xs" />
                  <input value={newAnn.content} onChange={e => setNewAnn(a => ({ ...a, content: e.target.value }))} placeholder="محتوا" className="px-2 py-1 border rounded col-span-2 text-xs" />
                  <input type="number" value={newAnn.priority} onChange={e => setNewAnn(a => ({ ...a, priority: Number(e.target.value) }))} placeholder="اولویت" className="px-2 py-1 border rounded text-xs" />
                  <select value={newAnn.type} onChange={e => setNewAnn(a => ({ ...a, type: e.target.value }))} className="px-2 py-1 border rounded text-xs">
                    <option value="info">info</option><option value="warning">warning</option><option value="success">success</option><option value="error">error</option>
                  </select>
                </div>
                {annErrors.length>0 && <ul className="text-red-600 text-[10px] list-disc pr-4 space-y-0.5">{annErrors.map(er=> <li key={er}>{er}</li>)}</ul>}
                <button disabled={annErrors.length>0} onClick={() => createAnnMutation.mutate()} className="text-xs px-3 py-1 bg-blue-600 text-white rounded flex items-center gap-1 disabled:opacity-40"><Plus className="w-3 h-3" />افزودن</button>
              </div>
              {/* List */}
              <div className="space-y-2 max-h-72 overflow-auto">
                {announcements.map(a => (
                  <div key={a.id} className="border rounded p-3 bg-white flex flex-col gap-2">
                    {editingAnnouncement?.id === a.id ? (
                      <div className="space-y-2">
                        <input value={editingAnnouncement.title} onChange={e => setEditingAnnouncement(o => o ? { ...o, title: e.target.value } : o)} className="w-full text-xs border px-2 py-1 rounded" />
                        <textarea value={editingAnnouncement.content} onChange={e => setEditingAnnouncement(o => o ? { ...o, content: e.target.value } : o)} rows={2} className="w-full text-xs border px-2 py-1 rounded" />
                        <div className="flex gap-2 items-center">
                          <input type="number" value={editingAnnouncement.priority} onChange={e => setEditingAnnouncement(o => o ? { ...o, priority: Number(e.target.value) } : o)} className="w-20 text-xs border px-2 py-1 rounded" />
                          <select value={editingAnnouncement.type} onChange={e => setEditingAnnouncement(o => o ? { ...o, type: e.target.value } : o)} className="text-xs border px-2 py-1 rounded">
                            <option value="info">info</option><option value="warning">warning</option><option value="success">success</option><option value="error">error</option>
                          </select>
                          <label className="text-[10px] flex items-center gap-1"><input type="checkbox" checked={editingAnnouncement.isActive} onChange={e => setEditingAnnouncement(o => o ? { ...o, isActive: e.target.checked } : o)} />فعال</label>
                          <button
                            disabled={!(editingAnnouncement.title.trim().length>=3 && editingAnnouncement.content.trim().length>=5)}
                            onClick={() => editingAnnouncement && updateAnnMutation.mutate(editingAnnouncement)}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded disabled:opacity-40"
                          >ذخیره</button>
                          <button onClick={() => setEditingAnnouncement(null)} className="text-xs px-2 py-1 border rounded">لغو</button>
                        </div>
                        {editingAnnouncement && (editingAnnouncement.title.trim().length<3 || editingAnnouncement.content.trim().length<5) && (
                          <div className="text-[10px] text-red-600">حداقل طول عنوان ۳ و محتوا ۵ کاراکتر</div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="text-xs leading-5">
                          <div className="font-semibold flex items-center gap-2">{a.title}<span className="px-1 rounded bg-gray-100 border text-[10px]">{a.type}</span>{!a.isActive && <span className="text-[10px] bg-red-50 border border-red-200 text-red-600 rounded px-1">غیرفعال</span>}</div>
                          <div className="text-gray-600 whitespace-pre-wrap">{a.content}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button onClick={() => setEditingAnnouncement(a)} className="text-[10px] px-2 py-1 border rounded">ویرایش</button>
                          <button onClick={() => deleteAnnMutation.mutate(a.id)} className="text-[10px] px-2 py-1 border rounded text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" />حذف</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {announcements.length === 0 && <div className="text-center text-xs text-gray-500">اطلاعیه‌ای ثبت نشده</div>}
              </div>
            </div>
          )}

          {activeTab === 'downloads' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">اپلیکیشن‌های دانلود</h2>
                <button onClick={() => refetchDownloads()} className="text-xs px-2 py-1 border rounded flex items-center gap-1"><RefreshCcw className="w-3 h-3" />تازه‌سازی</button>
              </div>
              {/* Create */}
              <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
                <div className="grid md:grid-cols-5 gap-2">
                  <input value={newDownload.title} onChange={e => setNewDownload(d => ({ ...d, title: e.target.value }))} placeholder="عنوان" className="px-2 py-1 border rounded text-xs" />
                  <input value={newDownload.downloadLink} onChange={e => setNewDownload(d => ({ ...d, downloadLink: e.target.value }))} placeholder="لینک" className="px-2 py-1 border rounded text-xs col-span-2" />
                  <input value={newDownload.description} onChange={e => setNewDownload(d => ({ ...d, description: e.target.value }))} placeholder="توضیح" className="px-2 py-1 border rounded text-xs" />
                  <button disabled={downloadErrors.length>0} onClick={() => createDownloadMutation.mutate()} className="text-xs px-3 py-1 bg-blue-600 text-white rounded flex items-center gap-1 disabled:opacity-40"><Plus className="w-3 h-3" />افزودن</button>
                </div>
                {downloadErrors.length>0 && <ul className="text-red-600 text-[10px] list-disc pr-4 space-y-0.5">{downloadErrors.map(er=> <li key={er}>{er}</li>)}</ul>}
              </div>
              {/* List */}
              <div className="space-y-2 max-h-72 overflow-auto"
                   onDragOver={(e)=>e.preventDefault()}
              >
                {localDownloads.map(d => (
                  <div key={d.id}
                       draggable
                       onDragStart={(e)=>{e.dataTransfer.setData('text/plain', String(d.id));}}
                       onDrop={(e)=>{
                          e.preventDefault();
                          const sourceId = Number(e.dataTransfer.getData('text/plain'));
                          if(!sourceId || sourceId===d.id) return;
                          setLocalDownloads(prev => {
                            const srcIndex = prev.findIndex(x=>x.id===sourceId);
                            const targetIndex = prev.findIndex(x=>x.id===d.id);
                            if(srcIndex===-1||targetIndex===-1) return prev;
                            const clone = prev.slice();
                            const [moved] = clone.splice(srcIndex,1);
                            clone.splice(targetIndex,0,moved);
                            // reassign displayOrder sequentially (step 10)
                            return clone.map((item,idx)=>({...item, displayOrder: idx*10}));
                          });
                       }}
                       className="border rounded p-3 bg-white flex items-start justify-between gap-4 cursor-move opacity-100 hover:shadow transition-shadow"
                  >
                    {editingDownload?.id === d.id ? (
                      <div className="flex-1 space-y-2">
                        <input value={editingDownload.title} onChange={e => setEditingDownload(o => o ? { ...o, title: e.target.value } : o)} className="w-full text-xs border px-2 py-1 rounded" />
                        <input value={editingDownload.downloadLink} onChange={e => setEditingDownload(o => o ? { ...o, downloadLink: e.target.value } : o)} className="w-full text-xs border px-2 py-1 rounded" />
                        <textarea value={editingDownload.description || ''} onChange={e => setEditingDownload(o => o ? { ...o, description: e.target.value } : o)} rows={2} className="w-full text-xs border px-2 py-1 rounded" />
                        <div className="flex gap-2 items-center">
                          <label className="text-[10px] flex items-center gap-1"><input type="checkbox" checked={editingDownload.isActive} onChange={e => setEditingDownload(o => o ? { ...o, isActive: e.target.checked } : o)} />فعال</label>
                          <button
                            disabled={!(editingDownload.title.trim().length>=2 && /^https?:\/\//i.test(editingDownload.downloadLink.trim()))}
                            onClick={() => editingDownload && updateDownloadMutation.mutate(editingDownload)}
                            className="text-[10px] px-2 py-1 bg-green-600 text-white rounded disabled:opacity-40"
                          >ذخیره</button>
                          <button onClick={() => setEditingDownload(null)} className="text-[10px] px-2 py-1 border rounded">لغو</button>
                        </div>
                        {editingDownload && (!(editingDownload.title.trim().length>=2) || !/^https?:\/\//i.test(editingDownload.downloadLink.trim())) && (
                          <div className="text-[10px] text-red-600">عنوان حداقل ۲ کاراکتر و لینک معتبر http/https لازم است</div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 text-xs space-y-1">
                        <div className="font-semibold flex items-center gap-2">{d.title}{!d.isActive && <span className="text-[10px] bg-red-50 border border-red-200 text-red-600 rounded px-1">غیرفعال</span>}</div>
                        <div className="text-gray-600 break-all">{d.downloadLink}</div>
                        {d.description && <div className="text-gray-500 whitespace-pre-wrap">{d.description}</div>}
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      {editingDownload?.id === d.id ? null : <button onClick={() => setEditingDownload(d)} className="text-[10px] px-2 py-1 border rounded">ویرایش</button>}
                      <button onClick={() => deleteDownloadMutation.mutate(d.id)} className="text-[10px] px-2 py-1 border rounded text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" />حذف</button>
                    </div>
                  </div>
                ))}
                {localDownloads.length === 0 && <div className="text-center text-xs text-gray-500">اپلیکیشنی ثبت نشده</div>}
              </div>
              <div className="pt-2 text-[10px] text-gray-500 flex items-center justify-between">
                <span>برای تغییر ترتیب آیتم‌ها را بکشید. سپس ذخیره ترتیب را بزنید.</span>
                <button
                  disabled={localDownloads.length===0}
                  onClick={async ()=>{
                    try {
                      // prepare payload as array of {id, displayOrder}
                      const order = localDownloads.map(d=>({ id: d.id, displayOrder: d.displayOrder }));
                      const res = await PortalContentService.downloads.reorder(order);
                      if(res.success){
                        toast({ title: 'ترتیب ذخیره شد', description: res.updated ? `${res.updated} آیتم` : undefined });
                        refetchDownloads();
                      }
                    } catch(err:any){
                      toast({ title: 'خطا', description: err.message, variant:'destructive' });
                    }
                  }}
                  className="text-[10px] px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                >ذخیره ترتیب</button>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">پیش‌نمایش پرتال (read-only)</h2>
                <button onClick={() => refetchFull()} className="text-xs px-2 py-1 border rounded flex items-center gap-1"><RefreshCcw className="w-3 h-3" />بارگذاری</button>
              </div>
              {!fullContentData && <div className="text-xs text-gray-500">در حال بارگذاری...</div>}
              {fullContentData && (
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-4">
                    <div className="border rounded-lg p-4 bg-white">
                      <h3 className="font-semibold text-sm mb-2">بلوک‌ها</h3>
                      <ul className="space-y-2 text-xs">
                        {fullContentData.data.blocks.map((b: any) => (
                          <li key={b.blockKey} className="border rounded p-2">
                            <div className="font-medium">{b.title} <span className="text-[10px] text-gray-500">({b.blockKey})</span></div>
                            <div className="text-gray-600 whitespace-pre-wrap mt-1 leading-relaxed text-[11px]">{b.body.slice(0, 500) || '—'}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="border rounded-lg p-4 bg-white">
                      <h3 className="font-semibold text-sm mb-2">اطلاعیه‌های فعال</h3>
                      <ul className="space-y-2 text-xs">
                        {fullContentData.data.announcements.map((a: any) => (
                          <li key={a.id} className="border rounded p-2">
                            <div className="font-medium flex items-center gap-2">{a.title}<span className="text-[10px] bg-gray-100 border rounded px-1">{a.type}</span></div>
                            <div className="text-gray-600 whitespace-pre-wrap mt-1 leading-relaxed text-[11px]">{a.content}</div>
                          </li>
                        ))}
                        {fullContentData.data.announcements.length === 0 && <li className="text-gray-400">موردی نیست</li>}
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-white">
                      <h3 className="font-semibold text-sm mb-2">اپلیکیشن‌ها</h3>
                      <ul className="space-y-1 text-[11px]">
                        {fullContentData.data.downloads.map((d: any) => (
                          <li key={d.id} className="border rounded px-2 py-1 flex flex-col">
                            <span className="font-medium">{d.title}</span>
                            <span className="text-gray-600 break-all">{d.downloadLink}</span>
                          </li>
                        ))}
                        {fullContentData.data.downloads.length === 0 && <li className="text-gray-400">موردی نیست</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
