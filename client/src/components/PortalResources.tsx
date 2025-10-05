/**
 * کامپوننت نمایش منابع (اپلیکیشن‌ها و اطلاعیه‌ها) در پرتال عمومی
 */
import React from 'react';
import { Download, Play, Copy, Check, AlertCircle, Info, CheckCircle, XCircle } from 'lucide-react';

interface AppDownload {
  id: number;
  title: string;
  description?: string;
  downloadLink: string;
  qrCodeUrl?: string;
  videoUrl?: string;
  displayOrder: number;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  priority: number;
}

interface PortalResourcesProps {
  publicId: string;
  downloadsIntro?: string;
}

interface UnifiedPublishedDoc {
  displayTitle: string;
  sections: { id: string; title: string; body: string; order: number }[];
  announcements: { id: string; title: string; content: string; priority: number; type: 'info'|'warning'|'success'|'error'; isActive?: boolean }[];
  downloads: { id: string; title: string; description?: string; downloadLink: string; qrCodeUrl?: string|null; videoUrl?: string|null; isActive?: boolean; displayOrder: number }[];
  metadata?: Record<string, any>;
}

export default function PortalResources({ publicId, downloadsIntro }: PortalResourcesProps) {
  const [resources, setResources] = React.useState<{
    appDownloads: AppDownload[];
    announcements: Announcement[];
  } | null>(null);
  const [unifiedDoc, setUnifiedDoc] = React.useState<UnifiedPublishedDoc | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [copiedLinks, setCopiedLinks] = React.useState<{ [key: number]: boolean }>({});
  const [sourceMode, setSourceMode] = React.useState<'legacy' | 'unified' | null>(null);

  // تابع برای ثبت بازدید
  const trackView = React.useCallback(async (appId: number, actionType: 'view' | 'download' | 'qr_scan' | 'video_play') => {
    try {
      await fetch(`/api/portal/track-view/${appId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId, actionType })
      });
    } catch (error) {
      console.error(`خطا در ثبت بازدید (${actionType}):`, error);
    }
  }, [publicId]);

  React.useEffect(() => {
    const fetchResources = async () => {
      try {
        const res = await fetch(`/api/portal/${publicId}/resources`);
        const json = await res.json();
        if (json.success) {
          if (json.data?.source === 'unified') {
            setSourceMode('unified');
            setUnifiedDoc(json.data.unified);
          } else {
            setSourceMode('legacy');
            setResources(json.data);
            if (json.data?.appDownloads) {
              json.data.appDownloads.forEach((app: AppDownload) => {
                trackView(app.id, 'view');
              });
            }
          }
        }
      } catch (error) {
        console.error('خطا در دریافت منابع:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResources();
  }, [publicId, trackView]);

  const copyToClipboard = (link: string, id: number) => {
    navigator.clipboard.writeText(link);
    setCopiedLinks({ ...copiedLinks, [id]: true });
    setTimeout(() => {
      setCopiedLinks({ ...copiedLinks, [id]: false });
    }, 2000);
  };

  const handleDownloadClick = (app: AppDownload) => {
    trackView(app.id, 'download');
    window.open(app.downloadLink, '_blank');
  };

  const handleVideoPlay = (appId: number) => {
    trackView(appId, 'video_play');
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: 'white' }}>
        <div style={{ 
          display: 'inline-block', 
          width: '40px', 
          height: '40px', 
          border: '3px solid rgba(255,255,255,0.3)', 
          borderTop: '3px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  // unified rendering condition
  if (sourceMode === 'unified' && unifiedDoc) {
    const activeAnnouncements = unifiedDoc.announcements.filter(a => a.isActive !== false).sort((a,b)=> b.priority - a.priority);
    const activeDownloads = unifiedDoc.downloads.filter(d => d.isActive !== false).sort((a,b)=> a.displayOrder - b.displayOrder);
    const orderedSections = unifiedDoc.sections.slice().sort((a,b)=> a.order - b.order);
    if (!activeAnnouncements.length && !activeDownloads.length && !orderedSections.length) return null;
    return (
      <div style={{ marginBottom: '40px' }}>
        {/* اطلاعیه‌های مهم */}
        {activeAnnouncements.length>0 && (
          <div style={{ marginBottom: '30px' }}>
            {activeAnnouncements.map(announcement => {
              const colors = getAnnouncementColor(announcement.type);
              return (
                <div key={announcement.id} style={{ background: colors.bg, border: `2px solid ${colors.border}`, borderRadius: '12px', padding: '20px', marginBottom: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                  <div style={{ display:'flex', alignItems:'start', gap:'15px' }}>
                    <div style={{ marginTop:'2px' }}>{getAnnouncementIcon(announcement.type)}</div>
                    <div style={{ flex:1 }}>
                      <h3 style={{ fontSize:'18px', fontWeight:'bold', marginBottom:'8px', color:'white' }}>{announcement.title}</h3>
                      <p style={{ fontSize:'14px', lineHeight:'1.6', color:'rgba(255,255,255,0.95)', whiteSpace:'pre-line' }}>{announcement.content}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* لینک‌های دانلود اپلیکیشن */}
        {activeDownloads.length>0 && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize:'24px', fontWeight:'bold', marginBottom:'20px', color:'white', textAlign:'center', whiteSpace:'pre-line' }}>{downloadsIntro?.trim() || unifiedDoc.metadata?.downloadsIntro || '📱 دانلود اپلیکیشن‌ها'}</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'20px' }}>
              {activeDownloads.map(app => (
                <div key={app.id} style={{ background:'linear-gradient(135deg, #334155, #475569)', border:'2px solid #64748b', borderRadius:'12px', padding:'20px', boxShadow:'0 4px 6px rgba(0,0,0,0.3)', transition:'transform 0.2s', cursor:'pointer' }} onMouseEnter={e=> (e.currentTarget.style.transform='translateY(-4px)')} onMouseLeave={e=> (e.currentTarget.style.transform='translateY(0)')}>
                  {/* عنوان و توضیحات */}
                  <div style={{ marginBottom:'15px' }}>
                    <h3 style={{ fontSize:'18px', fontWeight:'bold', marginBottom:'6px', color:'white' }}>{app.title}</h3>
                    {app.description && <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.7)', lineHeight:'1.4' }}>{app.description}</p>}
                  </div>

                  {/* QR Code */}
                  {app.qrCodeUrl && (
                    <div style={{ textAlign:'center', marginBottom:'15px', background:'white', padding:'10px', borderRadius:'8px' }}>
                      <img src={app.qrCodeUrl} alt={`QR Code ${app.title}`} style={{ maxWidth:'150px', height:'auto', display:'block', margin:'0 auto' }} />
                      <p style={{ fontSize:'11px', color:'#64748b', marginTop:'6px' }}>اسکن کنید برای دانلود</p>
                    </div>
                  )}

                  {/* دکمه‌های عملیات */}
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {/* دکمه دانلود */}
                    <a href={app.downloadLink} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', background:'linear-gradient(135deg, #10b981, #059669)', color:'white', padding:'12px', borderRadius:'8px', textDecoration:'none', fontSize:'14px', fontWeight:'bold', border:'none', cursor:'pointer', transition:'all 0.2s' }} onMouseEnter={e=> { e.currentTarget.style.background='linear-gradient(135deg, #059669, #047857)'; e.currentTarget.style.transform='scale(1.02)'; }} onMouseLeave={e=> { e.currentTarget.style.background='linear-gradient(135deg, #10b981, #059669)'; e.currentTarget.style.transform='scale(1)'; }} onClick={()=> {/* unified downloads currently no numeric id for tracking; skip */}}>
                      <Download size={18} />دانلود مستقیم
                    </a>

                    {/* دکمه کپی لینک */}
                    <button onClick={()=> { navigator.clipboard.writeText(app.downloadLink); }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', background:'linear-gradient(135deg, #3b82f6, #2563eb)', color:'white', padding:'10px', borderRadius:'8px', fontSize:'13px', fontWeight:'bold', border:'none', cursor:'pointer', transition:'all 0.2s' }}>
                      <Copy size={16} />کپی لینک
                    </button>

                    {/* دکمه ویدئو آموزشی */}
                    {app.videoUrl && (
                      <a href={app.videoUrl} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', background:'linear-gradient(135deg, #8b5cf6, #7c3aed)', color:'white', padding:'10px', borderRadius:'8px', textDecoration:'none', fontSize:'13px', fontWeight:'bold', border:'none', cursor:'pointer', transition:'all 0.2s' }}>
                        <Play size={16} />ویدئو آموزشی
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* بخش‌های سفارشی */}
        {orderedSections.length>0 && (
          <div style={{ display:'grid', gap:'16px', marginTop:'30px' }}>
            {orderedSections.map(sec => (
              <div key={sec.id} style={{ background:'linear-gradient(135deg, #0f766e, #115e59)', border:'2px solid #14b8a6', borderRadius:'12px', padding:'20px', boxShadow:'0 4px 6px rgba(0,0,0,0.3)' }}>
                <h3 style={{ fontSize:'17px', fontWeight:'bold', marginBottom:'10px', color:'white' }}>{sec.title}</h3>
                <div style={{ fontSize:'13px', lineHeight:'1.7', whiteSpace:'pre-line', color:'rgba(255,255,255,0.92)' }}>{sec.body || '—'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!resources || (resources.appDownloads.length === 0 && resources.announcements.length === 0)) {
    return null; // عدم نمایش بخش در صورت نبود محتوا
  }

  const getAnnouncementIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertCircle size={20} color="#f59e0b" />;
      case 'success': return <CheckCircle size={20} color="#10b981" />;
      case 'error': return <XCircle size={20} color="#ef4444" />;
      default: return <Info size={20} color="#3b82f6" />;
    }
  };

  const getAnnouncementColor = (type: string) => {
    switch (type) {
      case 'warning': return {
        bg: 'linear-gradient(135deg, #f59e0b, #d97706)',
        border: '#fbbf24'
      };
      case 'success': return {
        bg: 'linear-gradient(135deg, #10b981, #059669)',
        border: '#34d399'
      };
      case 'error': return {
        bg: 'linear-gradient(135deg, #ef4444, #dc2626)',
        border: '#f87171'
      };
      default: return {
        bg: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        border: '#60a5fa'
      };
    }
  };

  return (
    <div style={{ marginBottom: '40px' }}>
      {/* اطلاعیه‌های مهم */}
      {resources.announcements.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          {resources.announcements.map((announcement) => {
            const colors = getAnnouncementColor(announcement.type);
            return (
              <div
                key={announcement.id}
                style={{
                  background: colors.bg,
                  border: `2px solid ${colors.border}`,
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '15px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', gap: '15px' }}>
                  <div style={{ marginTop: '2px' }}>
                    {getAnnouncementIcon(announcement.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ 
                      fontSize: '18px', 
                      fontWeight: 'bold', 
                      marginBottom: '8px',
                      color: 'white'
                    }}>
                      {announcement.title}
                    </h3>
                    <p style={{ 
                      fontSize: '14px', 
                      lineHeight: '1.6',
                      color: 'rgba(255,255,255,0.95)',
                      whiteSpace: 'pre-line'
                    }}>
                      {announcement.content}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* لینک‌های دانلود اپلیکیشن */}
      {resources.appDownloads.length > 0 && (
        <div>
          <h2
            style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              marginBottom: '20px',
              color: 'white',
              textAlign: 'center',
              whiteSpace: 'pre-line'
            }}
          >
            {downloadsIntro?.trim() || '📱 دانلود اپلیکیشن‌های توصیه شده\n\nبرای استفاده بهینه از سرویس‌ها، نصب نرم‌افزارهای زیر ضروری است:'}
          </h2>
          
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px'
          }}>
            {resources.appDownloads.map((app) => (
              <div
                key={app.id}
                style={{
                  background: 'linear-gradient(135deg, #334155, #475569)',
                  border: '2px solid #64748b',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                  transition: 'transform 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {/* عنوان و توضیحات */}
                <div style={{ marginBottom: '15px' }}>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold', 
                    marginBottom: '6px',
                    color: 'white'
                  }}>
                    {app.title}
                  </h3>
                  {app.description && (
                    <p style={{ 
                      fontSize: '13px', 
                      color: 'rgba(255,255,255,0.7)',
                      lineHeight: '1.4'
                    }}>
                      {app.description}
                    </p>
                  )}
                </div>

                {/* QR Code */}
                {app.qrCodeUrl && (
                  <div style={{ 
                    textAlign: 'center', 
                    marginBottom: '15px',
                    background: 'white',
                    padding: '10px',
                    borderRadius: '8px'
                  }}>
                    <img 
                      src={app.qrCodeUrl} 
                      alt={`QR Code ${app.title}`}
                      style={{ 
                        maxWidth: '150px', 
                        height: 'auto',
                        display: 'block',
                        margin: '0 auto'
                      }}
                    />
                    <p style={{ 
                      fontSize: '11px', 
                      color: '#64748b',
                      marginTop: '6px'
                    }}>
                      اسکن کنید برای دانلود
                    </p>
                  </div>
                )}

                {/* دکمه‌های عملیات */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* دکمه دانلود */}
                  <a
                    href={app.downloadLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: 'white',
                      padding: '12px',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #059669, #047857)';
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    onClick={() => handleDownloadClick(app)}
                  >
                    <Download size={18} />
                    دانلود مستقیم
                  </a>

                  {/* دکمه کپی لینک */}
                  <button
                    onClick={() => copyToClipboard(app.downloadLink, app.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: copiedLinks[app.id] 
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: 'white',
                      padding: '10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {copiedLinks[app.id] ? (
                      <>
                        <Check size={16} />
                        کپی شد!
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        کپی لینک
                      </>
                    )}
                  </button>

                  {/* دکمه ویدئو آموزشی */}
                  {app.videoUrl && (
                    <a
                      href={app.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        color: 'white',
                        padding: '10px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => handleVideoPlay(app.id)}
                    >
                      <Play size={16} />
                      ویدئو آموزشی
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
