/**
 * 🎯 PUBLIC PORTAL - COMPLETE REDESIGN
 * 
 * آیتم‌های اصلی:
 * 1. اطلاعات هویتی نماینده (نام، شناسه، اطلاعات تماس)
 * 2. خلاصه مالی (موجودی، بدهی، پرداخت‌ها)
 * 3. فاکتورها FIFO با جزئیات کامل
 * 4. بخش دانلود اپلیکیشن‌ها (Telegram, V2Ray) با QR Code
 * 5. سیستم پیام‌رسانی و اعلانات ادمین
 * 6. راهنمایی و توصیه‌ها
 * 7. نوتیفیکیشن‌های سیستمی
 */

import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { getQueryFn } from "@/lib/queryClient";
import PortalResources from "@/components/PortalResources";

// Lucide Icons
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Info,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  CreditCard,
  Bell,
  HelpCircle,
  User,
  Phone,
  Mail,
  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// ==================== INTERFACES ====================

interface Invoice {
  id: number;
  invoiceNumber: string;
  amount: string;
  remainingAmount?: string;
  issueDate: string;
  dueDate?: string | null;
  status: string;
  usageData?: {
    records?: Array<{
      event_timestamp: string;
      event_type: string;
      description: string;
      admin_username: string;
      amount?: string;
    }>;
    type?: string;
    description?: string;
    createdBy?: string;
    createdAt?: string;
  };
}

interface Payment {
  amount: string;
  paymentDate: string;
  description?: string;
}

interface PortalData {
  name: string;
  code: string;
  panelUsername?: string;
  ownerName?: string;
  totalSales: string;
  totalDebt: string;
  credit: string;
  invoices: Invoice[];
  payments: Payment[];
  financialMeta?: {
    paymentRatio: number;
    debtLevel: string;
    lastCalculation: string;
    accuracyGuaranteed: boolean;
    totalSales?: number;
    actualDebt?: number;
    totalDebt?: number;
  };
  portalConfig?: {
    title?: string;
    description?: string;
  };
}

// ==================== INVOICE CARD COMPONENT ====================

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; bg: string; icon: React.ReactNode }> = {
      paid: { 
        label: 'پرداخت شده', 
        bg: 'linear-gradient(135deg, #059669, #047857)',
        icon: <CheckCircle size={16} />
      },
      partial: { 
        label: 'تسویه جزئی', 
        bg: 'linear-gradient(135deg, #ea580c, #c2410c)',
        icon: <AlertCircle size={16} />
      },
      unpaid: { 
        label: 'پرداخت نشده', 
        bg: 'linear-gradient(135deg, #dc2626, #b91c1c)',
        icon: <XCircle size={16} />
      }
    };

    const statusInfo = statusMap[status] || statusMap.unpaid;

    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: statusInfo.bg,
        color: 'white',
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 'bold'
      }}>
        {statusInfo.icon}
        {statusInfo.label}
      </div>
    );
  };

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #475569, #64748b)', 
      padding: '20px', 
      borderRadius: '12px',
      border: '2px solid #94a3b8',
      boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '15px',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <FileText size={20} color="#3b82f6" />
            <p style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>
              {invoice.invoiceNumber}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', opacity: 0.9 }}>
            <Calendar size={14} />
            <span>تاریخ: {invoice.issueDate}</span>
          </div>
          {invoice.dueDate && (
            <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>
              سررسید: {invoice.dueDate}
            </div>
          )}
        </div>
        
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', marginBottom: '8px' }}>
            {parseFloat(String(invoice.amount || '0')).toLocaleString('fa-IR')} <span style={{ fontSize: '16px' }}>تومان</span>
          </p>
          {getStatusBadge(invoice.status)}
          {invoice.remainingAmount && parseFloat(invoice.remainingAmount) > 0 && (
            <div style={{ 
              fontSize: '12px', 
              marginTop: '8px', 
              padding: '4px 8px', 
              background: 'rgba(239, 68, 68, 0.2)',
              borderRadius: '4px',
              color: '#fca5a5'
            }}>
              مانده: {parseFloat(invoice.remainingAmount).toLocaleString('fa-IR')} تومان
            </div>
          )}
        </div>
      </div>

      {/* Toggle Details Button */}
      {(invoice.usageData && (invoice.usageData.records || invoice.usageData.type === 'manual')) && (
        <button 
          onClick={() => setShowDetails(!showDetails)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            background: showDetails ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'linear-gradient(135deg, #1e40af, #3730a3)',
            color: 'white',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {showDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          {showDetails ? 'پنهان کردن جزئیات' : 
           (invoice.usageData.type === 'manual' ? 'نمایش جزئیات فاکتور' : 'نمایش ریز مصرف')}
        </button>
      )}

      {/* Usage Details */}
      {showDetails && invoice.usageData && (
        <div style={{
          marginTop: '15px',
          padding: '15px',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '8px',
          border: '1px solid rgba(148, 163, 184, 0.3)'
        }}>
          {invoice.usageData.records && (
            <>
              <h5 style={{ 
                fontSize: '15px', 
                fontWeight: 'bold', 
                marginBottom: '12px',
                color: '#93c5fd',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Info size={16} />
                ریز جزئیات مصرف ({invoice.usageData.records.length} رکورد)
              </h5>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {invoice.usageData.records.map((record: any, idx: number) => (
                  <div key={idx} style={{
                    background: 'rgba(51, 65, 85, 0.6)',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(100, 116, 139, 0.4)'
                  }}>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: '12px', 
                      fontSize: '13px' 
                    }}>
                      <div>
                        <p style={{ color: '#e2e8f0', marginBottom: '6px' }}>
                          <strong>نوع:</strong> {record.event_type || 'نامشخص'}
                        </p>
                        <p style={{ color: '#cbd5e1', fontSize: '12px' }}>
                          <strong>زمان:</strong> {record.event_timestamp || '-'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        {record.amount && (
                          <p style={{ color: '#10b981', marginBottom: '6px', fontWeight: 'bold' }}>
                            {parseFloat(record.amount).toLocaleString('fa-IR')} تومان
                          </p>
                        )}
                        <p style={{ color: '#cbd5e1', fontSize: '12px' }}>
                          <strong>کاربر:</strong> {record.admin_username || '-'}
                        </p>
                      </div>
                    </div>
                    {record.description && (
                      <p style={{ 
                        marginTop: '8px', 
                        paddingTop: '8px', 
                        borderTop: '1px solid rgba(148, 163, 184, 0.2)',
                        color: '#94a3b8', 
                        fontSize: '12px',
                        lineHeight: '1.4'
                      }}>
                        {record.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {invoice.usageData.type === 'manual' && (
            <>
              <h5 style={{ 
                fontSize: '15px', 
                fontWeight: 'bold', 
                marginBottom: '12px',
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FileText size={16} />
                فاکتور دستی
              </h5>
              
              <div style={{
                background: 'rgba(217, 119, 6, 0.1)',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid rgba(251, 191, 36, 0.3)'
              }}>
                <div style={{ fontSize: '13px' }}>
                  <p style={{ color: '#e2e8f0', marginBottom: '8px' }}>
                    <strong>ایجاد شده توسط:</strong> {invoice.usageData.createdBy || 'مدیر سیستم'}
                  </p>
                  {invoice.usageData.description && (
                    <p style={{ 
                      color: '#cbd5e1', 
                      marginTop: '10px',
                      paddingTop: '10px',
                      borderTop: '1px solid rgba(251, 191, 36, 0.2)',
                      lineHeight: '1.5'
                    }}>
                      <strong>توضیحات:</strong> {invoice.usageData.description}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== MAIN PORTAL COMPONENT ====================

export default function PublicPortal() {
  const { publicId } = useParams<{ publicId: string }>();

  const { data, isLoading, error } = useQuery<PortalData>({
    queryKey: [`/api/public/portal/${publicId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!publicId,
  });

  // ===== LOADING STATE =====
  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #1e293b, #334155, #475569)', 
        color: 'white', 
        padding: '40px',
        fontFamily: 'Tahoma, sans-serif',
        direction: 'rtl',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            border: '4px solid rgba(59, 130, 246, 0.3)', 
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>در حال بارگذاری پورتال...</h2>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ===== ERROR STATE =====
  if (error || !data) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #7f1d1d, #991b1b)', 
        color: 'white', 
        padding: '40px',
        fontFamily: 'Tahoma, sans-serif',
        direction: 'rtl',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.1)', 
          padding: '40px', 
          borderRadius: '15px',
          maxWidth: '600px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
          <h1 style={{ fontSize: '28px', marginBottom: '20px', fontWeight: 'bold' }}>
            خطا در بارگذاری پورتال!
          </h1>
          <p style={{ fontSize: '16px', marginBottom: '15px', lineHeight: '1.6' }}>
            شناسه پورتال "{publicId}" یافت نشد یا خطایی رخ داده است.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              background: 'linear-gradient(135deg, #1e40af, #3730a3)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            🔄 تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  // ===== CALCULATE FINANCIAL DATA =====
  let totalSales: number, totalDebt: number, credit: number;

  if (data.financialMeta && data.financialMeta.accuracyGuaranteed) {
    totalSales = data.financialMeta.totalSales || parseFloat(String(data.totalSales || '0'));
    totalDebt = data.financialMeta.actualDebt || data.financialMeta.totalDebt || parseFloat(String(data.totalDebt || '0'));
  } else {
    const invoiceSum = data.invoices.reduce((sum, inv) => sum + parseFloat(inv.amount || '0'), 0);
    const paymentSum = data.payments.reduce((sum, pay) => sum + parseFloat(pay.amount || '0'), 0);
    totalSales = invoiceSum || parseFloat(String(data.totalSales || '0'));
    totalDebt = Math.max(0, invoiceSum - paymentSum) || parseFloat(String(data.totalDebt || '0'));
  }

  credit = parseFloat(String(data.credit || '0'));

  // ===== MAIN PORTAL UI =====
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0f172a, #1e293b, #334155)', 
      color: 'white', 
      padding: '20px',
      fontFamily: 'Tahoma, sans-serif',
      direction: 'rtl'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* ===== 1. HEADER - اطلاعات هویتی ===== */}
        <div style={{ 
          background: 'linear-gradient(135deg, #1e40af, #1d4ed8, #2563eb)', 
          padding: '30px', 
          borderRadius: '16px',
          marginBottom: '30px',
          border: '2px solid #3b82f6',
          boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
            <User size={32} color="#dbeafe" />
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>
              پورتال عمومی نماینده
            </h1>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '15px',
            marginTop: '20px'
          }}>
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.1)', 
              padding: '15px', 
              borderRadius: '10px',
              border: '1px solid rgba(219, 234, 254, 0.3)'
            }}>
              <p style={{ fontSize: '13px', color: '#bfdbfe', marginBottom: '6px' }}>نام فروشگاه</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{data.name}</p>
            </div>
            
            {data.code && (
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                padding: '15px', 
                borderRadius: '10px',
                border: '1px solid rgba(219, 234, 254, 0.3)'
              }}>
                <p style={{ fontSize: '13px', color: '#bfdbfe', marginBottom: '6px' }}>کد نماینده</p>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', fontFamily: 'monospace' }}>{data.code}</p>
              </div>
            )}

            {data.panelUsername && (
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                padding: '15px', 
                borderRadius: '10px',
                border: '1px solid rgba(219, 234, 254, 0.3)'
              }}>
                <p style={{ fontSize: '13px', color: '#bfdbfe', marginBottom: '6px' }}>شناسه پنل</p>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{data.panelUsername}</p>
              </div>
            )}

            {data.ownerName && (
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                padding: '15px', 
                borderRadius: '10px',
                border: '1px solid rgba(219, 234, 254, 0.3)'
              }}>
                <p style={{ fontSize: '13px', color: '#bfdbfe', marginBottom: '6px' }}>نام مالک</p>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{data.ownerName}</p>
              </div>
            )}
          </div>

          {data.financialMeta?.accuracyGuaranteed && (
            <div style={{ 
              marginTop: '20px', 
              padding: '12px 16px', 
              background: 'rgba(16, 185, 129, 0.15)',
              borderRadius: '8px',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              display: 'inline-block'
            }}>
              <p style={{ fontSize: '13px', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} />
                داده‌های مالی با دقت Real-time محاسبه شده
                {data.financialMeta.lastCalculation && (
                  <span style={{ opacity: 0.8 }}>
                    ({new Date(data.financialMeta.lastCalculation).toLocaleString('fa-IR')})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* ===== 2. FINANCIAL SUMMARY - خلاصه مالی ===== */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <DollarSign size={28} color="#10b981" />
            موجودی مالی و وضعیت حساب
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '20px' 
          }}>
            {/* Total Debt */}
            <div style={{ 
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)', 
              padding: '24px', 
              borderRadius: '12px',
              border: '2px solid #ef4444',
              boxShadow: '0 4px 6px rgba(220, 38, 38, 0.3)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0.2 }}>
                <TrendingDown size={60} />
              </div>
              <p style={{ fontSize: '15px', marginBottom: '12px', opacity: 0.9 }}>بدهی کل</p>
              <p style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px', zIndex: 1, position: 'relative' }}>
                {totalDebt.toLocaleString('fa-IR')}
              </p>
              <p style={{ fontSize: '14px', opacity: 0.8 }}>تومان</p>
            </div>

            {/* Total Sales */}
            <div style={{ 
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', 
              padding: '24px', 
              borderRadius: '12px',
              border: '2px solid #3b82f6',
              boxShadow: '0 4px 6px rgba(37, 99, 235, 0.3)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0.2 }}>
                <TrendingUp size={60} />
              </div>
              <p style={{ fontSize: '15px', marginBottom: '12px', opacity: 0.9 }}>فروش کل</p>
              <p style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px', zIndex: 1, position: 'relative' }}>
                {totalSales.toLocaleString('fa-IR')}
              </p>
              <p style={{ fontSize: '14px', opacity: 0.8 }}>تومان</p>
            </div>

            {/* Credit */}
            {credit > 0 && (
              <div style={{ 
                background: 'linear-gradient(135deg, #059669, #047857)', 
                padding: '24px', 
                borderRadius: '12px',
                border: '2px solid #10b981',
                boxShadow: '0 4px 6px rgba(5, 150, 105, 0.3)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0.2 }}>
                  <CreditCard size={60} />
                </div>
                <p style={{ fontSize: '15px', marginBottom: '12px', opacity: 0.9 }}>اعتبار</p>
                <p style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px', zIndex: 1, position: 'relative' }}>
                  {credit.toLocaleString('fa-IR')}
                </p>
                <p style={{ fontSize: '14px', opacity: 0.8 }}>تومان</p>
              </div>
            )}

            {/* Payment Ratio */}
            {data.financialMeta?.paymentRatio !== undefined && (
              <div style={{ 
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', 
                padding: '24px', 
                borderRadius: '12px',
                border: '2px solid #8b5cf6',
                boxShadow: '0 4px 6px rgba(124, 58, 237, 0.3)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0.2 }}>
                  <CheckCircle size={60} />
                </div>
                <p style={{ fontSize: '15px', marginBottom: '12px', opacity: 0.9 }}>نسبت پرداخت</p>
                <p style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px', zIndex: 1, position: 'relative' }}>
                  {Math.round(data.financialMeta.paymentRatio * 100)}%
                </p>
                <p style={{ fontSize: '14px', opacity: 0.8 }}>
                  {data.financialMeta.debtLevel || 'عادی'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ===== 3. INVOICES - فاکتورها FIFO ===== */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <FileText size={28} color="#3b82f6" />
            فاکتورها (قدیمی‌ترین ابتدا - FIFO)
          </h3>
          
          <div style={{ 
            background: 'rgba(51, 65, 85, 0.4)', 
            padding: '24px', 
            borderRadius: '12px',
            border: '2px solid #475569'
          }}>
            {data.invoices && data.invoices.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {data.invoices.map((invoice: Invoice) => (
                  <InvoiceCard key={invoice.id} invoice={invoice} />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Info size={48} color="#64748b" style={{ marginBottom: '16px' }} />
                <p style={{ fontSize: '18px', opacity: 0.7 }}>فاکتوری یافت نشد</p>
              </div>
            )}
          </div>
        </div>

        {/* ===== 4. PAYMENTS - تاریخچه پرداخت‌ها ===== */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <CreditCard size={28} color="#10b981" />
            تاریخچه پرداخت‌ها ({data.payments.length} پرداخت)
          </h3>
          
          <div style={{ 
            background: 'rgba(51, 65, 85, 0.4)', 
            padding: '24px', 
            borderRadius: '12px',
            border: '2px solid #475569'
          }}>
            {data.payments && data.payments.length > 0 ? (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '15px' 
              }}>
                {data.payments.map((payment: Payment, index: number) => (
                  <div key={index} style={{ 
                    background: 'linear-gradient(135deg, #059669, #047857)', 
                    padding: '18px', 
                    borderRadius: '10px',
                    border: '2px solid #10b981',
                    boxShadow: '0 4px 6px rgba(5, 150, 105, 0.2)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <CheckCircle size={20} />
                      <p style={{ fontSize: '20px', fontWeight: 'bold' }}>
                        {parseFloat(payment.amount).toLocaleString('fa-IR')} تومان
                      </p>
                    </div>
                    <div style={{ fontSize: '14px', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} />
                      <span>تاریخ: {payment.paymentDate}</span>
                    </div>
                    {payment.description && (
                      <p style={{ fontSize: '13px', opacity: 0.8, marginTop: '8px', lineHeight: '1.4' }}>
                        {payment.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Info size={48} color="#64748b" style={{ marginBottom: '16px' }} />
                <p style={{ fontSize: '18px', opacity: 0.7 }}>پرداختی یافت نشد</p>
              </div>
            )}
          </div>
        </div>

        {/* ===== 5. DOWNLOADS & ANNOUNCEMENTS - دانلود اپ‌ها و اعلانات ===== */}
        {publicId && (
          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Bell size={28} color="#f59e0b" />
              اعلانات و دانلودها
            </h3>
            <PortalResources publicId={publicId} />
          </div>
        )}

        {/* ===== 6. HELP & GUIDANCE - راهنمایی ===== */}
        <div style={{ 
          background: 'linear-gradient(135deg, #0f766e, #0d9488)', 
          padding: '24px', 
          borderRadius: '12px',
          border: '2px solid #14b8a6',
          marginBottom: '40px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <HelpCircle size={28} />
            <h3 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>راهنمایی و توصیه‌ها</h3>
          </div>
          
          <div style={{ fontSize: '15px', lineHeight: '1.8', opacity: 0.95 }}>
            <p style={{ marginBottom: '12px' }}>
              • برای مشاهده جزئیات هر فاکتور، روی دکمه "نمایش جزئیات" کلیک کنید.
            </p>
            <p style={{ marginBottom: '12px' }}>
              • اعلانات مهم سیستم در بخش "اعلانات و دانلودها" نمایش داده می‌شود.
            </p>
            <p style={{ marginBottom: '12px' }}>
              • برای دانلود اپلیکیشن‌های توصیه شده، از بخش دانلودها استفاده کنید.
            </p>
            <p>
              • در صورت وجود هرگونه سوال یا مشکل، با پشتیبانی تماس بگیرید.
            </p>
          </div>
        </div>

        {/* ===== 7. FOOTER - اطلاعات تماس ===== */}
        <div style={{ 
          background: 'rgba(15, 23, 42, 0.6)', 
          padding: '24px', 
          borderRadius: '12px',
          border: '1px solid rgba(71, 85, 105, 0.5)',
          textAlign: 'center'
        }}>
          <h4 style={{ fontSize: '18px', marginBottom: '16px', fontWeight: 'bold' }}>اطلاعات تماس و پشتیبانی</h4>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            flexWrap: 'wrap',
            gap: '24px',
            fontSize: '14px',
            opacity: 0.9
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Phone size={16} />
              <span>۰۲۱-۱۲۳۴۵۶۷۸</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={16} />
              <span>support@example.com</span>
            </div>
          </div>
          
          <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '16px' }}>
            ساعات پاسخگویی: شنبه تا چهارشنبه، ۹ صبح تا ۶ عصر
          </p>
        </div>
      </div>
    </div>
  );
}
