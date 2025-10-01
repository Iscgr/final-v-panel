import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  const [allocationType, setAllocationType] = useState<'auto' | 'manual'>('auto');
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
    enabled: isOpen && allocationType === 'manual',
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
      setSelectedInvoiceNumber('');
      setAllocationType('auto');
      
      // Close dialog
      onOpenChange(false);
      
      // Refresh data
      if (onPaymentComplete) {
        onPaymentComplete();
      }
      
      queryClient.invalidateQueries({ queryKey: [`/api/representatives/${representativeCode}`] });
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

    if (allocationType === 'manual' && !selectedInvoiceNumber) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: "لطفاً فاکتور مورد نظر را انتخاب کنید",
      });
      return;
    }

    const paymentData: any = {
      representativeId,
      amount: amountNum,
      paymentDate,
      description: description || undefined,
    };

    // ✅ ODIN v5.0: ارسال invoiceNumber به جای invoiceId
    if (allocationType === 'manual' && selectedInvoiceNumber) {
      paymentData.selectedInvoiceNumber = selectedInvoiceNumber;
    } else if (allocationType === 'auto') {
      paymentData.selectedInvoiceNumber = 'auto';
    }

    paymentMutation.mutate(paymentData);
  };

  // محاسبه قدیمی‌ترین فاکتور برای نمایش در حالت auto
  const oldestInvoice = invoicesData?.invoices
    ?.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

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
          {/* نوع تخصیص */}
          <div className="space-y-3">
            <Label>نوع تخصیص</Label>
            <RadioGroup value={allocationType} onValueChange={(value) => setAllocationType(value as 'auto' | 'manual')}>
              <div className="flex items-center space-x-2 space-x-reverse p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <RadioGroupItem value="auto" id="auto" />
                <Label htmlFor="auto" className="flex-1 cursor-pointer">
                  <div className="font-semibold">تخصیص خودکار</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    تخصیص به قدیمی‌ترین فاکتورها
                  </div>
                  {oldestInvoice && allocationType === 'auto' && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      📌 شروع از فاکتور {toPersianDigits(oldestInvoice.invoiceNumber)} - مانده: {formatCurrency(oldestInvoice.remainingAmount)}
                    </div>
                  )}
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual" className="flex-1 cursor-pointer">
                  <div className="font-semibold">تخصیص دستی</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    انتخاب فاکتور مشخص
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* انتخاب فاکتور در حالت دستی */}
          {allocationType === 'manual' && (
            <div className="space-y-2">
              <Label htmlFor="invoice">فاکتور مقصد</Label>
              {isLoadingInvoices ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <Select value={selectedInvoiceNumber} onValueChange={setSelectedInvoiceNumber}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب فاکتور" />
                  </SelectTrigger>
                  <SelectContent>
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
                      <SelectItem value="none" disabled>
                        فاکتور تسویه نشده‌ای وجود ندارد
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

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
