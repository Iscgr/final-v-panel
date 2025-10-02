import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DollarSign, FileText } from "lucide-react";
import { formatCurrency, toPersianDigits } from "@/lib/persian-date";

interface Invoice {
  id: number;
  invoiceNumber: string;
  amount: number;
  remainingAmount: number;
  date: string;
}

interface PaymentDialogProps {
  representativeCode: string;
  representativeId: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentComplete?: () => void;
}

export default function PaymentDialog({
  representativeCode,
  representativeId,
  isOpen,
  onOpenChange,
  onPaymentComplete,
}: PaymentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ❌ [ODIN v5.0] allocationType removed - Manual allocation only
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  // ✅ ODIN v5.0: استفاده از invoiceNumber به جای invoice.id
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<string>('');

  // دریافت لیست فاکتورهای تسویه نشده
  const { data: invoicesData, isLoading: isLoadingInvoices } = useQuery<{ invoices: Invoice[], total: number }>({
    queryKey: [`/api/representatives/${representativeCode}/invoices/unpaid`],
    queryFn: async () => {
      const response = await fetch(`/api/representatives/${representativeCode}/invoices?page=1&pageSize=100`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      const data = await response.json();
      // فیلتر فاکتورهایی که مانده دارند
      const unpaidInvoices = data.invoices.filter((inv: Invoice) => inv.remainingAmount > 0);
      return { ...data, invoices: unpaidInvoices };
    },
    enabled: isOpen, // همیشه فعال - برای نمایش لیست فاکتورها
    staleTime: 0,
  });

  const paymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'خطا در ثبت پرداخت');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ موفقیت",
        description: "پرداخت با موفقیت ثبت و تخصیص داده شد",
      });
      
      // Reset form
      setAmount('');
      setDescription('');
      setSelectedInvoiceNumber(''); // این خالی می‌شود و در UI به "none" تبدیل می‌شود
      
      // Close dialog
      onOpenChange(false);
      
      // Refresh data
      if (onPaymentComplete) {
        onPaymentComplete();
      }

      const invalidateKeys: QueryKey[] = [
        [`/api/representatives/${representativeCode}`],
        ['/api/representatives'],
        ['representatives'],
        ['/dashboard'],
        ['/api/dashboard'],
        ['financial-summary-v1'],
        ['global-financial-summary-corrected'],
        ['/api/unified-financial/summary'],
        ['/api/unified-financial/debtors'],
        ['/api/unified-financial/all-representatives'],
        ['debtor-representatives']
      ];

      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "❌ خطا",
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: "لطفاً مبلغ معتبر وارد کنید",
      });
      return;
    }

    const paymentData: any = {
      representativeId,
      amount: amountNum,
      paymentDate,
      description: description || undefined,
    };

    // ✅ ODIN v5.0: ارسال invoiceNumber برای تخصیص دستی (اگر انتخاب شده باشد)
    if (selectedInvoiceNumber && selectedInvoiceNumber !== '' && selectedInvoiceNumber !== 'none') {
      paymentData.selectedInvoiceNumber = selectedInvoiceNumber;
    }
    // else: پرداخت بدون تخصیص ثبت می‌شود

    paymentMutation.mutate(paymentData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            ثبت پرداخت جدید
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* انتخاب فاکتور - تخصیص دستی فقط */}
          <div className="space-y-2">
            <Label htmlFor="invoice">فاکتور مقصد (اختیاری)</Label>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              برای تخصیص دستی، یک فاکتور انتخاب کنید. در غیر این صورت، پرداخت بدون تخصیص ثبت می‌شود.
            </div>
            {isLoadingInvoices ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <Select value={selectedInvoiceNumber || "none"} onValueChange={(value) => setSelectedInvoiceNumber(value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="بدون تخصیص (می‌توانید بعداً تخصیص دهید)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون تخصیص</SelectItem>
                  {invoicesData?.invoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.invoiceNumber}>
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span>فاکتور {toPersianDigits(invoice.invoiceNumber)}</span>
                        <span className="text-sm text-gray-600">
                          مانده: {formatCurrency(invoice.remainingAmount)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                  {(!invoicesData?.invoices || invoicesData.invoices.length === 0) && (
                    <SelectItem value="no-invoices" disabled>
                      فاکتور تسویه نشده‌ای وجود ندارد
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* مبلغ */}
          <div className="space-y-2">
            <Label htmlFor="amount">مبلغ پرداخت (تومان) *</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="مثال: 1000000"
              required
              min="1"
              step="1"
            />
            {amount && !isNaN(parseFloat(amount)) && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatCurrency(parseFloat(amount))} تومان
              </p>
            )}
          </div>

          {/* تاریخ پرداخت */}
          <div className="space-y-2">
            <Label htmlFor="paymentDate">تاریخ پرداخت *</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          {/* توضیحات */}
          <div className="space-y-2">
            <Label htmlFor="description">توضیحات (اختیاری)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: پرداخت نقدی، چک شماره..."
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={paymentMutation.isPending}
            >
              انصراف
            </Button>
            <Button type="submit" disabled={paymentMutation.isPending}>
              {paymentMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  در حال ثبت...
                </>
              ) : (
                'ثبت پرداخت'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
