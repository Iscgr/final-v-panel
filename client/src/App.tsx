import { Switch, Route, useLocation, Router } from "wouter";
import { useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UnifiedAuthProvider, useUnifiedAuth } from "@/contexts/unified-auth-context";
import { SidebarProvider, useSidebar } from "@/contexts/sidebar-context";
import { useMobileOptimizations } from "@/hooks/use-mobile-optimizations";

// Layout components
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

// Pages (Lazy Loaded)
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Invoices = lazy(() => import("@/pages/invoices"));
const InvoiceManagement = lazy(() => import("@/pages/InvoiceManagement"));
const Representatives = lazy(() => import("@/pages/representatives"));
const RepresentativeProfile = lazy(() => import("@/pages/representative-profile"));
const SalesPartners = lazy(() => import("@/pages/sales-partners"));
const Settings = lazy(() => import("@/pages/settings"));
const PublicPortal = lazy(() => import("@/pages/portal"));
const AdminLogin = lazy(() => import("@/pages/admin-login"));
const NotFound = lazy(() => import("@/pages/not-found"));
const UnifiedAuth = lazy(() => import("@/pages/unified-auth"));
// ❌ [ODIN v5.0] AllocationManagement removed - auto-allocation feature removed
const KpiDashboard = lazy(() => import("@/pages/kpi-dashboard"));

// Admin Resources Management Pages
const AppDownloadsManager = lazy(() => import("@/pages/admin/AppDownloadsManager"));
const AnnouncementsManager = lazy(() => import("@/pages/admin/AnnouncementsManager"));
const PortalContentManager = lazy(() => import("@/pages/admin/PortalContentManager"));

// Error boundary component

// System
import ErrorBoundary from "@/components/system/ErrorBoundary";

function AuthenticatedRouter() {
  const { isAuthenticated: adminAuthenticated, isLoading: adminIsLoading, user: adminUser } = useUnifiedAuth(); // Use unified auth hook
  const [location] = useLocation();

  const isPublicPortal = /^\/portal\/[^\/]+\/?$|^\/representative\/[^\/]+\/?$/.test(location);

  if (isPublicPortal) {
    return (
      <div className="dark public-portal-isolated">
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">در حال بارگذاری پورتال...</div>}>
          <Switch>
            <Route path="/portal/:publicId" component={PublicPortal} />
            <Route path="/representative/:publicId" component={PublicPortal} />
            <Route path="/portal/*">
              {() => (
                <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-red-400 text-6xl mb-4">⚠</div>
                    <h1 className="text-2xl font-bold mb-2">پورتال یافت نشد</h1>
                    <p className="text-gray-400">لینک پورتال نامعتبر است. لطفاً لینک صحیح را از مدیر سیستم دریافت کنید.</p>
                  </div>
                </div>
              )}
            </Route>
            <Route path="/representative/*">
              {() => (
                <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-red-400 text-6xl mb-4">⚠</div>
                    <h1 className="text-2xl font-bold mb-2">پورتال یافت نشد</h1>
                    <p className="text-gray-400">لینک پورتال نامعتبر است. لطفاً لینک صحیح را از مدیر سیستم دریافت کنید.</p>
                  </div>
                </div>
              )}
            </Route>
          </Switch>
        </Suspense>
      </div>
    );
  }

  if (adminIsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">در حال بررسی احراز هویت...</p>
        </div>
      </div>
    );
  }

  if (!adminAuthenticated) {
    if (location === "/admin-login") {
      return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">...</div>}>
          <AdminLogin onLoginSuccess={() => {}} />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">در حال بارگذاری...</div>}>
        <UnifiedAuth />
      </Suspense>
    );
  }

  return (
    <AdminLayout>
      <ErrorBoundary>
        <Suspense fallback={<div className="p-8 text-center">در حال بارگذاری صفحه...</div>}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/kpi-dashboard" component={KpiDashboard} />
            <Route path="/representatives" component={Representatives} />
            <Route path="/representatives/:code" component={RepresentativeProfile} />
            <Route path="/invoices" component={Invoices} />
            <Route path="/invoice-management" component={InvoiceManagement} />
            <Route path="/sales-partners" component={SalesPartners} />
            <Route path="/admin/app-downloads" component={AppDownloadsManager} />
            <Route path="/admin/announcements" component={AnnouncementsManager} />
            <Route path="/admin/portal-content" component={PortalContentManager} />
            <Route path="/settings" component={Settings} />
            <Route path="/admin-login">
              <AdminLogin onLoginSuccess={() => { console.log('Admin login successful'); }} />
            </Route>
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </ErrorBoundary>
    </AdminLayout>
  );
}

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isExpanded, isMobileOpen, toggleSidebar, openMobileSidebar, closeMobileSidebar } = useSidebar();
  const { isMobile } = useMobileOptimizations();

  // Mobile: use drawer-style sidebar
  // Desktop: use fixed sidebar with dynamic width
  const mainContentMarginClass = isMobile 
    ? 'mr-0' // No margin on mobile
    : isExpanded 
      ? 'lg:mr-80' // Full sidebar width when expanded
      : 'lg:mr-20'; // Collapsed sidebar width

  return (
    <div className="admin-panel-background dark">
      <Sidebar />
      <div className={`main-content ${mainContentMarginClass} transition-[margin] duration-300 relative z-10`}>
        {/* Header now uses useSidebar hook internally, no need for props */}
        <Header />
        <main className="p-4 lg:p-6 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  const { isMobile } = useMobileOptimizations();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UnifiedAuthProvider>
          <SidebarProvider>
            <Router>
              <div className={`min-h-screen bg-background ${isMobile ? 'mobile-optimized' : ''}`}>
                <ErrorBoundary>
                  <AuthenticatedRouter />
                </ErrorBoundary>
                <Toaster />
              </div>
            </Router>
          </SidebarProvider>
        </UnifiedAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;