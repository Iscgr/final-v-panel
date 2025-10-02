import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings as SettingsIcon,
  Save,
  TestTube,
  Bot,
  Send,
  Key,
  MessageSquare,
  Palette,
  Bell,
  Shield,
  FileText,
  Globe,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Database,
  SendToBack,
  Brain,
  CheckSquare,
  Target,
  BarChart,
  Users,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { toPersianDigits } from "@/lib/persian-date";
// ماژول‌های Financial Integrity, BatchRollback, MultiGroupConfiguration حذف شدند طبق پاکسازی ایمن
// import { FinancialIntegrityDashboard } from '../components/financial-integrity-dashboard';
// import { BatchRollbackManager } from '../components/batch-rollback-manager';
// import { MultiGroupConfiguration } from '../components/multi-group-configuration';

// Import Portal Content Management Components
import { PortalAppsManager } from "@/components/portal-apps-manager";
import { PortalAnnouncementsManager } from "@/components/portal-announcements-manager";

// Import default template function
const getDefaultTelegramTemplate = () => `📋 فاکتور شماره {invoice_number}

🏪 نماینده: {representative_name}
👤 صاحب فروشگاه: {shop_owner}
📱 شناسه پنل: {panel_id}
💰 مبلغ فاکتور: {amount} تومان
📅 تاریخ صدور: {issue_date}
🔍 وضعیت: {status}

ℹ️ برای مشاهده جزئیات کامل فاکتور، وارد لینک زیر بشوید

{portal_link}

تولید شده توسط سیستم مدیریت مالی 🤖`;

const telegramSettingsSchema = z.object({
  botToken: z.string().min(1, "توکن ربات الزامی است"),
  chatId: z.string().min(1, "شناسه چت الزامی است"),
  template: z.string().min(1, "قالب پیام الزامی است"),
});

const portalSettingsSchema = z.object({
  portalTitle: z.string().min(1, "عنوان پورتال الزامی است"),
  portalDescription: z.string().optional(),
  showOwnerName: z.boolean(),
  showDetailedUsage: z.boolean(),
  customCss: z.string().optional(),
});

const invoiceTemplateSchema = z.object({
  invoiceHeader: z.string().min(1, "سربرگ فاکتور الزامی است"),
  invoiceFooter: z.string().optional(),
  showUsageDetails: z.boolean(),
  usageFormat: z.string().optional(),
  usageTableColumns: z.string().optional(), // Column configuration for usage details table
  showEventTimestamp: z.boolean().default(true),
  showEventType: z.boolean().default(true),
  showDescription: z.boolean().default(true),
  showAdminUsername: z.boolean().default(true),
});



const dataResetSchema = z.object({
  representatives: z.boolean().default(false),
  invoices: z.boolean().default(false),
  payments: z.boolean().default(false),
  salesPartners: z.boolean().default(false),
  settings: z.boolean().default(false),
  activityLogs: z.boolean().default(false),
});

type TelegramSettingsData = z.infer<typeof telegramSettingsSchema>;
type DataResetData = z.infer<typeof dataResetSchema>;
type PortalSettingsData = z.infer<typeof portalSettingsSchema>;
type InvoiceTemplateData = z.infer<typeof invoiceTemplateSchema>;

export default function Settings() {
  const [activeTab, setActiveTab] = useState("telegram");
  const [showDataCounts, setShowDataCounts] = useState(false);
  const [dataCounts, setDataCounts] = useState({
    representatives: 0,
    invoices: 0,
    payments: 0,
    salesPartners: 0,
    settings: 0,
    activityLogs: 0,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current settings
  const { data: telegramBotToken } = useQuery({
    queryKey: ["/api/settings/telegram_bot_token"]
  });

  const { data: telegramChatId } = useQuery({
    queryKey: ["/api/settings/telegram_chat_id"]
  });

  const { data: telegramTemplate } = useQuery({
    queryKey: ["/api/settings/telegram_template"]
  });



  // Fetch invoice template settings
  const { data: showUsageDetails } = useQuery({
    queryKey: ["/api/settings/invoice_show_usage_details"]
  });

  const { data: showEventTimestamp } = useQuery({
    queryKey: ["/api/settings/invoice_show_event_timestamp"]
  });

  const { data: showEventType } = useQuery({
    queryKey: ["/api/settings/invoice_show_event_type"]
  });

  const { data: showDescription } = useQuery({
    queryKey: ["/api/settings/invoice_show_description"]
  });

  const { data: showAdminUsername } = useQuery({
    queryKey: ["/api/settings/invoice_show_admin_username"]
  });

  // Fetch portal settings
  const { data: portalTitle } = useQuery({
    queryKey: ["/api/settings/portal_title"]
  });

  const { data: portalDescription } = useQuery({
    queryKey: ["/api/settings/portal_description"]
  });

  const { data: showOwnerName } = useQuery({
    queryKey: ["/api/settings/portal_show_owner_name"]
  });

  const { data: showDetailedUsage } = useQuery({
    queryKey: ["/api/settings/portal_show_detailed_usage"]
  });

  // Forms
  const telegramForm = useForm<TelegramSettingsData>({
    resolver: zodResolver(telegramSettingsSchema),
    defaultValues: {
      botToken: "",
      chatId: "",
      template: getDefaultTelegramTemplate()
    }
  });

  const invoiceTemplateForm = useForm<InvoiceTemplateData>({
    resolver: zodResolver(invoiceTemplateSchema),
    defaultValues: {
      invoiceHeader: "سیستم مدیریت مالی MarFaNet",
      invoiceFooter: "",
      showUsageDetails: true,
      usageFormat: "table",
      usageTableColumns: "admin_username,event_timestamp,event_type,description,amount",
      showEventTimestamp: true,
      showEventType: true,
      showDescription: true,
      showAdminUsername: true
    }
  });

  const dataResetForm = useForm<DataResetData>({
    resolver: zodResolver(dataResetSchema),
    defaultValues: {
      representatives: false,
      invoices: false,
      payments: false,
      salesPartners: false,
      settings: false,
      activityLogs: false,
    }
  });

  const portalForm = useForm<PortalSettingsData>({
    resolver: zodResolver(portalSettingsSchema),
    defaultValues: {
      portalTitle: "پرتال عمومی نماینده",
      portalDescription: "مشاهده وضعیت مالی و فاکتورهای شما",
      showOwnerName: true,
      showDetailedUsage: true,
      customCss: ""
    }
  });

  // Update forms when data is loaded
  useEffect(() => {
    if ((telegramBotToken as any)?.value) telegramForm.setValue('botToken', (telegramBotToken as any).value);
    if ((telegramChatId as any)?.value) telegramForm.setValue('chatId', (telegramChatId as any).value);
    if ((telegramTemplate as any)?.value) telegramForm.setValue('template', (telegramTemplate as any).value);

    // Update invoice template form with settings values
    if ((showUsageDetails as any)?.value !== undefined) {
      invoiceTemplateForm.setValue('showUsageDetails', (showUsageDetails as any).value === 'true');
    }
    if ((showEventTimestamp as any)?.value !== undefined) {
      invoiceTemplateForm.setValue('showEventTimestamp', (showEventTimestamp as any).value === 'true');
    }
    if ((showEventType as any)?.value !== undefined) {
      invoiceTemplateForm.setValue('showEventType', (showEventType as any).value === 'true');
    }
    if ((showDescription as any)?.value !== undefined) {
      invoiceTemplateForm.setValue('showDescription', (showDescription as any).value === 'true');
    }
    if ((showAdminUsername as any)?.value !== undefined) {
      invoiceTemplateForm.setValue('showAdminUsername', (showAdminUsername as any).value === 'true');
    }

    // Update portal form
    if ((portalTitle as any)?.value) portalForm.setValue('portalTitle', (portalTitle as any).value);
    if ((portalDescription as any)?.value) portalForm.setValue('portalDescription', (portalDescription as any).value);
    if ((showOwnerName as any)?.value !== undefined) {
      portalForm.setValue('showOwnerName', (showOwnerName as any).value === 'true');
    }
    if ((showDetailedUsage as any)?.value !== undefined) {
      portalForm.setValue('showDetailedUsage', (showDetailedUsage as any).value === 'true');
    }
  }, [telegramBotToken, telegramChatId, telegramTemplate, showUsageDetails, showEventTimestamp, showEventType, showDescription, showAdminUsername, portalTitle, portalDescription, showOwnerName, showDetailedUsage]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string, value: string }) => {
      const response = await apiRequest(`/api/settings/${key}`, { method: 'PUT', data: { value } });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "تنظیمات ذخیره شد",
        description: "تغییرات با موفقیت اعمال شد",
      });
      // Invalidate specific settings queries instead of generic pattern
      queryClient.invalidateQueries({ queryKey: ["/api/settings/telegram_bot_token"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/telegram_chat_id"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/telegram_template"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: (error: any) => {
      toast({
        title: "خطا در ذخیره تنظیمات",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const testTelegramMutation = useMutation({
    mutationFn: async () => {
      // T-01 Fix: Correct endpoint path
      const response = await apiRequest('/api/test-telegram', { method: 'POST' });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "✅ اتصال تلگرام موفق",
        description: `ربات ${data.botInfo?.username || 'تلگرام'} متصل شد`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ خطا در اتصال تلگرام",
        description: error.message || "لطفاً تنظیمات را بررسی کنید",
        variant: "destructive",
      });
    }
  });

  const onTelegramSubmit = async (data: TelegramSettingsData) => {
    try {
      console.log('🔄 Saving telegram settings:', { botToken: data.botToken.substring(0, 10) + '...', chatId: data.chatId, templateLength: data.template.length });
      
      await updateSettingMutation.mutateAsync({ key: 'telegram_bot_token', value: data.botToken });
      await updateSettingMutation.mutateAsync({ key: 'telegram_chat_id', value: data.chatId });
      await updateSettingMutation.mutateAsync({ key: 'telegram_template', value: data.template });
      
      console.log('✅ All telegram settings saved successfully');
    } catch (error) {
      console.error('❌ Error saving telegram settings:', error);
      toast({
        title: "خطا در ذخیره تنظیمات تلگرام",
        description: "لطفاً دوباره تلاش کنید",
        variant: "destructive",
      });
    }
  };

  // Data Reset Functions
  const fetchDataCountsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/admin/data-counts', { method: 'GET' });
      return response;
    },
    onSuccess: (data) => {
      setDataCounts(data);
      setShowDataCounts(true);
    },
    onError: (error: any) => {
      toast({
        title: "خطا در دریافت آمار داده‌ها",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const resetDataMutation = useMutation({
    mutationFn: async (resetOptions: DataResetData) => {
      const response = await apiRequest('/api/admin/reset-data', { method: 'POST', data: resetOptions });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "بازنشانی اطلاعات موفق",
        description: `${data.deletedCounts?.total || 0} رکورد با موفقیت حذف شد`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/representatives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-partners"] });
      // تلاش برای همگام‌سازی کامل بدهی‌ها پس از حذف عمده جهت جلوگیری از مقادیر قدیمی
      (async () => {
        try {
          await apiRequest('/api/unified-financial/sync-all-representatives', { method: 'POST' });
          queryClient.invalidateQueries({ queryKey: ["/api/unified-financial/total-debt"] });
        } catch (e) {
          console.warn('Sync-all after reset failed (non-blocking)', e);
        }
      })();
      dataResetForm.reset();
      setShowDataCounts(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطا در بازنشانی اطلاعات",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onInvoiceTemplateSubmit = async (data: InvoiceTemplateData) => {
    try {
      await updateSettingMutation.mutateAsync({ key: 'invoice_header', value: data.invoiceHeader });
      if (data.invoiceFooter) {
        await updateSettingMutation.mutateAsync({ key: 'invoice_footer', value: data.invoiceFooter });
      }
      await updateSettingMutation.mutateAsync({ key: 'invoice_show_usage_details', value: data.showUsageDetails.toString() });
      await updateSettingMutation.mutateAsync({ key: 'invoice_show_event_timestamp', value: data.showEventTimestamp.toString() });
      await updateSettingMutation.mutateAsync({ key: 'invoice_show_event_type', value: data.showEventType.toString() });
      await updateSettingMutation.mutateAsync({ key: 'invoice_show_description', value: data.showDescription.toString() });
      await updateSettingMutation.mutateAsync({ key: 'invoice_show_admin_username', value: data.showAdminUsername.toString() });
    } catch (error: any) {
      toast({
        title: "خطا در ذخیره تنظیمات قالب فاکتور",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const onPortalSubmit = async (data: PortalSettingsData) => {
    try {
      await updateSettingMutation.mutateAsync({ key: 'portal_title', value: data.portalTitle });
      if (data.portalDescription) {
        await updateSettingMutation.mutateAsync({ key: 'portal_description', value: data.portalDescription });
      }
      await updateSettingMutation.mutateAsync({ key: 'portal_show_owner_name', value: data.showOwnerName.toString() });
      await updateSettingMutation.mutateAsync({ key: 'portal_show_detailed_usage', value: data.showDetailedUsage.toString() });
      if (data.customCss) {
        await updateSettingMutation.mutateAsync({ key: 'portal_custom_css', value: data.customCss });
      }
    } catch (error: any) {
      toast({
        title: "خطا در ذخیره تنظیمات پورتال",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const onDataResetSubmit = async (data: DataResetData) => {
    const selectedItems = Object.entries(data).filter(([key, value]) => value).map(([key]) => key);

    if (selectedItems.length === 0) {
      toast({
        title: "هیچ موردی انتخاب نشده",
        description: "لطفاً حداقل یک مورد برای بازنشانی انتخاب کنید",
        variant: "destructive",
      });
      return;
    }

    await resetDataMutation.mutateAsync(data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">تنظیمات</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            تنظیمات سیستم، یکپارچگی‌ها و پیکربندی
          </p>
        </div>

        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          نسخه ۱.۰.۰
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="telegram" className="flex items-center">
            <Send className="w-4 h-4 mr-2" />
            تلگرام
          </TabsTrigger>
          <TabsTrigger value="portal" className="flex items-center">
            <Globe className="w-4 h-4 mr-2" />
            پرتال عمومی
          </TabsTrigger>
          <TabsTrigger value="portal-content" className="flex items-center">
            <Bell className="w-4 h-4 mr-2" />
            اپلیکیشن‌ها و اعلانات
          </TabsTrigger>
          <TabsTrigger value="invoice-template" className="flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            قالب فاکتور
          </TabsTrigger>
          <TabsTrigger value="data-reset" className="flex items-center">
            <Database className="w-4 h-4 mr-2" />
            بازنشانی داده‌ها
          </TabsTrigger>
        </TabsList>

        {/* Telegram Settings */}
        <TabsContent value="telegram">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Send className="w-5 h-5 ml-2" />
                  تنظیمات ربات تلگرام
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...telegramForm}>
                  <form onSubmit={telegramForm.handleSubmit(onTelegramSubmit)} className="space-y-4">
                    <FormField
                      control={telegramForm.control}
                      name="botToken"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>توکن ربات تلگرام</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                              type="password"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            توکن ربات تلگرام خود را از @BotFather دریافت کنید<br/>
                            <strong>ربات صحیح: @Dsyrhshnmdbot</strong> - اطمینان حاصل کنید توکن مربوط به این ربات باشد
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={telegramForm.control}
                      name="chatId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>شناسه چت</FormLabel>
                          <FormControl>
                            <Input placeholder="-1001234567890" {...field} />
                          </FormControl>
                          <FormDescription>
                            شناسه چت یا گروه برای ارسال فاکتورها
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center space-x-4 space-x-reverse pt-4">
                      <Button
                        type="submit"
                        disabled={updateSettingMutation.isPending}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {updateSettingMutation.isPending ? "در حال ذخیره..." : "ذخیره تنظیمات"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => testTelegramMutation.mutate()}
                        disabled={testTelegramMutation.isPending || !telegramForm.watch('botToken')}
                      >
                        <TestTube className="w-4 h-4 mr-2" />
                        {testTelegramMutation.isPending ? "در حال تست..." : "تست اتصال"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="w-5 h-5 ml-2" />
                  قالب پیام تلگرام
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...telegramForm}>
                  <form onSubmit={telegramForm.handleSubmit(onTelegramSubmit)} className="space-y-4">
                    <FormField
                      control={telegramForm.control}
                      name="template"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>قالب پیام</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="قالب پیام خود را وارد کنید..."
                              rows={12}
                              className="font-mono text-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="space-y-1">
                            <div>متغیرهای قابل استفاده:</div>
                            <div className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                              {`{invoice_number}, {representative_name}, {shop_owner}, {panel_id}, {amount}, {issue_date}, {status}, {portal_link}`}
                            </div>
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="pt-4">
                      <Button
                        type="submit"
                        disabled={updateSettingMutation.isPending}
                        className="w-full"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {updateSettingMutation.isPending ? "در حال ذخیره..." : "ذخیره قالب پیام"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* پیکربندی چند گروه تلگرام حذف شد */}

          </div>
        </TabsContent>

        {/* Portal Settings */}
        <TabsContent value="portal">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="w-5 h-5 ml-2" />
                تنظیمات پرتال عمومی نماینده
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...portalForm}>
                <form onSubmit={portalForm.handleSubmit(onPortalSubmit)} className="space-y-6">
                  <FormField
                    control={portalForm.control}
                    name="portalTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>عنوان پرتال</FormLabel>
                        <FormControl>
                          <Input placeholder="پرتال عمومی نماینده" {...field} />
                        </FormControl>
                        <FormDescription>
                          عنوان اصلی که در بالای پرتال نمایندگان نمایش داده می‌شود
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={portalForm.control}
                    name="portalDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>توضیحات پرتال</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="مشاهده وضعیت مالی و فاکتورهای شما"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          توضیحات مختصری که زیر عنوان پرتال نمایش داده می‌شود
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={portalForm.control}
                      name="showOwnerName"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>نمایش نام صاحب فروشگاه</FormLabel>
                            <FormDescription>
                              نمایش نام صاحب فروشگاه در پرتال
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={portalForm.control}
                      name="showDetailedUsage"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>نمایش جزئیات مصرف</FormLabel>
                            <FormDescription>
                              نمایش جدول ریز جزئیات استفاده
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={portalForm.control}
                    name="customCss"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>استایل سفارشی (CSS)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="/* استایل سفارشی CSS */
.portal-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.portal-card {
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}"
                            rows={8}
                            className="font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          کدهای CSS سفارشی برای شخصی‌سازی ظاهر پرتال
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4">
                    <Button
                      type="submit"
                      disabled={updateSettingMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateSettingMutation.isPending ? "در حال ذخیره..." : "ذخیره تنظیمات"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* پیش‌نمایش پرتال حذف شد */}
        </TabsContent>

        {/* Invoice Template Settings */}
        <TabsContent value="invoice-template">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 ml-2" />
                  تنظیمات قالب فاکتور
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...invoiceTemplateForm}>
                  <form onSubmit={invoiceTemplateForm.handleSubmit(onInvoiceTemplateSubmit)} className="space-y-4">
                    <FormField
                      control={invoiceTemplateForm.control}
                      name="invoiceHeader"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>سربرگ فاکتور</FormLabel>
                          <FormControl>
                            <Input placeholder="سیستم مدیریت مالی MarFaNet" {...field} />
                          </FormControl>
                          <FormDescription>
                            متن سربرگ که در بالای فاکتور نمایش داده می‌شود
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceTemplateForm.control}
                      name="invoiceFooter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>پاورقی فاکتور</FormLabel>
                          <FormControl>
                            <Textarea placeholder="متن پاورقی اختیاری..." rows={2} {...field} />
                          </FormControl>
                          <FormDescription>
                            متن اختیاری که در پایین فاکتور نمایش داده می‌شود
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceTemplateForm.control}
                      name="showUsageDetails"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>نمایش جزئیات مصرف</FormLabel>
                            <FormDescription>
                              نمایش جدول ریز جزئیات مصرف در پورتال عمومی
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="pt-4">
                      <Button
                        type="submit"
                        disabled={updateSettingMutation.isPending}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {updateSettingMutation.isPending ? "در حال ذخیره..." : "ذخیره تنظیمات"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Palette className="w-5 h-5 ml-2" />
                  تنظیمات نمایش جدول ریز جزئیات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Form {...invoiceTemplateForm}>
                  <div className="space-y-4">
                    <FormField
                      control={invoiceTemplateForm.control}
                      name="showAdminUsername"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>نمایش نام کاربری ادمین</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              نمایش ستون admin_username در جدول
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceTemplateForm.control}
                      name="showEventTimestamp"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>نمایش زمان رویداد</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              نمایش ستون event_timestamp در جدول
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceTemplateForm.control}
                      name="showEventType"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>نمایش نوع رویداد</FormLabel>
                            <FormDescription>
                              نمایش ستون event_type در جدول
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceTemplateForm.control}
                      name="showDescription"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>نمایش توضیحات</FormLabel>
                            <FormDescription>
                              نمایش ستون description در جدول
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </Form>

                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 dark:text-green-200 mb-2">
                    پیش‌نمایش قالب جدول
                  </h4>
                  <div className="text-sm text-green-800 dark:text-green-300">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border border-green-200 dark:border-green-700">
                        <thead className="bg-green-100 dark:bg-green-800">
                          <tr>
                            <th className="px-2 py-1 text-right border border-green-200 dark:border-green-700">نام کاربری ادمین</th>
                            <th className="px-2 py-1 text-right border border-green-200 dark:border-green-700">زمان رویداد</th>
                            <th className="px-2 py-1 text-right border border-green-200 dark:border-green-700">نوع رویداد</th>
                            <th className="px-2 py-1 text-right border border-green-200 dark:border-green-700">توضیحات</th>
                            <th className="px-2 py-1 text-right border border-green-200 dark:border-green-700">مبلغ</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-2 py-1 border border-green-200 dark:border-green-700">mohamadrzmb</td>
                            <td className="px-2 py-1 border border-green-200 dark:border-green-700">2025-07-09 12:53:58</td>
                            <td className="px-2 py-1 border border-green-200 dark:border-green-700">CREATE</td>
                            <td className="px-2 py-1 border border-green-200 dark:border-green-700">ایجاد کاربر: aghayeyousefi_sh2</td>
                            <td className="px-2 py-1 border border-green-200 dark:border-green-700">27000.00</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>



        {/* تب حذف دسته‌جمعی حذف شد */}

        {/* تب امنیت حذف شد */}

        {/* Data Reset Settings */}
        <TabsContent value="data-reset">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-red-600 dark:text-red-400">
                <Database className="w-5 h-5 ml-2" />
                بازنشانی اطلاعات سیستم
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                حذف انتخابی اطلاعات سیستم با حفظ یکپارچگی داده‌ها
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 ml-2 text-yellow-600 dark:text-yellow-400" />
                    <div>
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">
                        هشدار: عملیات غیرقابل برگشت
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        اطلاعات حذف شده قابل بازیابی نخواهد بود
                      </p>
                    </div>
                  </div>
                </div>

                {!showDataCounts ? (
                  <div className="text-center">
                    <Button
                      onClick={() => fetchDataCountsMutation.mutate()}
                      disabled={fetchDataCountsMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <RotateCcw className="w-4 h-4 ml-2" />
                      {fetchDataCountsMutation.isPending ? "در حال بارگذاری..." : "نمایش آمار اطلاعات موجود"}
                    </Button>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      ابتدا آمار اطلاعات موجود را مشاهده کنید
                    </p>
                  </div>
                ) : (
                  <Form {...dataResetForm}>
                    <form onSubmit={dataResetForm.handleSubmit(onDataResetSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Representatives */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <FormField
                            control={dataResetForm.control}
                            name="representatives"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-base font-medium">
                                    نمایندگان ({toPersianDigits(dataCounts.representatives.toString())})
                                  </FormLabel>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    حذف تمام اطلاعات نمایندگان و کدهای دسترسی آن‌ها
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Invoices */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <FormField
                            control={dataResetForm.control}
                            name="invoices"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-base font-medium">
                                    فاکتورها ({toPersianDigits(dataCounts.invoices.toString())})
                                  </FormLabel>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    حذف تمام فاکتورها و جزئیات مصرف مرتبط
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Payments */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <FormField
                            control={dataResetForm.control}
                            name="payments"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-base font-medium">
                                    پرداخت‌ها ({toPersianDigits(dataCounts.payments.toString())})
                                  </FormLabel>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    حذف تمام رکوردهای پرداخت و تخصیص‌ها
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Sales Partners */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <FormField
                            control={dataResetForm.control}
                            name="salesPartners"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-base font-medium">
                                    همکاران فروش ({toPersianDigits(dataCounts.salesPartners.toString())})
                                  </FormLabel>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    حذف اطلاعات همکاران فروش و کمیسیون‌ها
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Activity Logs */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <FormField
                            control={dataResetForm.control}
                            name="activityLogs"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-base font-medium">
                                    گزارش فعالیت‌ها ({toPersianDigits(dataCounts.activityLogs.toString())})
                                  </FormLabel>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    حذف تاریخچه فعالیت‌های سیستم
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Settings */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <FormField
                            control={dataResetForm.control}
                            name="settings"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-base font-medium">
                                    تنظیمات ({toPersianDigits(dataCounts.settings.toString())})
                                  </FormLabel>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    بازگشت تنظیمات به حالت پیش‌فرض
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowDataCounts(false);
                            dataResetForm.reset();
                          }}
                        >
                          <RotateCcw className="w-4 h-4 ml-2" />
                          بازگشت
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="destructive"
                              disabled={resetDataMutation.isPending}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <Trash2 className="w-4 h-4 ml-2" />
                              {resetDataMutation.isPending ? "در حال حذف..." : "بازنشانی انتخاب‌شده"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-red-600">
                                تأیید بازنشانی اطلاعات
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                آیا از حذف اطلاعات انتخاب‌شده اطمینان دارید؟ این عملیات غیرقابل برگشت است و تمام داده‌های مرتبط حذف خواهد شد.

                                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                    موارد انتخاب‌شده:
                                  </p>
                                  <ul className="text-sm text-red-700 dark:text-red-300 mt-1 space-y-1">
                                    {dataResetForm.watch('representatives') && <li>• نمایندگان</li>}
                                    {dataResetForm.watch('invoices') && <li>• فاکتورها</li>}
                                    {dataResetForm.watch('payments') && <li>• پرداخت‌ها</li>}
                                    {dataResetForm.watch('salesPartners') && <li>• همکاران فروش</li>}
                                    {dataResetForm.watch('activityLogs') && <li>• گزارش فعالیت‌ها</li>}
                                    {dataResetForm.watch('settings') && <li>• تنظیمات</li>}
                                  </ul>
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>انصراف</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={dataResetForm.handleSubmit(onDataResetSubmit)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                تأیید حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </form>
                  </Form>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Portal Content Management - Apps & Announcements */}
        <TabsContent value="portal-content">
          <div className="grid grid-cols-1 gap-6">
            {/* Portal Apps Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="w-5 h-5 ml-2" />
                  مدیریت اپلیکیشن‌ها
                </CardTitle>
                <CardDescription>
                  مدیریت لینک‌های دانلود، QR کد و ویدیوهای آموزشی اپلیکیشن‌ها
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PortalAppsManager />
              </CardContent>
            </Card>

            {/* Portal Announcements Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="w-5 h-5 ml-2" />
                  مدیریت اعلانات مهم
                </CardTitle>
                <CardDescription>
                  مدیریت اعلانات و اخبار مهم برای نمایش در پرتال عمومی
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PortalAnnouncementsManager />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}