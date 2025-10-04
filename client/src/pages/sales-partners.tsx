import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Handshake, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Trash2, 
  Plus, 
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  PhoneCall,
  User,
  MapPin,
  Award,
  Calendar
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
import { formatCurrency, toPersianDigits } from "@/lib/persian-date";
import type { SalesPartnerWithCount } from "@shared/schema";

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

export default function SalesPartners() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPartner, setSelectedPartner] = useState<SalesPartner | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("partners");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const { data: representatives = [] } = useQuery<Representative[]>({
    queryKey: ["/api/representatives"],
    select: (data: any) => {
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.data)) return data.data;
      return [];
    }
  });

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            مدیریت همکاران فروش
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            مدیریت جامع همکاران فروش، کمیسیون‌ها و عملکرد
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 ml-2" />
          همکار جدید
        </Button>
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
                <Table>
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
                              onClick={() => handleViewDetails(partner)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {/* S-02 Fix: stats.totalCommission is now number */}
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
                    {/* S-02 Fix: stats.averageCommissionRate is now number */}
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
                    {/* S-02 Fix: stats.totalCoupledSales is now number */}
                    {formatCurrency(stats?.totalCoupledSales || 0)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">کل فروش کوپل شده</div>
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
                <Table>
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
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>ویرایش درصد کمیسیون</DialogTitle>
            <DialogDescription>
              تغییر درصد کمیسیون برای {selectedPartner?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedPartner && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="commission">درصد کمیسیون (%)</Label>
                <Input
                  id="commission"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  defaultValue={selectedPartner.commissionRate || 0}
                  placeholder="مثال: 5"
                />
                <p className="text-sm text-gray-500">
                  کمیسیون فعلی: {toPersianDigits((selectedPartner.commissionRate || 0).toString())}%
                </p>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                  انصراف
                </Button>
                <Button onClick={() => {
                  // TODO: Implement update commission API call
                  toast({
                    title: "توجه",
                    description: "قابلیت ویرایش کمیسیون در حال توسعه است",
                  });
                  setIsEditOpen(false);
                }}>
                  ذخیره تغییرات
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}