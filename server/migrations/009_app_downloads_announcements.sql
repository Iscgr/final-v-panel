-- Migration: 009_app_downloads_announcements.sql
-- تاریخ: 2025-10-02
-- توضیحات: ایجاد جداول برای مدیریت لینک‌های دانلود اپلیکیشن و اطلاعیه‌های پرتال عمومی

-- جدول App Downloads (لینک‌های دانلود اپلیکیشن)
CREATE TABLE IF NOT EXISTS app_downloads (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  download_link TEXT NOT NULL,
  qr_code_url TEXT,
  video_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- جدول Announcements (اطلاعیه‌های مهم)
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  type TEXT DEFAULT 'info',
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ایجاد indexes برای بهبود عملکرد
CREATE INDEX IF NOT EXISTS idx_app_downloads_active ON app_downloads(is_active);
CREATE INDEX IF NOT EXISTS idx_app_downloads_order ON app_downloads(display_order);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_expires ON announcements(expires_at);

-- Trigger برای بروزرسانی خودکار updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_app_downloads_updated_at
  BEFORE UPDATE ON app_downloads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- نمونه داده‌های اولیه (برای تست)
INSERT INTO app_downloads (title, description, download_link, display_order, is_active) VALUES
  ('V2ray Client', 'کلاینت V2ray برای اندروید', 'https://example.com/v2ray.apk', 1, true),
  ('Shadowsocks', 'کلاینت Shadowsocks', 'https://example.com/shadowsocks.apk', 2, true)
ON CONFLICT DO NOTHING;

INSERT INTO announcements (title, content, priority, type, is_active) VALUES
  ('به‌روزرسانی مهم', 'لطفاً نسخه جدید اپلیکیشن را دانلود کنید.', 10, 'warning', true)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE app_downloads IS 'لینک‌های دانلود اپلیکیشن برای نمایش در پرتال عمومی نمایندگان';
COMMENT ON TABLE announcements IS 'اطلاعیه‌های مهم برای نمایش در پرتال عمومی نمایندگان';
