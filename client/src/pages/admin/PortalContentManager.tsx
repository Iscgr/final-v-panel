import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, RefreshCcw, Megaphone, Download, Eye, Plus, Trash2, FileDiff, Rocket, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PortalContentUnifiedService } from '@/services/portalContentUnified';

// ============================================================================
// PortalContentManager (Unified) - CLEAN VERSION
// فایل legacy کاملاً حذف شد. این نسخه فقط با سند یکپارچه portal_content_documents کار می‌کند.
// ============================================================================

interface UnifiedSection { id: string; title: string; body: string; order: number; }
interface UnifiedAnnouncement { id: string; title: string; content: string; priority: number; type: 'info'|'warning'|'success'|'error'; isActive: boolean; }
interface UnifiedDownload { id: string; title: string; description?: string; downloadLink: string; qrCodeUrl?: string|null; videoUrl?: string|null; isActive: boolean; displayOrder: number; }
interface PortalUnifiedDraft { displayTitle: string; sections: UnifiedSection[]; announcements: UnifiedAnnouncement[]; downloads: UnifiedDownload[]; metadata?: Record<string, any>; }

const genId = () => 'id_' + Math.random().toString(36).slice(2,11);

const tabs = [
  { key: 'structure', label: 'ساختار و متن', icon: <Layers className="w-4 h-4" /> },
  { key: 'announcements', label: 'اعلانات', icon: <Megaphone className="w-4 h-4" /> },
  { key: 'downloads', label: 'دانلودها', icon: <Download className="w-4 h-4" /> },
  { key: 'diff', label: 'Diff', icon: <FileDiff className="w-4 h-4" /> },
  { key: 'preview', label: 'پیش‌نمایش', icon: <Eye className="w-4 h-4" /> }
];

export default function PortalContentManager() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('structure');

  // Queries
  const draftQuery = useQuery({ queryKey: ['unified-portal-draft'], queryFn: () => PortalContentUnifiedService.getDraft() });
  const statusQuery = useQuery({ queryKey: ['unified-portal-status'], queryFn: () => PortalContentUnifiedService.getStatus(), enabled: true });
  const flagQuery = useQuery({ queryKey: ['portal-content-flag-state'], queryFn: async ()=> {
    try { const r = await fetch('/api/admin/portal-content-flag/state',{ credentials:'include' }); if(!r.ok) throw new Error('flag_state_fetch'); return (await r.json())?.data?.state || 'off'; } catch { return 'off'; }
  }, staleTime: 15_000 });
  const diffQuery = useQuery({ queryKey: ['unified-portal-diff'], queryFn: () => PortalContentUnifiedService.getDiff(), enabled: activeTab === 'diff' });

  const draft = draftQuery.data?.data?.draftJson as PortalUnifiedDraft | undefined;
  const draftVersion = draftQuery.data?.data?.draftVersion || 1;
  const publishedVersion = draftQuery.data?.data?.publishedVersion || 0;
  const docStatus = draftQuery.data?.data?.status || 'draft';

  const [localDraft, setLocalDraft] = useState<PortalUnifiedDraft | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(()=>{ if(draft && !localDraft){ setLocalDraft(JSON.parse(JSON.stringify(draft))); setIsDirty(false);} }, [draft, localDraft]);
  useEffect(()=>{ if(!draft || !localDraft) return; setIsDirty(JSON.stringify(draft)!==JSON.stringify(localDraft)); }, [draft, localDraft]);

  const saveMutation = useMutation({
    mutationFn: () => { if(!localDraft) throw new Error('no_local_draft'); return PortalContentUnifiedService.saveDraft(localDraft as any); },
    onSuccess: () => { toast({ title: 'پیش‌نویس ذخیره شد' }); draftQuery.refetch(); },
    onError: () => toast({ title: 'خطا در ذخیره', variant: 'destructive' })
  });
  const publishMutation = useMutation({
    mutationFn: () => PortalContentUnifiedService.publish(),
    onSuccess: () => { toast({ title: 'منتشر شد', description: 'نسخه جدید فعال شد' }); draftQuery.refetch(); statusQuery.refetch(); diffQuery.refetch(); },
    onError: () => toast({ title: 'انتشار ناموفق', variant: 'destructive' })
  });

  // Draft field helpers
  const updateDraftField = <K extends keyof PortalUnifiedDraft>(k: K, v: PortalUnifiedDraft[K]) => setLocalDraft(d => d? { ...d, [k]: v } : d);
  const addSection = () => updateDraftField('sections', [...(localDraft?.sections||[]), { id: genId(), title: 'عنوان جدید', body: '', order: (localDraft?.sections?.length||0)*10 }]);
  const updateSection = (id:string, patch: Partial<UnifiedSection>) => updateDraftField('sections', (localDraft?.sections||[]).map(s=> s.id===id? {...s, ...patch}:s));
  const removeSection = (id:string) => updateDraftField('sections', (localDraft?.sections||[]).filter(s=> s.id!==id));

  const addAnnouncement = () => updateDraftField('announcements', [...(localDraft?.announcements||[]), { id: genId(), title:'عنوان اعلان', content:'متن اعلان', priority:0, type:'info', isActive:true }]);
  const updateAnnouncement = (id:string, patch: Partial<UnifiedAnnouncement>) => updateDraftField('announcements', (localDraft?.announcements||[]).map(a=> a.id===id? {...a, ...patch}:a));
  const removeAnnouncement = (id:string) => updateDraftField('announcements', (localDraft?.announcements||[]).filter(a=> a.id!==id));

  const addDownload = () => updateDraftField('downloads', [...(localDraft?.downloads||[]), { id: genId(), title:'اپ جدید', description:'', downloadLink:'https://', isActive:true, displayOrder:(localDraft?.downloads?.length||0)*10, qrCodeUrl:null, videoUrl:null }]);
  const updateDownload = (id:string, patch: Partial<UnifiedDownload>) => updateDraftField('downloads', (localDraft?.downloads||[]).map(d=> d.id===id? {...d, ...patch}:d));
  const removeDownload = (id:string) => updateDraftField('downloads', (localDraft?.downloads||[]).filter(d=> d.id!==id));
  const reorderDownload = (sourceId:string, targetId:string) => {
    const arr=[...(localDraft?.downloads||[])]; const si=arr.findIndex(d=>d.id===sourceId); const ti=arr.findIndex(d=>d.id===targetId); if(si===-1||ti===-1) return; const [mv]=arr.splice(si,1); arr.splice(ti,0,mv); updateDraftField('downloads', arr.map((d,i)=>({...d, displayOrder:i*10})));
  };

  const handleSave = () => { if(!isDirty || saveMutation.isPending) return; saveMutation.mutate(); };
  useEffect(()=>{ const h=(e:KeyboardEvent)=>{ if((e.ctrlKey||e.metaKey)&& e.key==='s'){ e.preventDefault(); handleSave(); }}; window.addEventListener('keydown',h); return ()=> window.removeEventListener('keydown',h); }, [handleSave, isDirty, saveMutation.isPending]);

  const loading = draftQuery.isLoading || !localDraft;
  const unifiedPreview = localDraft;

  const flagState = flagQuery.data as string | undefined;
  const isUnifiedLive = flagState === 'full';
  const isPublishedBehind = publishedVersion < draftVersion;
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold">مدیریت یکپارچه محتوای پرتال</h1>
        <div className="text-xs flex flex-wrap gap-3 items-center">
          <span className="px-2 py-1 rounded bg-gray-100 border">draft v{draftVersion}</span>
            <span className="px-2 py-1 rounded bg-gray-100 border">published v{publishedVersion}</span>
            <span className={`px-2 py-1 rounded border ${docStatus==='published' ? 'bg-emerald-50 border-emerald-300 text-emerald-700':'bg-amber-50 border-amber-300 text-amber-700'}`}>وضعیت: {docStatus}</span>
            {isDirty && <span className="px-2 py-1 rounded bg-amber-100 border border-amber-300 text-amber-800">تغییرات ذخیره نشده</span>}
            {flagState && <span className="px-2 py-1 rounded bg-indigo-50 border border-indigo-300 text-indigo-700">flag: {flagState}</span>}
            {!isUnifiedLive && <span className="px-2 py-1 rounded bg-rose-50 border border-rose-300 text-rose-700">⚠ public هنوز legacy است</span>}
            {isUnifiedLive && isPublishedBehind && <span className="px-2 py-1 rounded bg-amber-50 border border-amber-300 text-amber-700">⚠ انتشار لازم است</span>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=> draftQuery.refetch()} className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border flex items-center gap-1"><RefreshCcw className="w-3 h-3"/>بارگذاری مجدد</button>
          <button disabled={!isDirty || saveMutation.isPending} onClick={handleSave} className="px-3 py-1 text-xs rounded bg-blue-600 text-white flex items-center gap-1 disabled:opacity-40"><Save className="w-3 h-3" />{saveMutation.isPending? 'در حال ذخیره...' : 'ذخیره پیش‌نویس'}</button>
          <button disabled={publishMutation.isPending || (publishedVersion>0 && !isDirty && docStatus==='published')} onClick={()=> publishMutation.mutate()} className="px-3 py-1 text-xs rounded bg-emerald-600 text-white flex items-center gap-1 disabled:opacity-40"><Rocket className="w-3 h-3" />{publishMutation.isPending? 'انتشار...' : 'انتشار'}</button>
        </div>
        <div className="text-[11px] text-gray-500 flex flex-col gap-1">
          {!isUnifiedLive && <div>در حالت <b>{flagState}</b> محتوای عمومی هنوز از مسیر legacy سرو می‌شود. برای مشاهده تغییرات در پرتال عمومی، flag را به <code className="px-1 bg-gray-100 rounded">full</code> ببرید.</div>}
          {isUnifiedLive && isPublishedBehind && <div>نسخه پیش‌نویس از نسخه منتشر شده جلوتر است. برای اعمال در پرتال عمومی دکمه انتشار را بزنید.</div>}
        </div>
      </div>

      <div className="flex gap-2 mb-5 border-b pb-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={()=> setActiveTab(t.key)} className={`px-4 py-2 rounded-t-lg text-xs flex items-center gap-2 transition-all ${activeTab===t.key? 'bg-blue-600 text-white shadow -mb-[2px]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{t.icon}{t.label}</button>
        ))}
      </div>

      {loading && <div className="text-sm text-gray-500">در حال بارگذاری پیش‌نویس...</div>}
      {!loading && localDraft && (
        <>
          {activeTab==='structure' && (
            <div className="space-y-6">
              <div className="bg-white border rounded p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1">عنوان اصلی (displayTitle)</label>
                  <input value={localDraft.displayTitle} onChange={e=> updateDraftField('displayTitle', e.target.value)} className="w-full px-3 py-2 text-sm border rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">بخش‌ها (sections)</h3>
                  <button onClick={addSection} className="text-xs px-2 py-1 bg-blue-600 text-white rounded flex items-center gap-1"><Plus className="w-3 h-3"/>افزودن بخش</button>
                </div>
                <div className="space-y-3">
                  {localDraft.sections.length===0 && <div className="text-[11px] text-gray-500">هیچ بخشی تعریف نشده</div>}
                  {localDraft.sections.sort((a,b)=> a.order - b.order).map(sec => (
                    <div key={sec.id} className="border rounded p-3 bg-gray-50 space-y-2">
                      <div className="flex items-center gap-2">
                        <input value={sec.title} onChange={e=> updateSection(sec.id,{ title: e.target.value })} className="flex-1 text-xs border rounded px-2 py-1" />
                        <button onClick={()=> removeSection(sec.id)} className="text-[10px] px-2 py-1 border rounded text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3"/>حذف</button>
                      </div>
                      <textarea value={sec.body} onChange={e=> updateSection(sec.id,{ body: e.target.value })} rows={4} className="w-full text-xs border rounded px-2 py-1 leading-relaxed font-mono" />
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-gray-500">نکته: هر بخش می‌تواند برای راهنما، ساعات پشتیبانی، اطلاعات تماس و ... استفاده شود. ترتیب نهایی بر اساس order است.</p>
            </div>
          )}

          {activeTab==='announcements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">اعلانات</h3>
                <button onClick={addAnnouncement} className="text-xs px-2 py-1 bg-blue-600 text-white rounded flex items-center gap-1"><Plus className="w-3 h-3"/>افزودن اعلان</button>
              </div>
              <div className="space-y-3">
                {localDraft.announcements.length===0 && <div className="text-[11px] text-gray-500">اعلانی وجود ندارد</div>}
                {localDraft.announcements.sort((a,b)=> b.priority - a.priority).map(a => (
                  <div key={a.id} className="border rounded p-3 bg-white space-y-2">
                    <div className="grid md:grid-cols-5 gap-2 text-xs items-start">
                      <input value={a.title} onChange={e=> updateAnnouncement(a.id,{ title: e.target.value })} className="border rounded px-2 py-1 col-span-1" />
                      <textarea value={a.content} onChange={e=> updateAnnouncement(a.id,{ content: e.target.value })} rows={2} className="border rounded px-2 py-1 col-span-2" />
                      <div className="flex flex-col gap-1 col-span-1">
                        <input type="number" value={a.priority} onChange={e=> updateAnnouncement(a.id,{ priority: Number(e.target.value) })} className="border rounded px-2 py-1" />
                        <select value={a.type} onChange={e=> updateAnnouncement(a.id,{ type: e.target.value as any })} className="border rounded px-2 py-1"><option value="info">info</option><option value="warning">warning</option><option value="success">success</option><option value="error">error</option></select>
                        <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={a.isActive} onChange={e=> updateAnnouncement(a.id,{ isActive: e.target.checked })} />فعال</label>
                      </div>
                      <div className="flex flex-col gap-1 col-span-1">
                        <button onClick={()=> removeAnnouncement(a.id)} className="text-[10px] px-2 py-1 border rounded text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3"/>حذف</button>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500 flex gap-4"><span>priority: {a.priority}</span><span>type: {a.type}</span></div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-500">مرتب‌سازی عمومی بر اساس priority (نزولی) است.</p>
            </div>
          )}

          {activeTab==='downloads' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">دانلودها</h3><button onClick={addDownload} className="text-xs px-2 py-1 bg-blue-600 text-white rounded flex items-center gap-1"><Plus className="w-3 h-3"/>افزودن دانلود</button></div>
              <div className="space-y-3" onDragOver={e=>e.preventDefault()}>
                {localDraft.downloads.length===0 && <div className="text-[11px] text-gray-500">موردی ثبت نشده</div>}
                {localDraft.downloads.sort((a,b)=> a.displayOrder - b.displayOrder).map(d => (
                  <div key={d.id} draggable onDragStart={e=> e.dataTransfer.setData('text/plain', d.id)} onDrop={e=> { e.preventDefault(); const sid = e.dataTransfer.getData('text/plain'); if(sid && sid!==d.id) reorderDownload(sid, d.id); }} className="border rounded p-3 bg-white space-y-2 cursor-move">
                    <div className="flex items-start gap-3 text-xs flex-wrap">
                      <input value={d.title} onChange={e=> updateDownload(d.id,{ title: e.target.value })} className="border rounded px-2 py-1 flex-1 min-w-[140px]" />
                      <input value={d.downloadLink} onChange={e=> updateDownload(d.id,{ downloadLink: e.target.value })} className="border rounded px-2 py-1 flex-[2] min-w-[200px]" />
                      <input value={d.description || ''} onChange={e=> updateDownload(d.id,{ description: e.target.value })} className="border rounded px-2 py-1 flex-1 min-w-[160px]" placeholder="توضیح" />
                      <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={d.isActive} onChange={e=> updateDownload(d.id,{ isActive: e.target.checked })} />فعال</label>
                      <button onClick={()=> removeDownload(d.id)} className="text-[10px] px-2 py-1 border rounded text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3"/>حذف</button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-2 text-[10px]">
                      <input value={d.qrCodeUrl || ''} onChange={e=> updateDownload(d.id,{ qrCodeUrl: e.target.value })} placeholder="QR URL" className="border rounded px-2 py-1" />
                      <input value={d.videoUrl || ''} onChange={e=> updateDownload(d.id,{ videoUrl: e.target.value })} placeholder="Video URL" className="border rounded px-2 py-1" />
                    </div>
                    <div className="text-[10px] text-gray-500">order: {d.displayOrder}</div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-500">Drag & Drop برای تغییر ترتیب.</p>
            </div>
          )}

          {activeTab==='diff' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Diff آخرین انتشار</h3>
              {diffQuery.isLoading && <div className="text-xs text-gray-500">در حال بارگذاری diff...</div>}
              {!diffQuery.isLoading && (!diffQuery.data?.diff || Object.keys(diffQuery.data.diff).length===0) && <div className="text-xs text-gray-500">تفاوتی ثبت نشده</div>}
              {diffQuery.data?.diff && (
                <ul className="space-y-2 text-[11px]">
                  {Object.entries(diffQuery.data.diff).map(([k,v]:any) => (
                    <li key={k} className="border rounded p-3 bg-white">
                      <div className="font-medium text-xs mb-1">{k}</div>
                      <pre className="bg-gray-50 border rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap text-[10px] ltr:text-left rtl:text-right"><code>{JSON.stringify(v.after, null, 2)}</code></pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab==='preview' && unifiedPreview && (
            <div className="space-y-6">
              <div className="border rounded p-4 bg-white space-y-4">
                <h2 className="text-lg font-bold text-center">{unifiedPreview.displayTitle}</h2>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Megaphone className="w-4 h-4"/>اعلانات و اطلاعیه‌ها</h3>
                  <div className="grid md:grid-cols-3 gap-3">
                    {unifiedPreview.announcements.filter(a=>a.isActive).sort((a,b)=> b.priority - a.priority).map(a => (
                      <div key={a.id} className="rounded border p-3 text-xs bg-gradient-to-b from-amber-50 to-white">
                        <div className="font-semibold flex items-center gap-2">{a.title}<span className="px-1 rounded bg-gray-100 border text-[9px]">{a.type}</span></div>
                        <div className="mt-1 whitespace-pre-wrap leading-relaxed text-[11px] text-gray-700">{a.content}</div>
                      </div>
                    ))}
                    {unifiedPreview.announcements.filter(a=>a.isActive).length===0 && <div className="text-[11px] text-gray-400">اعلان فعالی نیست</div>}
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Download className="w-4 h-4"/>دانلود اپلیکیشن‌ها</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    {unifiedPreview.downloads.filter(d=>d.isActive).sort((a,b)=> a.displayOrder - b.displayOrder).map(d => (
                      <div key={d.id} className="border rounded p-4 bg-gray-800/90 text-white text-xs flex flex-col gap-3">
                        <div className="font-semibold text-sm">{d.title}</div>
                        {d.qrCodeUrl && <div className="bg-white p-2 rounded flex items-center justify-center"><img src={d.qrCodeUrl} alt="qr" className="w-28 h-28 object-contain" /></div>}
                        <div className="space-y-2">
                          <a href={d.downloadLink} className="block w-full text-center rounded bg-emerald-500 hover:bg-emerald-600 text-white py-1">دانلود مستقیم</a>
                          <button onClick={()=> navigator.clipboard.writeText(d.downloadLink)} className="block w-full text-center rounded bg-blue-600 hover:bg-blue-700 text-white py-1">کپی لینک</button>
                        </div>
                        {d.description && <div className="text-[10px] text-gray-200 whitespace-pre-wrap">{d.description}</div>}
                      </div>
                    ))}
                    {unifiedPreview.downloads.filter(d=>d.isActive).length===0 && <div className="text-[11px] text-gray-400">دانلود فعالی نیست</div>}
                  </div>
                </div>
                <div className="space-y-3">
                  {unifiedPreview.sections.sort((a,b)=> a.order - b.order).map(s => (
                    <div key={s.id} className="border rounded p-4 bg-teal-900/90 text-teal-50 text-xs">
                      <div className="font-semibold mb-2">{s.title}</div>
                      <div className="whitespace-pre-wrap leading-relaxed">{s.body || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-gray-500">این پیش‌نمایش بر اساس پیش‌نویس فعلی است و ممکن است هنوز منتشر نشده باشد.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
