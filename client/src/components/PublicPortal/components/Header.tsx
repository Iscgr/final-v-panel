import React from 'react';
import './Header.css';
import { Moon, Sun, Menu } from 'react-feather';

interface HeaderProps {
  shopInfo: {
    name: string;
    publicId: string;
    contactInfo: string;
  };
  toggleTheme: () => void;
  theme: 'light' | 'dark';
}

const Header: React.FC<HeaderProps> = ({ shopInfo, toggleTheme, theme }) => {
  return (
    <header className="portal-header">
      <div className="header-content">
        <div className="shop-info">
          <h1>{shopInfo.name}</h1>
          <div className="shop-details">
            <span className="shop-id">شناسه پنل: {shopInfo.publicId}</span>
            <span className="shop-contact">{shopInfo.contactInfo}</span>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            className="theme-toggle" 
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'فعال‌سازی حالت تاریک' : 'فعال‌سازی حالت روشن'}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </div>
      
      <div className="portal-title">
        <h2>پرتال عمومی نماینده</h2>
      </div>
    </header>
  );
};

export default Header;
