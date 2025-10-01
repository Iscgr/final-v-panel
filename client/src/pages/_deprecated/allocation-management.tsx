
/**
 * SHERLOCK v35.0: Allocation Management Page
 * 🎯 صفحه مدیریت جامع تخصیص پرداخت‌ها
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  BarChart3,
  AlertCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiRequest from '@/lib/axios';
import { formatCurrency } from '@/lib/currency-formatter';

interface AllocationMetrics {
  totalPayments: number;
  allocatedPayments: number;
  unallocatedPayments: number;
  allocationRate: number;
  averageAllocationTime: number;
  totalAllocatedAmount: number;
  totalUnallocatedAmount: number;
  lastAllocationDate: string | null;
}

interface AllocationAlert {
  id: string;
  type: 'WARNING' | 'ERROR' | 'INFO';
  title: string;
  description: string;
  representativeId?: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  actionRequired: boolean;
}

interface AllocationTrend {
  date: string;
  allocatedCount: number;
  allocatedAmount: number;
  efficiency: number;
}

interface MonitoringReport {
  metrics: AllocationMetrics;
  trends: AllocationTrend[];
  alerts: AllocationAlert[];
  recommendations: string[];
  systemHealth: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';
}

export default function AllocationManagement() {
  const [selectedRepresentative, setSelectedRepresentative] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Fetch monitoring report
  const { data: reportData, isLoading: reportLoading, error: reportError } = useQuery({
    queryKey: ['allocation-monitoring-report'],
    queryFn: async () => {
      const data = await apiRequest('/api/allocation/monitoring-report');
      // انتظار می‌رود API ساختاری مشابه { data: { metrics, trends, ... } } برگرداند
      // اگر مستقیماً ساختار نهایی برگردد، fallback مناسب انجام می‌دهیم
      const wrapped = (data as any)?.data ? (data as any).data : data;
      return wrapped as MonitoringReport;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch representatives
  const { data: representatives } = useQuery({
    queryKey: ['representatives'],
    queryFn: async () => {
      const data = await apiRequest('/api/representatives');
      return (data as any)?.data ? (data as any).data : data;
    },
  });

  // Batch allocation mutation
  const batchAllocationMutation = useMutation({
    mutationFn: async (representativeId: number) => {
      const data = await apiRequest(`/api/payments/batch-allocate/${representativeId}`, {
        method: 'POST',
        body: JSON.stringify({
          maxPayments: 50,
          strictMode: true
        })
      });
      return (data as any)?.data ? (data as any).data : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocation-monitoring-report'] });
      queryClient.invalidateQueries({ queryKey: ['representatives'] });
    },
  });

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'EXCELLENT': return 'text-green-600';
      case 'GOOD': return 'text-blue-600';
      case 'WARNING': return 'text-yellow-600';
      case 'CRITICAL': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'EXCELLENT': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'GOOD': return <CheckCircle className="h-5 w-5 text-blue-600" />;
      case 'WARNING': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'CRITICAL': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (reportLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="mr-2 text-lg">در حال بارگذاری گزارش مانیتورینگ...</span>
        </div>
      </div>
    );
  }

  if (reportError || !reportData) {
    return (
      <div className="space-y-6 p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            خطا در بارگذاری گزارش مانیتورینگ. لطفاً دوباره تلاش کنید.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">مدیریت تخصیص پرداخت‌ها</h1>
          <p className="text-gray-600 mt-2">نظارت و مدیریت جامع تخصیص خودکار پرداخت‌ها</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-1 ${getHealthColor(reportData.systemHealth)}`}>
            {getHealthIcon(reportData.systemHealth)}
            <span className="font-medium mr-1">وضعیت سیستم: {reportData.systemHealth}</span>
          </div>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کل پرداخت‌ها</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.metrics.totalPayments}</div>
            <p className="text-xs text-muted-foreground">
              {reportData.metrics.allocatedPayments} تخصیص یافته
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نرخ تخصیص</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.metrics.allocationRate.toFixed(1)}%</div>
            <Progress value={reportData.metrics.allocationRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مبلغ تخصیص یافته</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(reportData.metrics.totalAllocatedAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(reportData.metrics.totalUnallocatedAmount)} تخصیص نیافته
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">پرداخت‌های معوق</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.metrics.unallocatedPayments}</div>
            <p className="text-xs text-muted-foreground">
              نیاز به تخصیص فوری
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">هشدارها</TabsTrigger>
          <TabsTrigger value="trends">روندها</TabsTrigger>
          <TabsTrigger value="recommendations">پیشنهادات</TabsTrigger>
          <TabsTrigger value="actions">اقدامات</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 ml-2" />
                هشدارهای فعال ({reportData.alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {reportData.alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <p className="text-lg font-medium">هیچ هشداری وجود ندارد</p>
                  <p className="text-gray-600">سیستم تخصیص در وضعیت مطلوب قرار دارد</p>
                </div>
              ) : (
                reportData.alerts.map((alert) => (
                  <Alert key={alert.id} className="border-r-4 border-r-orange-500">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={getPriorityColor(alert.priority)}>
                            {alert.priority}
                          </Badge>
                          <span className="text-sm text-gray-500">{alert.type}</span>
                        </div>
                        <h4 className="font-medium">{alert.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                      </div>
                      {alert.actionRequired && (
                        <Button size="sm" variant="outline">
                          اقدام
                        </Button>
                      )}
                    </div>
                  </Alert>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 ml-2" />
                روند تخصیص (7 روز گذشته)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.trends.map((trend, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{trend.date}</div>
                      <div className="text-sm text-gray-600">
                        {trend.allocatedCount} تخصیص
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{formatCurrency(trend.allocatedAmount)}</div>
                      <div className="text-sm text-gray-600">
                        بازدهی: {trend.efficiency.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>پیشنهادات سیستم</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reportData.recommendations.length === 0 ? (
                  <p className="text-gray-600">پیشنهادی برای بهبود وجود ندارد</p>
                ) : (
                  reportData.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                      <p className="text-sm">{recommendation}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>اقدامات سریع</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['allocation-monitoring-report'] })}
                  className="w-full"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 ml-2" />
                  بروزرسانی گزارش
                </Button>

                <Button 
                  onClick={() => {
                    if (representatives && representatives.length > 0) {
                      const rep = representatives.find((r: any) => r.totalDebt && parseFloat(r.totalDebt) > 0);
                      if (rep) {
                        batchAllocationMutation.mutate(rep.id);
                      }
                    }
                  }}
                  className="w-full"
                  disabled={batchAllocationMutation.isPending}
                >
                  {batchAllocationMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <DollarSign className="h-4 w-4 ml-2" />
                  )}
                  تخصیص دسته‌ای هوشمند
                </Button>
              </div>

              {representatives && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">تخصیص دسته‌ای برای نماینده خاص:</h4>
                  <div className="space-y-2">
                    {representatives
                      .filter((rep: any) => rep.totalDebt && parseFloat(rep.totalDebt) > 0)
                      .slice(0, 5)
                      .map((rep: any) => (
                        <div key={rep.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium">{rep.name}</div>
                            <div className="text-sm text-gray-600">
                              بدهی: {formatCurrency(parseFloat(rep.totalDebt || '0'))}
                            </div>
                          </div>
                          <Button 
                            size="sm"
                            onClick={() => batchAllocationMutation.mutate(rep.id)}
                            disabled={batchAllocationMutation.isPending}
                          >
                            تخصیص خودکار
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

