-- Migration: Add portal_apps and portal_announcements tables
-- Created: 2025
-- Purpose: Enable management of app download links, QR codes, videos and announcements in representative portal

CREATE TABLE "portal_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"download_link" text NOT NULL,
	"qr_code" text,
	"video_url" text,
	"icon_url" text,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'info',
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- Create indexes for better query performance
CREATE INDEX "portal_apps_active_order_idx" ON "portal_apps" ("is_active", "order");
CREATE INDEX "portal_announcements_active_priority_idx" ON "portal_announcements" ("is_active", "priority");

-- Add comments for documentation
COMMENT ON TABLE "portal_apps" IS 'اپلیکیشن‌های پرتال - مدیریت لینک‌های دانلود، QR کد و ویدیوهای آموزشی';
COMMENT ON TABLE "portal_announcements" IS 'اعلانات پرتال - نمایش اعلانات و اخبار مهم در پرتال عمومی';
