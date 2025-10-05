import React from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/unified-auth-context';
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Bell,
  Download,
  LayoutTemplate,
  Settings,
  FileCog,
  ShieldCheck,
  Activity,
} from 'lucide-react';

interface SidebarLinkProps {
  to: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ to, children, icon }) => {
  const [location] = useLocation();
  const isActive = location === to || (to !== '/' && location.startsWith(to));

  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50',
        isActive && 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50'
      )}
    >
      {icon}
      {children}
    </Link>
  );
};

const Sidebar: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="hidden border-r bg-gray-100/40 lg:block dark:bg-gray-800/40">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-[60px] items-center border-b px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <FileCog className="h-6 w-6" />
            <span>MarFaNet Panel</span>
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-4 text-sm font-medium">
            <SidebarLink to="/dashboard" icon={<LayoutDashboard className="w-5 h-5" />}>
              داشبورد
            </SidebarLink>
            <SidebarLink to="/representatives" icon={<Users className="w-5 h-5" />}>
              نمایندگان
            </SidebarLink>
            <SidebarLink to="/invoices" icon={<FileText className="w-5 h-5" />}>
              مدیریت فاکتورها
            </SidebarLink>
            <SidebarLink to="/payments" icon={<CreditCard className="w-5 h-5" />}>
              مدیریت پرداخت‌ها
            </SidebarLink>
            <SidebarLink to="/sales-partners" icon={<Users className="w-5 h-5" />}>
              همکاران فروش
            </SidebarLink>
            
            {user?.role === 'SUPERADMIN' && (
              <>
                <hr className="my-2" />
                <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</h3>
                <SidebarLink to="/admin/portal-content" icon={<LayoutTemplate className="w-5 h-5" />}>
                  مدیریت پرتال
                </SidebarLink>
                <SidebarLink to="/admin/system-settings" icon={<Settings className="w-5 h-5" />}>
                  تنظیمات سیستم
                </SidebarLink>
              </>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;