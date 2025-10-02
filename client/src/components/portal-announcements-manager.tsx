/**
 * Portal Announcements Manager Component
 * مدیریت اعلانات و اخبار مهم پرتال
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Save, X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface PortalAnnouncement {
  id: number;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface AnnouncementFormData {
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  isActive: boolean;
  priority: number;
}

const initialFormData: AnnouncementFormData = {
  title: "",
  content: "",
  type: "info",
  isActive: true,
  priority: 0,
};

const typeConfig = {
  info: { label: "اطلاعات", icon: Info, color: "text-blue-600", bg: "bg-blue-50" },
  warning: { label: "هشدار", icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50" },
  success: { label: "موفقیت", icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
  error: { label: "خطا", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
};

export function PortalAnnouncementsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<PortalAnnouncement | null>(null);
  const [formData, setFormData] = useState<AnnouncementFormData>(initialFormData);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all announcements
  const { data: announcements = [], isLoading } = useQuery<PortalAnnouncement[]>({
    queryKey: ["/api/portal-announcements"],
  });

  // Create announcement mutation
  const createMutation = useMutation({
    mutationFn: async (data: AnnouncementFormData) => {
      return await apiRequest("/api/portal-announcements", {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-announcements"] });
      toast({
        title: "موفق",
        description: "اعلان با موفقیت ایجاد شد",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "خطا",
        description: error.message || "خطا در ایجاد اعلان",
        variant: "destructive",
      });
    },
  });

  // Update announcement mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AnnouncementFormData> }) => {
      return await apiRequest(`/api/portal-announcements/${id}`, {
        method: "PUT",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-announcements"] });
      toast({
        title: "موفق",
        description: "اعلان با موفقیت بروزرسانی شد",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "خطا",
        description: error.message || "خطا در بروزرسانی اعلان",
        variant: "destructive",
      });
    },
  });

  // Delete announcement mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/portal-announcements/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-announcements"] });
      toast({
        title: "موفق",
        description: "اعلان با موفقیت حذف شد",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطا",
        description: error.message || "خطا در حذف اعلان",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (announcement?: PortalAnnouncement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setFormData({
        title: announcement.title,
        content: announcement.content,
        type: announcement.type,
        isActive: announcement.isActive,
        priority: announcement.priority,
      });
    } else {
      setEditingAnnouncement(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAnnouncement(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "خطا",
        description: "عنوان و محتوا الزامی هستند",
        variant: "destructive",
      });
      return;
    }

    if (editingAnnouncement) {
      updateMutation.mutate({ id: editingAnnouncement.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("آیا از حذف این اعلان اطمینان دارید؟")) {
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
          تعداد اعلانات: {announcements.length}
        </p>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          افزودن اعلان جدید
        </Button>
      </div>

      <div className="space-y-3">
        {announcements.map((announcement) => {
          const TypeIcon = typeConfig[announcement.type].icon;
          return (
            <div
              key={announcement.id}
              className={`border rounded-lg p-4 ${typeConfig[announcement.type].bg} hover:border-primary transition-colors`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <TypeIcon className={`w-5 h-5 ${typeConfig[announcement.type].color}`} />
                    <h4 className="font-medium">{announcement.title}</h4>
                    {!announcement.isActive && (
                      <Badge variant="secondary">غیرفعال</Badge>
                    )}
                    {announcement.priority > 0 && (
                      <Badge variant="default">اولویت: {announcement.priority}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {announcement.content}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Badge variant="outline">
                      {typeConfig[announcement.type].label}
                    </Badge>
                    <span>•</span>
                    <span>
                      بروزرسانی: {new Date(announcement.updatedAt).toLocaleDateString('fa-IR')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(announcement)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(announcement.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {announcements.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>هیچ اعلانی ثبت نشده است</p>
          <p className="text-sm mt-2">برای شروع، اعلان جدید اضافه کنید</p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? "ویرایش اعلان" : "افزودن اعلان جدید"}
            </DialogTitle>
            <DialogDescription>
              اطلاعات اعلان را وارد کنید. فیلدهای ستاره‌دار الزامی هستند.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                عنوان اعلان <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="مثال: بروزرسانی مهم سیستم"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">
                محتوای اعلان <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="متن کامل اعلان را اینجا وارد کنید..."
                rows={5}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">نوع اعلان</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${config.color}`} />
                          <span>{config.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">اولویت نمایش</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                }
                min="0"
              />
              <p className="text-xs text-gray-500">
                اعلانات با اولویت بالاتر (عدد بزرگتر) در ابتدا نمایش داده می‌شوند
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">وضعیت فعال</Label>
                <p className="text-sm text-gray-500">
                  آیا این اعلان در پرتال عمومی نمایش داده شود؟
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
