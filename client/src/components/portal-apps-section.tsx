/**
 * Portal Apps Section Component
 * بخش نمایش اپلیکیشن‌ها و اعلانات در پرتال عمومی نماینده
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, QrCode, Video, AlertCircle, Info, CheckCircle, AlertTriangle } from "lucide-react";

interface PortalApp {
  id: number;
  title: string;
  description?: string;
  downloadLink: string;
  qrCode?: string;
  videoUrl?: string;
  iconUrl?: string;
  order: number;
  isActive: boolean;
}

interface PortalAnnouncement {
  id: number;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  isActive: boolean;
  priority: number;
}

const announcementStyles = {
  info: {
    icon: Info,
    bg: "linear-gradient(135deg, #0ea5e9, #0284c7)",
    border: "#38bdf8",
  },
  warning: {
    icon: AlertTriangle,
    bg: "linear-gradient(135deg, #f59e0b, #d97706)",
    border: "#fbbf24",
  },
  success: {
    icon: CheckCircle,
    bg: "linear-gradient(135deg, #10b981, #059669)",
    border: "#34d399",
  },
  error: {
    icon: AlertCircle,
    bg: "linear-gradient(135deg, #ef4444, #dc2626)",
    border: "#f87171",
  },
};

export function PortalAppsSection() {
  // Fetch active apps
  const { data: apps = [], isLoading: appsLoading } = useQuery<PortalApp[]>({
    queryKey: ["/api/public/portal-apps"],
    retry: 1,
  });

  // Fetch active announcements
  const { data: announcements = [], isLoading: announcementsLoading } = useQuery<PortalAnnouncement[]>({
    queryKey: ["/api/public/portal-announcements"],
    retry: 1,
  });

  const isLoading = appsLoading || announcementsLoading;
  const hasContent = apps.length > 0 || announcements.length > 0;

  if (isLoading) {
    return (
      <div
        style={{
          background: "rgba(255, 255, 255, 0.1)",
          padding: "20px",
          borderRadius: "15px",
          marginBottom: "30px",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: "14px", opacity: 0.8 }}>در حال بارگذاری اطلاعات...</p>
      </div>
    );
  }

  if (!hasContent) {
    return null;
  }

  return (
    <div style={{ marginBottom: "30px" }}>
      {/* Announcements Section */}
      {announcements.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          {announcements.map((announcement) => {
            const Icon = announcementStyles[announcement.type].icon;
            return (
              <div
                key={announcement.id}
                style={{
                  background: announcementStyles[announcement.type].bg,
                  padding: "20px",
                  borderRadius: "12px",
                  border: `2px solid ${announcementStyles[announcement.type].border}`,
                  marginBottom: "15px",
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "15px" }}>
                  <Icon style={{ width: "28px", height: "28px", flexShrink: 0, marginTop: "2px" }} />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "8px" }}>
                      {announcement.title}
                    </h3>
                    <p
                      style={{
                        fontSize: "14px",
                        lineHeight: "1.6",
                        whiteSpace: "pre-wrap",
                        opacity: 0.95,
                      }}
                    >
                      {announcement.content}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Apps Section */}
      {apps.length > 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, #4c1d95, #5b21b6)",
            padding: "25px",
            borderRadius: "15px",
            border: "2px solid #7c3aed",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
          }}
        >
          <h2
            style={{
              fontSize: "22px",
              fontWeight: "bold",
              marginBottom: "20px",
              color: "#e9d5ff",
            }}
          >
            📱 دانلود اپلیکیشن‌های مورد تایید
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            {apps.map((app) => (
              <div
                key={app.id}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(10px)",
                  padding: "20px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "15px" }}>
                  {app.iconUrl && (
                    <img
                      src={app.iconUrl}
                      alt={app.title}
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "8px",
                        objectFit: "cover",
                      }}
                    />
                  )}
                  <h3 style={{ fontSize: "18px", fontWeight: "bold", flex: 1 }}>{app.title}</h3>
                </div>

                {app.description && (
                  <p
                    style={{
                      fontSize: "13px",
                      lineHeight: "1.5",
                      opacity: 0.9,
                      marginBottom: "15px",
                    }}
                  >
                    {app.description}
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {/* Download Button */}
                  <a
                    href={app.downloadLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      color: "white",
                      padding: "10px 16px",
                      borderRadius: "8px",
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: "600",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "linear-gradient(135deg, #059669, #047857)";
                      e.currentTarget.style.transform = "scale(1.02)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "linear-gradient(135deg, #10b981, #059669)";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <Download style={{ width: "16px", height: "16px" }} />
                    دانلود مستقیم
                  </a>

                  {/* QR Code & Video Buttons */}
                  <div style={{ display: "flex", gap: "10px" }}>
                    {app.qrCode && (
                      <button
                        onClick={() => {
                          const qrWindow = window.open("", "_blank", "width=400,height=400");
                          if (qrWindow) {
                            qrWindow.document.write(`
                              <html dir="rtl">
                              <head>
                                <title>QR کد - ${app.title}</title>
                                <style>
                                  body {
                                    margin: 0;
                                    padding: 20px;
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    justify-content: center;
                                    min-height: 100vh;
                                    font-family: Tahoma, sans-serif;
                                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    color: white;
                                  }
                                  h2 { margin-bottom: 20px; }
                                  img { max-width: 300px; max-height: 300px; background: white; padding: 10px; border-radius: 10px; }
                                </style>
                              </head>
                              <body>
                                <h2>${app.title}</h2>
                                <img src="${app.qrCode}" alt="QR Code" />
                              </body>
                              </html>
                            `);
                          }
                        }}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          background: "rgba(59, 130, 246, 0.8)",
                          color: "white",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: "500",
                          border: "none",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(37, 99, 235, 0.9)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(59, 130, 246, 0.8)";
                        }}
                      >
                        <QrCode style={{ width: "14px", height: "14px" }} />
                        QR کد
                      </button>
                    )}

                    {app.videoUrl && (
                      <a
                        href={app.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          background: "rgba(168, 85, 247, 0.8)",
                          color: "white",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          textDecoration: "none",
                          fontSize: "13px",
                          fontWeight: "500",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(147, 51, 234, 0.9)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(168, 85, 247, 0.8)";
                        }}
                      >
                        <Video style={{ width: "14px", height: "14px" }} />
                        آموزش
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p
            style={{
              fontSize: "12px",
              textAlign: "center",
              marginTop: "20px",
              opacity: 0.7,
              color: "#e9d5ff",
            }}
          >
            💡 برای استفاده بهینه، حتماً از جدیدترین نسخه اپلیکیشن‌ها استفاده کنید
          </p>
        </div>
      )}
    </div>
  );
}
