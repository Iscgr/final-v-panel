/*
 * صفحه مدیریت لینک‌های دانلود اپلیکیشن در پنل ادمین
 * نسخه پیشرفته با File Upload, Search & Filter, Statistics
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Save, X, Search, Filter, BarChart3, Image as ImageIcon, Video as VideoIcon, Loader2 } from 'lucide-react';
import FileUploadZone from '@/components/FileUploadZone';

interface AppDownload {
  id: number;
  title: string;
  description?: string;
  downloadLink: string;
  qrCodeUrl?: string;
  qrCodeFilePath?: string;
  videoUrl?: string;
  videoFilePath?: string;
  viewCount: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AppStats {
  totalViews: number;
  viewsByType: { actionType: string; count: number }[];
  recentViews: { date: string; count: number }[];
}

export default function AppDownloadsManager() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingStatsId, setViewingStatsId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | 'all'>('all');
  const [formData, setFormData] = useState<Partial<AppDownload>>({
    title: '',
    description: '',
    downloadLink: '',
    qrCodeUrl: '',
    videoUrl: '',
    displayOrder: 0,
    isActive: true
  });
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // دریافت لیست اپلیکیشن‌ها
  const { data: downloads = [], isLoading } = useQuery<AppDownload[]>({
    queryKey: ['/api/admin/app-downloads'],
    queryFn: async () => {
      const res = await fetch('/api/admin/app-downloads');
      const json = await res.json();
      return json.data || [];
    }
  });

  // دریافت آمار یک اپلیکیشن
  const { data: stats, isLoading: isLoadingStats } = useQuery<AppStats>({
    queryKey: ['/api/admin/app-downloads', viewingStatsId, 'stats'],
    enabled: !!viewingStatsId,
    queryFn: async () => {
      const res = await fetch(`/api/admin/app-downloads/${viewingStatsId}/stats`);
      const json = await res.json();
      return json.data;
    }
  });

  // فیلتر و جستجو
  const filteredDownloads = useMemo(() => {
    return downloads.filter(item => {
      // فیلتر بر اساس وضعیت
      if (filterActive !== 'all' && item.isActive !== filterActive) {
        return false;
      }
      // جستجو در عنوان و توضیحات
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const titleMatch = item.title.toLowerCase().includes(query);
        const descMatch = item.description?.toLowerCase().includes(query);
        return titleMatch || descMatch;
      }
      return true;
    });
  }, [downloads, searchQuery, filterActive]);

  // آپلود فایل
  const uploadFileMutation = useMutation({
    mutationFn: async ({ id, file, type }: { id: number; file: File; type: 'qr-code' | 'video' }) => {
      const formDataObj = new FormData();
      formDataObj.append(type === 'qr-code' ? 'qrCode' : 'video', file);
      const res = await fetch(`/api/admin/upload/${type}/${id}`, {
        method: 'POST',
        body: formDataObj
      });
      return res.json();
    }
  });

  // حذف فایل
  const deleteFileMutation = useMutation({
    mutationFn: async ({ id, type }: { id: number; type: 'qr-code' | 'video' }) => {
      const res = await fetch(`/api/admin/upload/${type}/${id}`, {
        method: 'DELETE'
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });
    }
  });

  // ایجاد اپلیکیشن جدید
  const createMutation = useMutation({
    mutationFn: async (data: Partial<AppDownload>) => {
      const res = await fetch('/api/admin/app-downloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    onSuccess: async (response) => {
      const appId = response.data?.id;
      if (appId) {
        if (qrCodeFile) await uploadFileMutation.mutateAsync({ id: appId, file: qrCodeFile, type: 'qr-code' });
        if (videoFile) await uploadFileMutation.mutateAsync({ id: appId, file: videoFile, type: 'video' });
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });
      resetForm();
      setIsAdding(false);
    }
  });

  // ویرایش اپلیکیشن
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AppDownload> }) => {
      const res = await fetch(`/api/admin/app-downloads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    onSuccess: async (_, variables) => {
      if (qrCodeFile) await uploadFileMutation.mutateAsync({ id: variables.id, file: qrCodeFile, type: 'qr-code' });
      if (videoFile) await uploadFileMutation.mutateAsync({ id: variables.id, file: videoFile, type: 'video' });
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });
      resetForm();
      setEditingId(null);
    }
  });

  // حذف اپلیکیشن
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/app-downloads/${id}`, { method: 'DELETE' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });
    }
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      downloadLink: '',
      qrCodeUrl: '',
      videoUrl: '',
      displayOrder: 0,
      isActive: true
    });
    setQrCodeFile(null);
    setVideoFile(null);
  };

  const handleEdit = (download: AppDownload) => {
    setFormData(download);
    setEditingId(download.id);
    setIsAdding(false);
  };

  const cancelEdit = () => {
    resetForm();
    setEditingId(null);
    setIsAdding(false);
  };

  const handleSubmit = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('آیا از حذف این اپلیکیشن اطمینان دارید؟')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center">در حال بارگذاری...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">مدیریت اپلیکیشن‌ها</h1>
        <p className="text-gray-600">مدیریت لینک‌های دانلود، QR Code و ویدئوهای آموزشی</p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg shadow-sm">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="جستجو..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-gray-500" />
          <select
            value={filterActive === 'all' ? 'all' : String(filterActive)}
            onChange={(e) => setFilterActive(e.target.value === 'all' ? 'all' : e.target.value === 'true')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">همه</option>
            <option value="true">فعال</option>
            <option value="false">غیرفعال</option>
          </select>
        </div>
        <button
          onClick={() => { resetForm(); setIsAdding(true); setEditingId(null); }}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          افزودن
        </button>
      </div>

      {/* فرم افزودن/ویرایش */}
      {(isAdding || editingId) && (
        <div className="mb-6 bg-white p-6 rounded-lg shadow-md border-2 border-blue-200">
          <h2 className="text-xl font-bold mb-4">{editingId ? 'ویرایش' : 'افزودن'} اپلیکیشن</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="عنوان *"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-2 border rounded"
            />
            <input
              type="url"
              placeholder="لینک دانلود *"
              value={formData.downloadLink || ''}
              onChange={(e) => setFormData({ ...formData, downloadLink: e.target.value })}
              className="w-full p-2 border rounded"
            />
            <textarea
              placeholder="توضیحات"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="md:col-span-2 w-full p-2 border rounded"
            />
            <input
              type="number"
              placeholder="ترتیب نمایش"
              value={formData.displayOrder || 0}
              onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
              className="w-full p-2 border rounded"
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              فعال
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <ImageIcon className="inline w-5 h-5 mr-1" />
                QR Code
              </label>
              <FileUploadZone
                type="image"
                maxSize={5}
                currentFileUrl={formData.qrCodeUrl}
                onFileSelect={setQrCodeFile}
                onRemove={() => {
                  setQrCodeFile(null);
                  if (editingId) deleteFileMutation.mutate({ id: editingId, type: 'qr-code' });
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <VideoIcon className="inline w-5 h-5 mr-1" />
                ویدئو
              </label>
              <FileUploadZone
                type="video"
                maxSize={50}
                currentFileUrl={formData.videoUrl}
                onFileSelect={setVideoFile}
                onRemove={() => {
                  setVideoFile(null);
                  if (editingId) deleteFileMutation.mutate({ id: editingId, type: 'video' });
                }}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={!formData.title || !formData.downloadLink || createMutation.isPending || updateMutation.isPending}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="inline w-5 h-5 mr-1" />
              ذخیره
            </button>
            <button
              onClick={() => { resetForm(); setIsAdding(false); setEditingId(null); }}
              className="px-6 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      {/* لیست اپلیکیشن‌ها */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDownloads.map((download) => (
          <div key={download.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* تصویر QR Code */}
            {download.qrCodeUrl && (
              <div className="h-48 w-full object-contain bg-gray-100 p-2">
                <img
                  src={download.qrCodeUrl}
                  alt={download.title}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}

            <div className="p-4">
              <h3 className="text-lg font-bold">{download.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-2 h-10">{download.description}</p>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                <BarChart3 className="w-4 h-4" />
                <span>{download.viewCount.toLocaleString('fa-IR')} بازدید</span>
              </div>

              {/* ویدئو */}
              {download.videoUrl && (
                <div className="mb-3">
                  <video
                    src={download.videoUrl}
                    controls
                    className="w-full h-32 bg-black rounded"
                  />
                </div>
              )}

              {/* دکمه‌های عملیات */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleEdit(download)}
                  className="flex-1 p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                >
                  <Edit className="inline w-4 h-4" />
                  ویرایش
                </button>
                <button
                  onClick={() => setViewingStatsId(download.id)}
                  className="flex-1 p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100"
                >
                  <BarChart3 className="inline w-4 h-4" />
                  آمار
                </button>
                <button
                  onClick={() => handleDelete(download.id)}
                  className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* نمایش پیام خالی */}
      {filteredDownloads.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          نتیجه‌ای یافت نشد.
        </div>
      )}

      {/* مودال آمار */}
      {viewingStatsId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">آمار بازدید</h2>
              <button onClick={() => setViewingStatsId(null)}>
                <X />
              </button>
            </div>
            {isLoadingStats ? (
              <Loader2 className="animate-spin" />
            ) : (
              stats && (
                <div className="space-y-4">
                  <div>
                    کل بازدیدها: <span className="font-bold text-lg">{stats.totalViews.toLocaleString('fa-IR')}</span>
                  </div>
                  <div>
                    <h3>بر اساس نوع:</h3>
                    <ul>
                      {stats.viewsByType.map(v => (
                        <li key={v.actionType}>
                          {v.actionType}: {v.count.toLocaleString('fa-IR')}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>بازدید ۷ روز اخیر:</h3>
                    <ul>
                      {stats.recentViews.map(v => (
                        <li key={v.date}>
                          {new Date(v.date).toLocaleDateString('fa-IR')}: {v.count.toLocaleString('fa-IR')}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
