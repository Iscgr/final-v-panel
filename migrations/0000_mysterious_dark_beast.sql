CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"related_id" integer,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'ADMIN',
	"permissions" json DEFAULT '["FINANCIAL_MANAGEMENT","REPORTS"]'::json,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "daily_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"telegram_message_id" integer,
	"report_date" text NOT NULL,
	"tasks" json,
	"challenges" text,
	"achievements" text,
	"next_day_plans" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_integrity_constraints" (
	"id" serial PRIMARY KEY NOT NULL,
	"constraint_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"constraint_rule" json,
	"current_status" text DEFAULT 'VALID' NOT NULL,
	"last_validation_at" timestamp DEFAULT now(),
	"violation_details" json,
	"auto_fix_attempts" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to_id" integer,
	"created_by_id" integer,
	"due_date" timestamp,
	"completed_at" timestamp,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"username" text,
	"phone" text,
	"email" text,
	"position" text,
	"department" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "employees_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "financial_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"representative_id" integer NOT NULL,
	"related_entity_type" text,
	"related_entity_id" integer,
	"original_state" json,
	"target_state" json,
	"actual_state" json,
	"financial_impact" json,
	"processing_steps" json DEFAULT '[]'::json,
	"rollback_data" json,
	"initiated_by" text NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "financial_transactions_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "guard_metrics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"level" text,
	"context" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ingestion_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"state" text DEFAULT 'PENDING' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"total_steps" integer DEFAULT 0 NOT NULL,
	"processed_records" integer DEFAULT 0 NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"checkpoint_data" json,
	"started_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "ingestion_state_batch_id_unique" UNIQUE("batch_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_balance_cache" (
	"invoice_id" integer PRIMARY KEY NOT NULL,
	"allocated_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"remaining_amount" numeric(15, 2) NOT NULL,
	"status_cached" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_name" text NOT NULL,
	"batch_code" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_invoices" integer DEFAULT 0,
	"total_amount" numeric(15, 2) DEFAULT '0',
	"uploaded_by" text NOT NULL,
	"uploaded_file_name" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "invoice_batches_batch_code_unique" UNIQUE("batch_code")
);
--> statement-breakpoint
CREATE TABLE "invoice_edits" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"original_usage_data" json,
	"edited_usage_data" json,
	"edit_type" text NOT NULL,
	"edit_reason" text,
	"original_amount" numeric(15, 2),
	"edited_amount" numeric(15, 2),
	"edited_by" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"transaction_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_usage_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"admin_username" text NOT NULL,
	"event_timestamp" text NOT NULL,
	"event_type" text NOT NULL,
	"description" text,
	"amount_text" text NOT NULL,
	"amount_dec" numeric(15, 2),
	"raw_json" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"representative_id" integer NOT NULL,
	"batch_id" integer,
	"amount" numeric(15, 2) NOT NULL,
	"issue_date" text NOT NULL,
	"due_date" text,
	"status" text DEFAULT 'unpaid' NOT NULL,
	"usage_data" json,
	"sent_to_telegram" boolean DEFAULT false,
	"telegram_sent_at" timestamp,
	"telegram_send_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"telegram_message_id" integer,
	"request_date" text NOT NULL,
	"duration" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by_id" integer,
	"reviewed_at" timestamp,
	"review_comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" json NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"error_last" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"invoice_id" integer NOT NULL,
	"allocated_amount" numeric(15, 2) NOT NULL,
	"method" text NOT NULL,
	"synthetic" boolean DEFAULT false NOT NULL,
	"idempotency_key" text,
	"performed_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"representative_id" integer,
	"invoice_id" integer,
	"amount" text NOT NULL,
	"amount_dec" numeric(15, 2),
	"payment_date" text NOT NULL,
	"description" text,
	"is_allocated" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "process_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"step_number" integer NOT NULL,
	"step_name" text NOT NULL,
	"step_type" text NOT NULL,
	"step_config" json,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reconciliation_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"representative_id" integer,
	"action_type" text NOT NULL,
	"target_entity" text NOT NULL,
	"target_id" integer NOT NULL,
	"current_value" numeric(15, 2),
	"expected_value" numeric(15, 2),
	"adjustment_amount" numeric(15, 2),
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reason" text,
	"applied_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reconciliation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"diff_abs" numeric(15, 2) NOT NULL,
	"diff_ratio" numeric(12, 6) NOT NULL,
	"status" text NOT NULL,
	"mode" text DEFAULT 'dry' NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"summary" json DEFAULT '{}',
	"meta" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "representatives" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"owner_name" text,
	"panel_username" text NOT NULL,
	"phone" text,
	"telegram_id" text,
	"public_id" text NOT NULL,
	"sales_partner_id" integer,
	"is_active" boolean DEFAULT true,
	"total_debt" numeric(15, 2) DEFAULT '0',
	"total_sales" numeric(15, 2) DEFAULT '0',
	"credit" numeric(15, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "representatives_code_unique" UNIQUE("code"),
	CONSTRAINT "representatives_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "sales_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"commission_rate" numeric(5, 2) DEFAULT '0',
	"total_commission" numeric(15, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "technical_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"telegram_message_id" integer,
	"issue" text NOT NULL,
	"status" text NOT NULL,
	"priority" text DEFAULT 'medium',
	"assigned_to_id" integer,
	"resolution" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "telegram_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"joined_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "telegram_groups_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE "telegram_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"from_user_id" text NOT NULL,
	"employee_id" integer,
	"text" text,
	"message_type" text NOT NULL,
	"parsed_data" json,
	"entities" json,
	"processed" boolean DEFAULT false,
	"response_required" boolean DEFAULT false,
	"response_text" text,
	"response_sent" boolean DEFAULT false,
	"task_created" boolean DEFAULT false,
	"created_task_id" integer,
	"received_at" timestamp NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "telegram_send_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"send_type" text NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"sent_by" text NOT NULL,
	"bot_token" text,
	"chat_id" text,
	"message_template" text,
	"send_status" text DEFAULT 'SUCCESS' NOT NULL,
	"error_message" text,
	"telegram_message_id" text,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "threshold_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"metric_code" text NOT NULL,
	"warn_threshold" numeric(18, 6) NOT NULL,
	"critical_threshold" numeric(18, 6) NOT NULL,
	"window_minutes" integer DEFAULT 60 NOT NULL,
	"comparison_operator" text DEFAULT '>' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"auto_suspend_on_breach" boolean DEFAULT false NOT NULL,
	"meta" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "threshold_config_metric_code_unique" UNIQUE("metric_code")
);
--> statement-breakpoint
ALTER TABLE "invoice_balance_cache" ADD CONSTRAINT "invoice_balance_cache_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_usage_items" ADD CONSTRAINT "invoice_usage_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_representative_id_representatives_id_fk" FOREIGN KEY ("representative_id") REFERENCES "public"."representatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_actions" ADD CONSTRAINT "reconciliation_actions_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_actions" ADD CONSTRAINT "reconciliation_actions_representative_id_representatives_id_fk" FOREIGN KEY ("representative_id") REFERENCES "public"."representatives"("id") ON DELETE no action ON UPDATE no action;