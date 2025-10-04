import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemService } from '../services/system';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Upload, Download, History } from 'lucide-react';
import { format } from 'date-fns-jalali';

const SystemSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['backupHistory'],
    queryFn: systemService.getBackupHistory,
  });

  const createBackupMutation = useMutation({
    mutationFn: systemService.createBackup,
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `marfanet-backup-${timestamp}.tar.gz`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('پشتیبان با موفقیت ایجاد و دانلود شد.');
      queryClient.invalidateQueries({ queryKey: ['backupHistory'] });
    },
    onError: (error) => {
      toast.error(`خطا در ایجاد پشتیبان: ${error.message}`);
    },
    onSettled: () => {
      setIsCreating(false);
    },
  });

  const restoreBackupMutation = useMutation({
    mutationFn: systemService.restoreFromBackup,
    onSuccess: () => {
      toast.success('بازیابی با موفقیت انجام شد. سیستم مجدداً راه‌اندازی می‌شود.');
      // Give a moment for the toast to be seen before reloading
      setTimeout(() => window.location.reload(), 2000);
    },
    onError: (error) => {
      toast.error(`خطا در بازیابی: ${error.message}`);
    },
    onSettled: () => {
      setIsRestoring(false);
    },
  });

  const handleCreateBackup = () => {
    setIsCreating(true);
    createBackupMutation.mutate();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsRestoring(true);
      restoreBackupMutation.mutate(file);
    }
  };

  const triggerFileUpload = () => {
    document.getElementById('backupFileInput')?.click();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">تنظیمات سیستم</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              ایجاد پشتیبان جدید
            </CardTitle>
            <CardDescription>
              یک نسخه کامل از داده‌های حیاتی سیستم (مانند نمایندگان، فاکتورها و تنظیمات) ایجاد کنید.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleCreateBackup} disabled={isCreating}>
              {isCreating ? 'در حال ایجاد...' : 'ایجاد و دانلود پشتیبان'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              بازیابی از پشتیبان
            </CardTitle>
            <CardDescription>
              سیستم را به وضعیت یک فایل پشتیبان بازگردانید. این عملیات غیرقابل بازگشت است.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              id="backupFileInput"
              className="hidden"
              onChange={handleFileChange}
              accept=".tar.gz"
              disabled={isRestoring}
            />
            <Button onClick={triggerFileUpload} disabled={isRestoring} variant="destructive">
              {isRestoring ? 'در حال بازیابی...' : 'انتخاب و بازیابی فایل'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            تاریخچه عملیات
          </CardTitle>
          <CardDescription>
            لیست آخرین عملیات‌های پشتیبان‌گیری و بازیابی انجام شده در سیستم.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>عملیات</TableHead>
                <TableHead>کاربر</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>تاریخ</TableHead>
                <TableHead>جزئیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingHistory ? (
                <TableRow><TableCell colSpan={5} className="text-center">در حال بارگذاری تاریخچه...</TableCell></TableRow>
              ) : (
                history?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.action === 'backup' ? 'پشتیبان‌گیری' : 'بازیابی'}</TableCell>
                    <TableCell>{log.performedBy}</TableCell>
                    <TableCell>{log.status === 'success' ? 'موفق' : 'ناموفق'}</TableCell>
                    <TableCell>{format(new Date(log.createdAt), 'yyyy/MM/dd HH:mm')}</TableCell>
                    <TableCell>{log.notes}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemSettingsPage;
