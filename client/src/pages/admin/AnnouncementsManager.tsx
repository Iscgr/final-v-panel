/**
 * صفحه مدیریت اطلاعیه‌ها در پنل ادمین
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Save, X, AlertCircle, Info, CheckCircle, XCircle, Search, Filter } from 'lucide-react';

interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: number;
  type: 'info' | 'warning' | 'success' | 'error';
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

const typeIcons = {
  info: <Info size={18} className="text-blue-600" />,
  warning: <AlertCircle size={18} className="text-yellow-600" />,
  success: <CheckCircle size={18} className="text-green-600" />,
  error: <XCircle size={18} className="text-red-600" />
};

const typeColors = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800'
};

export default function AnnouncementsManager() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | Announcement['type']>('all');
  const [filterActive, setFilterActive] = useState<'all' | boolean>('all');
  const [formData, setFormData] = useState<Partial<Announcement>>({
    title: '',
    content: '',
    priority: 0,
    type: 'info',
    isActive: true,
    expiresAt: undefined
  });

  // دریافت لیست اطلاعیه‌ها
  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ['/api/admin/announcements'],
    queryFn: async () => {
      const res = await fetch('/api/admin/announcements');
      const json = await res.json();
      return json.data || [];
    }
  });

  // فیلتر و جستجو
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(item => {
      if (filterActive !== 'all' && item.isActive !== filterActive) return false;
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return item.title.toLowerCase().includes(query) || item.content.toLowerCase().includes(query);
      }
      return true;
    });
  }, [announcements, searchQuery, filterType, filterActive]);

  // ایجاد اطلاعیه جدید
  const createMutation = useMutation({
    mutationFn: async (data: Partial<Announcement>) => {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
      resetForm();
      setIsAdding(false);
    }
  });

  // ویرایش اطلاعیه
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Announcement> }) => {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
      resetForm();
      setEditingId(null);
    }
  });

  // حذف اطلاعیه
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: 'DELETE'
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
    }
  });

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      priority: 0,
      type: 'info',
      isActive: true,
      expiresAt: undefined
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

  const startEdit = (announcement: Announcement) => {
    setFormData({
      ...announcement,
      expiresAt: announcement.expiresAt ? announcement.expiresAt.split('T')[0] : undefined
    });
    setEditingId(announcement.id);
    setIsAdding(false);
  };

  const cancelEdit = () => {
    resetForm();
    setEditingId(null);
    setIsAdding(false);
  };

  if (isLoading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">در حال بارگذاری...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">مدیریت اطلاعیه‌ها</h1>
        <p className="text-gray-600">ایجاد، ویرایش و حذف اطلاعیه‌های مهم برای پرتال عمومی</p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg shadow-sm">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="جستجو در عنوان یا محتوا..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pr-10 pl-4 py-2 border rounded-lg" />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="p-2 border rounded-lg">
              <option value="all">همه نوع‌ها</option>
              <option value="info">اطلاع‌رسانی</option>
              <option value="warning">هشدار</option>
              <option value="success">موفقیت</option>
              <option value="error">خطا</option>
            </select>
            <select value={String(filterActive)} onChange={(e) => setFilterActive(e.target.value === 'all' ? 'all' : e.target.value === 'true')} className="p-2 border rounded-lg">
              <option value="all">همه وضعیت‌ها</option>
              <option value="true">فعال</option>
              <option value="false">غیرفعال</option>
            </select>
          </div>
        </div>
        <button onClick={() => { resetForm(); setIsAdding(true); setEditingId(null); }} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          افزودن اطلاعیه
        </button>
      </div>

      {/* فرم افزودن/ویرایش */}
      {(isAdding || editingId) && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? 'ویرایش اطلاعیه' : 'افزودن اطلاعیه جدید'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                عنوان اطلاعیه <span className="text-red-500">*</span>
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
                محتوای اطلاعیه <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع اطلاعیه</label>
                <select
                  value={formData.type || 'info'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="info">اطلاعات</option>
                  <option value="warning">هشدار</option>
                  <option value="success">موفقیت</option>
                  <option value="error">خطا</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  اولویت (بالاتر = مهم‌تر)
                </label>
                <input
                  type="number"
                  value={formData.priority || 0}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاریخ انقضا (اختیاری)</label>
                <input
                  type="date"
                  value={formData.expiresAt || ''}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAnnouncements.map((announcement) => (
          <div key={announcement.id} className={`rounded-lg shadow-md overflow-hidden border-l-4 ${
            { info: 'border-blue-500', warning: 'border-yellow-500', success: 'border-green-500', error: 'border-red-500' }[announcement.type]
          }`}>
            <div className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-xl">
                    {typeIcons[announcement.type]}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{announcement.title}</h3>
                    <p className="text-gray-600 text-sm mt-1 whitespace-pre-line">{announcement.content}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(announcement)}
                    className="text-blue-600 hover:text-blue-800"
                    title="ویرایش"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('آیا از حذف این اطلاعیه اطمینان دارید?')) {
                        deleteMutation.mutate(announcement.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-800"
                    title="حذف"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${typeColors[announcement.type]}`}>
                  {announcement.type === 'info' && 'اطلاعات'}
                  {announcement.type === 'warning' && 'هشدار'}
                  {announcement.type === 'success' && 'موفقیت'}
                  {announcement.type === 'error' && 'خطا'}
                </span>
                <span
                  className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    announcement.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {announcement.isActive ? 'فعال' : 'غیرفعال'}
                </span>
                <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  اولویت: {announcement.priority}
                </span>
                {announcement.expiresAt && (
                  <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    انقضا: {new Date(announcement.expiresAt).toLocaleDateString('fa-IR')}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredAnnouncements.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {searchQuery || filterType !== 'all' || filterActive !== 'all'
              ? 'نتیجه‌ای یافت نشد'
              : 'هنوز اطلاعیه‌ای اضافه نشده است'}
          </p>
        </div>
      )}
    </div>
  );
}
