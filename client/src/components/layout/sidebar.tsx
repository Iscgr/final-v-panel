import { Link, useLocation } from "wouter";
import { 
  BarChart3, 
  Users, 
  FileText, 
  Handshake, 
  Settings, 
  Shield,
  LogOut,
  Menu,
  X,
  Edit,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useUnifiedAuth } from "@/contexts/unified-auth-context";
import { useSidebar } from "@/contexts/sidebar-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navigation = [
  { name: "داشبورد", href: "/dashboard", icon: BarChart3 },
  { name: "KPI مالی", href: "/kpi-dashboard", icon: BarChart3 },
  { name: "نمایندگان", href: "/representatives", icon: Users },
  { name: "فاکتورها", href: "/invoices", icon: FileText },
  { name: "مدیریت فاکتورها", href: "/invoice-management", icon: Edit },
  { name: "همکاران فروش", href: "/sales-partners", icon: Handshake },
  { name: "تنظیمات", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { logout } = useUnifiedAuth();
  const { isExpanded, isMobileOpen, toggleSidebar, closeMobileSidebar } = useSidebar();

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/login";
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  const isCollapsed = !isExpanded; // For easier conditional rendering

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "admin-sidebar fixed right-0 top-0 h-screen z-50 transform transition-all duration-300 ease-in-out",
        "lg:translate-x-0",
        isMobileOpen ? "translate-x-0" : "translate-x-full",
        isCollapsed ? "w-20" : "w-80"
      )}>
        {/* Logo Section */}
        <div className={cn(
          "p-6 border-b border-white/10 transition-all duration-300",
          isCollapsed && "p-4"
        )}>
          <div className="flex items-center justify-between">
            <div className={cn(
              "flex items-center space-x-3 space-x-reverse transition-all duration-300",
              isCollapsed && "justify-center w-full space-x-0"
            )}>
              <div className={cn(
                "bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300",
                isCollapsed ? "w-10 h-10" : "w-12 h-12"
              )}>
                <Shield className={cn(
                  "text-white transition-all duration-300",
                  isCollapsed ? "w-5 h-5" : "w-6 h-6"
                )} />
              </div>
              {!isCollapsed && (
                <div className="transition-opacity duration-300">
                  <h1 className="text-xl font-bold text-white mb-1">MarFaNet</h1>
                  <p className="text-sm text-blue-200">سیستم مدیریت مالی</p>
                </div>
              )}
            </div>
            
            {/* Close button for mobile */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-white hover:bg-white/10"
              onClick={closeMobileSidebar}
              aria-label="بستن منوی ناوبری"
              title="بستن منوی ناوبری"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </Button>
          </div>
          
          {/* Desktop Collapse Toggle */}
          <div className="hidden lg:block">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "absolute -left-3 top-20 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-1.5 shadow-lg transition-all duration-300 z-50",
                isCollapsed && "left-1/2 -translate-x-1/2"
              )}
              onClick={toggleSidebar}
              aria-label={isCollapsed ? "باز کردن منو" : "بستن منو"}
              title={isCollapsed ? "باز کردن منو" : "بستن منو"}
            >
              {isCollapsed ? (
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className={cn(
          "mt-6 flex-1 transition-all duration-300",
          isCollapsed ? "px-2" : "px-4"
        )} aria-label="منوی اصلی ناوبری">
          <div className={cn(
            "flex flex-col transition-all duration-300",
            isCollapsed ? "gap-3" : "gap-2"
          )}>
            {navigation.map((item) => {
              const isActive = location === item.href || 
                             (item.href === "/dashboard" && location === "/");
              
              const navItem = (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-label={`رفتن به صفحه ${item.name}`}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "admin-nav-item flex items-center text-sm font-medium rounded-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent relative",
                    isCollapsed ? "justify-center p-3 w-full" : "px-4 py-3",
                    isActive
                      ? "active text-white bg-white/10"
                      : "text-blue-100 hover:text-white hover:bg-white/5"
                  )}
                >
                  {/* Active indicator - به جای نوار بیرون‌زده، یک dot کوچک */}
                  {isActive && isCollapsed && (
                    <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full" aria-hidden="true" />
                  )}
                  {isActive && !isCollapsed && (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-400 rounded-l-full" aria-hidden="true" />
                  )}
                  
                  <item.icon className={cn(
                    "w-5 h-5 flex-shrink-0 transition-all duration-300",
                    isCollapsed ? "ml-0" : "ml-3"
                  )} aria-hidden="true" />
                  
                  {!isCollapsed && (
                    <span className="transition-opacity duration-300">{item.name}</span>
                  )}
                </Link>
              );

              // در حالت collapsed، آیکون را با Tooltip wrap می‌کنیم
              if (isCollapsed) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      {navItem}
                    </TooltipTrigger>
                    <TooltipContent side="left" className="bg-gray-900 text-white border-gray-700">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return navItem;
            })}
          </div>
        </nav>

        {/* User Profile Section */}
        <div className={cn(
          "absolute bottom-0 right-0 left-0 p-4 border-t border-white/10 transition-all duration-300",
          isCollapsed && "p-2"
        )}>
          <div className={cn(
            "admin-glass-card transition-all duration-300",
            isCollapsed ? "p-2" : "p-4"
          )}>
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="w-full flex justify-center text-blue-200 hover:text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-md p-2"
                    onClick={handleLogout}
                    aria-label="خروج از سیستم"
                    title="خروج از سیستم"
                  >
                    <LogOut className="w-5 h-5" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="bg-gray-900 text-white border-gray-700">
                  خروج از سیستم
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">حسابدار اصلی</p>
                  <p className="text-xs text-blue-200">admin@marfanet.com</p>
                </div>
                <button 
                  className="text-blue-200 hover:text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-md p-1"
                  onClick={handleLogout}
                  aria-label="خروج از سیستم"
                  title="خروج از سیستم"
                >
                  <LogOut className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
