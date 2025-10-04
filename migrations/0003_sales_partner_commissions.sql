-- 0003_sales_partner_commissions.sql
-- اضافه شدن ستون‌های تکمیلی برای همکاران فروش و جدول تسویه پورسانت

ALTER TABLE "sales_partners"
  ADD COLUMN IF NOT EXISTS "code" text,
  ADD COLUMN IF NOT EXISTS "contact_person" text;

CREATE TABLE IF NOT EXISTS "partner_commission_payments" (
  "id" serial PRIMARY KEY,
  "sales_partner_id" integer NOT NULL REFERENCES "sales_partners"("id") ON DELETE CASCADE,
  "amount" numeric(15,2) NOT NULL,
  "payment_date" timestamp DEFAULT now(),
  "note" text,
  "created_by" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
