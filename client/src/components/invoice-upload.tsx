import { useState, useCallback, useEffect, useRef } from "react";
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

interface ProcessingStep {
  stage: string;
  message: string;
  progress: number;
  total: number;
  timestamp: string;
  status: 'processing' | 'completed' | 'error';
  details?: string;
}

export default function InvoiceUpload() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<number[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  
  // NEW: Invoice date selection states
  const [invoiceDateMode, setInvoiceDateMode] = useState<'today' | 'custom'>('today');
  const [customInvoiceDate, setCustomInvoiceDate] = useState('');
  const [showDateSettings, setShowDateSettings] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
    };
  }, []);

  // شبیه‌سازی مراحل پردازش بر اساس اندازه فایل
  const simulateProcessingSteps = (fileSize: number) => {
    const estimatedRecords = Math.floor(fileSize / 200); // تخمین تعداد رکوردها
    const estimatedRepresentatives = Math.floor(estimatedRecords / 20); // تخمین نمایندگان
    
    let currentStep = 0;
    const totalSteps = estimatedRepresentatives + 5; // مراحل اضافی برای parsing و setup
    
    const addStep = (stage: string, message: string, details?: string) => {
      currentStep++;
      const progress = Math.floor((currentStep / totalSteps) * 100);
      
      setProcessingSteps(prev => [...prev, {
        stage,
        message,
        progress: currentStep,
        total: totalSteps,
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        status: 'processing',
        details
      }]);
      
      setUploadProgress(progress);
    };

    // مرحله اول: آپلود
    setTimeout(() => addStep('آپلود', 'آپلود فایل JSON...', `حجم فایل: ${Math.round(fileSize/1024)} KB`), 500);
    
    // مرحله دوم: پارس کردن
    setTimeout(() => addStep('تحلیل', 'تحلیل ساختار JSON...', `تشخیص فرمت PHPMyAdmin`), 1000);
    
    // مرحله سوم: استخراج داده
    setTimeout(() => addStep('استخراج', `استخراج ${toPersianDigits(estimatedRecords.toString())} رکورد...`, 'گروه‌بندی بر اساس نمایندگان'), 1500);
    
    // شبیه‌سازی پردازش نمایندگان
    let processedReps = 0;
    const interval = setInterval(() => {
      processedReps++;
      const repName = `نماینده ${toPersianDigits(processedReps.toString())}`;
      addStep('پردازش', `ایجاد فاکتور برای ${repName}`, `${toPersianDigits(processedReps.toString())}/${toPersianDigits(estimatedRepresentatives.toString())} نماینده`);
      
      if (processedReps >= estimatedRepresentatives - 2) {
        clearInterval(interval);
        // مراحل نهایی
        setTimeout(() => addStep('نهایی‌سازی', 'به‌روزرسانی آمار مالی...'), 100);
        setTimeout(() => addStep('تکمیل', 'پردازش با موفقیت تکمیل شد!'), 200);
      }
    }, Math.max(100, 1000 / estimatedRepresentatives)); // حداقل 100ms فاصله بین مراحل
    
    processingIntervalRef.current = interval;
  };

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
      formData.append('batchName', `Upload-${file.name}-${Date.now()}`);
      formData.append('description', `فایل آپلود شده: ${file.name}`);
      
      // Add optional period parameters (can be empty for basic functionality)
      formData.append('periodStart', '');
      formData.append('periodEnd', '');
      
      console.log('Uploading file:', file.name, 'Size:', file.size);
      console.log('Invoice date mode:', invoiceDateMode, 'Custom date:', customInvoiceDate);
      
      // شروع نمایش modal و شبیه‌سازی مراحل
      setIsProcessing(true);
      setShowProcessingModal(true);
      setProcessingSteps([]);
      setCurrentFile(file);
      
      // شروع شبیه‌سازی مراحل
      simulateProcessingSteps(file.size);
      
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
      // پاک کردن interval
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
      
      // به‌روزرسانی مرحله آخر به موفقیت
      setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'completed' })));
      
      setUploadResult(data);
      setUploadProgress(100);
      setIsProcessing(false);
      
      console.log('فایل با موفقیت پردازش شد:', data);
      toast({
        title: "فایل با موفقیت پردازش شد",
        description: `${toPersianDigits(data.created.toString())} فاکتور ایجاد شد، ${toPersianDigits(data.newRepresentatives?.toString() || '0')} نماینده جدید`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
    },
    onError: (error: any) => {
      // پاک کردن interval
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
      
      // به‌روزرسانی مرحله آخر به خطا
      setProcessingSteps(prev => prev.map((step, index) => 
        index === prev.length - 1 ? { ...step, status: 'error' } : step
      ));
      
      setUploadProgress(0);
      setIsProcessing(false);
      
      toast({
        title: "خطا در پردازش فایل",
        description: error.message,
        variant: "destructive",
      });
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
        setUploadProgress(10);
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
            {processingSteps.length > 0 && (
              <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                <Activity className="w-3 h-3 ml-1 animate-spin" />
                <span>{processingSteps[processingSteps.length - 1]?.message}</span>
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
        
        {/* Processing Details Modal */}
        <Dialog open={showProcessingModal} onOpenChange={setShowProcessingModal}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Activity className="w-5 h-5 ml-2 text-primary" />
                  جزئیات پردازش فایل JSON
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowProcessingModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* File Info */}
              {currentFile && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <h4 className="font-medium mb-2">اطلاعات فایل</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">نام فایل:</span>
                      <span className="mr-2 font-mono">{currentFile.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">حجم:</span>
                      <span className="mr-2">{toPersianDigits(Math.round(currentFile.size / 1024).toString())} KB</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Progress Overview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">پیشرفت کلی</h4>
                  <span className="text-lg font-bold text-primary">
                    {toPersianDigits(uploadProgress.toString())}%
                  </span>
                </div>
                <Progress value={uploadProgress} className="w-full h-3" />
                {processingSteps.length > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {toPersianDigits(processingSteps.filter(s => s.status === 'completed').length.toString())} از {' '}
                    {toPersianDigits(processingSteps.length.toString())} مرحله تکمیل شده
                  </div>
                )}
              </div>
              
              <Separator />
              
              {/* Processing Steps */}
              <div>
                <h4 className="font-medium mb-3">مراحل پردازش</h4>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {processingSteps.map((step, index) => (
                      <div 
                        key={index}
                        className={`flex items-start space-x-3 space-x-reverse p-3 rounded-lg border ${
                          step.status === 'completed' 
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : step.status === 'error'
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {step.status === 'completed' ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : step.status === 'error' ? (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          ) : (
                            <Activity className="w-4 h-4 text-blue-600 animate-spin" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              {step.stage}
                            </span>
                            <span className="text-xs text-gray-500">
                              {step.timestamp}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            {step.message}
                          </p>
                          
                          {step.details && (
                            <p className="text-xs text-gray-500 mt-1">
                              {step.details}
                            </p>
                          )}
                          
                          {step.total > 0 && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs">
                                <span>پیشرفت این مرحله</span>
                                <span>
                                  {toPersianDigits(step.progress.toString())}/
                                  {toPersianDigits(step.total.toString())}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                                <div 
                                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${(step.progress / step.total) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {processingSteps.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Activity className="w-8 h-8 mx-auto mb-2 animate-spin" />
                        <p>در انتظار شروع پردازش...</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
