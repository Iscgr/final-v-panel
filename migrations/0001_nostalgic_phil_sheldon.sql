CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"priority" integer DEFAULT 0,
	"type" text DEFAULT 'info',
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_download_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_download_id" integer NOT NULL,
	"representative_id" integer,
	"public_id" text,
	"ip_address" text,
	"user_agent" text,
	"action_type" text DEFAULT 'view' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_downloads" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"download_link" text NOT NULL,
	"qr_code_url" text,
	"qr_code_file_path" text,
	"video_url" text,
	"video_file_path" text,
	"view_count" integer DEFAULT 0,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"stored_file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "uploaded_files_stored_file_name_unique" UNIQUE("stored_file_name")
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "due_date_gregorian" timestamp;--> statement-breakpoint
ALTER TABLE "app_download_views" ADD CONSTRAINT "app_download_views_app_download_id_app_downloads_id_fk" FOREIGN KEY ("app_download_id") REFERENCES "public"."app_downloads"("id") ON DELETE cascade ON UPDATE no action;