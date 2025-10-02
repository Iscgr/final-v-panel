/**
 * صفحه مدیریت لینک‌های دانلود اپلیکیشن در پنل ادمین
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

interface AppDownload {
  id: number;
  title: string;
  description?: string;
  downloadLink: string;
  qrCodeUrl?: string;
  videoUrl?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AppDownloadsManager() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<AppDownload>>({
    title: '',
    description: '',
    downloadLink: '',
    qrCodeUrl: '',
    videoUrl: '',
    displayOrder: 0,
    isActive: true
  });

  // دریافت لیست اپلیکیشن‌ها
  const { data: downloads = [], isLoading } = useQuery<AppDownload[]>({
    queryKey: ['/api/admin/app-downloads'],
    queryFn: async () => {
      const res = await fetch('/api/admin/app-downloads');
      const json = await res.json();
      return json.data || [];
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });
      resetForm();
      setEditingId(null);
    }
  });

  // حذف اپلیکیشن
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/app-downloads/${id}`, {
        method: 'DELETE'
      });
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const startEdit = (download: AppDownload) => {
    setFormData(download);
    setEditingId(download.id);
    setIsAdding(false);
  };

  const cancelEdit = () => {
    resetForm();
    setEditingId(null);
    setIsAdding(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">مدیریت لینک‌های دانلود اپلیکیشن</h1>
        {!isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            افزودن اپلیکیشن جدید
          </button>
        )}
      </div>

      {/* فرم افزودن/ویرایش */}
      {(isAdding || editingId) && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? 'ویرایش اپلیکیشن' : 'افزودن اپلیکیشن جدید'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  عنوان اپلیکیشن <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  لینک دانلود <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={formData.downloadLink || ''}
                  onChange={(e) => setFormData({ ...formData, downloadLink: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL تصویر QR Code</label>
                <input
                  type="url"
                  value={formData.qrCodeUrl || ''}
                  onChange={(e) => setFormData({ ...formData, qrCodeUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL ویدئوی آموزشی</label>
                <input
                  type="url"
                  value={formData.videoUrl || ''}
                  onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ترتیب نمایش</label>
                <input
                  type="number"
                  value={formData.displayOrder || 0}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive !== false}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">فعال</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={cancelEdit}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <X size={18} />
                انصراف
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={18} />
                {editingId ? 'ذخیره تغییرات' : 'افزودن'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* لیست اپلیکیشن‌ها */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">عنوان</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">توضیحات</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">لینک دانلود</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">QR Code</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">ویدئو</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">ترتیب</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">وضعیت</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {downloads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  هیچ اپلیکیشنی ثبت نشده است
                </td>
              </tr>
            ) : (
              downloads.map((download) => (
                <tr key={download.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{download.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{download.description || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <a
                      href={download.downloadLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate block max-w-xs"
                    >
                      {download.downloadLink}
                    </a>
                  </td>
                  <td className="px-6 py-4 text-center text-sm">
                    {download.qrCodeUrl ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-sm">
                    {download.videoUrl ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-900">{download.displayOrder}</td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        download.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {download.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => startEdit(download)}
                        className="text-blue-600 hover:text-blue-800"
                        title="ویرایش"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('آیا از حذف این اپلیکیشن اطمینان دارید?')) {
                            deleteMutation.mutate(download.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-800"
                        title="حذف"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
