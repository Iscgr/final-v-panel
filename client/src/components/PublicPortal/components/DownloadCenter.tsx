import React from 'react';
import './DownloadCenter.css';
import { Download, ExternalLink } from 'react-feather';

interface DownloadCenterProps {
  applications: Array<{
    id: string;
    name: string;
    description: string;
    qrCode: string;
    directLink: string;
  }>;
}

const DownloadCenter: React.FC<DownloadCenterProps> = ({ applications }) => {
  return (
    <div className="download-center">
      <div className="section-header">
        <h2>دانلود اپلیکیشن‌های توصیه شده</h2>
        <p>برای تجربه بهتر، اپلیکیشن‌های زیر را نصب کنید</p>
      </div>

      <div className="app-grid">
        {applications.map(app => (
          <div className="app-card" key={app.id}>
            <div className="app-info">
              <h3>{app.name}</h3>
              <p>{app.description}</p>
            </div>
            
            <div className="qr-container">
              <img src={app.qrCode} alt={`QR کد دانلود ${app.name}`} className="qr-code" />
              <p className="qr-hint">اسکن کنید</p>
            </div>
            
            <div className="app-actions">
              <a href={app.directLink} className="download-button" target="_blank" rel="noopener noreferrer">
                <Download size={16} />
                <span>دانلود مستقیم</span>
              </a>
              
              <button className="link-button">
                <ExternalLink size={16} />
                <span>دانلود با لینک</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="download-help">
        <h4>نیاز به راهنمایی دارید؟</h4>
        <p>برای دریافت راهنمای نصب و پیکربندی اپلیکیشن‌ها، با پشتیبانی تماس بگیرید.</p>
      </div>
    </div>
  );
};

export default DownloadCenter;
