import { pgTable, text, serial, integer, boolean, timestamp, decimal, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const omitInsert = <T extends z.AnyZodObject>(schema: T, ...keys: string[]) =>
  schema.omit(Object.fromEntries(keys.map((key) => [key, true])) as any);

// Representatives (نمایندگان)
export const representatives = pgTable("representatives", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // REP-001, mntzresf, etc.
  name: text("name").notNull(), // Shop name
  ownerName: text("owner_name"), // صاحب فروشگاه
  panelUsername: text("panel_username").notNull(), // یوزرنیم ادمین پنل - admin_username from JSON
  phone: text("phone"),
  telegramId: text("telegram_id"), // آی‌دی تلگرام با @
  publicId: text("public_id").notNull().unique(), // For public portal access - based on panelUsername
  salesPartnerId: integer("sales_partner_id"), // همکار فروش معرف
  isActive: boolean("is_active").default(true),
  totalDebt: decimal("total_debt", { precision: 15, scale: 2 }).default("0"), // بدهی کل
  totalSales: decimal("total_sales", { precision: 15, scale: 2 }).default("0"), // فروش کل
  credit: decimal("credit", { precision: 15, scale: 2 }).default("0"), // اعتبار
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Sales Partners (همکاران فروش)
export const salesPartners = pgTable("sales_partners", {
  id: serial("id").primaryKey(),
  code: text("code"), // شناسه داخلی همکار فروش
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  contactPerson: text("contact_person"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("0"), // نرخ کمیسیون درصدی
  totalCommission: decimal("total_commission", { precision: 15, scale: 2 }).default("0"), // کل کمیسیون
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});

export const partnerCommissionPayments = pgTable("partner_commission_payments", {
  id: serial("id").primaryKey(),
  salesPartnerId: integer("sales_partner_id").notNull().references(() => salesPartners.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").defaultNow(),
  note: text("note"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Reconciliation Actions (اقدامات اصلاحی drift)
// هدف: ثبت plan های تولیدشده توسط Active Reconciliation Engine برای اصلاح انحرافات مالی
export const reconciliationActions = pgTable("reconciliation_actions", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => reconciliationRuns.id).notNull(),
  representativeId: integer("representative_id").references(() => representatives.id),
  actionType: text("action_type").notNull(), // 'ADJUST_DEBT', 'RECALCULATE_BALANCE', 'SYNC_CACHE'
  targetEntity: text("target_entity").notNull(), // 'representative', 'invoice', 'payment'
  targetId: integer("target_id").notNull(),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  expectedValue: decimal("expected_value", { precision: 15, scale: 2 }),
  adjustmentAmount: decimal("adjustment_amount", { precision: 15, scale: 2 }),
  status: text("status").notNull().default("PENDING"), // 'PENDING', 'APPLIED', 'FAILED', 'SKIPPED'
  reason: text("reason"),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").defaultNow()
});

// Invoice Usage Items (ریزجزئیات مصرف در فایل‌های هفتگی JSON)
// هدف: نگهداری خطوط خام (event) مرتبط با هر فاکتور برای Traceability و نمایش در پرتال عمومی.
// رابطه: هر رکورد متعلق به یک invoice است (one-to-many). در فاز فعلی از invoiceNumber برای اتصال ساده استفاده می‌شود.
export const invoiceUsageItems = pgTable("invoice_usage_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id).notNull(),
  adminUsername: text("admin_username").notNull(),
  eventTimestamp: text("event_timestamp").notNull(),
  eventType: text("event_type").notNull(),
  description: text("description"),
  amountText: text("amount_text").notNull(), // مقدار خام به صورت TEXT برای همسانی با منبع
  amountDec: decimal("amount_dec", { precision: 15, scale: 2 }), // جایگاه تبدیل آتی (Phase A E-A1)
  rawJson: json("raw_json"), // ذخیره کامل رکورد برای آینده (ممکن است null جهت صرفه‌جویی)
  createdAt: timestamp("created_at").defaultNow()
});

// Invoice Batches (دسته‌های فاکتور) - فاز ۱: مدیریت دوره‌ای
export const invoiceBatches = pgTable("invoice_batches", {
  id: serial("id").primaryKey(),
  batchName: text("batch_name").notNull(), // "هفته اول شهریور 1404"
  batchCode: text("batch_code").notNull().unique(), // "BATCH-1404-06-W1"
  periodStart: text("period_start").notNull(), // Persian date
  periodEnd: text("period_end").notNull(), // Persian date
  description: text("description"),
  status: text("status").notNull().default("draft"), // draft, processing, completed, archived
  totalInvoices: integer("total_invoices").default(0),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0"),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedFileName: text("uploaded_file_name"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at")
});

// Invoices (فاکتورها) - بهبود یافته با پشتیبانی دوره‌ای
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  representativeId: integer("representative_id").notNull(),
  batchId: integer("batch_id"), // ارتباط با دسته فاکتور - فاز ۱
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  issueDate: text("issue_date").notNull(), // Persian date: 1404/4/30
  dueDate: text("due_date"), // Persian date
  dueDateGregorian: timestamp("due_date_gregorian"), // تاریخ میلادی برای مقایسه
  status: text("status").notNull().default("unpaid"), // unpaid, paid, overdue
  usageData: json("usage_data"), // Raw JSON data from uploaded file
  sentToTelegram: boolean("sent_to_telegram").default(false),
  telegramSentAt: timestamp("telegram_sent_at"),
  telegramSendCount: integer("telegram_send_count").default(0), // تعداد دفعات ارسال
  createdAt: timestamp("created_at").defaultNow()
});

// Telegram Send History (تاریخچه ارسال تلگرام) - برای پیگیری ارسال مجدد
export const telegramSendHistory = pgTable("telegram_send_history", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  sendType: text("send_type").notNull(), // "FIRST_SEND", "RESEND"
  sentAt: timestamp("sent_at").defaultNow(),
  sentBy: text("sent_by").notNull(), // User who initiated the send
  botToken: text("bot_token"), // Token used (for audit)
  chatId: text("chat_id"), // Chat ID used (for audit)
  messageTemplate: text("message_template"), // Template used
  sendStatus: text("send_status").notNull().default("SUCCESS"), // SUCCESS, FAILED
  errorMessage: text("error_message"), // If failed
  telegramMessageId: text("telegram_message_id"), // Telegram's message ID if successful
  metadata: json("metadata") // Additional data
});

// Payments (پرداخت‌ها) - simplified to match actual database
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  representativeId: integer('representative_id').references(() => representatives.id),
  invoiceId: integer('invoice_id').references(() => invoices.id),
  amount: text('amount').notNull(),
  // ستون shadow برای مهاجرت تدریجی به DECIMAL (Phase A E-A1)
  amountDec: decimal('amount_dec', { precision: 15, scale: 2 }),
  paymentDate: text('payment_date').notNull(),
  description: text('description'),
  isAllocated: boolean('is_allocated').default(false),
  createdAt: timestamp('created_at').defaultNow()
});

// Supporting types for enhanced allocation
interface PaymentAllocation {
  invoiceId: number;
  allocatedAmount: number;
  allocationDate: string;
  allocationMethod: 'AUTO' | 'MANUAL';
  allocatedBy: string; // user ID or 'SYSTEM'
}

interface AllocationHistoryEntry {
  timestamp: string;
  action: 'ALLOCATE' | 'DEALLOCATE' | 'REALLOCATE';
  invoiceId: number;
  amount: number;
  method: string;
  performedBy: string;
  reason?: string;
}

// Activity Log (لاگ فعالیت‌ها)
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // invoice_created, payment_received, telegram_sent, etc.
  description: text("description").notNull(),
  relatedId: integer("related_id"), // ID of related entity
  metadata: json("metadata"), // Additional data
  createdAt: timestamp("created_at").defaultNow()
});

// Admin Users (کاربران ادمین)
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("ADMIN"), // "ADMIN", "SUPER_ADMIN", "VIEWER"
  permissions: json("permissions").default(["FINANCIAL_MANAGEMENT", "REPORTS"]), // Array of permissions
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow()
});

// Invoice Edits (ویرایش‌های فاکتور)
export const invoiceEdits = pgTable("invoice_edits", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  originalUsageData: json("original_usage_data"),
  editedUsageData: json("edited_usage_data"),
  editType: text("edit_type").notNull(), // "MANUAL_EDIT", "RECORD_ADD", "RECORD_DELETE"
  editReason: text("edit_reason"),
  originalAmount: decimal("original_amount", { precision: 15, scale: 2 }),
  editedAmount: decimal("edited_amount", { precision: 15, scale: 2 }),
  editedBy: text("edited_by").notNull(),
  isActive: boolean("is_active").default(true),
  transactionId: text("transaction_id"), // UUID for atomic transaction tracking
  createdAt: timestamp("created_at").defaultNow()
});

// Financial Transactions (تراکنش‌های مالی) - Clock's Core Gear System
export const financialTransactions = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  transactionId: text("transaction_id").notNull().unique(), // UUID for atomic operations
  type: text("type").notNull(), // "INVOICE_CREATE", "INVOICE_EDIT", "PAYMENT_ALLOCATE", "DEBT_RECONCILE"
  status: text("status").notNull().default("PENDING"), // "PENDING", "COMPLETED", "ROLLED_BACK"
  representativeId: integer("representative_id").notNull(),
  relatedEntityType: text("related_entity_type"), // "invoice", "payment", "edit"
  relatedEntityId: integer("related_entity_id"),
  originalState: json("original_state"), // Snapshot before transaction
  targetState: json("target_state"), // Intended state after transaction
  actualState: json("actual_state"), // Final state after completion
  financialImpact: json("financial_impact"), // { debtChange, creditChange, balanceChange }
  processingSteps: json("processing_steps").default([]), // Array of atomic steps
  rollbackData: json("rollback_data"), // Data needed for rollback
  initiatedBy: text("initiated_by").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow()
});

// ==================== LEDGER FOUNDATION TABLES (Phase A) ====================
// زیرلجر تخصیص پرداخت‌ها (E-A2)
export const paymentAllocations = pgTable('payment_allocations', {
  id: serial('id').primaryKey(),
  paymentId: integer('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  allocatedAmount: decimal('allocated_amount', { precision: 15, scale: 2 }).notNull(),
  method: text('method').notNull(), // auto | manual | backfill
  synthetic: boolean('synthetic').notNull().default(false),
  idempotencyKey: text('idempotency_key'),
  performedBy: integer('performed_by'), // لینک به admin_users.id در صورت نیاز
  createdAt: timestamp('created_at').defaultNow()
});

// کش تراز و وضعیت فاکتور (E-A3)
export const invoiceBalanceCache = pgTable('invoice_balance_cache', {
  invoiceId: integer('invoice_id').primaryKey().references(() => invoices.id, { onDelete: 'cascade' }),
  allocatedTotal: decimal('allocated_total', { precision: 15, scale: 2 }).notNull().default('0'),
  remainingAmount: decimal('remaining_amount', { precision: 15, scale: 2 }).notNull(),
  statusCached: text('status_cached').notNull(),
  version: integer('version').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow()
});

// نتایج اجرای drift / آشتی (E-A5)
export const reconciliationRuns = pgTable('reconciliation_runs', {
  id: serial('id').primaryKey(),
  scope: text('scope').notNull(), // representative:<id> یا global
  diffAbs: decimal('diff_abs', { precision: 15, scale: 2 }).notNull(),
  diffRatio: decimal('diff_ratio', { precision: 12, scale: 6 }).notNull(),
  status: text('status').notNull(), // PENDING | RUNNING | COMPLETED | COMPLETED_WITH_WARNINGS | FAILED | CANCELLED
  mode: text('mode').notNull().default('dry'), // dry | enforce
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  summary: json('summary').default('{}'),
  meta: json('meta'),
  createdAt: timestamp('created_at').defaultNow()
});

// Guard Metrics Events (Phase B - E-B5 Persistence مرحله 1)
// هدف: ذخیره رویدادهای ثبت‌شده توسط GuardMetricsService برای تحلیل زمانی و KPI
export const guardMetricsEvents = pgTable('guard_metrics_events', {
  id: serial('id').primaryKey(),
  eventType: text('event_type').notNull(), // همان type در record()
  // level بالقوه برای آینده (warn/enforce) - فعلاً nullable
  level: text('level'),
  // اختیاری: شناسه نماینده یا موجودیت در context (Json فیلد)
  context: json('context'),
  createdAt: timestamp('created_at').defaultNow()
});

// ==================== RELIABILITY TABLES (Phase C) ====================
// Telegram Outbox Pattern (E-C1)
// هدف: تضمین تحویل پیام‌های تلگرام با retry mechanism و KPI tracking
export const outbox = pgTable('outbox', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // 'TELEGRAM_MESSAGE', 'EMAIL', 'WEBHOOK'
  payload: json('payload').notNull(), // محتوای پیام شامل recipient، message، options
  status: text('status').notNull().default('PENDING'), // PENDING | PROCESSING | SENT | FAILED | CANCELLED
  retryCount: integer('retry_count').notNull().default(0),
  nextRetryAt: timestamp('next_retry_at'),
  errorLast: text('error_last'), // آخرین خطای مواجه شده
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow()
});

// Dynamic Threshold Configuration (E-C4)
// هدف: مدیریت آستانه‌های پویا برای alerting و SLA monitoring
export const thresholdConfig = pgTable('threshold_config', {
  id: serial('id').primaryKey(),
  metricCode: text('metric_code').notNull().unique(), // 'outbox_failure_rate', 'outbox_avg_retry', 'outbox_latency_p95'
  warnThreshold: decimal('warn_threshold', { precision: 18, scale: 6 }).notNull(),
  criticalThreshold: decimal('critical_threshold', { precision: 18, scale: 6 }).notNull(),
  windowMinutes: integer('window_minutes').notNull().default(60),
  comparisonOperator: text('comparison_operator').notNull().default('>'),
  enabled: boolean('enabled').notNull().default(true),
  autoSuspendOnBreach: boolean('auto_suspend_on_breach').notNull().default(false),
  meta: json('meta').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Data Integrity Constraints (محدودیت‌های یکپارچگی داده) - Clock's Precision Mechanism
export const dataIntegrityConstraints = pgTable("data_integrity_constraints", {
  id: serial("id").primaryKey(),
  constraintType: text("constraint_type").notNull(), // "BALANCE_CHECK", "DEBT_LIMIT", "FINANCIAL_RECONCILIATION"
  entityType: text("entity_type").notNull(), // "representative", "invoice", "payment"
  entityId: integer("entity_id").notNull(),
  constraintRule: json("constraint_rule"), // Validation rules and limits
  currentStatus: text("current_status").notNull().default("VALID"), // "VALID", "VIOLATED", "WARNING"
  lastValidationAt: timestamp("last_validation_at").defaultNow(),
  violationDetails: json("violation_details"), // Details if constraint is violated
  autoFixAttempts: integer("auto_fix_attempts").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Ingestion State Management (E-C6)
// هدف: مدیریت وضعیت فرایندهای ingestion برای resumable processes
export const ingestionState = pgTable('ingestion_state', {
  id: serial('id').primaryKey(),
  batchId: text('batch_id').notNull().unique(),
  state: text('state').notNull().default('PENDING'),
  currentStep: integer('current_step').notNull().default(0),
  totalSteps: integer('total_steps').notNull().default(0),
  processedRecords: integer('processed_records').notNull().default(0),
  totalRecords: integer('total_records').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  lastError: text('last_error'),
  checkpointData: json('checkpoint_data'),
  startedAt: timestamp('started_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at')
});

export const processSteps = pgTable('process_steps', {
  id: serial('id').primaryKey(),
  batchId: text('batch_id').notNull(),
  stepNumber: integer('step_number').notNull(),
  stepName: text('step_name').notNull(),
  stepType: text('step_type').notNull(),
  stepConfig: json('step_config'),
  status: text('status').notNull().default('PENDING'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow()
});

// Settings (تنظیمات)
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow()
});



// AI Configuration (تنظیمات پیشرفته هوش مصنوعی)
// export const aiConfiguration = pgTable("ai_configuration", {
//   id: serial("id").primaryKey(),
//   configName: text("config_name").notNull().unique(),
//   configCategory: text("config_category").notNull(), // "GENERAL", "PERSIAN_CULTURAL", "BEHAVIOR", "GROQ_SETTINGS", "SECURITY"

//   // General AI Settings
//   aiEnabled: boolean("ai_enabled").default(true),
//   defaultModel: text("default_model").default("groq/llama-3.1-8b-instant"),
//   maxTokens: integer("max_tokens").default(4096),
//   temperature: decimal("temperature", { precision: 3, scale: 2 }).default("0.7"),
//   topP: decimal("top_p", { precision: 3, scale: 2 }).default("0.9"),
//   frequencyPenalty: decimal("frequency_penalty", { precision: 3, scale: 2 }).default("0.0"),
//   presencePenalty: decimal("presence_penalty", { precision: 3, scale: 2 }).default("0.0"),

//   // Persian Cultural Intelligence
//   culturalSensitivity: decimal("cultural_sensitivity", { precision: 3, scale: 2 }).default("0.95"), // 0-1 scale
//   religiousSensitivity: decimal("religious_sensitivity", { precision: 3, scale: 2 }).default("0.9"),
//   traditionalValuesWeight: decimal("traditional_values_weight", { precision: 3, scale: 2 }).default("0.8"),
//   languageFormality: text("language_formality").default("RESPECTFUL"), // "FORMAL", "RESPECTFUL", "CASUAL"
//   persianPoetryIntegration: boolean("persian_poetry_integration").default(true),
//   culturalMetaphors: boolean("cultural_metaphors").default(true),

//   // Behavior Tuning
//   proactivityLevel: decimal("proactivity_level", { precision: 3, scale: 2 }).default("0.8"), // How proactive AI should be
//   confidenceThreshold: decimal("confidence_threshold", { precision: 3, scale: 2 }).default("0.75"),
//   learningRate: decimal("learning_rate", { precision: 3, scale: 2 }).default("0.1"),
//   creativityLevel: decimal("creativity_level", { precision: 3, scale: 2 }).default("0.6"),
//   riskTolerance: decimal("risk_tolerance", { precision: 3, scale: 2 }).default("0.3"),
//   contextWindowMemory: integer("context_window_memory").default(10), // Number of conversations to remember

//   // Advanced Groq Settings
//   groqModelVariant: text("groq_model_variant").default("llama-3.1-8b-instant"),
//   groqApiEndpoint: text("groq_api_endpoint").default("https://api.groq.com/openai/v1"),
//   maxConcurrentRequests: integer("max_concurrent_requests").default(5),
//   requestTimeoutMs: integer("request_timeout_ms").default(30000),
//   retryAttempts: integer("retry_attempts").default(3),
//   rateLimitRpm: integer("rate_limit_rpm").default(30), // Requests per minute

//   // Security & Privacy
//   dataEncryption: boolean("data_encryption").default(true),
//   accessLogging: boolean("access_logging").default(true),
//   sensitiveDataRedaction: boolean("sensitive_data_redaction").default(true),
//   emergencyStopEnabled: boolean("emergency_stop_enabled").default(true),
//   auditTrail: boolean("audit_trail").default(true),

//   // Performance & Monitoring
//   responseTimeLimit: integer("response_time_limit").default(5000), // milliseconds
//   qualityThreshold: decimal("quality_threshold", { precision: 3, scale: 2 }).default("0.8"),
//   errorRateThreshold: decimal("error_rate_threshold", { precision: 3, scale: 2 }).default("0.05"),
//   performanceMetrics: json("performance_metrics").default({}),

//   // Custom Instructions & Prompts
//   systemPrompt: text("system_prompt"),
//   culturalPrompts: json("cultural_prompts").default([]),
//   behaviorPrompts: json("behavior_prompts").default([]),
//   specialInstructions: json("special_instructions").default([]),

//   // Integration Settings
//   telegramIntegration: boolean("telegram_integration").default(false),
//   xaiIntegration: boolean("xai_integration").default(false),
//   customApiEndpoints: json("custom_api_endpoints").default([]),

//   isActive: boolean("is_active").default(true),
//   lastModifiedBy: text("last_modified_by"),
//   configVersion: integer("config_version").default(1),
//   createdAt: timestamp("created_at").defaultNow(),
//   updatedAt: timestamp("updated_at").defaultNow()
// });

// ==================== CRM INTELLIGENT SYSTEM ====================

// AI Knowledge Base (دیتابیس دانش هوشمند)
// export const aiKnowledgeBase = pgTable("ai_knowledge_base", {
//   id: serial("id").primaryKey(),
//   knowledgeId: text("knowledge_id").notNull().unique(),
//   category: text("category").notNull(), // "BEST_PRACTICE", "COMMON_MISTAKE", "SUCCESSFUL_APPROACH", "CULTURAL_INSIGHT"
//   title: text("title").notNull(),
//   description: text("description").notNull(),
//   sourceType: text("source_type").notNull(), // "TASK_RESULT", "ADMIN_INPUT", "AI_ANALYSIS", "PATTERN_DETECTION"
//   sourceId: text("source_id"), // Reference to source data
//   applicableScenarios: json("applicable_scenarios"), // When to apply this knowledge
//   successRate: decimal("success_rate", { precision: 5, scale: 2 }), // How successful this knowledge has been
//   usageCount: integer("usage_count").default(0),
//   culturalContext: text("cultural_context"), // Persian/Iranian business culture context
//   confidenceLevel: integer("confidence_level"), // AI confidence in this knowledge (1-100)
//   tags: json("tags").default([]), // Searchable tags
//   relatedKnowledge: json("related_knowledge").default([]), // Links to related knowledge
//   lastUsedAt: timestamp("last_used_at"),
//   isActive: boolean("is_active").default(true),
//   createdAt: timestamp("created_at").defaultNow(),
//   updatedAt: timestamp("updated_at").defaultNow()
// });

// AI Decision Log (لاگ تصمیم‌گیری هوش مصنوعی)
// export const aiDecisionLog = pgTable("ai_decision_log", {
//   id: serial("id").primaryKey(),
//   decisionId: text("decision_id").notNull().unique(),
//   decisionType: text("decision_type").notNull(), // "TASK_ASSIGNMENT", "PRIORITY_CHANGE", "LEVEL_CHANGE", "ESCALATION"
//   representativeId: integer("representative_id"),
//   inputData: json("input_data"), // Data used to make the decision
//   reasoning: text("reasoning").notNull(), // AI's reasoning process
//   confidenceScore: integer("confidence_score"), // How confident AI is (1-100)
//   expectedOutcome: text("expected_outcome"),
//   actualOutcome: text("actual_outcome"), // To be filled later for learning
//   contextFactors: json("context_factors"), // What factors influenced the decision
//   culturalConsiderations: json("cultural_considerations"), // Persian culture factors
//   alternativeOptions: json("alternative_options"), // Other options AI considered
//   decisionEffectiveness: integer("decision_effectiveness"), // Measured later (1-10)
//   learningPoints: text("learning_points"), // What AI learned from this decision
//   adminOverride: boolean("admin_override").default(false),
//   overrideReason: text("override_reason"),
//   createdAt: timestamp("created_at").defaultNow(),
//   evaluatedAt: timestamp("evaluated_at")
// });

// ==================== DA VINCI v1.0 SCHEMAS ====================

// AI Knowledge Database (دیتابیس دانش AI) - برای DA VINCI v1.0
// export const aiKnowledgeDatabase = pgTable("ai_knowledge_database", {
//   id: serial("id").primaryKey(),
//   category: text("category").notNull(), // "REPRESENTATIVE_BEHAVIOR", "COMMON_QUESTIONS", "CONCERNS", "SOLUTIONS"

//   // Representative Behavior Data
//   representativeStatus: text("representative_status"), // "ACTIVE", "INACTIVE", "TERMINATED"
//   behaviorType: text("behavior_type"), // "POSITIVE", "NEGATIVE", "NEUTRAL", "PROBLEMATIC"
//   behaviorDescription: text("behavior_description"),
//   testedApproaches: json("tested_approaches").default([]), // روش‌های تست شده
//   approachResults: json("approach_results").default([]), // نتایج روش‌ها
//   successRate: decimal("success_rate", { precision: 5, scale: 2 }),

//   // Common Questions & Concerns
//   questionCategory: text("question_category"), // "TECHNICAL", "FINANCIAL", "PROCEDURAL", "GENERAL"
//   questionText: text("question_text"),
//   recommendedAnswer: text("recommended_answer"),
//   alternativeAnswers: json("alternative_answers").default([]),

//   // General Knowledge
//   title: text("title"),
//   content: text("content"),
//   tags: json("tags").default([]),
//   applicableScenarios: json("applicable_scenarios").default([]),

//   // Metadata
//   sourceType: text("source_type"), // "MANAGER_INPUT", "HISTORICAL_DATA", "AI_ANALYSIS"
//   confidence: decimal("confidence", { precision: 5, scale: 2 }).default("0"),
//   usageCount: integer("usage_count").default(0),
//   effectivenessScore: decimal("effectiveness_score", { precision: 5, scale: 2 }),

//   isActive: boolean("is_active").default(true),
//   createdBy: text("created_by"),
//   lastUsedAt: timestamp("last_used_at"),
//   createdAt: timestamp("created_at").defaultNow(),
//   updatedAt: timestamp("updated_at").defaultNow()
// });

// ==================== DA VINCI v2.0 WORKSPACE SCHEMAS ====================

// Task Reports Analysis (تحلیل گزارشات وظایف) - AI Analysis Results
// export const taskReportsAnalysis = pgTable("task_reports_analysis", {
//   id: text("id").primaryKey(),
//   reportId: text("report_id").notNull(),
//   representativeId: integer("representative_id").notNull(),

//   // AI-extracted insights
//   keyInsights: json("key_insights").notNull(), // Array of key insights
//   culturalContext: json("cultural_context").notNull(), // Cultural factors
//   priorityLevel: text("priority_level").notNull(), // "LOW", "MEDIUM", "HIGH", "URGENT"
//   nextContactDate: text("next_contact_date"), // Persian date

//   // Follow-up actions generated by AI
//   followUpActions: json("follow_up_actions").notNull(), // Array of follow-up actions

//   // Representative profile updates
//   representativeUpdates: json("representative_updates").notNull(), // Suggested profile updates

//   // AI confidence and metadata
//   aiConfidence: integer("ai_confidence").default(75), // 1-100
//   processingModel: text("processing_model").default("XAI_GROK"),

//   createdAt: timestamp("created_at").defaultNow(),
//   updatedAt: timestamp("updated_at").defaultNow()
// });

// Workspace AI Reminders (یادآورهای هوشمند میز کار) - Auto-generated and manual reminders
// export const workspaceAiReminders = pgTable("workspace_ai_reminders", {
//   id: text("id").primaryKey(),
//   staffId: integer("staff_id").notNull(),
//   representativeId: integer("representative_id").notNull(),

//   // Reminder content
//   title: text("title").notNull(),
//   description: text("description").notNull(),
//   context: text("context"), // Background context from reports

//   // Scheduling
//   scheduledFor: text("scheduled_for").notNull(), // Persian datetime
//   scheduledTime: text("scheduled_time").default("07:00"), // Time in HH:MM format

//   // Source tracking
//   sourceType: text("source_type").notNull(), // "AI_GENERATED", "MANUAL", "FOLLOW_UP"
//   sourceId: text("source_id"), // ID of source (report, task, etc.)

//   // Status
//   status: text("status").default("ACTIVE"), // "ACTIVE", "COMPLETED", "DISMISSED"
//   completedAt: text("completed_at"), // Persian datetime

//   // Priority
//   priority: text("priority").default("MEDIUM"), // "LOW", "MEDIUM", "HIGH", "URGENT"

//   createdAt: timestamp("created_at").defaultNow(),
//   updatedAt: timestamp("updated_at").defaultNow()
// });

// AI Test Results (نتایج تست AI) - برای نمایش لاگ‌های تست
// export const aiTestResults = pgTable("ai_test_results", {
//   id: serial("id").primaryKey(),
//   testId: text("test_id").notNull().unique(), // UUID
//   testType: text("test_type").notNull(), // "API_KEY_TEST", "AI_CONFIG_TEST", "KNOWLEDGE_TEST", "OFFER_TEST"

//   // Test Context
//   relatedEntityType: text("related_entity_type"), // "SETTING", "STAFF", "KNOWLEDGE", "OFFER"
//   relatedEntityId: integer("related_entity_id"),
//   testParameters: json("test_parameters").default({}),

//   // Test Execution
//   testStarted: timestamp("test_started").defaultNow(),
//   testCompleted: timestamp("test_completed"),
//   testDuration: integer("test_duration"), // بر حسب میلی‌ثانیه

//   // Results
//   testStatus: text("test_status").notNull(), // "SUCCESS", "FAILED", "PARTIAL", "ERROR"
//   responseData: json("response_data").default({}),
//   errorMessage: text("error_message"),
//   warningMessages: json("warning_messages").default([]),

//   // Debug Information
//   debugLogs: json("debug_logs").default([]),
//   networkLogs: json("network_logs").default([]),
//   performanceMetrics: json("performance_metrics").default({}),

//   // Analysis
//   aiAnalysis: text("ai_analysis"),
//   recommendations: json("recommendations").default([]),

//   initiatedBy: text("initiated_by"),
//   createdAt: timestamp("created_at").defaultNow()
// });

// ==================== ZOD SCHEMAS ====================
export interface XaiTestResponse {
  success: boolean;
  model: string;
  responseTime: number;
  response: string;
  debugInfo: {
    requestPayload: any;
    responseHeaders: any;
    networkLatency: number;
  };
  error?: string;
}

export interface ManagerWorkspaceTask {
  id: string;
  title: string;
  description: string;
  assignedStaff?: {
    id: number;
    name: string;
  };
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONE_TIME';
  dailyTarget?: number;
  createdAt: string;
}

// Relations
export const representativesRelations = relations(representatives, ({ one, many }) => ({
  salesPartner: one(salesPartners, {
    fields: [representatives.salesPartnerId],
    references: [salesPartners.id]
  }),
  invoices: many(invoices),
  payments: many(payments)
}));

export const salesPartnersRelations = relations(salesPartners, ({ many }) => ({
  representatives: many(representatives),
  commissionPayments: many(partnerCommissionPayments)
}));

export const partnerCommissionPaymentsRelations = relations(partnerCommissionPayments, ({ one }) => ({
  salesPartner: one(salesPartners, {
    fields: [partnerCommissionPayments.salesPartnerId],
    references: [salesPartners.id]
  })
}));

// فاز ۱: Relations برای مدیریت دوره‌ای فاکتورها
export const invoiceBatchesRelations = relations(invoiceBatches, ({ many }) => ({
  invoices: many(invoices)
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  representative: one(representatives, {
    fields: [invoices.representativeId],
    references: [representatives.id]
  }),
  batch: one(invoiceBatches, {
    fields: [invoices.batchId],
    references: [invoiceBatches.id]
  })
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  representative: one(representatives, {
    fields: [payments.representativeId],
    references: [representatives.id]
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id]
  })
}));

export const invoiceEditsRelations = relations(invoiceEdits, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceEdits.invoiceId],
    references: [invoices.id]
  }),
  transaction: one(financialTransactions, {
    fields: [invoiceEdits.transactionId],
    references: [financialTransactions.transactionId]
  })
}));

export const financialTransactionsRelations = relations(financialTransactions, ({ one, many }) => ({
  representative: one(representatives, {
    fields: [financialTransactions.representativeId],
    references: [representatives.id]
  }),
  invoiceEdits: many(invoiceEdits)
}));

export const dataIntegrityConstraintsRelations = relations(dataIntegrityConstraints, ({ one }) => ({
  representative: one(representatives, {
    fields: [dataIntegrityConstraints.entityId],
    references: [representatives.id]
  })
}));

// Insert Schemas
export const insertRepresentativeSchema = omitInsert(createInsertSchema(representatives), "id", "publicId", "totalDebt", "totalSales", "credit", "createdAt", "updatedAt");

export const insertSalesPartnerSchema = omitInsert(createInsertSchema(salesPartners), "id", "totalCommission", "createdAt");
export const insertPartnerCommissionPaymentSchema = omitInsert(createInsertSchema(partnerCommissionPayments), "id", "createdAt", "updatedAt");

// فاز ۱: Insert Schema برای مدیریت دوره‌ای
export const insertInvoiceBatchSchema = omitInsert(createInsertSchema(invoiceBatches), "id", "totalInvoices", "totalAmount", "createdAt", "completedAt");

export const insertInvoiceSchema = omitInsert(createInsertSchema(invoices), "id", "invoiceNumber", "sentToTelegram", "telegramSentAt", "telegramSendCount", "createdAt");

export const insertTelegramSendHistorySchema = omitInsert(createInsertSchema(telegramSendHistory), "id", "sentAt");

export const insertPaymentSchema = omitInsert(createInsertSchema(payments), "id", "isAllocated", "createdAt");

export const insertActivityLogSchema = omitInsert(createInsertSchema(activityLogs), "id", "createdAt");

export const insertAdminUserSchema = omitInsert(createInsertSchema(adminUsers), "id", "lastLoginAt", "createdAt");

export const insertInvoiceEditSchema = omitInsert(createInsertSchema(invoiceEdits), "id", "createdAt");

export const insertFinancialTransactionSchema = omitInsert(createInsertSchema(financialTransactions), "id", "status", "completedAt", "createdAt");

export const insertDataIntegrityConstraintSchema = omitInsert(createInsertSchema(dataIntegrityConstraints), "id", "currentStatus", "lastValidationAt", "autoFixAttempts", "createdAt", "updatedAt");

export const insertSettingSchema = omitInsert(createInsertSchema(settings), "id", "updatedAt");

/*
export const insertAiConfigurationSchema = createInsertSchema(aiConfiguration).omit({
  id: true,
  configVersion: true,
  createdAt: true,
  updatedAt: true
});
*/

/*
export const insertAiKnowledgeBaseSchema = createInsertSchema(aiKnowledgeBase).omit({
  id: true,
  usageCount: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true
});

export const insertAiDecisionLogSchema = createInsertSchema(aiDecisionLog).omit({
  id: true,
  actualOutcome: true,
  decisionEffectiveness: true,
  learningPoints: true,
  adminOverride: true,
  overrideReason: true,
  createdAt: true,
  evaluatedAt: true
});
*/

// Types
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;

// فاز ۱: Types برای مدیریت دوره‌ای فاکتورها
export type InvoiceBatch = typeof invoiceBatches.$inferSelect;
export type InsertInvoiceBatch = z.infer<typeof insertInvoiceBatchSchema>;

export type Representative = typeof representatives.$inferSelect;
export type InsertRepresentative = z.infer<typeof insertRepresentativeSchema>;

export type SalesPartner = typeof salesPartners.$inferSelect;
export type InsertSalesPartner = z.infer<typeof insertSalesPartnerSchema>;

// Extended SalesPartner with calculated fields (for API responses)
export interface SalesPartnerWithCount extends SalesPartner {
  representativesCount?: number;
  totalSales?: number;
  totalDebt?: number;
  commissionDue?: number;
  commissionPaid?: number;
  commissionOutstanding?: number;
  lastSettlementAt?: string | null;
}

export type PartnerCommissionPayment = typeof partnerCommissionPayments.$inferSelect;
export type InsertPartnerCommissionPayment = z.infer<typeof insertPartnerCommissionPaymentSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export type InvoiceEdit = typeof invoiceEdits.$inferSelect;
export type InsertInvoiceEdit = z.infer<typeof insertInvoiceEditSchema>;

export type FinancialTransaction = typeof financialTransactions.$inferSelect;
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;

export type DataIntegrityConstraint = typeof dataIntegrityConstraints.$inferSelect;
export type InsertDataIntegrityConstraint = z.infer<typeof insertDataIntegrityConstraintSchema>;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

/*
export type AiConfiguration = typeof aiConfiguration.$inferSelect;
export type InsertAiConfiguration = z.infer<typeof insertAiConfigurationSchema>;
*/

export type TelegramSendHistory = typeof telegramSendHistory.$inferSelect;
export type InsertTelegramSendHistory = z.infer<typeof insertTelegramSendHistorySchema>;

// ==================== NEW EMPLOYEE & TELEGRAM MANAGEMENT TABLES ====================

// Employees (کارمندان)
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(), // شناسه تلگرام کارمند
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  username: text("username"), // نام کاربری تلگرام
  phone: text("phone"),
  email: text("email"),
  position: text("position"), // سمت شغلی
  department: text("department"), // بخش
  // managerId: integer("manager_id"), // مدیر مستقیم - حذف شده در migration
  isActive: boolean("is_active").default(true),
  // joinedAt: timestamp("joined_at").defaultNow(), // حذف شده در migration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Tasks (وظایف)
export const employeeTasks = pgTable("employee_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'generated', 'manual', 'telegram_command'
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, cancelled
  assignedToId: integer("assigned_to_id"), // employee ID
  createdById: integer("created_by_id"), // employee ID
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  metadata: json("metadata"), // اطلاعات اضافی مخصوص نوع وظیفه
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Telegram Groups (گروه‌های تلگرام)
export const telegramGroups = pgTable("telegram_groups", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull().unique(),
  title: text("title").notNull(),
  type: text("type").notNull(), // leave_requests, technical_reports, responsibilities, daily_reports, general
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow()
});

// Telegram Messages (پیام‌های تلگرام)
export const telegramMessages = pgTable("telegram_messages", {
  id: serial("id").primaryKey(),
  messageId: text("message_id").notNull(), // شناسه پیام تلگرام
  chatId: text("chat_id").notNull(),
  fromUserId: text("from_user_id").notNull(),
  employeeId: integer("employee_id"), // ارتباط با جدول employees
  text: text("text"),
  messageType: text("message_type").notNull(), // leave_request, technical_report, responsibility, daily_report, general_message
  parsedData: json("parsed_data"), // داده‌های استخراج شده
  entities: json("entities"), // موجودیت‌های شناسایی شده
  processed: boolean("processed").default(false),
  responseRequired: boolean("response_required").default(false),
  responseText: text("response_text"),
  responseSent: boolean("response_sent").default(false),
  taskCreated: boolean("task_created").default(false),
  createdTaskId: integer("created_task_id"),
  receivedAt: timestamp("received_at").notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow()
});

// Leave Requests (درخواست‌های مرخصی)
export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  telegramMessageId: integer("telegram_message_id"), // ارتباط با پیام تلگرام
  requestDate: text("request_date").notNull(), // تاریخ فارسی
  duration: text("duration").notNull(), // مدت مرخصی
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, denied
  reviewedById: integer("reviewed_by_id"),
  reviewedAt: timestamp("reviewed_at"),
  reviewComment: text("review_comment"),
  createdAt: timestamp("created_at").defaultNow()
});

// Technical Reports (گزارش‌های فنی)
export const technicalReports = pgTable("technical_reports", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  telegramMessageId: integer("telegram_message_id"),
  issue: text("issue").notNull(),
  status: text("status").notNull(), // reported, investigating, resolved
  priority: text("priority").default("medium"), // low, medium, high, critical
  assignedToId: integer("assigned_to_id"),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow()
});

// Daily Reports (گزارش‌های روزانه)
export const dailyReports = pgTable("daily_reports", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  telegramMessageId: integer("telegram_message_id"),
  reportDate: text("report_date").notNull(), // تاریخ فارسی
  tasks: json("tasks"), // لیست کارهای انجام شده
  challenges: text("challenges"), // چالش‌ها
  achievements: text("achievements"), // دستاوردها
  nextDayPlans: text("next_day_plans"), // برنامه‌های روز بعد
  createdAt: timestamp("created_at").defaultNow()
});

// ==================== RELATIONS ====================

export const employeesRelations = relations(employees, ({ one, many }) => ({
  // manager: one(employees, {
  //   fields: [employees.managerId],
  //   references: [employees.id]
  // }),
  // subordinates: many(employees), // زیردستان
  assignedTasks: many(employeeTasks), // وظایف تخصیص داده شده
  createdTasks: many(employeeTasks), // وظایف ایجاد شده
  telegramMessages: many(telegramMessages),
  leaveRequests: many(leaveRequests),
  technicalReports: many(technicalReports),
  dailyReports: many(dailyReports)
}));

export const employeeTasksRelations = relations(employeeTasks, ({ one }) => ({
  assignedTo: one(employees, {
    fields: [employeeTasks.assignedToId],
    references: [employees.id]
  }),
  createdBy: one(employees, {
    fields: [employeeTasks.createdById],
    references: [employees.id]
  }),
  relatedTelegramMessage: one(telegramMessages, {
    fields: [employeeTasks.id],
    references: [telegramMessages.createdTaskId]
  })
}));

export const telegramGroupsRelations = relations(telegramGroups, ({ many }) => ({
  messages: many(telegramMessages)
}));

export const telegramMessagesRelations = relations(telegramMessages, ({ one }) => ({
  employee: one(employees, {
    fields: [telegramMessages.employeeId],
    references: [employees.id]
  }),
  createdTask: one(employeeTasks, {
    fields: [telegramMessages.createdTaskId],
    references: [employeeTasks.id]
  }),
  leaveRequest: one(leaveRequests, {
    fields: [telegramMessages.id],
    references: [leaveRequests.telegramMessageId]
  }),
  technicalReport: one(technicalReports, {
    fields: [telegramMessages.id],
    references: [technicalReports.telegramMessageId]
  }),
  dailyReport: one(dailyReports, {
    fields: [telegramMessages.id],
    references: [dailyReports.telegramMessageId]
  })
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(employees, {
    fields: [leaveRequests.employeeId],
    references: [employees.id]
  }),
  reviewedBy: one(employees, {
    fields: [leaveRequests.reviewedById],
    references: [employees.id]
  }),
  telegramMessage: one(telegramMessages, {
    fields: [leaveRequests.telegramMessageId],
    references: [telegramMessages.id]
  })
}));

export const technicalReportsRelations = relations(technicalReports, ({ one }) => ({
  employee: one(employees, {
    fields: [technicalReports.employeeId],
    references: [employees.id]
  }),
  assignedTo: one(employees, {
    fields: [technicalReports.assignedToId],
    references: [employees.id]
  }),
  telegramMessage: one(telegramMessages, {
    fields: [technicalReports.telegramMessageId],
    references: [telegramMessages.id]
  })
}));

export const dailyReportsRelations = relations(dailyReports, ({ one }) => ({
  employee: one(employees, {
    fields: [dailyReports.employeeId],
    references: [employees.id]
  }),
  telegramMessage: one(telegramMessages, {
    fields: [dailyReports.telegramMessageId],
    references: [telegramMessages.id]
  })
}));

// ==================== APP DOWNLOADS & ANNOUNCEMENTS ====================
// برای مدیریت لینک‌های دانلود اپلیکیشن و اطلاعیه‌های پرتال عمومی

// App Downloads (لینک‌های دانلود اپلیکیشن)
export const appDownloads = pgTable("app_downloads", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // نام اپلیکیشن
  description: text("description"), // توضیحات کوتاه
  downloadLink: text("download_link").notNull(), // لینک دانلود مستقیم
  qrCodeUrl: text("qr_code_url"), // URL تصویر QR Code (اگر آپلود شود، مسیر فایل محلی)
  qrCodeFilePath: text("qr_code_file_path"), // مسیر فایل QR Code آپلود شده در سرور
  videoUrl: text("video_url"), // URL ویدئوی آموزشی (لینک یا مسیر فایل)
  videoFilePath: text("video_file_path"), // مسیر فایل ویدئو آپلود شده در سرور
  viewCount: integer("view_count").default(0), // تعداد بازدید/کلیک
  displayOrder: integer("display_order").default(0), // ترتیب نمایش
  isActive: boolean("is_active").default(true), // فعال/غیرفعال
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Announcements (اطلاعیه‌های مهم)
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // عنوان اطلاعیه
  content: text("content").notNull(), // محتوای اطلاعیه
  priority: integer("priority").default(0), // اولویت نمایش (بالاتر = مهم‌تر)
  type: text("type").default("info"), // info, warning, success, error
  isActive: boolean("is_active").default(true), // فعال/غیرفعال
  expiresAt: timestamp("expires_at"), // تاریخ انقضا (اختیاری)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Portal Content Blocks (Phase 1 additive, not yet consumed directly by portal UI)
export const portalContentBlocks = pgTable("portal_content_blocks", {
  id: serial("id").primaryKey(),
  blockKey: text("block_key").notNull().unique(), // guidance, contact_info, downloads_intro, support_hours, announcements_title
  title: text("title"),
  body: text("body").notNull().default(''),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow()
});

export type PortalContentBlock = typeof portalContentBlocks.$inferSelect;
export type InsertPortalContentBlock = typeof portalContentBlocks.$inferInsert;

// App Download Views (آمار بازدید اپلیکیشن‌ها)
// برای ثبت تاریخچه بازدید و تحلیل رفتار کاربران
export const appDownloadViews = pgTable("app_download_views", {
  id: serial("id").primaryKey(),
  appDownloadId: integer("app_download_id").notNull().references(() => appDownloads.id, { onDelete: "cascade" }),
  representativeId: integer("representative_id"), // نماینده‌ای که روی لینک کلیک کرده (optional)
  publicId: text("public_id"), // شناسه عمومی نماینده از URL پرتال
  ipAddress: text("ip_address"), // IP آدرس برای آمارگیری
  userAgent: text("user_agent"), // User agent مرورگر
  actionType: text("action_type").notNull().default("view"), // view, download, qr_scan
  createdAt: timestamp("created_at").defaultNow()
});

// Uploaded Files Metadata (متادیتای فایل‌های آپلود شده)
// برای مدیریت فایل‌های QR Code و Video
export const uploadedFiles = pgTable("uploaded_files", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(), // نام فایل اصلی
  storedFileName: text("stored_file_name").notNull().unique(), // نام منحصربفرد فایل در سرور (UUID)
  filePath: text("file_path").notNull(), // مسیر کامل فایل
  fileType: text("file_type").notNull(), // image/png, video/mp4, etc.
  fileSize: integer("file_size").notNull(), // اندازه فایل به بایت
  entityType: text("entity_type").notNull(), // app_download_qr, app_download_video
  entityId: integer("entity_id").notNull(), // ID موجودیت مرتبط
  uploadedBy: text("uploaded_by").notNull(), // نام کاربر آپلودکننده
  createdAt: timestamp("created_at").defaultNow()
});

// Import Jobs (پایش فرایند پردازش فایل‌های JSON) - Phase A instrumentation scaffold
export const importJobs = pgTable('import_jobs', {
  id: serial('id').primaryKey(),
  jobCode: text('job_code').notNull().unique(),
  sourceFileName: text('source_file_name'),
  status: text('status').notNull().default('pending'), // pending, validating, ingesting, enriching, completed, failed
  totalRecords: integer('total_records').default(0),
  processedRecords: integer('processed_records').default(0),
  errorCount: integer('error_count').default(0),
  startedAt: timestamp('started_at').defaultNow(),
  finishedAt: timestamp('finished_at'),
  lastError: text('last_error'),
  metadata: json('metadata').default({})
});
export type ImportJob = typeof importJobs.$inferSelect;
export type InsertImportJob = typeof importJobs.$inferInsert;
// TODO: Add relations if needed and extend services for create/update progress.

// ==================== ZOD SCHEMAS ====================

export const insertEmployeeSchema = omitInsert(createInsertSchema(employees), "id", "createdAt", "updatedAt");

export const insertEmployeeTaskSchema = omitInsert(createInsertSchema(employeeTasks), "id", "createdAt", "updatedAt");

export const insertTelegramGroupSchema = omitInsert(createInsertSchema(telegramGroups), "id", "createdAt");

export const insertTelegramMessageSchema = omitInsert(createInsertSchema(telegramMessages), "id", "createdAt");

export const insertLeaveRequestSchema = omitInsert(createInsertSchema(leaveRequests), "id", "createdAt");

export const insertTechnicalReportSchema = omitInsert(createInsertSchema(technicalReports), "id", "createdAt");

export const insertDailyReportSchema = omitInsert(createInsertSchema(dailyReports), "id", "createdAt");

export const insertReconciliationActionSchema = omitInsert(createInsertSchema(reconciliationActions), "id", "createdAt", "appliedAt");

// State Management Types (E-C6)
export type IngestionState = typeof ingestionState.$inferSelect;
export type InsertIngestionState = typeof ingestionState.$inferInsert;
export type ProcessStep = typeof processSteps.$inferSelect;
export type InsertProcessStep = typeof processSteps.$inferInsert;

export const insertIngestionStateSchema = createInsertSchema(ingestionState);
export const insertProcessStepSchema = createInsertSchema(processSteps);

export const insertOutboxSchema = omitInsert(createInsertSchema(outbox), "id", "createdAt");

export const insertThresholdConfigSchema = omitInsert(createInsertSchema(thresholdConfig), "id", "createdAt", "updatedAt");

export const insertAppDownloadSchema = omitInsert(createInsertSchema(appDownloads), "id", "viewCount", "createdAt", "updatedAt");

export const insertAnnouncementSchema = omitInsert(createInsertSchema(announcements), "id", "createdAt", "updatedAt");

export const insertAppDownloadViewSchema = omitInsert(createInsertSchema(appDownloadViews), "id", "createdAt");

export const insertUploadedFileSchema = omitInsert(createInsertSchema(uploadedFiles), "id", "createdAt");

// ==================== TYPES ====================

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type EmployeeTask = typeof employeeTasks.$inferSelect;
export type InsertEmployeeTask = z.infer<typeof insertEmployeeTaskSchema>;

export type TelegramGroup = typeof telegramGroups.$inferSelect;
export type InsertTelegramGroup = z.infer<typeof insertTelegramGroupSchema>;

export type TelegramMessage = typeof telegramMessages.$inferSelect;
export type InsertTelegramMessage = z.infer<typeof insertTelegramMessageSchema>;

export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;

export type TechnicalReport = typeof technicalReports.$inferSelect;
export type InsertTechnicalReport = z.infer<typeof insertTechnicalReportSchema>;

export type DailyReport = typeof dailyReports.$inferSelect;
export type InsertDailyReport = z.infer<typeof insertDailyReportSchema>;

export type Outbox = typeof outbox.$inferSelect;
export type InsertOutbox = z.infer<typeof insertOutboxSchema>;

export type ThresholdConfig = typeof thresholdConfig.$inferSelect;
export type InsertThresholdConfig = z.infer<typeof insertThresholdConfigSchema>;

export type AppDownload = typeof appDownloads.$inferSelect;
export type InsertAppDownload = z.infer<typeof insertAppDownloadSchema>;

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

export type AppDownloadView = typeof appDownloadViews.$inferSelect;
export type InsertAppDownloadView = z.infer<typeof insertAppDownloadViewSchema>;

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;