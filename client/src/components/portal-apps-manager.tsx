/**
 * Portal Apps Manager Component
 * مدیریت اپلیکیشن‌های پرتال - لینک‌های دانلود، QR کد و ویدیو
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Save, X, Link as LinkIcon, QrCode, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PortalApp {
  id: number;
  title: string;
  description?: string;
  downloadLink: string;
  qrCode?: string;
  videoUrl?: string;
  iconUrl?: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AppFormData {
  title: string;
  description: string;
  downloadLink: string;
  qrCode: string;
  videoUrl: string;
  iconUrl: string;
  order: number;
  isActive: boolean;
}

const initialFormData: AppFormData = {
  title: "",
  description: "",
  downloadLink: "",
  qrCode: "",
  videoUrl: "",
  iconUrl: "",
  order: 0,
  isActive: true,
};

export function PortalAppsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<PortalApp | null>(null);
  const [formData, setFormData] = useState<AppFormData>(initialFormData);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all apps
  const { data: apps = [], isLoading } = useQuery<PortalApp[]>({
    queryKey: ["/api/portal-apps"],
  });

  // Create app mutation
  const createMutation = useMutation({
    mutationFn: async (data: AppFormData) => {
      return await apiRequest("/api/portal-apps", {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-apps"] });
      toast({
        title: "موفق",
        description: "اپلیکیشن با موفقیت ایجاد شد",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "خطا",
        description: error.message || "خطا در ایجاد اپلیکیشن",
        variant: "destructive",
      });
    },
  });

  // Update app mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AppFormData> }) => {
      return await apiRequest(`/api/portal-apps/${id}`, {
        method: "PUT",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-apps"] });
      toast({
        title: "موفق",
        description: "اپلیکیشن با موفقیت بروزرسانی شد",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "خطا",
        description: error.message || "خطا در بروزرسانی اپلیکیشن",
        variant: "destructive",
      });
    },
  });

  // Delete app mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/portal-apps/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-apps"] });
      toast({
        title: "موفق",
        description: "اپلیکیشن با موفقیت حذف شد",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطا",
        description: error.message || "خطا در حذف اپلیکیشن",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (app?: PortalApp) => {
    if (app) {
      setEditingApp(app);
      setFormData({
        title: app.title,
        description: app.description || "",
        downloadLink: app.downloadLink,
        qrCode: app.qrCode || "",
        videoUrl: app.videoUrl || "",
        iconUrl: app.iconUrl || "",
        order: app.order,
        isActive: app.isActive,
      });
    } else {
      setEditingApp(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingApp(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.downloadLink.trim()) {
      toast({
        title: "خطا",
        description: "عنوان و لینک دانلود الزامی هستند",
        variant: "destructive",
      });
      return;
    }

    if (editingApp) {
      updateMutation.mutate({ id: editingApp.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("آیا از حذف این اپلیکیشن اطمینان دارید؟")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          تعداد اپلیکیشن‌ها: {apps.length}
        </p>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          افزودن اپلیکیشن جدید
        </Button>
      </div>

      <div className="space-y-3">
        {apps.map((app) => (
          <div
            key={app.id}
            className="border rounded-lg p-4 hover:border-primary transition-colors"
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{app.title}</h4>
                  {!app.isActive && (
                    <Badge variant="secondary">غیرفعال</Badge>
                  )}
                  <Badge variant="outline">ترتیب: {app.order}</Badge>
                </div>
                {app.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {app.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                  {app.downloadLink && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <LinkIcon className="w-3 h-3" />
                      <span>لینک دانلود</span>
                    </div>
                  )}
                  {app.qrCode && (
                    <div className="flex items-center gap-1 text-green-600">
                      <QrCode className="w-3 h-3" />
                      <span>QR کد</span>
                    </div>
                  )}
                  {app.videoUrl && (
                    <div className="flex items-center gap-1 text-purple-600">
                      <Video className="w-3 h-3" />
                      <span>ویدیو آموزشی</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenDialog(app)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(app.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {apps.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>هیچ اپلیکیشنی ثبت نشده است</p>
          <p className="text-sm mt-2">برای شروع، اپلیکیشن جدید اضافه کنید</p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingApp ? "ویرایش اپلیکیشن" : "افزودن اپلیکیشن جدید"}
            </DialogTitle>
            <DialogDescription>
              اطلاعات اپلیکیشن را وارد کنید. فیلدهای ستاره‌دار الزامی هستند.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                عنوان اپلیکیشن <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="مثال: اپلیکیشن V2Ray"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">توضیحات</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="توضیحات کوتاه درباره اپلیکیشن"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="downloadLink">
                لینک دانلود مستقیم <span className="text-red-500">*</span>
              </Label>
              <Input
                id="downloadLink"
                type="url"
                value={formData.downloadLink}
                onChange={(e) =>
                  setFormData({ ...formData, downloadLink: e.target.value })
                }
                placeholder="https://example.com/app.apk"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qrCode">لینک یا داده QR کد</Label>
              <Input
                id="qrCode"
                value={formData.qrCode}
                onChange={(e) =>
                  setFormData({ ...formData, qrCode: e.target.value })
                }
                placeholder="https://example.com/qr-code.png یا base64 data"
              />
              <p className="text-xs text-gray-500">
                می‌توانید لینک تصویر QR کد یا داده base64 را وارد کنید
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="videoUrl">لینک ویدیو آموزشی</Label>
              <Input
                id="videoUrl"
                type="url"
                value={formData.videoUrl}
                onChange={(e) =>
                  setFormData({ ...formData, videoUrl: e.target.value })
                }
                placeholder="https://example.com/tutorial.mp4"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="iconUrl">لینک آیکون</Label>
              <Input
                id="iconUrl"
                type="url"
                value={formData.iconUrl}
                onChange={(e) =>
                  setFormData({ ...formData, iconUrl: e.target.value })
                }
                placeholder="https://example.com/icon.png"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order">ترتیب نمایش</Label>
              <Input
                id="order"
                type="number"
                value={formData.order}
                onChange={(e) =>
                  setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
                }
                min="0"
              />
              <p className="text-xs text-gray-500">
                اپلیکیشن‌ها بر اساس این عدد مرتب می‌شوند (کوچکتر = ابتدا)
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">وضعیت فعال</Label>
                <p className="text-sm text-gray-500">
                  آیا این اپلیکیشن در پرتال عمومی نمایش داده شود؟
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                <X className="w-4 h-4 mr-2" />
                انصراف
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {createMutation.isPending || updateMutation.isPending
                  ? "در حال ذخیره..."
                  : "ذخیره"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
