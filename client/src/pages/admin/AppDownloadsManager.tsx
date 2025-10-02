/**/**

 * صفحه مدیریت لینک‌های دانلود اپلیکیشن در پنل ادمین * صفحه مدیریت لینک‌های دانلود اپلیکیشن در پنل ادمین

 * نسخه پیشرفته با File Upload, Search & Filter, Statistics */

 */import React, { useState } from 'react';

import React, { useState, useMemo } from 'react';import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

import { Plus, Edit, Trash2, Save, X, Search, Filter, BarChart3, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';

import FileUploadZone from '@/components/FileUploadZone';interface AppDownload {

  id: number;

interface AppDownload {  title: string;

  id: number;  description?: string;

  title: string;  downloadLink: string;

  description?: string;  qrCodeUrl?: string;

  downloadLink: string;  videoUrl?: string;

  qrCodeUrl?: string;  displayOrder: number;

  qrCodeFilePath?: string;  isActive: boolean;

  videoUrl?: string;  createdAt: string;

  videoFilePath?: string;  updatedAt: string;

  viewCount: number;}

  displayOrder: number;

  isActive: boolean;export default function AppDownloadsManager() {

  createdAt: string;  const queryClient = useQueryClient();

  updatedAt: string;  const [isAdding, setIsAdding] = useState(false);

}  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState<Partial<AppDownload>>({

interface AppStats {    title: '',

  totalViews: number;    description: '',

  viewsByType: { actionType: string; count: number }[];    downloadLink: '',

  recentViews: { date: string; count: number }[];    qrCodeUrl: '',

}    videoUrl: '',

    displayOrder: 0,

export default function AppDownloadsManager() {    isActive: true

  const queryClient = useQueryClient();  });

  const [isAdding, setIsAdding] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);  // دریافت لیست اپلیکیشن‌ها

  const [viewingStatsId, setViewingStatsId] = useState<number | null>(null);  const { data: downloads = [], isLoading } = useQuery<AppDownload[]>({

  const [searchQuery, setSearchQuery] = useState('');    queryKey: ['/api/admin/app-downloads'],

  const [filterActive, setFilterActive] = useState<boolean | 'all'>('all');    queryFn: async () => {

  const [formData, setFormData] = useState<Partial<AppDownload>>({      const res = await fetch('/api/admin/app-downloads');

    title: '',      const json = await res.json();

    description: '',      return json.data || [];

    downloadLink: '',    }

    qrCodeUrl: '',  });

    videoUrl: '',

    displayOrder: 0,  // ایجاد اپلیکیشن جدید

    isActive: true  const createMutation = useMutation({

  });    mutationFn: async (data: Partial<AppDownload>) => {

  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);      const res = await fetch('/api/admin/app-downloads', {

  const [videoFile, setVideoFile] = useState<File | null>(null);        method: 'POST',

  const [isUploadingQR, setIsUploadingQR] = useState(false);        headers: { 'Content-Type': 'application/json' },

  const [isUploadingVideo, setIsUploadingVideo] = useState(false);        body: JSON.stringify(data)

      });

  // دریافت لیست اپلیکیشن‌ها      return res.json();

  const { data: downloads = [], isLoading } = useQuery<AppDownload[]>({    },

    queryKey: ['/api/admin/app-downloads'],    onSuccess: () => {

    queryFn: async () => {      queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });

      const res = await fetch('/api/admin/app-downloads');      resetForm();

      const json = await res.json();      setIsAdding(false);

      return json.data || [];    }

    }  });

  });

  // ویرایش اپلیکیشن

  // دریافت آمار یک اپلیکیشن  const updateMutation = useMutation({

  const { data: stats } = useQuery<AppStats>({    mutationFn: async ({ id, data }: { id: number; data: Partial<AppDownload> }) => {

    queryKey: ['/api/admin/app-downloads', viewingStatsId, 'stats'],      const res = await fetch(`/api/admin/app-downloads/${id}`, {

    enabled: !!viewingStatsId,        method: 'PUT',

    queryFn: async () => {        headers: { 'Content-Type': 'application/json' },

      const res = await fetch(`/api/admin/app-downloads/${viewingStatsId}/stats`);        body: JSON.stringify(data)

      const json = await res.json();      });

      return json.data;      return res.json();

    }    },

  });    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });

  // فیلتر و جستجو      resetForm();

  const filteredDownloads = useMemo(() => {      setEditingId(null);

    return downloads.filter(item => {    }

      // فیلتر بر اساس وضعیت  });

      if (filterActive !== 'all' && item.isActive !== filterActive) {

        return false;  // حذف اپلیکیشن

      }  const deleteMutation = useMutation({

    mutationFn: async (id: number) => {

      // جستجو در عنوان و توضیحات      const res = await fetch(`/api/admin/app-downloads/${id}`, {

      if (searchQuery) {        method: 'DELETE'

        const query = searchQuery.toLowerCase();      });

        const titleMatch = item.title.toLowerCase().includes(query);      return res.json();

        const descMatch = item.description?.toLowerCase().includes(query);    },

        return titleMatch || descMatch;    onSuccess: () => {

      }      queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });

    }

      return true;  });

    });

  }, [downloads, searchQuery, filterActive]);  const resetForm = () => {

    setFormData({

  // آپلود QR Code      title: '',

  const uploadQRCodeMutation = useMutation({      description: '',

    mutationFn: async ({ id, file }: { id: number; file: File }) => {      downloadLink: '',

      const formDataObj = new FormData();      qrCodeUrl: '',

      formDataObj.append('qrCode', file);      videoUrl: '',

      displayOrder: 0,

      const res = await fetch(`/api/admin/upload/qr-code/${id}`, {      isActive: true

        method: 'POST',    });

        body: formDataObj  };

      });

      return res.json();  const handleSubmit = (e: React.FormEvent) => {

    },    e.preventDefault();

    onSuccess: () => {    if (editingId) {

      queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });      updateMutation.mutate({ id: editingId, data: formData });

      setQrCodeFile(null);    } else {

    }      createMutation.mutate(formData);

  });    }

  };

  // آپلود ویدئو

  const uploadVideoMutation = useMutation({  const startEdit = (download: AppDownload) => {

    mutationFn: async ({ id, file }: { id: number; file: File }) => {    setFormData(download);

      const formDataObj = new FormData();    setEditingId(download.id);

      formDataObj.append('video', file);    setIsAdding(false);

  };

      const res = await fetch(`/api/admin/upload/video/${id}`, {

        method: 'POST',  const cancelEdit = () => {

        body: formDataObj    resetForm();

      });    setEditingId(null);

      return res.json();    setIsAdding(false);

    },  };

    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });  if (isLoading) {

      setVideoFile(null);    return (

    }      <div className="flex justify-center items-center min-h-screen">

  });        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>

      </div>

  // حذف QR Code    );

  const deleteQRCodeMutation = useMutation({  }

    mutationFn: async (id: number) => {

      const res = await fetch(`/api/admin/upload/qr-code/${id}`, {  return (

        method: 'DELETE'    <div className="container mx-auto p-6" dir="rtl">

      });      <div className="flex justify-between items-center mb-6">

      return res.json();        <h1 className="text-3xl font-bold text-gray-900">مدیریت لینک‌های دانلود اپلیکیشن</h1>

    },        {!isAdding && !editingId && (

    onSuccess: () => {          <button

      queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });            onClick={() => setIsAdding(true)}

    }            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"

  });          >

            <Plus size={20} />

  // حذف ویدئو            افزودن اپلیکیشن جدید

  const deleteVideoMutation = useMutation({          </button>

    mutationFn: async (id: number) => {        )}

      const res = await fetch(`/api/admin/upload/video/${id}`, {      </div>

        method: 'DELETE'

      });      {/* فرم افزودن/ویرایش */}

      return res.json();      {(isAdding || editingId) && (

    },        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-200">

    onSuccess: () => {          <h2 className="text-xl font-semibold mb-4">

      queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });            {editingId ? 'ویرایش اپلیکیشن' : 'افزودن اپلیکیشن جدید'}

    }          </h2>

  });          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

  // ایجاد اپلیکیشن جدید              <div>

  const createMutation = useMutation({                <label className="block text-sm font-medium text-gray-700 mb-1">

    mutationFn: async (data: Partial<AppDownload>) => {                  عنوان اپلیکیشن <span className="text-red-500">*</span>

      const res = await fetch('/api/admin/app-downloads', {                </label>

        method: 'POST',                <input

        headers: { 'Content-Type': 'application/json' },                  type="text"

        body: JSON.stringify(data)                  value={formData.title || ''}

      });                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}

      return res.json();                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"

    },                  required

    onSuccess: async (response) => {                />

      await queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });              </div>

                    <div>

      // آپلود فایل‌ها بعد از ایجاد رکورد                <label className="block text-sm font-medium text-gray-700 mb-1">

      const appId = response.data?.id;                  لینک دانلود <span className="text-red-500">*</span>

      if (appId) {                </label>

        if (qrCodeFile) {                <input

          await uploadQRCodeMutation.mutateAsync({ id: appId, file: qrCodeFile });                  type="url"

        }                  value={formData.downloadLink || ''}

        if (videoFile) {                  onChange={(e) => setFormData({ ...formData, downloadLink: e.target.value })}

          await uploadVideoMutation.mutateAsync({ id: appId, file: videoFile });                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"

        }                  required

      }                />

              </div>

      resetForm();            </div>

      setIsAdding(false);

    }            <div>

  });              <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>

              <textarea

  // ویرایش اپلیکیشن                value={formData.description || ''}

  const updateMutation = useMutation({                onChange={(e) => setFormData({ ...formData, description: e.target.value })}

    mutationFn: async ({ id, data }: { id: number; data: Partial<AppDownload> }) => {                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"

      const res = await fetch(`/api/admin/app-downloads/${id}`, {                rows={2}

        method: 'PUT',              />

        headers: { 'Content-Type': 'application/json' },            </div>

        body: JSON.stringify(data)

      });            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      return res.json();              <div>

    },                <label className="block text-sm font-medium text-gray-700 mb-1">URL تصویر QR Code</label>

    onSuccess: async (_, variables) => {                <input

      await queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });                  type="url"

                  value={formData.qrCodeUrl || ''}

      // آپلود فایل‌های جدید (اگر انتخاب شده باشند)                  onChange={(e) => setFormData({ ...formData, qrCodeUrl: e.target.value })}

      if (qrCodeFile) {                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"

        await uploadQRCodeMutation.mutateAsync({ id: variables.id, file: qrCodeFile });                />

      }              </div>

      if (videoFile) {              <div>

        await uploadVideoMutation.mutateAsync({ id: variables.id, file: videoFile });                <label className="block text-sm font-medium text-gray-700 mb-1">URL ویدئوی آموزشی</label>

      }                <input

                  type="url"

      resetForm();                  value={formData.videoUrl || ''}

      setEditingId(null);                  onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}

    }                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"

  });                />

              </div>

  // حذف اپلیکیشن            </div>

  const deleteMutation = useMutation({

    mutationFn: async (id: number) => {            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      const res = await fetch(`/api/admin/app-downloads/${id}`, {              <div>

        method: 'DELETE'                <label className="block text-sm font-medium text-gray-700 mb-1">ترتیب نمایش</label>

      });                <input

      return res.json();                  type="number"

    },                  value={formData.displayOrder || 0}

    onSuccess: () => {                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}

      queryClient.invalidateQueries({ queryKey: ['/api/admin/app-downloads'] });                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"

    }                />

  });              </div>

              <div className="flex items-center">

  const resetForm = () => {                <label className="flex items-center gap-2 cursor-pointer">

    setFormData({                  <input

      title: '',                    type="checkbox"

      description: '',                    checked={formData.isActive !== false}

      downloadLink: '',                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}

      qrCodeUrl: '',                    className="w-4 h-4"

      videoUrl: '',                  />

      displayOrder: 0,                  <span className="text-sm font-medium text-gray-700">فعال</span>

      isActive: true                </label>

    });              </div>

    setQrCodeFile(null);            </div>

    setVideoFile(null);

  };            <div className="flex gap-2 justify-end">

              <button

  const handleEdit = (download: AppDownload) => {                type="button"

    setFormData(download);                onClick={cancelEdit}

    setEditingId(download.id);                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"

    setIsAdding(false);              >

  };                <X size={18} />

                انصراف

  const handleSubmit = () => {              </button>

    if (editingId) {              <button

      updateMutation.mutate({ id: editingId, data: formData });                type="submit"

    } else {                disabled={createMutation.isPending || updateMutation.isPending}

      createMutation.mutate(formData);                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"

    }              >

  };                <Save size={18} />

                {editingId ? 'ذخیره تغییرات' : 'افزودن'}

  const handleDelete = (id: number) => {              </button>

    if (confirm('آیا از حذف این اپلیکیشن اطمینان دارید؟')) {            </div>

      deleteMutation.mutate(id);          </form>

    }        </div>

  };      )}



  if (isLoading) {      {/* لیست اپلیکیشن‌ها */}

    return (      <div className="bg-white rounded-lg shadow-lg overflow-hidden">

      <div className="flex items-center justify-center min-h-screen">        <table className="w-full">

        <div className="text-center">          <thead className="bg-gray-50 border-b border-gray-200">

          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>            <tr>

          <p className="text-gray-600">در حال بارگذاری...</p>              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">عنوان</th>

        </div>              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">توضیحات</th>

      </div>              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">لینک دانلود</th>

    );              <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">QR Code</th>

  }              <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">ویدئو</th>

              <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">ترتیب</th>

  return (              <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">وضعیت</th>

    <div className="p-6 max-w-7xl mx-auto">              <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">عملیات</th>

      {/* هدر */}            </tr>

      <div className="mb-6">          </thead>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">مدیریت اپلیکیشن‌ها</h1>          <tbody className="divide-y divide-gray-200">

        <p className="text-gray-600">مدیریت لینک‌های دانلود، QR Code و ویدئوهای آموزشی</p>            {downloads.length === 0 ? (

      </div>              <tr>

                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">

      {/* نوار ابزار */}                  هیچ اپلیکیشنی ثبت نشده است

      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg shadow-sm">                </td>

        {/* جستجو */}              </tr>

        <div className="relative flex-1 max-w-md w-full">            ) : (

          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />              downloads.map((download) => (

          <input                <tr key={download.id} className="hover:bg-gray-50">

            type="text"                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{download.title}</td>

            placeholder="جستجو در عنوان یا توضیحات..."                  <td className="px-6 py-4 text-sm text-gray-600">{download.description || '-'}</td>

            value={searchQuery}                  <td className="px-6 py-4 text-sm">

            onChange={(e) => setSearchQuery(e.target.value)}                    <a

            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"                      href={download.downloadLink}

          />                      target="_blank"

        </div>                      rel="noopener noreferrer"

                      className="text-blue-600 hover:underline truncate block max-w-xs"

        {/* فیلتر */}                    >

        <div className="flex items-center gap-3">                      {download.downloadLink}

          <Filter className="w-5 h-5 text-gray-500" />                    </a>

          <select                  </td>

            value={filterActive === 'all' ? 'all' : filterActive ? 'true' : 'false'}                  <td className="px-6 py-4 text-center text-sm">

            onChange={(e) => {                    {download.qrCodeUrl ? (

              const val = e.target.value;                      <span className="text-green-600">✓</span>

              setFilterActive(val === 'all' ? 'all' : val === 'true');                    ) : (

            }}                      <span className="text-gray-400">-</span>

            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"                    )}

          >                  </td>

            <option value="all">همه</option>                  <td className="px-6 py-4 text-center text-sm">

            <option value="true">فعال</option>                    {download.videoUrl ? (

            <option value="false">غیرفعال</option>                      <span className="text-green-600">✓</span>

          </select>                    ) : (

        </div>                      <span className="text-gray-400">-</span>

                    )}

        {/* دکمه افزودن */}                  </td>

        <button                  <td className="px-6 py-4 text-center text-sm text-gray-900">{download.displayOrder}</td>

          onClick={() => {                  <td className="px-6 py-4 text-center">

            resetForm();                    <span

            setIsAdding(true);                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${

            setEditingId(null);                        download.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'

          }}                      }`}

          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"                    >

        >                      {download.isActive ? 'فعال' : 'غیرفعال'}

          <Plus className="w-5 h-5" />                    </span>

          افزودن اپلیکیشن                  </td>

        </button>                  <td className="px-6 py-4 text-center">

      </div>                    <div className="flex justify-center gap-2">

                      <button

      {/* فرم افزودن/ویرایش */}                        onClick={() => startEdit(download)}

      {(isAdding || editingId) && (                        className="text-blue-600 hover:text-blue-800"

        <div className="mb-6 bg-white p-6 rounded-lg shadow-md border-2 border-blue-200">                        title="ویرایش"

          <div className="flex items-center justify-between mb-4">                      >

            <h2 className="text-xl font-bold text-gray-900">                        <Edit size={18} />

              {editingId ? 'ویرایش اپلیکیشن' : 'افزودن اپلیکیشن جدید'}                      </button>

            </h2>                      <button

            <button                        onClick={() => {

              onClick={() => {                          if (confirm('آیا از حذف این اپلیکیشن اطمینان دارید?')) {

                resetForm();                            deleteMutation.mutate(download.id);

                setIsAdding(false);                          }

                setEditingId(null);                        }}

              }}                        className="text-red-600 hover:text-red-800"

              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"                        title="حذف"

            >                      >

              <X className="w-5 h-5" />                        <Trash2 size={18} />

            </button>                      </button>

          </div>                    </div>

                  </td>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">                </tr>

            <div>              ))

              <label className="block text-sm font-medium text-gray-700 mb-2">            )}

                عنوان اپلیکیشن *          </tbody>

              </label>        </table>

              <input      </div>

                type="text"    </div>

                value={formData.title || ''}  );

                onChange={(e) => setFormData({ ...formData, title: e.target.value })}}

                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="مثلاً: V2Ray Client"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                لینک دانلود *
              </label>
              <input
                type="url"
                value={formData.downloadLink || ''}
                onChange={(e) => setFormData({ ...formData, downloadLink: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/download"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                توضیحات
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="توضیحات کوتاه درباره اپلیکیشن..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ترتیب نمایش
              </label>
              <input
                type="number"
                value={formData.displayOrder || 0}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">فعال</span>
              </label>
            </div>
          </div>

          {/* آپلود فایل‌ها */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                QR Code (اختیاری)
              </label>
              <FileUploadZone
                type="image"
                accept="image/*"
                maxSize={5}
                currentFileUrl={editingId ? formData.qrCodeUrl : undefined}
                isUploading={isUploadingQR}
                onFileSelect={(file) => setQrCodeFile(file)}
                onRemove={() => {
                  setQrCodeFile(null);
                  if (editingId && formData.qrCodeFilePath) {
                    deleteQRCodeMutation.mutate(editingId);
                  }
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <VideoIcon className="w-5 h-5" />
                ویدئو آموزشی (اختیاری)
              </label>
              <FileUploadZone
                type="video"
                accept="video/*"
                maxSize={50}
                currentFileUrl={editingId ? formData.videoUrl : undefined}
                isUploading={isUploadingVideo}
                onFileSelect={(file) => setVideoFile(file)}
                onRemove={() => {
                  setVideoFile(null);
                  if (editingId && formData.videoFilePath) {
                    deleteVideoMutation.mutate(editingId);
                  }
                }}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={!formData.title || !formData.downloadLink || createMutation.isPending || updateMutation.isPending}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {editingId ? 'ذخیره تغییرات' : 'ایجاد اپلیکیشن'}
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsAdding(false);
                setEditingId(null);
              }}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      {/* لیست اپلیکیشن‌ها */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDownloads.map((download) => (
          <div
            key={download.id}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
          >
            {/* تصویر QR Code */}
            {download.qrCodeUrl && (
              <div className="h-48 bg-gray-100 flex items-center justify-center p-4">
                <img
                  src={download.qrCodeUrl}
                  alt={download.title}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}

            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{download.title}</h3>
                  {download.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{download.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className={`px-2 py-1 text-xs rounded-full ${download.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {download.isActive ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>
              </div>

              {/* آمار بازدید */}
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
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
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(download)}
                  className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  ویرایش
                </button>
                <button
                  onClick={() => setViewingStatsId(download.id)}
                  className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  آمار
                </button>
                <button
                  onClick={() => handleDelete(download.id)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
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
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {searchQuery || filterActive !== 'all' 
              ? 'نتیجه‌ای یافت نشد' 
              : 'هنوز اپلیکیشنی اضافه نشده است'}
          </p>
        </div>
      )}

      {/* مودال آمار */}
      {viewingStatsId && stats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">آمار بازدید</h2>
              <button
                onClick={() => setViewingStatsId(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">کل بازدیدها</p>
                <p className="text-3xl font-bold text-blue-600">
                  {stats.totalViews.toLocaleString('fa-IR')}
                </p>
              </div>

              {stats.viewsByType && stats.viewsByType.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">بر اساس نوع عملیات</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {stats.viewsByType.map((item, idx) => (
                      <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">{item.actionType}</p>
                        <p className="text-xl font-bold">{item.count.toLocaleString('fa-IR')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.recentViews && stats.recentViews.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">بازدید 7 روز اخیر</h3>
                  <div className="space-y-2">
                    {stats.recentViews.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">{new Date(item.date).toLocaleDateString('fa-IR')}</span>
                        <span className="font-semibold">{item.count.toLocaleString('fa-IR')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
