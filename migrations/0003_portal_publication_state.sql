-- Migration: ایجاد جدول وضعیت انتشار محتوای پرتال
-- هدف: نگهداری متادیتای آخرین انتشار و نسخه محتوا جهت تفکیک حالت draft از published

CREATE TABLE IF NOT EXISTS portal_content_publication_state (
  id SERIAL PRIMARY KEY,
  content_version INT NOT NULL DEFAULT 1,
  last_published_at TIMESTAMPTZ NULL,
  last_published_by TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ایندکس ساده برای دسترسی سریع به رکورد تکی (عملاً یک ردیف خواهیم داشت)
CREATE UNIQUE INDEX IF NOT EXISTS ux_portal_content_publication_state_singleton ON portal_content_publication_state((true));
