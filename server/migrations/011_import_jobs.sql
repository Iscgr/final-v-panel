-- Migration: 011_import_jobs.sql
-- هدف: ایجاد جدول import_jobs برای پایش و نمایش وضعیت پردازش فایل‌های JSON (Phase A instrumentation)
-- ایمن: فقط افزودنی؛ تغییری در جداول موجود ایجاد نمی‌کند.

CREATE TABLE IF NOT EXISTS import_jobs (
  id SERIAL PRIMARY KEY,
  job_code TEXT NOT NULL UNIQUE, -- مثلا: WEEKLY_USAGE_1404_06_W1
  source_file_name TEXT, -- نام فایل آپلودی
  status TEXT NOT NULL DEFAULT 'pending', -- pending, validating, ingesting, enriching, completed, failed
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP,
  last_error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
