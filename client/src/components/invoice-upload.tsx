import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Send, 
  Download,
  Clock,
  Activity,
  Eye,
  X,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, toPersianDigits, getCurrentPersianDate } from "@/lib/persian-date";
import { createImportJob, useImportJobPolling, calculateProgress } from "@/services/import-jobs";
import { JobProgress } from "@/components/JobProgress";
import { nanoid } from 'nanoid';
import { JsonProcessingDialog } from './json-progress/JsonProcessingDialog';

interface ProcessedInvoice {
  id: number;
  invoiceNumber: string;
  representativeName: string;
  representativeCode: string;
  amount: string;
  issueDate: string;
  status: string;
  sentToTelegram: boolean;
}

interface UploadResult {
  success: boolean;
  created: number;
  invalid: number;
  invoices: ProcessedInvoice[];
  invalidRecords: any[];
  newRepresentatives?: number;
}

export default function InvoiceUpload() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<number[]>([]);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentJobCode, setCurrentJobCode] = useState<string | null>(null);
  const [jobEvents, setJobEvents] = useState<{ ts: string; status: string; note?: string }[]>([]);
  const addJobEvent = useCallback((status: string, note?: string) => {
    setJobEvents(prev => [...prev, { ts: new Date().toLocaleTimeString('fa-IR'), status, note }]);
  }, []);
  
  // NEW: Invoice date selection states
  const [invoiceDateMode, setInvoiceDateMode] = useState<'today' | 'custom'>('today');
  const [customInvoiceDate, setCustomInvoiceDate] = useState('');
  const [showDateSettings, setShowDateSettings] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Hook polling برای job فعلی (باید مستقل از باز بودن مودال فعال باشد تا Progress در کارت اصلی حرکت کند)
  const { data: jobData } = useImportJobPolling(currentJobCode, !!currentJobCode);
  
  const uploadProgress = jobData ? calculateProgress(jobData) : 0;

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('usageFile', file);
      
      // Add invoice date parameters
      formData.append('invoiceDateMode', invoiceDateMode);
      if (invoiceDateMode === 'custom' && customInvoiceDate) {
        formData.append('customInvoiceDate', customInvoiceDate);
      }
      
      // Add standardized parameters with default values
      formData.append('jobCode', jobCode);
      formData.append('description', `فایل آپلود شده: ${file.name}`);
      
      // Add optional period parameters (can be empty for basic functionality)
      formData.append('periodStart', '');
      formData.append('periodEnd', '');
      
      console.log('Uploading file:', file.name, 'Size:', file.size);
      console.log('Invoice date mode:', invoiceDateMode, 'Custom date:', customInvoiceDate);
      
      const jobCode = `upload-${nanoid(10)}`;
      
      // ایجاد job tracking
      setCurrentJobCode(jobCode);
      setShowProcessingModal(true);
      setCurrentFile(file);
      setJobEvents([]);
      addJobEvent('pending', 'ثبت اولیه Job');
      
      // ثبت job در سرور
      await createImportJob({
        jobCode,
        sourceFileName: file.name,
        totalRecords: 0 // به‌روزرسانی خواهد شد
      });
      addJobEvent('pending', 'ارسال فایل برای پردازش');

      // شبیه‌سازی و فراخوانی /start حذف شد. بک‌اند مسئول آپدیت Job است.
      addJobEvent('starting','ارسال فایل به سرور برای پردازش یکپارچه');
      
      // Use fetch directly for file upload with proper headers and extended timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes timeout
      
      const response = await fetch('/api/invoices/generate-standard', {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include cookies for authentication
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('خطا در پردازش فایل:', errorData);
        throw new Error(errorData.error || errorData.message || 'خطا در پردازش فایل');
      }
      
      const responseData = await response.json();
      
      // Convert standardized response to legacy format for compatibility
      if (responseData.success && responseData.data) {
        return {
          success: true,
          created: responseData.data.createdInvoices || 0,
          invalid: 0, // invalid records are filtered out in the new system
          invoices: [], // invoices list will be loaded separately
          invalidRecords: [],
          newRepresentatives: responseData.data.newRepresentatives || 0
        };
      }
      
      return responseData;
    },
    onSuccess: (data: UploadResult) => {
      setUploadResult(data);
      // بک‌اند خودش وضعیت را completed می‌کند، نیازی به آپدیت از کلاینت نیست.
      addJobEvent('completed','پردازش کامل شد');
      
      console.log('فایل با موفقیت پردازش شد:', data);
      toast({
        title: "فایل با موفقیت پردازش شد",
        description: `${toPersianDigits(data.created.toString())} فاکتور ایجاد شد، ${toPersianDigits(data.newRepresentatives?.toString() || '0')} نماینده جدید`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
    },
    onError: (error: any) => {
      toast({
        title: "خطا در پردازش فایل",
        description: error.message,
        variant: "destructive",
      });
      // بک‌اند خودش وضعیت را failed می‌کند، نیازی به آپدیت از کلاینت نیست.
      addJobEvent('failed','بروز خطا در پردازش');
    }
  });

  const sendToTelegramMutation = useMutation({
    mutationFn: async (invoiceIds: number[]) => {
      // ✅ ODIN v5.0 FIX: Remove test message - let backend handle validation
      // Backend will validate Telegram config and send REAL invoices with template
      const response = await apiRequest('/api/invoices/send-telegram', {
        method: 'POST',
        data: { invoiceIds }
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "ارسال به تلگرام",
        description: `${toPersianDigits(data.success.toString())} فاکتور با موفقیت ارسال شد`,
      });
      setUploadResult(prev => prev ? {
        ...prev,
        invoices: prev.invoices.map(inv => 
          selectedInvoices.includes(inv.id) 
            ? { ...inv, sentToTelegram: true }
            : inv
        )
      } : null);
      setSelectedInvoices([]);
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
    },
    onError: (error: any) => {
      toast({
        title: "خطا در ارسال",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      // Validate custom date if selected
      if (invoiceDateMode === 'custom' && !customInvoiceDate.trim()) {
        toast({
          title: "خطا در تنظیمات تاریخ",
          description: "لطفاً تاریخ دلخواه را وارد کنید",
          variant: "destructive",
        });
        return;
      }
      
      // Accept JSON files more broadly (including text/plain for some exports)
      const isJsonFile = file.name.toLowerCase().endsWith('.json') || 
                        file.type === 'application/json' || 
                        file.type === 'text/plain';
      
      if (isJsonFile) {
        uploadMutation.mutate(file);
      } else {
        toast({
          title: "نوع فایل نامعتبر",
          description: "لطفاً فقط فایل‌های JSON آپلود کنید",
          variant: "destructive",
        });
      }
    }
  }, [uploadMutation, toast, invoiceDateMode, customInvoiceDate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
      'text/plain': ['.json']  // Accept JSON files that might be detected as text
    },
    maxFiles: 1,
    multiple: false
  });

  const handleSelectAll = () => {
    if (!uploadResult) return;
    
    const unsentInvoices = uploadResult.invoices
      .filter(inv => !inv.sentToTelegram)
      .map(inv => inv.id);
      
    if (selectedInvoices.length === unsentInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(unsentInvoices);
    }
  };

  const handleInvoiceSelect = (invoiceId: number) => {
    setSelectedInvoices(prev => 
      prev.includes(invoiceId)
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const handleSendToTelegram = () => {
    if (selectedInvoices.length === 0) {
      toast({
        title: "هیچ فاکتوری انتخاب نشده",
        description: "لطفاً حداقل یک فاکتور برای ارسال انتخاب کنید",
        variant: "destructive",
      });
      return;
    }
    sendToTelegramMutation.mutate(selectedInvoices);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>تولید فاکتور از فایل JSON</span>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            آماده
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invoice Date Settings */}
        <Card className="border-dashed border-gray-300 dark:border-gray-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                <Calendar className="w-4 h-4 ml-2" />
                تنظیمات تاریخ صدور فاکتور
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDateSettings(!showDateSettings)}
                className="text-xs"
              >
                {showDateSettings ? 'بستن' : 'تنظیمات'}
              </Button>
            </div>
            
            {showDateSettings && (
              <div className="space-y-4">
                <RadioGroup 
                  value={invoiceDateMode} 
                  onValueChange={(value: 'today' | 'custom') => setInvoiceDateMode(value)}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="today" id="today" />
                    <Label htmlFor="today" className="text-sm">
                      تاریخ امروز ({toPersianDigits(getCurrentPersianDate())})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom" className="text-sm">
                      تاریخ دلخواه (برای بازسازی فاکتورهای حذف شده)
                    </Label>
                  </div>
                </RadioGroup>
                
                {invoiceDateMode === 'custom' && (
                  <div className="mr-6">
                    <Label htmlFor="customDate" className="text-xs text-gray-600 dark:text-gray-400">
                      تاریخ صدور (فرمت: ۱۴۰۳/۱۲/۱۵)
                    </Label>
                    <Input
                      id="customDate"
                      value={customInvoiceDate}
                      onChange={(e) => setCustomInvoiceDate(e.target.value)}
                      placeholder="مثال: ۱۴۰۳/۱۲/۱۵"
                      className="mt-1 text-sm"
                      dir="rtl"
                      maxLength={10}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      * برای بازسازی فاکتورهای حذف شده با تاریخ اصلی (تقویم شمسی)
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* File Upload Area */}
        <div
          {...getRootProps()}
          className={`upload-area ${isDragActive ? 'dragover' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {isDragActive 
              ? "فایل را اینجا رها کنید..."
              : "فایل JSON حاوی داده‌های مصرف را اینجا رها کنید"
            }
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            یا کلیک کنید تا فایل را انتخاب کنید
          </p>
          <Button 
            disabled={uploadMutation.isPending || (invoiceDateMode === 'custom' && !customInvoiceDate.trim())}
          >
            {uploadMutation.isPending ? "در حال پردازش..." : "انتخاب فایل"}
          </Button>
          
          {invoiceDateMode === 'custom' && !customInvoiceDate.trim() && (
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
              لطفاً تاریخ دلخواه را وارد کنید
            </p>
          )}
        </div>

        {/* Upload Progress */}
        {uploadMutation.isPending && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>در حال پردازش فایل...</span>
              <div className="flex items-center space-x-2 space-x-reverse">
                <span>{toPersianDigits(uploadProgress.toString())}%</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowProcessingModal(true)}
                  className="text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  نمایش جزئیات
                </Button>
              </div>
            </div>
            <Progress value={uploadProgress} className="w-full" />
            
            {/* Latest processing step preview */}
            {jobData && (
              <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                <Activity className={`w-3 h-3 ml-1 ${jobData.status !== 'completed' && jobData.status !== 'failed' ? 'animate-spin' : ''}`} />
                <span>مرحله: {jobData.status}</span>
              </div>
            )}
          </div>
        )}

        {/* Processing Status */}
        {uploadResult && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">وضعیت پردازش</h3>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <CheckCircle className="w-4 h-4 text-green-600 ml-2" />
                <span>فایل JSON بارگذاری شد</span>
              </div>
              <div className="flex items-center text-sm">
                <CheckCircle className="w-4 h-4 text-green-600 ml-2" />
                <span>{toPersianDigits(uploadResult.created.toString())} فاکتور ایجاد شد</span>
              </div>
              {uploadResult.invalid > 0 && (
                <div className="flex items-center text-sm text-orange-600">
                  <AlertCircle className="w-4 h-4 ml-2" />
                  <span>{toPersianDigits(uploadResult.invalid.toString())} رکورد نامعتبر نادیده گرفته شد</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generated Invoices List */}
        {uploadResult && uploadResult.invoices.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-medium text-gray-900 dark:text-white">
                فاکتورهای تولید شده ({toPersianDigits(uploadResult.invoices.length.toString())} فاکتور)
              </h3>
              <div className="flex items-center space-x-2 space-x-reverse">
                <Button
                  size="sm"
                  onClick={handleSendToTelegram}
                  disabled={selectedInvoices.length === 0 || sendToTelegramMutation.isPending}
                  className="bg-primary text-white hover:bg-primary/90"
                >
                  <Send className="w-3 h-3 mr-1" />
                  {sendToTelegramMutation.isPending 
                    ? "در حال ارسال..." 
                    : `ارسال ${toPersianDigits(selectedInvoices.length.toString())} فاکتور`
                  }
                </Button>
                <Button size="sm" variant="outline">
                  <Download className="w-3 h-3 mr-1" />
                  دانلود گزارش
                </Button>
              </div>
            </div>
            
            <div className="p-4">
              <div className="flex items-center mb-4">
                <Checkbox
                  checked={
                    uploadResult.invoices
                      .filter(inv => !inv.sentToTelegram).length > 0 &&
                    selectedInvoices.length === 
                      uploadResult.invoices.filter(inv => !inv.sentToTelegram).length
                  }
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">
                  انتخاب همه فاکتورهای ارسال نشده
                </span>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {uploadResult.invoices.map((invoice) => (
                  <div 
                    key={invoice.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center space-x-3 space-x-reverse">
                      <Checkbox
                        checked={selectedInvoices.includes(invoice.id)}
                        onCheckedChange={() => handleInvoiceSelect(invoice.id)}
                        disabled={invoice.sentToTelegram}
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {invoice.representativeName} ({invoice.representativeCode})
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          مبلغ: {formatCurrency(invoice.amount)} تومان
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 space-x-reverse">
                      {invoice.sentToTelegram ? (
                        <Badge className="invoice-status-paid">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          ارسال شده
                        </Badge>
                      ) : (
                        <Badge className="invoice-status-unpaid">
                          <Clock className="w-3 h-3 mr-1" />
                          در انتظار ارسال
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Processing Details Modal (New JSON Progress UI) */}
        {showProcessingModal && currentJobCode && (window as any).LOCAL_JSON_PROGRESS_UI !== false && (
          <JsonProcessingDialog
            jobCode={currentJobCode}
            open={showProcessingModal}
            onOpenChange={setShowProcessingModal}
            fileName={currentFile?.name}
            fileSize={currentFile?.size}
          />
        )}
        {/* Legacy fallback kept (in case feature flag disabled) */}
        {showProcessingModal && (window as any).LOCAL_JSON_PROGRESS_UI === false && (
          <div className="p-4 text-xs text-gray-400">نسخه قدیمی نمایش پردازش فعال است (Feature Flag خاموش)</div>
        )}
      </CardContent>
    </Card>
  );
}
