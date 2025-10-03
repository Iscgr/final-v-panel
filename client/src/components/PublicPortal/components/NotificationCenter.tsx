import React, { useState } from 'react';
import './NotificationCenter.css';
import { Bell, AlertCircle, CheckCircle, Info, AlertTriangle } from 'react-feather';

interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
  isRead: boolean;
  type: 'info' | 'warning' | 'error' | 'success';
}

interface NotificationCenterProps {
  notifications: Notification[];
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications }) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [readStatuses, setReadStatuses] = useState<Record<string, boolean>>(
    notifications.reduce((acc, notification) => ({
      ...acc,
      [notification.id]: notification.isRead
    }), {})
  );

  // تبدیل تاریخ به فرمت فارسی
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // فیلتر اعلان‌ها
  const getFilteredNotifications = () => {
    if (activeFilter === 'all') {
      return notifications;
    } else if (activeFilter === 'unread') {
      return notifications.filter(n => !readStatuses[n.id]);
    } else {
      return notifications.filter(n => n.type === activeFilter);
    }
  };

  // تغییر وضعیت خوانده شدن اعلان
  const toggleReadStatus = (id: string) => {
    setReadStatuses(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // آیکون مناسب برای هر نوع اعلان
  const getNotificationIcon = (type: string) => {
    switch(type) {
      case 'info': return <Info size={18} />;
      case 'warning': return <AlertTriangle size={18} />;
      case 'error': return <AlertCircle size={18} />;
      case 'success': return <CheckCircle size={18} />;
      default: return <Bell size={18} />;
    }
  };

  // تعداد اعلان‌های نخوانده
  const unreadCount = Object.values(readStatuses).filter(status => !status).length;

  return (
    <div className="notification-center">
      <div className="notification-header">
        <div className="notification-title">
          <h2>پیام‌ها و اعلانات</h2>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount} پیام جدید</span>
          )}
        </div>
        
        <div className="notification-filters">
          <button 
            className={activeFilter === 'all' ? 'active' : ''}
            onClick={() => setActiveFilter('all')}
          >
            همه
          </button>
          <button 
            className={activeFilter === 'unread' ? 'active' : ''}
            onClick={() => setActiveFilter('unread')}
          >
            نخوانده
          </button>
          <button 
            className={activeFilter === 'info' ? 'active' : ''}
            onClick={() => setActiveFilter('info')}
          >
            اطلاعات
          </button>
          <button 
            className={activeFilter === 'warning' ? 'active' : ''}
            onClick={() => setActiveFilter('warning')}
          >
            هشدار
          </button>
        </div>
      </div>

      <div className="notifications-list">
        {getFilteredNotifications().length > 0 ? (
          getFilteredNotifications().map(notification => (
            <div 
              key={notification.id} 
              className={`notification-item ${notification.type} ${!readStatuses[notification.id] ? 'unread' : ''}`}
              onClick={() => toggleReadStatus(notification.id)}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="notification-content">
                <div className="notification-header">
                  <h3>{notification.title}</h3>
                  <span className="notification-date">{formatDate(notification.date)}</span>
                </div>
                <p className="notification-message">{notification.message}</p>
              </div>
              {!readStatuses[notification.id] && (
                <div className="unread-indicator"></div>
              )}
            </div>
          ))
        ) : (
          <div className="empty-notifications">
            <Bell size={40} />
            <p>پیامی برای نمایش وجود ندارد.</p>
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="notification-actions">
          <button 
            className="mark-all-read"
            onClick={() => {
              const allRead = Object.keys(readStatuses).reduce((acc, key) => ({
                ...acc,
                [key]: true
              }), {});
              setReadStatuses(allRead);
            }}
          >
            علامت‌گذاری همه به عنوان خوانده شده
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
