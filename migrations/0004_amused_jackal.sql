CREATE TABLE "backup_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"performed_by" text NOT NULL,
	"action" text NOT NULL,
	"status" text NOT NULL,
	"file_size" integer,
	"checksum" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "partner_commission_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"sales_partner_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"payment_date" timestamp DEFAULT now(),
	"status" text DEFAULT 'pending' NOT NULL,
	"settled_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"last_partial_settlement_at" timestamp,
	"note" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_content_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"block_key" text NOT NULL,
	"title" text,
	"body" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "portal_content_blocks_block_key_unique" UNIQUE("block_key")
);
--> statement-breakpoint
CREATE TABLE "portal_content_publication_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_version" integer DEFAULT 1 NOT NULL,
	"last_published_at" timestamp,
	"last_published_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" text PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales_partners" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "sales_partners" ADD COLUMN "contact_person" text;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD COLUMN "fileName" text NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_commission_payments" ADD CONSTRAINT "partner_commission_payments_sales_partner_id_sales_partners_id_fk" FOREIGN KEY ("sales_partner_id") REFERENCES "public"."sales_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" DROP COLUMN "file_name";