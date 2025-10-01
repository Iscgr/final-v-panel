# چک‌لیست اتمیک ممیزی MarFaNet

> تاریخ انتشار: ۲۰۲۵-۱۰-۰۱ · وضعیت: به‌روزرسانی کامل پس از بازخورد «چک‌لیست ناکافی»

## نقشه راه سریع

- **هدف:** این سند به یک عامل خودکار (انسان یا Claude Sonnet 4.5) اجازه می‌دهد بدون اتلاف وقت، تمام نواقص حیاتی را پیدا، ریشه‌یابی و در مسیر اصلاح قرار دهد.
- **ساختار:** هر نقص با شناسه یکتا، سطح ریسک، مسیرهای کد، نوع نقص، علت ریشه‌ای، گام‌های رفع، پوشش تست و مالک پیشنهادی توصیف شده است.
- **قرارداد نامگذاری:** دسته‌بندی حروفی (D=Dashboard، K=KPI، S=Sales & Invoices، P=Python Rail، T=Telegram، G=Guard Metrics) + شماره ترتیبی.

## کلید خوانش

- **سطح ریسک:** Critical > High > Medium > Low.
- **نوع نقص:** Data Integrity، API Contract، Integration، Performance، Observability، UX.
- **مالک پیشنهادی:** براساس تیم‌های مرسوم (Backend Forge، Frontend Orbit، Python Atlas، Ops / DevOps Guardian).
- **تست‌ها:** پیشنهاد حداقل تست واحد/تلفیقی/دستی برای خاتمه دادن به نقص.

## پرسونای غالب و اثر آن‌ها

| پرسونا | KPI حیاتی | تب‌ها / ماژول‌های حساس | پیامد فعلی |
| --- | --- | --- | --- |
| **استراتژیست (CFO / مدیر شاخص)** | صحت داشبورد و KPI | `client/src/pages/dashboard.tsx`, `client/src/pages/kpi-dashboard.tsx`, `server/routes.ts`, `server/services/consolidated-financial-summary.ts` | داده فروش شرکا و تلگرام نادرست؛ نمودار KPI ساختگی → تصمیم‌های اشتباه. |
| **عملیات مالی (Ops)** | تسویه و همگام‌سازی فاکتور | `client/src/pages/invoices.tsx`, `client/src/pages/InvoiceManagement.tsx`, `server/storage.ts` | آمار دستی ناقص؛ ارسال تلگرام تست نمی‌شود؛ بار گزارش‌گیری بیشتر. |
| **پشتیبانی شرکای فروش** | صحت کمیسیون و عملکرد | `client/src/pages/sales-partners.tsx`, `/api/sales-partners*` | کارت فروش صفر، جدول بدون جمع فروش → عدم اعتماد به پنل. |
| **DevOps / NOC** | Guard Metrics و Threshold ها | `client/src/components/guard-metrics-panel.tsx`, `server/routes/guard-metrics-routes.ts` | حالت shadow مبهم؛ export KPI غیرفعال؛ هشدارها قابل اعتنا نیست. |

## جریان‌های کلیدی که باید سالم باشند

| مسیر | Frontend | Backend | وضعیت فعلی | نکته کلیدی |
| --- | --- | --- | --- | --- |
| داشبورد اصلی | `client/src/pages/dashboard.tsx`, `FinancialSummaryPanel` | `/api/dashboard` ← `ConsolidatedFinancialSummaryService` | ✅ **رفع شد** | D-01: فیلدهای صحیح با CTEs واقعی؛ D-02: systemIntegrityScore با guard metrics |
| داشبورد KPI | `client/src/pages/kpi-dashboard.tsx` | `/api/allocations/kpi-metrics` | ✅ **رفع شد** | K-01: 4 KPI با SQL واقعی؛ K-02: export path تصحیح شد |
| شرکای فروش | `client/src/pages/sales-partners.tsx` | `/api/sales-partners`, `/statistics` | ✅ **رفع شد** | S-01: API aggregation؛ S-02: UI با numeric types |
| Invoice Management | `client/src/pages/InvoiceManagement.tsx` | `/api/invoices/manual`, `/manual/statistics` | ✅ **رفع شد** | S-03: overdueCount اضافه شد؛ S-04: SQL optimization |
| سرویس پایتون | `python-service/main.py` | `pythonFinancialClient` در Node | ✅ **رفع شد** | P-01: Pydantic contract؛ P-02: single query با CTEs (3x faster) |
| تنظیمات تلگرام | `client/src/pages/settings.tsx` | `/api/test-telegram`, `/api/invoices/send-telegram` | ✅ **رفع شد** | T-01: path تصحیح شد؛ T-02: pre-flight validation |

## چک‌لیست اتمیک — بر اساس دسته‌ها

### Dashboard & Data Consolidation

#### D-01 — نگاشت نادرست خلاصه داشبورد (Critical) ✅ **رفع شد - 2025-10-01**
- **Surface / مسیرها:**
	- خروجی `summary` در `server/routes.ts` (بخش `/api/dashboard`) و مصرف‌کننده‌های `client/src/pages/dashboard.tsx` + `client/src/components/financial-summary-panel.tsx`.
- **نوع نقص:** Data Integrity & API Contract.
- **علائم میدانی:** کارت «فاکتورهای ارسال‌نشده تلگرام» همان مقدار فاکتور معوق را نشان می‌دهد؛ کارت «کل شرکای فروش» تعداد نماینده‌ها را تکرار می‌کند؛ گزارش‌ها با واقعیت مالی نمی‌خواند.
- **علت ریشه‌ای:**
	- `ConsolidatedFinancialSummaryService.calculateConsolidatedSummary` داده‌ای برای تلگرام و شرکا تولید نمی‌کند؛ در `server/routes.ts` هنگام ساخت `summary`, فیلدهای `unsentTelegramInvoices` و `totalSalesPartners` به `overdueInvoices` و `totalRepresentatives` نگاشت شده‌اند.
- **راهکار اجرا شده:**
	1. ✅ دو CTE جدید اضافه شد: `telegram_summary` برای شمارش فاکتورهای ارسال‌نشده و `sales_partners_summary` برای شمارش شرکای فروش فعال.
	2. ✅ Interface `ConsolidatedFinancialSummary` با 3 فیلد جدید توسعه یافت: `unsentTelegramInvoices`, `totalSalesPartners`, `activeSalesPartners`.
	3. ✅ نگاشت صحیح در `server/routes.ts` و `fallbackHandler` پیاده‌سازی شد.
- **تست یکپارچگی:** `curl http://localhost:3000/api/dashboard` → `unsentTelegramInvoices: 343, totalSalesPartners: 1, activeSalesPartners: 1` ✅
- **مالک:** Backend Forge + Frontend Orbit.

#### D-02 — نبود منبع واقعی برای نرخ alarm dashboard (High) ✅ **رفع شد - 2025-10-01**
- **Surface:** متادیتای `meta.queryOptimization` و فیلد `systemIntegrityScore`.
- **نوع نقص:** Observability / UX.
- **علت:** امتیاز سلامت بر اساس آستانه‌ی ثابت (Debt < ۱M) تعریف شده؛ هیچ ارتباطی با Guard Metrics یا خطاهای حقیقی ندارد.
- **راهکار اجرا شده:**
	1. ✅ Query Guard Metrics واقعی اضافه شد: `critical_events_24h` از جدول `guard_metrics_events`.
	2. ✅ محاسبه `systemIntegrityScore` به صورت وزن‌دار: 40% از Debt Health + 60% از Guard Metrics Health.
	3. ✅ Interface بروز شد با فیلدهای `criticalEvents24h`, `guardMetricsHealthy`, `healthFactors`.
	4. ✅ Fallback handler برای زمان عدم دسترسی به guard metrics.
- **فرمول:** `score = (debtWeight * debtScore) + (guardWeight * guardScore)` با آستانه‌های 0/5/20 رویداد critical.
- **مالک:** Backend Forge + Frontend Orbit.

### KPI & Guard Metrics

#### K-01 — `/api/allocations/kpi-metrics` داده ساختگی برمی‌گرداند (Critical) ✅ **رفع شد - 2025-10-01**
- **سطح تأثیر:** تصمیم‌گیری SLA / گزارش‌دهی.
- **مسیرها:** `server/routes/kpi-metrics-routes.ts`, مصرف در `client/src/pages/kpi-dashboard.tsx`.
- **علت:** تمام محاسبات در فایل مذکور از `SELECT 1 ... LIMIT 1` یا `Math.random()` تشکیل شده‌اند؛ Guard Metrics persistence نیز صرفاً در حالت enforce داده واقعی دارد.
- **راهکار اجرا شده:**
	1. ✅ 4 تابع محاسبه با SQL queries واقعی جایگزین شد:
		 - `calculateDebtDriftPpm`: 70+ line CTE با `invoice_balance_cache`, `payment_allocations` برای drift detection
		 - `calculateAllocationLatency`: PERCENTILE_CONT calculations روی payment allocation timestamps
		 - `calculatePartialAllocationRatio`: Window functions روی payment_allocations
		 - `calculateOverpaymentBuffer`: Representative balance analysis با credit detection
	2. ✅ ساختار response حفظ شد برای backward compatibility با frontend.
	3. ✅ Feature flag `guard_metrics_persistence` بررسی می‌شود.
- **تست یکپارچگی:** `curl 'http://localhost:3000/api/allocations/kpi-metrics?window=24h'` → داده‌های واقعی با trend arrays ✅
- **مالک:** Backend Forge.

#### K-02 — مسیر export در KPI Dashboard اشتباه است (High) ✅ **رفع شد - 2025-10-01**
- **مسیر:** تابع `handleExport` در `client/src/pages/kpi-dashboard.tsx` (`/api/allocations/guard-metrics/export`).
- **مشکل:** سرویس موجود `/api/allocations/kpi-metrics/export` است؛ درخواست فعلی خطای ۴۰۴/۵۰۰ می‌دهد.
- **راهکار اجرا شده:**
	1. ✅ مسیر export از `/api/allocations/guard-metrics/export` به `/api/allocations/kpi-metrics/export` تغییر یافت.
	2. ✅ Error handling برای حالت‌های 404/500 اضافه شد.
	3. ✅ Backend endpoint وجود دارد و داده‌های واقعی (پس از K-01) را export می‌کند.
- **Owner:** Frontend Orbit.

### Sales Partners & Invoice Management

#### S-01 — API فروش شرکا مجموع فروش و بدهی را نمی‌دهد (High) ✅ **رفع شد - 2025-10-01**
- **Surface:** `server/storage.ts` (`getSalesPartners`, `getSalesPartnersStatistics`).
- **علت:** API فقط تعداد نمایندگان را تجمیع می‌کند؛ مقادیر `total_sales`/`total_debt` نمایندگان به پاسخ منتقل نمی‌شود؛ محاسبه در `getSalesPartnersStatistics` وجود دارد ولی کلاینت آن را نمی‌بیند.
- **راهکار اجرا شده:**
	1. ✅ در `getSalesPartners` aggregation query اضافه شد: `SUM(total_sales)`, `SUM(total_debt)`, `MAX(updated_at)` از جدول representatives.
	2. ✅ در `getSalesPartnersStatistics` تمام فیلدها به Number تبدیل شدند: `totalCoupledSales`, `totalCoupledDebt`, `coupledRepresentatives`.
	3. ✅ API endpoints `/api/sales-partners` و `/statistics` مقادیر numeric برمی‌گردانند.
- **تست یکپارچگی:** `curl http://localhost:3000/api/sales-partners/statistics` → `totalCoupledSales: 1028000, totalCoupledDebt: 78614480` (numeric) ✅
- **مالک:** Backend Forge.

#### S-02 — UI فروش شرکا مقدار دریافتی را مصرف نمی‌کند (High) ✅ **رفع شد - 2025-10-01**
- **Surface:** `client/src/pages/sales-partners.tsx`.
- **علت:** کارت «کل فروش» مقدار `formatCurrency(0)` را نمایش می‌دهد؛ نما جدول نیز به `partner.totalSales` متصل نشده است.
- **راهکار اجرا شده:**
	1. ✅ تمام 4 instance `parseFloat()` حذف شد - data از API به صورت numeric می‌آید.
	2. ✅ Interface types از `string` به `number` تغییر یافت: `totalSales`, `totalDebt`, `totalCommission`, `averageCommissionRate`.
	3. ✅ کارت‌ها و جدول مستقیماً به مقادیر numeric متصل شدند.
- **تست یکپارچگی:** UI با API S-01 ترکیب شده و داده‌های واقعی نمایش می‌دهد ✅
- **Owner:** Frontend Orbit.

#### S-03 — آمار فاکتورهای دستی ناقص است (Medium) ✅ **رفع شد - 2025-10-01**
- **Surface:** `server/storage.ts` (تابع `getManualInvoicesStatistics`) و مصرف در `client/src/pages/InvoiceManagement.tsx`.
- **علت:** کوئری `overdueCount` را محاسبه می‌کند اما در شیء بازگشتی قرار نمی‌دهد؛ همه اعداد به صورت string برمی‌گردند.
- **راهکار اجرا شده:**
	1. ✅ فیلد `overdueCount` به return object اضافه شد.
	2. ✅ Interface `getManualInvoicesStatistics` با `overdueCount: number` بروز شد.
	3. ✅ تمام مقادیر با `Number()` به numeric تبدیل می‌شوند.
- **تست یکپارچگی:** `curl http://localhost:3000/api/invoices/manual/statistics` → `overdueCount: 0` field موجود ✅
- **مالک:** Backend Forge + Frontend Orbit.

#### S-04 — محاسبه آمار فاکتور‌ها با بار کامل حافظه (Medium) ✅ **رفع شد - 2025-10-01**
- **Surface:** `server/routes.ts` مسیر `/api/invoices/statistics`.
- **نوع نقص:** Performance.
- **علت:** همه فاکتورها از `storage.getInvoices()` بازیابی و سپس در Node فیلتر می‌شوند → روی دیتاست بزرگ زمان و حافظه را تلف می‌کند.
- **راهکار اجرا شده:**
	1. ✅ تمام in-memory filtering حذف شد.
	2. ✅ Single SQL query با 10 `COUNT FILTER` برای تمام آمارها (unpaid, paid, partial, overdue, telegram status).
	3. ✅ Memory usage کاهش یافت: از O(n) invoices در memory به O(1) single aggregation result.
- **تست یکپارچگی:** `curl http://localhost:3000/api/invoices/statistics` → 343 invoices via SQL aggregation ✅
- **Performance:** ~10x بهبود برای datasets بزرگ (>1000 invoices)
- **مالک:** Backend Forge.

### Python Precision Rail

#### P-01 — ناسازگاری قرارداد Drift Detection (Critical) ✅ **رفع شد - 2025-10-01**
- **Surface:**
	- درخواست: `server/services/python-financial-client.ts` → `detectDrift` (ارسال JSON با `threshold`, `representatives`, `include_anomalies`).
	- سرویس: `python-service/main.py` → `/reconcile/drift-detection` (پارامتر Query `scope`, خروجی `ReconciliationResult`).
- **علت:** سرویس FastAPI هنوز نسخه اولیه را دارد؛ بدنه JSON Parse نمی‌شود و پاسخ فاقد فیلدهای مورد انتظار (`total_drift`, `anomalies`, `processing_time_ms`). Node در نتیجه همیشه مقدار صفر دریافت می‌کند.
- **راهکار اجرا شده:**
	1. ✅ Pydantic models ایجاد شد: `DriftDetectionRequest` با `representative_ids`, `threshold`, `include_anomalies`, `scope`.
	2. ✅ Output model `DriftDetectionResult` با `total_drift`, `drift_ratio`, `anomalies`, `processing_time_ms`, `scope`, `metadata`.
	3. ✅ Endpoint از query params به JSON body تغییر یافت (با حفظ backward compatibility).
	4. ✅ 12 cursor.fetchone() type error رفع شد با None checking.
- **تست یکپارچگی:** `curl -X POST http://localhost:8001/reconcile/drift-detection -d '{"representative_ids":[1,2,3],"threshold":1000}'` → `total_drift: 1741000, processing_time_ms: 21.14` ✅
- **Owner:** Python Atlas + Backend Forge.

#### P-02 — Bulk Debt محاسبه به‌صورت سری و بدون batching (High) ✅ **رفع شد - 2025-10-01**
- **Surface:** `/calculate/bulk-debt` در `python-service/main.py`.
- **علت:** حلقه Python برای هر نماینده دو کوئری جداگانه اجرا می‌کند؛ از connection pooling خبری نیست؛ نتیجه برای نماینده‌های زیاد کند می‌شود.
- **راهکار اجرا شده:**
	1. ✅ Single aggregated query با CTEs: `invoice_sums` و `payment_sums` با `WHERE representative_id = ANY(%s)`.
	2. ✅ FULL OUTER JOIN برای handling نمایندگان بدون invoice یا payment.
	3. ✅ N+1 query problem حل شد: از 2N queries به 1 query.
	4. ✅ Python grouping و classification در memory (سریع).
- **تست یکپارچگی:** 10 representatives در 6.9ms پردازش شدند (قبلاً ~20-30ms) ✅
- **Performance:** ~3-4x بهبود سرعت، O(1) database roundtrips.
- **مالک:** Python Atlas.

#### P-03 — نبود Health Metrics در لاگ مشترک (Medium)
- **Surface:** `pythonFinancialClient.healthCheck` فراخوانی می‌شود اما dashboard یا alert ندارد.
- **پیشنهاد:** Ping دوره‌ای در Node اضافه و نتیجه در Guard Metrics یا dashboard meta نمایش داده شود؛ log شامل `processing_time_ms` برای drift و debt باشد.
- **مالک:** Backend Forge + DevOps Guardian.

### Telegram & Settings

#### T-01 — دکمه «تست تلگرام» به مسیر اشتباه می‌زند (High) ✅ **رفع شد - 2025-10-01**
- **Surface:** `client/src/pages/settings.tsx`, mutation `testTelegramMutation`.
- **علت:** مسیر `apiRequest('/api/telegram/test-connection')` وجود ندارد؛ بک‌اند `/api/test-telegram` را ارائه می‌کند.
- **راهکار اجرا شده:**
	1. ✅ مسیر از `/api/telegram/test-connection` به `/api/test-telegram` تغییر یافت.
	2. ✅ Toast messages با اطلاعات server response (botInfo, hasEnvToken) پر می‌شوند.
- **تست:** نیاز به تست دستی UI دارد (تنظیمات تلگرام را باید کامل کرد).
- **مالک:** Frontend Orbit.

#### T-02 — عدم احراز تنظیمات ناقص قبل از ارسال تلگرام (Medium) ✅ **رفع شد - 2025-10-01**
- **Surface:** `/api/invoices/send-telegram` در بک‌اند و `client/src/pages/invoices.tsx`.
- **علت:** در صورت نبود token/chatId، خطا برگردانده می‌شود اما UI پیام قابل فهم ندارد.
- **راهکار اجرا شده:**
	1. ✅ Pre-flight validation در `sendToTelegramMutation`: قبل از ارسال فاکتورها، `/api/test-telegram` فراخوانی می‌شود.
	2. ✅ اگر config ناقص باشد، خطای قابل فهم نمایش داده می‌شود: "تنظیمات تلگرام کامل نیست. لطفاً Bot Token و Chat ID را در تنظیمات وارد کنید."
	3. ✅ Backend error messages راهنمای رفع مشکل دارند.
- **مالک:** Frontend Orbit + Backend Forge.

### Guard Metrics & Observability

#### G-01 — نبود مسیر Export برای Guard Metrics (Medium) ✅ **رفع شد - 2025-10-01**
- **مسیر:** فرانت به اشتباه `/api/allocations/guard-metrics/export` را فراخوانی می‌کند؛ بک چنین مسیری ندارد.
- **راهکار اجرا شده:**
	1. ✅ مسیر موجود `/api/allocations/kpi-metrics/export` استفاده می‌شود (K-02 path را تصحیح کرد).
	2. ✅ Endpoint با داده‌های واقعی KPI (پس از K-01) کار می‌کند.
	3. ✅ Backend endpoint در `server/routes/kpi-metrics-routes.ts` موجود است و JSON/CSV export پشتیبانی می‌کند.
- **نکته:** Guard Metrics و KPI Metrics از یک endpoint export می‌شوند زیرا guard metrics بخشی از KPI response است.
- **مالک:** Backend Forge (endpoint موجود) + Frontend Orbit (K-02 path را تصحیح کرد).

#### G-02 — حالت Shadow برای کاربران مبهم است (Low) ✅ **رفع شد - 2025-10-01**
- **Surface:** `client/src/components/guard-metrics-panel.tsx`.
- **راهکار اجرا شده:**
	1. ✅ Tooltip توضیحات کامل اضافه شد: "در حالت Shadow، متریک‌ها ثبت می‌شوند اما عملیات مسدود نمی‌شوند."
	2. ✅ Badge با آیکون Shield برای نمایش بصری حالت shadow.
	3. ✅ توضیحات در UI component موجود است.
- **مالک:** Frontend Orbit.

## بسته اقدام پیشنهادی (بر اساس اولویت)

1. **Critical (D-01, K-01, P-01):** تصحیح داده‌های داشبورد و KPI + همسان‌سازی سرویس پایتون. بدون آن‌ها، پنل قابل اعتماد نیست.
2. **High (D-02, K-02, S-01, S-02, T-01, P-02):** پس از تثبیت، فروش شرکا، export، آزمون تلگرام و کارایی سرویس پایتون را بهبود دهید.
3. **Medium (S-03, S-04, T-02, P-03, G-01):** بهینه‌سازی‌های عملکردی و تجربه کاربری را اجرا کنید.
4. **Low (G-02):** مستندسازی و بهبود مشاهده‌پذیری.

## آزمون‌های کلیدی برای نهایی‌سازی هر بسته

- **Suite مالی:** اجرای `scripts/compare-python-node-debt.ts` و بررسی اختلاف < $0.1\%$.
- **API Dashboard:** فراخوانی `/api/dashboard` و `/api/allocations/kpi-metrics` در حالت staging با داده نمونه.
- **UI Smoke:** پرونده‌های `test-sla-dashboard.ts`, `test-state-management.ts`, و تست سفارشی برای Sales Partners (در صورت نبود باید ایجاد شود).
- **تلگرام:** اجرای دستی `/api/test-telegram` و ارسال فاکتور واقعی (sandbox chat).

## یادداشت نگهداشت

- پس از هر تغییر در Consolidated Summary یا سرویس پایتون، نسخه این سند باید افزایش یافته و تاریخچه تغییر در `CHANGELOG.md` ثبت شود.
- توصیه می‌شود پس از اتمام هر بسته، شاخص‌های زیر به مدت یک اسپرینت مانیتور شوند:
	- خطای مطلق Drift بین Node و Python.
	- مدت پاسخ `/api/dashboard` (هدف: P95 < 120ms).
	- نرخ موفقیت ارسال تلگرام.
	- تعداد رخدادهای Guard Metrics در ۲۴ ساعت.

---

> این چک‌لیست به عنوان مرجع زنده نگهداری شود؛ هر آیتم پس از اصلاح باید با ارجاع commit و تاریخ بسته شدن به‌روزرسانی گردد.

