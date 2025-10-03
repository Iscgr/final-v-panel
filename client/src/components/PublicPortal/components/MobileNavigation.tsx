import React from 'react';
import './MobileNavigation.css';
import { Home, Download, FileText, Bell, DollarSign, CreditCard } from 'react-feather';

interface MobileNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  notificationCount: number;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ activeTab, setActiveTab, notificationCount }) => {
  const navigationItems = [
    { id: 'dashboard', label: 'داشبورد', icon: <Home size={20} /> },
    { id: 'downloads', label: 'دانلودها', icon: <Download size={20} /> },
    { id: 'invoices', label: 'فاکتورها', icon: <FileText size={20} /> },
    { id: 'payments', label: 'پرداخت‌ها', icon: <DollarSign size={20} /> },
    { 
      id: 'notifications', 
      label: 'پیام‌ها', 
      icon: <Bell size={20} />,
      badge: notificationCount > 0 ? notificationCount : null 
    },
    { id: 'financial', label: 'مالی', icon: <CreditCard size={20} /> }
  ];

  return (
    <>
      {/* منوی اصلی برای نمایشگرهای بزرگتر */}
      <div className="desktop-navigation">
        <nav className="main-navigation">
          <ul>
            {navigationItems.map(item => (
              <li key={item.id}>
                <button
                  className={activeTab === item.id ? 'active' : ''}
                  onClick={() => setActiveTab(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && <span className="notification-badge">{item.badge}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      
      {/* منوی برای موبایل */}
      <div className="mobile-navigation">
        <nav className="mobile-nav-bar">
          <ul>
            {navigationItems.map(item => (
              <li key={item.id}>
                <button
                  className={activeTab === item.id ? 'active' : ''}
                  onClick={() => setActiveTab(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && <span className="notification-badge">{item.badge}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
};

export default MobileNavigation;
