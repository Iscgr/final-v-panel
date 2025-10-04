import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, DollarSign, FileText, CreditCard, User, Phone, Mail, MapPin, Calendar, TrendingUp, Loader2, ExternalLink, Edit3, Trash2, Plus } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, toPersianDigits } from "@/lib/persian-date";
import InvoiceEditDialog from "@/components/invoice-edit-dialog";
import PaymentDialog from "@/components/payment-dialog";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest } from '@/lib/queryClient';
import { Form, FormField, FormItem, FormControl, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RepresentativeDetails {
  id: number;
  code: string;
  name: string;
  ownerName: string;
  phone?: string;
  email?: string;
  address?: string;
  publicId?: string | null;
  totalSales: number;
  totalDebt: number;
  isActive: boolean;
  createdAt: string;
  panelUsername: string;
  telegramHandle?: string | null;
  salesPartnerId?: number | null;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  amount: number;
  remainingAmount: number;
  date: string;
  status: string;
  usageData?: any;
}

interface Payment {
  id: number;
  amount: number;
  date: string;
  description?: string;
}

export default function RepresentativeProfile() {
  const [match, params] = useRoute<{ code: string }>("/representatives/:code");
  const code = params?.code || '';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // States for dialogs
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Phase3 Edit Profile Form
  const editProfileSchema = z.object({
    ownerName: z.string().trim().max(120,'حداکثر ۱۲۰ نویسه').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
    panelUsername: z.string().trim().min(3,'حداقل ۳ نویسه').max(64,'حداکثر ۶۴ نویسه'),
    phone: z.string().trim().regex(/^\+?[\d\s-]{5,18}$/,'شماره تماس نامعتبر است').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
    telegramHandle: z.string().trim().regex(/^@?[A-Za-z0-9_]{5,32}$/,'آیدی تلگرام نامعتبر است').optional().or(z.literal('')).transform(v => v === '' ? undefined : (v.startsWith('@') ? v : '@'+v)),
    salesPartnerId: z.string().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v))
  });
  type EditProfileFormValues = z.infer<typeof editProfileSchema>;
  const editProfileForm = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: { ownerName: '', panelUsername: '', phone: '', telegramHandle: '', salesPartnerId: '' as any }
  });
  const openEditForm = () => {
    if (!representative) return;
    editProfileForm.reset({
      ownerName: representative.ownerName === '-' ? '' : representative.ownerName,
      panelUsername: representative.panelUsername,
      phone: representative.phone || '',
      telegramHandle: representative.telegramHandle || '',
      salesPartnerId: representative.salesPartnerId ? String(representative.salesPartnerId) as any : '' as any
    });
    setIsEditProfileOpen(true);
  };
  const updateProfileMutation = useMutation({
    mutationFn: async (values: EditProfileFormValues) => {
      if (!representative) throw new Error('نماینده موجود نیست');
      const payload: Record<string, any> = {};
      if (values.ownerName !== undefined) payload.ownerName = values.ownerName;
      if (values.panelUsername) payload.panelUsername = values.panelUsername;
      if (values.phone !== undefined) payload.phone = values.phone;
      if (values.telegramHandle !== undefined) payload.telegramHandle = values.telegramHandle;
      if (values.salesPartnerId !== undefined) payload.salesPartnerId = values.salesPartnerId;
      return apiRequest(`/representatives/${representative.id}/profile`, { method: 'PUT', data: payload });
    },
    onSuccess: () => {
      toast({ title: 'پروفایل بروزرسانی شد', description: 'تغییرات نماینده با موفقیت ذخیره شد.' });
      setIsEditProfileOpen(false);
      refetchRepresentative();
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'خطا در بروزرسانی', description: error?.message || 'خطای ناشناخته' });
    }
  });

  const { data: representative, isLoading: isLoadingRep, error: repError, refetch: refetchRepresentative } = useQuery<RepresentativeDetails>({
    queryKey: [`/api/representatives/${code}`],
    queryFn: async () => {
      const response = await fetch(`/api/representatives/${code}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch representative details');
      }
      return response.json();
    },
    enabled: !!code,
    staleTime: 30000,
  });

  const { data: invoicesData, isLoading: isLoadingInvoices, refetch: refetchInvoices } = useQuery<{ invoices: Invoice[], total: number }>({
    queryKey: [`/api/representatives/${code}/invoices`],
    queryFn: async () => {
      const response = await fetch(`/api/representatives/${code}/invoices?page=1&pageSize=10`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      return response.json();
    },
    enabled: !!code,
    staleTime: 30000,
  });

  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery<{ payments: Payment[], total: number }>({
    queryKey: [`/api/representatives/${code}/payments`],
    queryFn: async () => {
      const response = await fetch(`/api/representatives/${code}/payments?page=1&pageSize=10`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch payments');
      }
      return response.json();
    },
    enabled: !!code,
    staleTime: 30000,
  });

  // Mutation برای حذف فاکتور
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'خطا در حذف فاکتور');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ موفقیت",
        description: "فاکتور با موفقیت حذف شد",
      });
      // Refresh all data
      refetchInvoices();
      refetchRepresentative();
      queryClient.invalidateQueries({ queryKey: ['/api/representatives'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "❌ خطا",
        description: error.message,
      });
    },
  });

  const handleDeleteInvoice = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteInvoice = () => {
    if (invoiceToDelete) {
      deleteInvoiceMutation.mutate(invoiceToDelete.id);
      setIsDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsEditDialogOpen(true);
  };

  const handleEditComplete = () => {
    setIsEditDialogOpen(false);
    setSelectedInvoice(null);
    refetchInvoices();
    refetchRepresentative();
    queryClient.invalidateQueries({ queryKey: ['/api/representatives'] });
  };

  if (isLoadingRep) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">در حال بارگذاری اطلاعات نماینده...</p>
        </div>
      </div>
    );
  }

  if (repError || !representative) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600 text-right">خطا در بارگذاری اطلاعات</CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              اطلاعات نماینده با کد "{code}" یافت نشد.
            </p>
            <Link href="/representatives">
              <Button variant="outline" className="w-full">
                <ArrowRight className="ml-2 h-4 w-4" />
                بازگشت به لیست نمایندگان
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getDebtColor = (debt: number) => {
    if (debt > 10000000) return "text-red-600";
    if (debt > 5000000) return "text-orange-600";
    return "text-green-600";
  };

  const getSettlementStatus = (amount: number, remaining: number) => {
    if (remaining === 0) {
      return { label: 'تسویه شده', variant: 'default' as const, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
    } else if (remaining === amount) {
      return { label: 'تسویه نشده', variant: 'destructive' as const, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
    } else {
      return { label: 'تسویه جزئی', variant: 'secondary' as const, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' };
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/representatives">
            <Button variant="ghost" size="icon">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {representative.name}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              کد نماینده: {toPersianDigits(representative.code)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {representative.publicId && (
            <a 
              href={`/portal/${representative.publicId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                ورود به پورتال عمومی
              </Button>
            </a>
          )}
          <Button variant="secondary" onClick={openEditForm} aria-label="ویرایش پروفایل نماینده">
            <Edit3 className="h-4 w-4 ml-2" /> ویرایش پروفایل
          </Button>
          <Badge variant={representative.isActive ? "default" : "secondary"}>
            {representative.isActive ? "فعال" : "غیرفعال"}
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              میزان فروش کل
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(representative.totalSales)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">تومان</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              مانده بدهی
            </CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getDebtColor(representative.totalDebt)}`}>
              {formatCurrency(representative.totalDebt)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">تومان</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              تعداد فاکتورها
            </CardTitle>
            <FileText className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {toPersianDigits(invoicesData?.total || 0)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">فاکتور</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              تعداد پرداخت‌ها
            </CardTitle>
            <CreditCard className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {toPersianDigits(paymentsData?.total || 0)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">پرداخت</p>
          </CardContent>
        </Card>
      </div>

      {/* Representative Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            اطلاعات نماینده
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">نام مالک / همکار فروش</p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                {representative.ownerName || "-"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">نام کاربری پنل</p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                {representative.panelUsername}
              </p>
            </div>
            {representative.phone && (
              <div className="space-y-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  تلفن
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white" dir="ltr">
                  {toPersianDigits(representative.phone)}
                </p>
              </div>
            )}
            {representative.email && (
              <div className="space-y-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  ایمیل
                </p>
                <p className="text-base font-semibold text-gray-900 dark:text-white" dir="ltr">
                  {representative.email}
                </p>
              </div>
            )}
          </div>
          {representative.address && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  آدرس
                </p>
                <p className="text-base text-gray-900 dark:text-white">
                  {representative.address}
                </p>
              </div>
            </>
          )}
          <Separator />
          <div className="space-y-1">
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              تاریخ ثبت
            </p>
            <p className="text-base text-gray-900 dark:text-white">
              {new Date(representative.createdAt).toLocaleDateString('fa-IR')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              آخرین فاکتورها
            </span>
            <Badge variant="outline">{toPersianDigits(invoicesData?.total || 0)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingInvoices ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : invoicesData?.invoices && invoicesData.invoices.length > 0 ? (
            <div className="space-y-3">
              {invoicesData.invoices.slice(0, 10).map((invoice) => {
                const settlementStatus = getSettlementStatus(invoice.amount, invoice.remainingAmount);
                return (
                  <div key={invoice.id} className="flex items-center justify-between gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          فاکتور {toPersianDigits(invoice.invoiceNumber)}
                        </p>
                        <Badge className={settlementStatus.color}>
                          {settlementStatus.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {invoice.date}
                      </p>
                    </div>
                    <div className="text-left space-y-1">
                      <p className="font-bold text-gray-900 dark:text-white">
                        {formatCurrency(invoice.amount)}
                      </p>
                      {invoice.remainingAmount > 0 && (
                        <p className="text-sm text-orange-600 dark:text-orange-400">
                          مانده: {formatCurrency(invoice.remainingAmount)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditInvoice(invoice)}
                        className="h-8 w-8"
                      >
                        <Edit3 className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteInvoice(invoice)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-600 dark:text-gray-400 py-8">
              فاکتوری ثبت نشده است
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              آخرین پرداخت‌ها
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setIsPaymentDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                ثبت پرداخت
              </Button>
              <Badge variant="outline">{toPersianDigits(paymentsData?.total || 0)}</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingPayments ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : paymentsData?.payments && paymentsData.payments.length > 0 ? (
            <div className="space-y-3">
              {paymentsData.payments.slice(0, 5).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      پرداخت
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(payment.date).toLocaleDateString('fa-IR')}
                    </p>
                    {payment.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {payment.description}
                      </p>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-green-600">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600 dark:text-gray-400 py-8">
              پرداختی ثبت نشده است
            </p>
          )}
        </CardContent>
      </Card>

      {/* Invoice Edit Dialog */}
      {selectedInvoice && (
        <InvoiceEditDialog
          invoice={{
            id: selectedInvoice.id,
            invoiceNumber: selectedInvoice.invoiceNumber,
            amount: selectedInvoice.amount.toString(),
            issueDate: selectedInvoice.date,
            status: selectedInvoice.status,
            usageData: selectedInvoice.usageData,
          }}
          representativeCode={code}
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onEditComplete={handleEditComplete}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأیید حذف فاکتور</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف فاکتور {invoiceToDelete?.invoiceNumber} با مبلغ{' '}
              {invoiceToDelete && formatCurrency(invoiceToDelete.amount)} اطمینان دارید؟
              <br />
              <span className="text-red-600 font-semibold mt-2 block">
                ⚠️ این عمل غیرقابل بازگشت است و محاسبات مالی به‌روز خواهد شد.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteInvoice}
              className="bg-red-600 hover:bg-red-700"
            >
              حذف فاکتور
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog */}
      {representative && (
        <PaymentDialog
          representativeCode={code}
          representativeId={representative.id}
          isOpen={isPaymentDialogOpen}
          onOpenChange={setIsPaymentDialogOpen}
          onPaymentComplete={() => {
            refetchInvoices();
            refetchRepresentative();
            queryClient.invalidateQueries({ queryKey: [`/api/representatives/${code}/payments`] });
          }}
        />
      )}

      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>ویرایش پروفایل نماینده</DialogTitle>
            <DialogDescription>به‌روزرسانی اطلاعات پایه و آیدی تلگرام</DialogDescription>
          </DialogHeader>
          <Form {...editProfileForm}>
            <form className="space-y-6" onSubmit={editProfileForm.handleSubmit(values => updateProfileMutation.mutate(values))}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField name="ownerName" control={editProfileForm.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>نام مالک / همکار فروش</FormLabel>
                    <FormControl><Input placeholder="مثال: علی رضایی" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="panelUsername" control={editProfileForm.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>نام کاربری پنل *</FormLabel>
                    <FormControl><Input placeholder="panel_user" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="phone" control={editProfileForm.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>شماره تماس</FormLabel>
                    <FormControl><Input placeholder="09121234567" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="telegramHandle" control={editProfileForm.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>آیدی تلگرام</FormLabel>
                    <FormControl><Input placeholder="@example_handle" {...field} /></FormControl>
                    <p className="text-xs text-gray-500">بدون @ نیز قابل ورود است؛ خودکار افزوده می‌شود.</p>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="salesPartnerId" control={editProfileForm.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>همکار فروش معرف</FormLabel>
                    <FormControl>
                      <Select value={field.value ? String(field.value) : ''} onValueChange={(val) => field.onChange(val)}>
                        <SelectTrigger><SelectValue placeholder="انتخاب همکار" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">بدون همکار</SelectItem>
                          {/* Sales partners dynamically */}
                          {/* این لیست بعداً با کوئری React Query ادغام خواهد شد */}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsEditProfileOpen(false)}>انصراف</Button>
                <Button type="submit" disabled={updateProfileMutation.isPending}>{updateProfileMutation.isPending ? 'در حال ذخیره...' : 'ذخیره تغییرات'}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
