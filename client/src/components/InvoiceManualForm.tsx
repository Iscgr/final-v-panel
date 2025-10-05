// فاز ۲: Manual Invoice Creation Form
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

// فرم schema برای ایجاد فاکتور دستی
const manualInvoiceSchema = z.object({
  representativeId: z.number({ required_error: "انتخاب نماینده الزامی است" }),
  amount: z.string().min(1, "مبلغ الزامی است").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "مبلغ باید عدد مثبت باشد"
  ),
  issueDate: z.string().min(1, "تاریخ صدور الزامی است"),
  dueDate: z.string().optional(),
  status: z.enum(["unpaid", "paid", "overdue"]).default("unpaid"),
  description: z.string().optional(),
  batchId: z.number().optional()
});

type ManualInvoiceFormData = z.infer<typeof manualInvoiceSchema>;

interface InvoiceManualFormProps {
  onSuccess?: () => void;
  editInvoice?: any; // برای ویرایش فاکتور موجود
}

export function InvoiceManualForm({ onSuccess, editInvoice }: InvoiceManualFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // دریافت لیست نمایندگان
  const { data: representativesResponse, isLoading: repsLoading } = useQuery({
    queryKey: ['/api/representatives', { pageSize: 500, sortBy: 'name', sortOrder: 'asc' }],
    queryFn: () => apiRequest('/api/representatives?pageSize=500&sortBy=name&sortOrder=asc'),
  });

  const representatives = useMemo(() => {
    if (!representativesResponse) {
      return [] as any[];
    }

    if (Array.isArray(representativesResponse)) {
      return representativesResponse as any[];
    }

    if ('representatives' in representativesResponse) {
      return (representativesResponse as any)?.representatives ?? [];
    }

    console.warn('⚠️ Unexpected response shape for /api/representatives', representativesResponse);
    return [] as any[];
  }, [representativesResponse]);

  // دریافت لیست batches برای انتخاب اختیاری
  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ['/api/invoice-batches'],
    queryFn: () => apiRequest('/api/invoice-batches'),
  });

  const form = useForm<ManualInvoiceFormData>({
    resolver: zodResolver(manualInvoiceSchema),
    defaultValues: {
      representativeId: editInvoice?.representativeId || undefined,
      amount: editInvoice?.amount || "",
      issueDate: editInvoice?.issueDate || getCurrentPersianDate(),
      dueDate: editInvoice?.dueDate || "",
      status: editInvoice?.status || "unpaid",
      description: editInvoice?.usageData?.description || "",
      batchId: editInvoice?.batchId || undefined
    }
  });

  // تابع کمکی برای دریافت تاریخ فارسی فعلی
  function getCurrentPersianDate(): string {
    const now = new Date();
    return `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
  }

  const onSubmit = async (data: ManualInvoiceFormData) => {
    setIsSubmitting(true);
    try {
      console.log('🔧 فاز ۲: ارسال فاکتور دستی', data);

      // آماده‌سازی داده‌ها برای ارسال
      const invoiceData = {
        representativeId: data.representativeId,
        amount: data.amount,
        issueDate: data.issueDate,
        dueDate: data.dueDate || null,
        status: data.status,
        batchId: data.batchId || null,
        usageData: {
          type: "manual",
          description: data.description || "فاکتور ایجاد شده به صورت دستی",
          createdBy: "admin",
          createdAt: new Date().toISOString()
        }
      };

      let response;
      if (editInvoice) {
        // ویرایش فاکتور موجود
        response = await fetch(`/api/invoices/${editInvoice.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoiceData)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        
        toast({
          title: "✅ موفقیت",
          description: "فاکتور با موفقیت ویرایش شد"
        });
      } else {
        // ایجاد فاکتور جدید
        response = await fetch('/api/invoices/create-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoiceData)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        
        toast({
          title: "✅ موفقیت",
          description: `فاکتور دستی برای ${result.invoice.representativeName} ایجاد شد`
        });
      }

      // تازه‌سازی کش
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/representatives'] });

      // ریست فرم
      if (!editInvoice) {
        form.reset({
          representativeId: undefined,
          amount: "",
          issueDate: getCurrentPersianDate(),
          dueDate: "",
          status: "unpaid",
          description: "",
          batchId: undefined
        });
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('خطا در ایجاد فاکتور دستی:', error);
      toast({
        variant: "destructive",
        title: "❌ خطا",
        description: error.message || "خطا در ایجاد فاکتور"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-right">
          {editInvoice ? "ویرایش فاکتور" : "ایجاد فاکتور دستی"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" dir="rtl">
            {/* انتخاب نماینده */}
            <FormField
              control={form.control}
              name="representativeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نماینده *</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(Number(value))}
                    value={field.value?.toString() || ""}
                    disabled={repsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="انتخاب نماینده" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {representatives.map((rep: any) => (
                        <SelectItem key={rep.id} value={rep.id.toString()}>
                          {rep.name} - {rep.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* مبلغ فاکتور */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>مبلغ فاکتور (تومان) *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="0"
                      type="number"
                      min="0"
                      step="1000"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* تاریخ صدور */}
            <FormField
              control={form.control}
              name="issueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تاریخ صدور *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="1403/11/15"
                      type="text"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* تاریخ سررسید */}
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تاریخ سررسید</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="1403/12/15"
                      type="text"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* وضعیت فاکتور */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>وضعیت فاکتور</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="انتخاب وضعیت" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unpaid">پرداخت نشده</SelectItem>
                      <SelectItem value="paid">پرداخت شده</SelectItem>
                      <SelectItem value="overdue">سررسید گذشته</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* انتخاب دسته (اختیاری) */}
            <FormField
              control={form.control}
              name="batchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>دسته فاکتور (اختیاری)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === 'none' ? undefined : Number(value))}
                    value={field.value?.toString() || ""}
                    disabled={batchesLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="انتخاب دسته" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">بدون دسته</SelectItem>
                      {(batches as any[]).map((batch: any) => (
                        <SelectItem key={batch.id} value={batch.id.toString()}>
                          {batch.batchName} - {batch.batchCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* توضیحات */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>توضیحات</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="توضیحات اضافی درباره فاکتور..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* دکمه‌های عملیات */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                ریست فرم
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || repsLoading}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? "در حال پردازش..." : 
                 editInvoice ? "ویرایش فاکتور" : "ایجاد فاکتور"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}