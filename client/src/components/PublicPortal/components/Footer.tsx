import React from 'react';
import './Footer.css';

interface FooterProps {
  supportInfo: {
    contactNumber: string;
    email: string;
    supportHours: string;
  };
}

const Footer: React.FC<FooterProps> = ({ supportInfo }) => {
  return (
    <footer className="portal-footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>پشتیبانی</h3>
          <p>شماره تماس: {supportInfo.contactNumber}</p>
          <p>ایمیل: {supportInfo.email}</p>
        </div>
        
        <div className="footer-section">
          <h3>ساعات پاسخگویی</h3>
          <p>{supportInfo.supportHours}</p>
        </div>
        
        <div className="footer-section">
          <h3>راهنما</h3>
          <p>برای دریافت راهنمای استفاده از پورتال، با پشتیبانی تماس بگیرید.</p>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} - تمامی حقوق محفوظ است</p>
      </div>
    </footer>
  );
};

export default Footer;
