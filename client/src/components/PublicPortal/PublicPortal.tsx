import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './PublicPortal.css';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import NotificationCenter from './components/NotificationCenter';
import DownloadCenter from './components/DownloadCenter';
import InvoiceList from './components/InvoiceList';
import PaymentList from './components/PaymentList';
import FinancialPanel from './components/FinancialPanel';
import MobileNavigation from './components/MobileNavigation';
import Footer from './components/Footer';
import SkeletonLoader from './components/SkeletonLoader';

interface PortalData {
  name: string;
  code: string;
  totalDebt: string;
  totalSales: string;
  credit: string;
  portalConfig: {
    title: string;
    description: string;
  };
  invoices: Array<{
    id: number;
    invoiceNumber: string;
    amount: string;
    remainingAmount: string;
    issueDate: string;
    dueDate: string | null;
    status: string;
    usageData: any;
  }>;
  payments: Array<{
    amount: string;
    paymentDate: string;
    description: string;
  }>;
  financialMeta: {
    paymentRatio: number;
    debtLevel: string;
    lastCalculation: string;
    accuracyGuaranteed: boolean;
  };
}

interface ResourcesData {
  appDownloads: Array<{
    id: number;
    name: string;
    description: string;
    platform: string;
    version: string;
    qrCodePath: string | null;
    downloadUrl: string;
    iconPath: string | null;
  }>;
  announcements: Array<{
    id: number;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
    priority: number;
    createdAt: string;
    expiresAt: string | null;
  }>;
}

const PublicPortal: React.FC = () => {
  const { publicId } = useParams<{ publicId: string }>();
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [resources, setResources] = useState<ResourcesData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const fetchPortalData = async () => {
      try {
        setLoading(true);
        
        // Fetch main portal data
        const portalResponse = await fetch(`/api/public/portal/${publicId}`);
        if (!portalResponse.ok) {
          throw new Error('خطا در دریافت اطلاعات پورتال');
        }
        const portalJson = await portalResponse.json();
        setPortalData(portalJson);

        // Fetch resources (apps and announcements)
        const resourcesResponse = await fetch(`/api/portal/${publicId}/resources`);
        if (resourcesResponse.ok) {
          const resourcesJson = await resourcesResponse.json();
          if (resourcesJson.success && resourcesJson.data) {
            setResources(resourcesJson.data);
          }
        }
      } catch (error) {
        console.error('خطای دریافت اطلاعات پورتال:', error);
      } finally {
        setLoading(false);
      }
    };

    if (publicId) {
      fetchPortalData();
    }
  }, [publicId]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  if (loading) {
    return <SkeletonLoader />;
  }

  if (!portalData) {
    return (
      <div className="portal-error">
        <h2>خطا در بارگذاری اطلاعات</h2>
        <p>متأسفانه اطلاعات پورتال در دسترس نیست. لطفاً دوباره تلاش کنید.</p>
        <button onClick={() => window.location.reload()}>تلاش مجدد</button>
      </div>
    );
  }

  return (
    <div className={`portal-container ${theme}`} dir="rtl">
      <Header 
        shopInfo={portalData.shopInfo}
        toggleTheme={toggleTheme}
        theme={theme}
      />
      
      <MobileNavigation 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        notificationCount={portalData.notifications.filter(n => !n.isRead).length}
      />
      
      <main className="portal-main">
        {activeTab === 'dashboard' && (
          <Dashboard financialData={portalData.financialData} />
        )}
        
        {activeTab === 'notifications' && (
          <NotificationCenter notifications={portalData.notifications} />
        )}
        
        {activeTab === 'downloads' && (
          <DownloadCenter applications={portalData.recommendedApps} />
        )}
        
        {activeTab === 'invoices' && (
          <InvoiceList invoices={portalData.invoices} />
        )}
        
        {activeTab === 'payments' && (
          <PaymentList payments={portalData.payments} />
        )}
        
        {activeTab === 'financial' && (
          <FinancialPanel 
            financial={portalData.financialData}
            recentInvoices={portalData.invoices.slice(0, 3)}
            recentPayments={portalData.payments.slice(0, 3)}
          />
        )}
      </main>
      
      <Footer supportInfo={portalData.supportInfo} />
    </div>
  );
};

export default PublicPortal;