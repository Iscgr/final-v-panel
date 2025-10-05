-- Migration: 0005_portal_content_documents.sql
-- هدف: ایجاد مدل یکپارچه محتوای پرتال (portal_content_documents)
-- وابستگی: جداول announcements, app_downloads, portal_content_blocks (برای مهاجرت تدریجی)

CREATE TABLE IF NOT EXISTS portal_content_documents (
    id SERIAL PRIMARY KEY,
    doc_key TEXT NOT NULL UNIQUE,
    draft_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    published_json JSONB,
    draft_version INT NOT NULL DEFAULT 1,
    published_version INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft', -- draft | dirty | published
    diff_json JSONB,
    updated_by TEXT,
    published_by TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    published_at TIMESTAMP
);

COMMENT ON TABLE portal_content_documents IS 'سند یکپارچه محتوای پرتال شامل پیش نویس و نسخه منتشر شده';
COMMENT ON COLUMN portal_content_documents.doc_key IS 'کلید منطقی سند (فعلا portal_main)';
COMMENT ON COLUMN portal_content_documents.draft_json IS 'آخرین پیش‌نویس ویرایش شده (ساختار JSON)';
COMMENT ON COLUMN portal_content_documents.published_json IS 'آخرین نسخه منتشر شده برای مصرف عمومی';
COMMENT ON COLUMN portal_content_documents.diff_json IS 'Diff آخرین انتشار (برای shadow mode)';

CREATE INDEX IF NOT EXISTS idx_portal_content_documents_key ON portal_content_documents(doc_key);

-- Seed اولیه اگر وجود ندارد
INSERT INTO portal_content_documents (doc_key, draft_json, status)
SELECT 'portal_main', jsonb_build_object(
    'displayTitle', 'پرتال نمایندگان',
    'sections', jsonb_build_array(),
    'announcements', jsonb_build_array(),
    'downloads', jsonb_build_array(),
    'metadata', jsonb_build_object('createdAt', NOW())
), 'draft'
WHERE NOT EXISTS (SELECT 1 FROM portal_content_documents WHERE doc_key='portal_main');
