import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { 
  Handshake, 
  Search, 
  Eye, 
  Edit, 
  Plus, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Award,
  Loader2,
  RotateCcw,
  Check,
  XCircle
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatPersianDate, toPersianDigits } from "@/lib/persian-date";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { InsertSalesPartner, SalesPartnerWithCount } from "@shared/schema";

// Extend the shared type with additional fields needed for UI
interface SalesPartner extends SalesPartnerWithCount {
  lastActivityDate?: string;
  updatedAt?: string;
}

interface SalesPartnerStats {
  // S-01 Fix: Changed to number to match backend response
  totalPartners: number;
  activePartners: number;
  totalCommission: number;
  averageCommissionRate: number;
  totalCoupledSales?: number;
  totalCoupledDebt?: number;
}

interface Representative {
  id: number;
  code: string;
  name: string;
  salesPartnerId: number;
  totalSales: string;
  isActive: boolean;
}

interface CommissionPaymentRow {
  id: number;
  salesPartnerId: number | null;
  amount: string | number | null;
  paymentDate: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt?: string | null;
  partnerName: string | null;
  partnerCode: string | null;
  status?: string | null;
  // ✅ Partial Settlement fields (backend added in migration 0003 & endpoint) – may be undefined until backend returns
  settledAmount?: string | number | null;
  lastPartialSettlementAt?: string | null;
}

interface CommissionPaymentsResult {
  payments: CommissionPaymentRow[];
  summary: {
    totalAmount: number;
  };
  count: number;
}

const createPartnerFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "نام باید حداقل ۳ نویسه داشته باشد")
      .max(120, "نام حداکثر می‌تواند ۱۲۰ نویسه باشد"),
    code: z.string().trim().max(32, "کد حداکثر می‌تواند ۳۲ نویسه باشد").optional(),
    contactPerson: z
      .string()
      .trim()
      .max(120, "نام مسئول تماس حداکثر می‌تواند ۱۲۰ نویسه باشد")
      .optional(),
    phone: z.string().trim().max(32, "شماره تماس حداکثر می‌تواند ۳۲ نویسه باشد").optional(),
    email: z.string().trim().email("ایمیل وارد شده معتبر نیست").optional(),
    commissionRate: z
      .coerce
      .number({ invalid_type_error: "درصد کمیسیون را وارد کنید" })
      .min(0, "درصد کمیسیون نمی‌تواند منفی باشد")
      .max(100, "حداکثر درصد مجاز ۱۰۰ است"),
    isActive: z.boolean().default(true)
  })
  .superRefine((data, ctx) => {
    if (data.phone && !/^\+?[\d\s-]{5,18}$/.test(data.phone)) {
      ctx.addIssue({
        path: ["phone"],
        code: z.ZodIssueCode.custom,
        message: "شماره تماس فقط می‌تواند شامل اعداد، فاصله یا خط تیره باشد"
      });
    }
  });

const editCommissionSchema = z.object({
  commissionRate: z
    .coerce
    .number({ invalid_type_error: "درصد کمیسیون را وارد کنید" })
    .min(0, "حداقل درصد ۰ است")
    .max(100, "حداکثر درصد ۱۰۰ است")
});

type CreatePartnerFormValues = z.infer<typeof createPartnerFormSchema>;
type EditCommissionFormValues = z.infer<typeof editCommissionSchema>;

export default function SalesPartners() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPartner, setSelectedPartner] = useState<SalesPartner | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("partners");
  const [commissionPartnerFilter, setCommissionPartnerFilter] = useState<string>("all");
  const [commissionStartDate, setCommissionStartDate] = useState<string>("");
  const [commissionEndDate, setCommissionEndDate] = useState<string>("");
  // Settlement & status workflow states (added ODIN-settlement v1)
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<string>('all');
  const [settleDialogPayment, setSettleDialogPayment] = useState<CommissionPaymentRow | null>(null);
  const [cancelDialogPayment, setCancelDialogPayment] = useState<CommissionPaymentRow | null>(null);
  // Partial settlement dialog state
  const [partialSettlePayment, setPartialSettlePayment] = useState<CommissionPaymentRow | null>(null);
  const [partialAmount, setPartialAmount] = useState<string>("");
  const [partialNote, setPartialNote] = useState<string>("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createPartnerForm = useForm<CreatePartnerFormValues>({
    resolver: zodResolver(createPartnerFormSchema),
    defaultValues: {
      name: "",
      code: undefined,
      contactPerson: undefined,
      phone: undefined,
      email: undefined,
      commissionRate: 0,
      isActive: true
    }
  });

  const editCommissionForm = useForm<EditCommissionFormValues>({
    resolver: zodResolver(editCommissionSchema),
    defaultValues: {
      commissionRate: 0
    }
  });

  const { data: salesPartners = [], isLoading } = useQuery<SalesPartner[]>({
    queryKey: ["/sales-partners"],
    queryFn: () => apiRequest("/sales-partners"),
    select: (data: any) => {
      console.log('SHERLOCK v12.1 DEBUG: Sales Partners data:', data);
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.data)) return data.data;
      return [];
    },
    retry: 3,
    retryDelay: 1000
  });

  // S-01 Fix: Query for statistics with success state
  const statsQuery = useQuery<SalesPartnerStats>({
    queryKey: ["/sales-partners/statistics"],
    queryFn: () => apiRequest("/sales-partners/statistics"),
    select: (data: any) => {
      // S-01 Fix: Handle numeric values from backend
      return data || {
        totalPartners: 0,
        activePartners: 0,
        totalCommission: 0,
        averageCommissionRate: 0,
        totalCoupledSales: 0,
        totalCoupledDebt: 0
      };
    }
  });
  
  const stats = statsQuery.data;

  const representativesQuery = useQuery<Representative[]>({
    queryKey: ["/representatives"],
    queryFn: async () => apiRequest("/representatives"),
    select: (data: any) => {
      if (Array.isArray(data)) return data;
      if (data) {
        if (Array.isArray(data.data)) return data.data;
        if (Array.isArray(data.representatives)) return data.representatives;
      }
      return [];
    },
    retry: 2
  });

  useEffect(() => {
    if (representativesQuery.error) {
      const description = representativesQuery.error instanceof Error
        ? representativesQuery.error.message
        : "دریافت نمایندگان ناموفق بود";
      toast({
        variant: "destructive",
        title: "خطا در بارگذاری نمایندگان",
        description
      });
    }
  }, [representativesQuery.error, toast]);

  const representatives: Representative[] = representativesQuery.data ?? [];

  const commissionQueryKey = [
    "/sales-partners/payments",
    commissionPartnerFilter,
    commissionStartDate,
    commissionEndDate,
    commissionStatusFilter
  ] as const;

  const commissionPaymentsQuery = useQuery<CommissionPaymentsResult>({
    queryKey: commissionQueryKey,
    enabled: activeTab === "commission",
    queryFn: async () => {
      const params = new URLSearchParams();
      if (commissionPartnerFilter !== "all") {
        params.set("partnerId", commissionPartnerFilter);
      }
      if (commissionStartDate) {
        params.set("startDate", commissionStartDate);
      }
      if (commissionEndDate) {
        params.set("endDate", commissionEndDate);
      }
      if (commissionStatusFilter !== 'all') {
        params.set('status', commissionStatusFilter);
      }
      const queryString = params.toString();
      return apiRequest(`/sales-partners/payments${queryString ? `?${queryString}` : ""}`);
    },
    select: (response: any) => {
      const payments = Array.isArray(response?.data) ? response.data : [];
      const summary = response?.summary ?? { totalAmount: 0 };
      const count = typeof response?.count === "number" ? response.count : payments.length;
      return {
        payments,
        summary: {
          totalAmount: Number(summary.totalAmount ?? 0)
        },
        count
      } satisfies CommissionPaymentsResult;
    },
    retry: 2,
    staleTime: 30 * 1000
  });

  useEffect(() => {
    if (activeTab === "commission" && commissionPaymentsQuery.error) {
      const description = commissionPaymentsQuery.error instanceof Error
        ? commissionPaymentsQuery.error.message
        : "دریافت رویدادهای پورسانت ناموفق بود";
      toast({
        variant: "destructive",
        title: "خطا در بارگذاری رویدادهای پورسانت",
        description
      });
    }
  }, [activeTab, commissionPaymentsQuery.error, toast]);

  const commissionData = commissionPaymentsQuery.data;
  const commissionPayments = commissionData?.payments ?? [];
  const commissionSummary = commissionData?.summary ?? { totalAmount: 0 };
  const commissionCount = commissionData?.count ?? commissionPayments.length;
  const isCommissionLoading = commissionPaymentsQuery.isFetching;
  const isCommissionFetched = commissionPaymentsQuery.isFetched;
  const commissionError = commissionPaymentsQuery.error as Error | null;
  const hasCommissionFilters =
    commissionPartnerFilter !== "all" || Boolean(commissionStartDate) || Boolean(commissionEndDate) || commissionStatusFilter !== 'all';

  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ payment, status }: { payment: CommissionPaymentRow; status: 'paid' | 'cancelled' }) => {
      if (!payment.salesPartnerId) throw new Error('شناسه همکار موجود نیست');
      return apiRequest(`/sales-partners/${payment.salesPartnerId}/payments/${payment.id}`, {
        method: 'PUT',
        data: { status }
      });
    },
    onSuccess: (_u, vars) => {
      toast({
        title: vars.status === 'paid' ? 'تسویه ثبت شد' : 'پرداخت لغو شد',
        description: vars.status === 'paid' ? 'وضعیت پرداخت به تسویه شده تغییر یافت.' : 'وضعیت پرداخت به لغو شده تغییر کرد.'
      });
      queryClient.invalidateQueries({ queryKey: commissionQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/sales-partners"] });
      setSettleDialogPayment(null);
      setCancelDialogPayment(null);
    },
    onError: (error: unknown) => {
      toast({
        variant: 'destructive',
        title: 'خطا در تغییر وضعیت پرداخت',
        description: error instanceof Error ? error.message : 'خطای ناشناخته'
      });
    }
  });

  // Mutation: partial settlement
  const partialSettlementMutation = useMutation({
    mutationFn: async (vars: { payment: CommissionPaymentRow; amount: number; note?: string }) => {
      if (!vars.payment.salesPartnerId) throw new Error('شناسه همکار موجود نیست');
      return apiRequest(`/sales-partners/${vars.payment.salesPartnerId}/payments/${vars.payment.id}/partial-settlement`, {
        method: 'POST',
        data: { amount: vars.amount, note: vars.note }
      });
    },
    onSuccess: (_resp, vars) => {
      toast({
        title: 'تسویه جزئی ثبت شد',
        description: `مبلغ ${formatCurrency(vars.amount)} با موفقیت اعمال شد.`
      });
      setPartialSettlePayment(null);
      setPartialAmount("");
      setPartialNote("");
      queryClient.invalidateQueries({ queryKey: commissionQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/sales-partners"] });
    },
    onError: (error: unknown) => {
      toast({
        variant: 'destructive',
        title: 'خطا در تسویه جزئی',
        description: error instanceof Error ? error.message : 'خطای ناشناخته'
      });
    }
  });

  const getPaymentStatusBadge = (status?: string | null) => {
    const st = status || 'pending';
    const base = 'px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap';
    if (st === 'paid') return <span className={`${base} bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300`}>تسویه شده</span>;
    if (st === 'cancelled') return <span className={`${base} bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300`}>لغو شده</span>;
    return <span className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300`}>در انتظار</span>;
  };

  const handleResetCommissionFilters = () => {
    setCommissionPartnerFilter("all");
    setCommissionStartDate("");
    setCommissionEndDate("");
    setCommissionStatusFilter('all');
  };

  const sanitizeText = (value?: string | null) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const createPartnerMutation = useMutation({
    mutationFn: async (values: CreatePartnerFormValues) => {
      const payload: InsertSalesPartner = {
        name: values.name.trim(),
        code: sanitizeText(values.code) ?? undefined,
        contactPerson: sanitizeText(values.contactPerson) ?? undefined,
        phone: sanitizeText(values.phone) ?? undefined,
        email: sanitizeText(values.email) ?? undefined,
        commissionRate: values.commissionRate.toString(),
        isActive: values.isActive
      };

      return apiRequest<SalesPartner>("/sales-partners", {
        method: "POST",
        data: payload
      });
    },
    onSuccess: (created) => {
      toast({
        title: "همکار جدید ثبت شد",
        description: `همکار ${created.name} با موفقیت اضافه شد`
      });
      queryClient.invalidateQueries({ queryKey: ["/sales-partners"] });
      queryClient.invalidateQueries({ queryKey: ["/sales-partners/statistics"] });
      createPartnerForm.reset();
      setIsCreateOpen(false);
    },
    onError: (error: unknown) => {
      const description = error instanceof Error ? error.message : "خطای نامشخص رخ داد";
      toast({
        variant: "destructive",
        title: "ثبت همکار انجام نشد",
        description
      });
    }
  });

  const updateCommissionMutation = useMutation({
    mutationFn: async (values: EditCommissionFormValues) => {
      if (!selectedPartner) {
        throw new Error("همکار برای ویرایش انتخاب نشده است");
      }

      return apiRequest<SalesPartner>(`/sales-partners/${selectedPartner.id}`, {
        method: "PUT",
        data: {
          commissionRate: values.commissionRate.toString()
        }
      });
    },
    onSuccess: (updated) => {
      toast({
        title: "درصد کمیسیون بروزرسانی شد",
        description: `کمیسیون ${updated.name} اکنون ${toPersianDigits((updated.commissionRate || 0).toString())}% است`
      });
      queryClient.invalidateQueries({ queryKey: ["/sales-partners"] });
      queryClient.invalidateQueries({ queryKey: ["/sales-partners/statistics"] });
      setSelectedPartner((prev) => (prev ? { ...prev, commissionRate: updated.commissionRate } : prev));
      setIsEditOpen(false);
    },
    onError: (error: unknown) => {
      const description = error instanceof Error ? error.message : "خطای نامشخص رخ داد";
      toast({
        variant: "destructive",
        title: "ویرایش کمیسیون ناموفق بود",
        description
      });
    }
  });

  useEffect(() => {
    if (selectedPartner && isEditOpen) {
      editCommissionForm.reset({
        commissionRate: Number(selectedPartner.commissionRate || 0)
      });
    }
  }, [selectedPartner, isEditOpen, editCommissionForm]);

  // Filter sales partners based on search term and status
  const filteredPartners = salesPartners.filter(partner => {
    const matchesSearch = 
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (partner.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (partner.contactPerson || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "all" || 
      (statusFilter === "active" && partner.isActive === true) ||
      (statusFilter === "inactive" && partner.isActive === false);
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <CheckCircle className="w-3 h-3 ml-1" />
        فعال
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        <AlertTriangle className="w-3 h-3 ml-1" />
        غیرفعال
      </Badge>
    );
  };

  const getCommissionRateColor = (rate: string | number | null) => {
    const numRate = typeof rate === 'string' ? parseFloat(rate) : (rate || 0);
    if (numRate >= 10) return "text-green-600 dark:text-green-400";
    if (numRate >= 5) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const handleViewDetails = (partner: SalesPartner) => {
    setSelectedPartner(partner);
    setIsDetailsOpen(true);
  };

  const handleEdit = (partner: SalesPartner) => {
    setSelectedPartner(partner);
    editCommissionForm.reset({
      commissionRate: Number(partner.commissionRate || 0)
    });
    setIsEditOpen(true);
  };

  const getPartnerRepresentatives = (partnerId: number) => {
    return representatives.filter(rep => rep.salesPartnerId === partnerId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-labelledby="sales-partners-heading">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 id="sales-partners-heading" className="text-2xl font-bold text-gray-900 dark:text-white" tabIndex={-1}>
             مدیریت همکاران فروش
           </h1>
          <p className="text-gray-600 dark:text-gray-400">
            مدیریت جامع همکاران فروش، کمیسیون‌ها و عملکرد
          </p>
        </div>
        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              createPartnerForm.reset();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={createPartnerMutation.isPending} aria-label="افزودن همکار فروش جدید">
              <Plus className="w-4 h-4 ml-2" />
              همکار جدید
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>افزودن همکار فروش</DialogTitle>
              <DialogDescription>
                اطلاعات همکار جدید را تکمیل کنید تا در سیستم ثبت شود.
              </DialogDescription>
            </DialogHeader>
            <Form {...createPartnerForm}>
              <form
                className="space-y-6"
                onSubmit={createPartnerForm.handleSubmit((values) => createPartnerMutation.mutate(values))}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={createPartnerForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>نام همکار *</FormLabel>
                        <FormControl>
                          <Input placeholder="مثال: گروه همکاران شمال" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createPartnerForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>کد داخلی</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="SP-001"
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createPartnerForm.control}
                    name="contactPerson"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>مسئول تماس</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="نام و نام خانوادگی"
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createPartnerForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>شماره تماس</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="مثال: 09121234567"
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createPartnerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ایمیل</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="partner@example.com"
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createPartnerForm.control}
                    name="commissionRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>درصد کمیسیون *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder="مثال: 5"
                            value={field.value ?? 0}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <FormField
                    control={createPartnerForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">وضعیت فعال بودن</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            در صورت غیرفعال کردن، همکار در گزارش‌ها نمایش داده نمی‌شود.
                          </p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="وضعیت فعال بودن" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    انصراف
                  </Button>
                  <Button type="submit" disabled={createPartnerMutation.isPending}>
                    {createPartnerMutation.isPending ? "در حال ثبت..." : "ثبت همکار"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="partners">همکاران فروش</TabsTrigger>
          <TabsTrigger value="performance">عملکرد</TabsTrigger>
          <TabsTrigger value="commission">کمیسیون‌ها</TabsTrigger>
        </TabsList>

        {/* Partners Tab */}
        <TabsContent value="partners" className="space-y-4">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      کل همکاران
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {toPersianDigits(stats?.totalPartners || "0")}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Handshake className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      همکاران فعال
                    </p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {toPersianDigits(stats?.activePartners || "0")}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      کل فروش
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {/* S-02 Fix: Display actual totalCoupledSales from API */}
                      {statsQuery.isSuccess ? formatCurrency(Number(stats?.totalCoupledSales || 0)) : formatCurrency(0)}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      کل کمیسیون
                    </p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {/* S-02 Fix: stats.totalCommission is now number, not string */}
                      {formatCurrency(stats?.totalCommission || 0)}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                    <Award className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-4">
                  <div className="relative flex-1 lg:w-80">
                    <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="جستجو همکار..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="وضعیت" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">همه</SelectItem>
                      <SelectItem value="active">فعال</SelectItem>
                      <SelectItem value="inactive">غیرفعال</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {toPersianDigits(filteredPartners.length.toString())} همکار یافت شد
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales Partners Table */}
          <Card>
            <CardHeader>
              <CardTitle>فهرست همکاران فروش</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table role="table" aria-label="فهرست همکاران فروش">
                  <TableHeader>
                    <TableRow>
                      <TableHead>کد</TableHead>
                      <TableHead>نام</TableHead>
                      <TableHead>مسئول تماس</TableHead>
                      <TableHead>درصد کمیسیون</TableHead>
                      <TableHead>تعداد نمایندگان</TableHead>
                      <TableHead>کل فروش</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead>عملیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPartners.map((partner) => (
                      <TableRow 
                        key={partner.id} 
                        className="hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <TableCell className="font-mono text-sm">
                          {partner.code || '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {partner.name}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{partner.contactPerson || '-'}</div>
                            <div className="text-sm text-gray-500 font-mono">{partner.phone || '-'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold ${getCommissionRateColor(partner.commissionRate)}`}>
                            {toPersianDigits((partner.commissionRate || 0).toString())}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">
                            {toPersianDigits((partner.representativesCount || 0).toString())}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatCurrency(partner.totalSales ?? 0)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(partner.isActive === true)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`جزئیات همکار ${partner.name}`}
                              onClick={() => handleViewDetails(partner)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`ویرایش کمیسیون ${partner.name}`}
                              onClick={() => handleEdit(partner)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredPartners.slice(0, 6).map((partner) => {
              const partnerReps = getPartnerRepresentatives(partner.id);
              const activeReps = partnerReps.filter(rep => rep.isActive);
              
              return (
                <Card key={partner.id}>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">{partner.name}</CardTitle>
                      {getStatusBadge(partner.isActive ?? false)}
                    </div>
                    <CardDescription>کد: {partner.code}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {toPersianDigits(partnerReps.length.toString())}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">نمایندگان</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {toPersianDigits(activeReps.length.toString())}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">فعال</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">کل فروش:</span>
                        <span className="font-semibold">{formatCurrency(partner.totalSales ?? 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">کمیسیون:</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">
                          {formatCurrency(parseFloat(partner.totalCommission || "0"))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">درصد کمیسیون:</span>
                        <span className={`font-semibold ${getCommissionRateColor(partner.commissionRate)}`}>
                          {toPersianDigits((partner.commissionRate || 0).toString())}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Commission Tab */}
        <TabsContent value="commission" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>فیلتر رویدادهای پورسانت</CardTitle>
              <CardDescription>
                بازه‌ی زمانی و همکار مدنظر را انتخاب کنید تا تاریخچه پرداخت‌ها و تسویه‌ها دقیق‌تر نمایش داده شود.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    htmlFor="commission-partner-filter"
                  >
                    همکار فروش
                  </label>
                  <Select value={commissionPartnerFilter} onValueChange={setCommissionPartnerFilter}>
                    <SelectTrigger id="commission-partner-filter" className="w-full">
                      <SelectValue placeholder="همه همکاران" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">همه همکاران</SelectItem>
                      {salesPartners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id.toString()}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    htmlFor="commission-start-date"
                  >
                    از تاریخ
                  </label>
                  <Input
                    id="commission-start-date"
                    type="date"
                    value={commissionStartDate}
                    onChange={(event) => setCommissionStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    htmlFor="commission-end-date"
                  >
                    تا تاریخ
                  </label>
                  <Input
                    id="commission-end-date"
                    type="date"
                    value={commissionEndDate}
                    onChange={(event) => setCommissionEndDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">وضعیت پرداخت</label>
                  <Select value={commissionStatusFilter} onValueChange={setCommissionStatusFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="همه وضعیت‌ها" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">همه</SelectItem>
                      <SelectItem value="pending">در انتظار</SelectItem>
                      <SelectItem value="paid">تسویه شده</SelectItem>
                      <SelectItem value="cancelled">لغو شده</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!hasCommissionFilters}
                    onClick={handleResetCommissionFilters}
                    className="w-full md:w-auto"
                  >
                    <RotateCcw className="w-4 h-4 ml-2" />
                    پاکسازی فیلتر
                  </Button>
                </div>
              </div>
              {hasCommissionFilters && isCommissionFetched && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  {`نمایش ${toPersianDigits(commissionCount.toString())} رویداد بر اساس فیلترهای انتخاب‌شده.`}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {formatCurrency(stats?.totalCommission || 0)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">کل کمیسیون‌ها</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {toPersianDigits((stats?.averageCommissionRate || 0).toFixed(1))}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">میانگین کمیسیون</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(stats?.totalCoupledSales || 0)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">کل فروش کوپل شده</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  {isCommissionLoading ? (
                    <Skeleton className="h-7 w-24 mx-auto" />
                  ) : (
                    <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                      {formatCurrency(commissionSummary.totalAmount || 0)}
                    </div>
                  )}
                  <div className="text-sm text-gray-600 dark:text-gray-400">مجموع پرداخت‌های فیلتر شده</div>
                  {isCommissionLoading ? (
                    <Skeleton className="h-4 w-20 mx-auto mt-2" />
                  ) : (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {toPersianDigits(commissionCount.toString())} رکورد
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>جزئیات کمیسیون همکاران</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table role="table" aria-label="جدول خلاصه کمیسیون همکاران">
                  <TableHeader>
                    <TableRow>
                      <TableHead>همکار</TableHead>
                      <TableHead>درصد کمیسیون</TableHead>
                      <TableHead>کل فروش</TableHead>
                      <TableHead>کمیسیون محاسبه شده</TableHead>
                      <TableHead>کمیسیون پرداخت شده</TableHead>
                      <TableHead>مانده</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPartners.map((partner) => {
                      const totalSales = partner.totalSales ?? 0;
                      const commissionRate = parseFloat((partner.commissionRate || 0).toString());
                      const calculatedCommission = (totalSales * commissionRate) / 100;
                      const paidCommission = parseFloat(partner.totalCommission || "0");
                      const remaining = calculatedCommission - paidCommission;

                      return (
                        <TableRow key={partner.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{partner.name}</div>
                              <div className="text-sm text-gray-500">{partner.code || '-'}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={getCommissionRateColor(partner.commissionRate)}>
                              {toPersianDigits((partner.commissionRate || 0).toString())}%
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">
                            {formatCurrency(totalSales)}
                          </TableCell>
                          <TableCell className="font-mono">
                            {formatCurrency(calculatedCommission)}
                          </TableCell>
                          <TableCell className="font-mono text-green-600 dark:text-green-400">
                            {formatCurrency(paidCommission)}
                          </TableCell>
                          <TableCell className="font-mono">
                            <span className={remaining > 0 ? "text-red-600 dark:text-red-400" : "text-gray-500"}>
                              {formatCurrency(Math.abs(remaining))}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>تاریخچه پرداخت‌های پورسانت</CardTitle>
                {isCommissionFetched && (
                  <Badge variant="secondary">
                    {toPersianDigits(commissionCount.toString())} رویداد
                  </Badge>
                )}
              </div>
              <CardDescription>گزارش تراکنش‌های پرداخت و تسویه بر اساس فیلترهای فعال.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table role="table" aria-label="تاریخچه پرداخت‌های پورسانت">
                  <TableHeader>
                    <TableRow>
                      <TableHead>تاریخ پرداخت</TableHead>
                      <TableHead>همکار</TableHead>
                      <TableHead>مبلغ</TableHead>
                      <TableHead>مبلغ تسویه‌شده</TableHead>
                      <TableHead>مانده</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead>توضیحات</TableHead>
                      <TableHead>ثبت‌کننده</TableHead>
                      <TableHead>تاریخ ثبت</TableHead>
                      <TableHead>عملیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionError ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-6 text-center text-red-500">
                          خطا در بارگذاری داده‌ها: {commissionError.message}
                        </TableCell>
                      </TableRow>
                    ) : isCommissionLoading ? (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <div className="flex items-center justify-center gap-2 py-6 text-gray-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>در حال بارگذاری تاریخچه پرداخت‌ها...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : commissionPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <div className="py-6 text-center text-gray-500">
                            هیچ رویدادی برای بازه انتخاب‌شده یافت نشد.
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      commissionPayments.map((payment) => {
                        const paymentDate = payment.paymentDate ?? payment.createdAt;
                        const originalAmount = Number(payment.amount || 0);
                        const settled = Number(payment.settledAmount || (payment.status === 'paid' ? payment.amount || 0 : 0));
                        const remaining = Math.max(originalAmount - settled, 0);
                        return (
                          <TableRow key={payment.id}>
                            <TableCell className="font-mono whitespace-nowrap">
                              {paymentDate ? formatPersianDate(paymentDate) : '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{payment.partnerName ?? '—'}</span>
                                <span className="text-xs text-gray-500">{payment.partnerCode ?? '-'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-green-600 dark:text-green-400">
                              {formatCurrency(payment.amount ?? 0)}
                            </TableCell>
                            <TableCell className="font-mono text-teal-600 dark:text-teal-400">
                              {formatCurrency(settled)}
                            </TableCell>
                            <TableCell className="font-mono">
                              <span className={remaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}>
                                {formatCurrency(remaining)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {getPaymentStatusBadge(payment.status)}
                            </TableCell>
                            <TableCell>
                              <span className="block text-sm text-gray-600 dark:text-gray-300 max-w-xs">
                                {payment.note || '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">
                              {payment.createdBy || 'سیستم'}
                            </TableCell>
                            <TableCell className="font-mono whitespace-nowrap">
                              {payment.createdAt ? formatPersianDate(payment.createdAt) : '—'}
                            </TableCell>
                            <TableCell>
                              {payment.status === 'pending' && (
                                <div className="flex flex-col gap-2 min-w-[140px]">
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      aria-label={`تسویه کامل پرداخت شماره ${payment.id}`}
                                      onClick={() => setSettleDialogPayment(payment)}
                                    >
                                      <Check className="w-4 h-4 ml-1" />
                                      تسویه کامل
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      aria-label={`لغو پرداخت شماره ${payment.id}`}
                                      onClick={() => setCancelDialogPayment(payment)}
                                    >
                                      <XCircle className="w-4 h-4 ml-1" />
                                      لغو
                                    </Button>
                                  </div>
                                  {remaining > 0 && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      aria-label={`تسویه جزئی پرداخت شماره ${payment.id}`}
                                      onClick={() => {
                                        setPartialSettlePayment(payment);
                                        setPartialAmount(remaining > 0 ? Math.min(remaining, originalAmount).toString() : '');
                                      }}
                                    >
                                      تسویه جزئی
                                    </Button>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sales Partner Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>جزئیات همکار فروش</DialogTitle>
            <DialogDescription>
              اطلاعات کامل و عملکرد همکار فروش
            </DialogDescription>
          </DialogHeader>
          {selectedPartner && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">اطلاعات کلی</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">کد:</span>
                    <span className="font-mono">{selectedPartner.code || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">نام:</span>
                    <span>{selectedPartner.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">مسئول تماس:</span>
                    <span>{selectedPartner.contactPerson || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">تلفن:</span>
                    <span className="font-mono">{selectedPartner.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">ایمیل:</span>
                    <span className="text-sm">{selectedPartner.email || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">وضعیت:</span>
                    {getStatusBadge(selectedPartner.isActive === true)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">آمار عملکرد</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">درصد کمیسیون:</span>
                    <span className={`font-bold ${getCommissionRateColor(selectedPartner.commissionRate)}`}>
                      {toPersianDigits((selectedPartner.commissionRate || 0).toString())}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">تعداد نمایندگان:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {toPersianDigits((selectedPartner.representativesCount || 0).toString())}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">کل فروش:</span>
                    <span className="font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(selectedPartner.totalSales ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">کل کمیسیون:</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(parseFloat(selectedPartner.totalCommission || "0"))}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ✅ ODIN v5.0: Edit Commission Dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open && selectedPartner) {
            editCommissionForm.reset({
              commissionRate: Number(selectedPartner.commissionRate || 0)
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>ویرایش درصد کمیسیون</DialogTitle>
            <DialogDescription>
              تغییر درصد کمیسیون برای {selectedPartner?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedPartner && (
            <Form {...editCommissionForm}>
              <form
                className="space-y-4 py-4"
                onSubmit={editCommissionForm.handleSubmit((values) => updateCommissionMutation.mutate(values))}
              >
                <FormField
                  control={editCommissionForm.control}
                  name="commissionRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>درصد کمیسیون (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                          placeholder="مثال: 5"
                        />
                      </FormControl>
                      <p className="text-sm text-gray-500">
                        کمیسیون فعلی: {toPersianDigits((selectedPartner.commissionRate || 0).toString())}%
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                    انصراف
                  </Button>
                  <Button type="submit" disabled={updateCommissionMutation.isPending}>
                    {updateCommissionMutation.isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      {/* Settlement Confirmation Dialog */}
      <Dialog open={!!settleDialogPayment} onOpenChange={(open) => !open && setSettleDialogPayment(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>تایید تسویه پرداخت</DialogTitle>
            <DialogDescription>
              آیا از تسویه این پرداخت اطمینان دارید؟ پس از تسویه امکان بازگشت وجود ندارد.
            </DialogDescription>
          </DialogHeader>
          {settleDialogPayment && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm leading-relaxed">
                پرداخت شماره {toPersianDigits(settleDialogPayment.id.toString())} به مبلغ {formatCurrency(settleDialogPayment.amount || 0)} برای همکار {settleDialogPayment.partnerName}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSettleDialogPayment(null)} disabled={updatePaymentStatusMutation.isPending}>انصراف</Button>
                <Button onClick={() => updatePaymentStatusMutation.mutate({ payment: settleDialogPayment, status: 'paid' })} disabled={updatePaymentStatusMutation.isPending}>
                  {updatePaymentStatusMutation.isPending ? 'در حال ثبت...' : 'تایید تسویه'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!cancelDialogPayment} onOpenChange={(open) => !open && setCancelDialogPayment(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>لغو پرداخت</DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید این پرداخت را لغو کنید؟ پس از لغو امکان تغییر مجدد وجود ندارد.
            </DialogDescription>
          </DialogHeader>
          {cancelDialogPayment && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm leading-relaxed">
                پرداخت شماره {toPersianDigits(cancelDialogPayment.id.toString())} به مبلغ {formatCurrency(cancelDialogPayment.amount || 0)} برای همکار {cancelDialogPayment.partnerName}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCancelDialogPayment(null)} disabled={updatePaymentStatusMutation.isPending}>انصراف</Button>
                <Button
                  onClick={() => updatePaymentStatusMutation.mutate({ payment: cancelDialogPayment, status: 'cancelled' })}
                  disabled={updatePaymentStatusMutation.isPending}
                >
                  {updatePaymentStatusMutation.isPending ? 'در حال لغو...' : 'تایید لغو'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Partial Settlement Dialog */}
      <Dialog open={!!partialSettlePayment} onOpenChange={(open) => !open && setPartialSettlePayment(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>تسویه جزئی پرداخت</DialogTitle>
            <DialogDescription>
              مبلغی کمتر از کل پرداخت را برای ثبت تسویه جزئی وارد کنید.
            </DialogDescription>
          </DialogHeader>
          {partialSettlePayment && (() => {
            const originalAmount = Number(partialSettlePayment.amount || 0);
            const alreadySettled = Number(partialSettlePayment.settledAmount || (partialSettlePayment.status === 'paid' ? partialSettlePayment.amount || 0 : 0));
            const remaining = Math.max(originalAmount - alreadySettled, 0);
            return (
              <div className="space-y-5 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded bg-gray-50 dark:bg-gray-800">
                    <div className="text-xs text-gray-500">مبلغ کل</div>
                    <div className="font-mono font-semibold">{formatCurrency(originalAmount)}</div>
                  </div>
                  <div className="p-3 rounded bg-gray-50 dark:bg-gray-800">
                    <div className="text-xs text-gray-500">تسویه شده تاکنون</div>
                    <div className="font-mono font-semibold text-teal-600 dark:text-teal-400">{formatCurrency(alreadySettled)}</div>
                  </div>
                  <div className="p-3 rounded bg-gray-50 dark:bg-gray-800 col-span-2">
                    <div className="text-xs text-gray-500">مانده</div>
                    <div className={`font-mono font-semibold ${remaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>{formatCurrency(remaining)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="partial-amount">مبلغ تسویه *</label>
                  <Input
                    id="partial-amount"
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="مثال: 500000"
                  />
                  <p className="text-xs text-gray-500">حداکثر مجاز: {formatCurrency(remaining)}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="partial-note">توضیح (اختیاری)</label>
                  <Input
                    id="partial-note"
                    value={partialNote}
                    onChange={(e) => setPartialNote(e.target.value)}
                    placeholder="مثال: پیش‌پرداخت مرحله اول"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setPartialSettlePayment(null)} disabled={partialSettlementMutation.isPending}>انصراف</Button>
                  <Button
                    disabled={partialSettlementMutation.isPending || !partialAmount || Number(partialAmount) <= 0 || Number(partialAmount) > remaining}
                    onClick={() => {
                      if (!partialSettlePayment) return;
                      const amt = Number(partialAmount);
                      if (!Number.isFinite(amt)) return;
                      partialSettlementMutation.mutate({ payment: partialSettlePayment, amount: amt, note: partialNote || undefined });
                    }}
                  >
                    {partialSettlementMutation.isPending ? 'در حال ثبت...' : 'ثبت تسویه جزئی'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}