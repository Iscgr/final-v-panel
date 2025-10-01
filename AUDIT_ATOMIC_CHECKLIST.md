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
| داشبورد اصلی | `client/src/pages/dashboard.tsx`, `FinancialSummaryPanel` | `/api/dashboard` ← `ConsolidatedFinancialSummaryService` | ⚠️ نقشه فیلدها غلط | `unsentTelegramInvoices` به جای انباشت ارسال‌نشده، تعداد overdue را نشان می‌دهد؛ فروش شرکا = تعداد نماینده. |
| داشبورد KPI | `client/src/pages/kpi-dashboard.tsx` | `/api/allocations/kpi-metrics` | ⛔ Mock | داده‌ها از کوئری واقعی نمی‌آید؛ export به مسیر اشتباه متصل است. |
| شرکای فروش | `client/src/pages/sales-partners.tsx` | `/api/sales-partners`, `/statistics` | ⚠️ ناقص | API مقادیر فروش/کمیسیون را جمع نمی‌کند؛ UI رقم ۰ نشان می‌دهد. |
| Invoice Management | `client/src/pages/InvoiceManagement.tsx` | `/api/invoices/manual`, `/manual/statistics` | ⚠️ ناقص | آمار overdue برگشت داده نمی‌شود؛ رشته‌ها parse نشده. |
| سرویس پایتون | `python-service/main.py` | `pythonFinancialClient` در Node | ⚠️ ناسازگار | Drift detection پاسخ ناسازگار با انتظار Node؛ bulk debt بدون batching. |
| تنظیمات تلگرام | `client/src/pages/settings.tsx` | `/api/test-telegram`, `/api/invoices/send-telegram` | ⚠️ ۴۰۴ تست | فرانت به `/api/telegram/test-connection` می‌زند؛ بک فقط `/api/test-telegram` دارد. |

## چک‌لیست اتمیک — بر اساس دسته‌ها

### Dashboard & Data Consolidation

#### D-01 — نگاشت نادرست خلاصه داشبورد (Critical)
- **Surface / مسیرها:**
	- خروجی `summary` در `server/routes.ts` (بخش `/api/dashboard`) و مصرف‌کننده‌های `client/src/pages/dashboard.tsx` + `client/src/components/financial-summary-panel.tsx`.
- **نوع نقص:** Data Integrity & API Contract.
- **علائم میدانی:** کارت «فاکتورهای ارسال‌نشده تلگرام» همان مقدار فاکتور معوق را نشان می‌دهد؛ کارت «کل شرکای فروش» تعداد نماینده‌ها را تکرار می‌کند؛ گزارش‌ها با واقعیت مالی نمی‌خواند.
- **علت ریشه‌ای:**
	- `ConsolidatedFinancialSummaryService.calculateConsolidatedSummary` داده‌ای برای تلگرام و شرکا تولید نمی‌کند؛ در `server/routes.ts` هنگام ساخت `summary`, فیلدهای `unsentTelegramInvoices` و `totalSalesPartners` به `overdueInvoices` و `totalRepresentatives` نگاشت شده‌اند.
- **چرا خطرناک است:** تصمیم‌های استراتژیک (پرداخت کمیسیون، SLA تلگرام) بر اساس ارقام جعلی گرفته می‌شوند؛ اختلاف حساب تا زمان گزارش ماهانه کشف نمی‌شود.
- **گام‌های رفع:**
	1. در `ConsolidatedFinancialSummaryService`, CTE جداگانه‌ای برای شمارش فاکتورهای ارسال‌نشده (`invoices.sent_to_telegram = false`) و تعداد شرکای فعال از جدول `sales_partners` اضافه کنید.
	2. پاسخ سرویس را توسعه داده و در `server/routes.ts` مپ فیلدها را به مقادیر جدید متصل کنید (مثلاً `summary.unsentTelegramInvoices = consolidatedData.unsentTelegramInvoices`).
	3. در صورت فعال بودن fallback (unifiedFinancialEngine)، مقادیر جدید را نیز محاسبه کنید تا در حالت degrade هم دقیق باشند.
- **تست‌ها:**
	- تست واحد برای `ConsolidatedFinancialSummaryService` که مقادیر `unsentTelegramInvoices`، `totalSalesPartners` را برای سناریوی پایه و با داده ساختگی اعتبارسنجی کند.
	- تست E2E در `test-thresholds.ts` یا اسکریپت Cypress برای بررسی UI کارت‌ها پس از درج داده نمونه.
- **مالک پیشنهادی:** Backend Forge + Frontend Orbit.
- **وابستگی:** نیازمند دسترسی به جدول `sales_partners` و `telegram_send_history` (در صورت استفاده برای شمارش دقیق ارسال). در صورت نبود، برنامه‌ی نهایی باید شماری از منابع را مشخص کند.

#### D-02 — نبود منبع واقعی برای نرخ alarm dashboard (High)
- **Surface:** متادیتای `meta.queryOptimization` و فیلد `systemIntegrityScore`.
- **نوع نقص:** Observability / UX.
- **علت:** امتیاز سلامت بر اساس آستانه‌ی ثابت (Debt < ۱M) تعریف شده؛ هیچ ارتباطی با Guard Metrics یا خطاهای حقیقی ندارد.
- **ریسک:** شاخص سلامت سبز باقی می‌ماند حتی اگر Guard Metrics هشدار قرمز صادر کند → مدیر فکر می‌کند همه‌چیز خوب است.
- **گام‌های رفع:**
	1. پس از واقعی‌سازی KPI (K-01) و Guard Metrics (G-01)، مقدار `systemIntegrityScore` را از ترکیب `guard_metrics` و `debt_drift_ppm` بسازید.
	2. در UI، توضیح Tooltip برای امتیاز اضافه کنید که نشان دهد از چه شاخص‌هایی تشکیل شده است.
	3. تست Snapshot یا Jest برای کارت‌ها که تغییر مقدار و Tooltip را تأیید کند.
- **مالک:** Backend Forge + Frontend Orbit.

### KPI & Guard Metrics

#### K-01 — `/api/allocations/kpi-metrics` داده ساختگی برمی‌گرداند (Critical)
- **سطح تأثیر:** تصمیم‌گیری SLA / گزارش‌دهی.
- **مسیرها:** `server/routes/kpi-metrics-routes.ts`, مصرف در `client/src/pages/kpi-dashboard.tsx`.
- **علت:** تمام محاسبات در فایل مذکور از `SELECT 1 ... LIMIT 1` یا `Math.random()` تشکیل شده‌اند؛ Guard Metrics persistence نیز صرفاً در حالت enforce داده واقعی دارد.
- **گام‌های رفع:**
	1. برای هر KPI، کوئری واقعی روی جداول موجود طراحی کنید:
		 - Debt drift: استفاده از `invoice_balance_cache` و `payment_allocations` (مشابه سرویس Python) → ذخیره در جدول snapshot یا محاسبه لحظه‌ای با محدودیت زمانی.
		 - Allocation latency: خواندن از لاگ‌های `allocation_monitoring` اگر موجود است؛ در غیر این صورت instrumentation جدید اضافه کنید.
		 - Partial allocation ratio: از `payment_allocations` و `invoices` با Window function.
		 - Overpayment buffer: بر اساس `representatives.total_sales` و `total_debt`.
	2. ساختار پاسخ را بدون تغییر نگه دارید تا Frontend نیاز به اصلاح بزرگ نداشته باشد.
	3. Feature flag `guard_metrics_persistence` را بررسی کنید؛ در صورت خاموش بودن، API باید `success:false` با پیام راهنما بدهد.
- **تست‌ها:**
	- Jest/tsx برای اطمینان از رندر شدن اعداد واقعی در `kpi-dashboard` با mock fetch.
	- تست یکپارچگی SQL (یا Playwright) برای صحت خروجی JSON.
- **مالک:** Backend Forge.

#### K-02 — مسیر export در KPI Dashboard اشتباه است (High)
- **مسیر:** تابع `handleExport` در `client/src/pages/kpi-dashboard.tsx` (`/api/allocations/guard-metrics/export`).
- **مشکل:** سرویس موجود `/api/allocations/kpi-metrics/export` است؛ درخواست فعلی خطای ۴۰۴/۵۰۰ می‌دهد.
- **رفع:** مسیر را به `/api/allocations/kpi-metrics/export` تغییر دهید؛ هندل خطای قابل‌فهم برای کاربر اضافه کنید؛ در سمت سرور، اطمینان حاصل کنید فرمت CSV/JSON داده واقعی (K-01) را استفاده می‌کند.
- **تست:** تست Jest برای `handleExport` با Mock fetch و سناریوی خطا؛ smoke دستی دانلود فایل.
- **Owner:** Frontend Orbit.

### Sales Partners & Invoice Management

#### S-01 — API فروش شرکا مجموع فروش و بدهی را نمی‌دهد (High)
- **Surface:** `server/storage.ts` (`getSalesPartners`, `getSalesPartnersStatistics`).
- **علت:** API فقط تعداد نمایندگان را تجمیع می‌کند؛ مقادیر `total_sales`/`total_debt` نمایندگان به پاسخ منتقل نمی‌شود؛ محاسبه در `getSalesPartnersStatistics` وجود دارد ولی کلاینت آن را نمی‌بیند.
- **پیامد:** کارت «کل فروش» و ستون «کل فروش» در UI صفر است؛ تیم همکاری فروش نمی‌تواند عملکرد را بسنجد.
- **گام‌ها:**
	1. در `getSalesPartners` یک JOIN با `representatives` اضافه کنید و جمع `total_sales`, `total_debt`، آخرین فعالیت و ... را برگردانید.
	2. در `getSalesPartnersStatistics` فیلدهای `totalCoupledSales`, `totalCoupledDebt` را به‌صورت عددی (Number) ارسال کنید، نه string.
	3. مسیر `/api/sales-partners`, `/statistics` را برای مقادیر جدید تطبیق دهید (از JSON.stringify اضافی پرهیز).
- **تست:**
	- تست واحد در storage با پایگاه آزمایشی.
	- تست UI (React Testing Library) برای تریگر کارت‌ها با داده جدید.
- **مالک:** Backend Forge.

#### S-02 — UI فروش شرکا مقدار دریافتی را مصرف نمی‌کند (High)
- **Surface:** `client/src/pages/sales-partners.tsx`.
- **علت:** کارت «کل فروش» مقدار `formatCurrency(0)` را نمایش می‌دهد؛ نما جدول نیز به `partner.totalSales` متصل نشده است.
- **گام‌ها:**
	1. مقدار کارت را از `stats.totalCoupledSales` بخوانید؛ در جدول، `partner.totalSales` را نمایش دهید.
	2. برای درصد کمیسیون، اگر `commissionRate` string است، قبل از format آن را به عدد تبدیل کنید تا رنگ‌بندی درست شود.
- **تست:** Snapshot برای کارت‌ها، تست تعامل فیلتر.
- **Owner:** Frontend Orbit.

#### S-03 — آمار فاکتورهای دستی ناقص است (Medium)
- **Surface:** `server/storage.ts` (تابع `getManualInvoicesStatistics`) و مصرف در `client/src/pages/InvoiceManagement.tsx`.
- **علت:** کوئری `overdueCount` را محاسبه می‌کند اما در شیء بازگشتی قرار نمی‌دهد؛ همه اعداد به صورت string برمی‌گردند.
- **گام‌ها:**
	1. مقدار `overdueCount` را در نتیجه بازگشت اضافه کنید و مقادیر عددی را با `Number()` تبدیل کنید.
	2. سمت فرانت در بخش آمار، مقدار جدید را نمایش داده و تست‌های موجود را بروزرسانی کنید.
- **مالک:** Backend Forge + Frontend Orbit (برای نمایش).
- **تست:** تست API (supertest) برای تأیید وجود `overdueCount`؛ تست UI برای دیده شدن مقدار.

#### S-04 — محاسبه آمار فاکتور‌ها با بار کامل حافظه (Medium)
- **Surface:** `server/routes.ts` مسیر `/api/invoices/statistics`.
- **نوع نقص:** Performance.
- **علت:** همه فاکتورها از `storage.getInvoices()` بازیابی و سپس در Node فیلتر می‌شوند → روی دیتاست بزرگ زمان و حافظه را تلف می‌کند.
- **راهکار پیشنهادی:** کوئری منفرد با `COUNT FILTER` (مشابه رویکرد manual) برای فاکتورهای سیستمی نیز استفاده کنید.
- **تست:** Benchmark قبل/بعد و تست واحد.
- **مالک:** Backend Forge.

### Python Precision Rail

#### P-01 — ناسازگاری قرارداد Drift Detection (Critical)
- **Surface:**
	- درخواست: `server/services/python-financial-client.ts` → `detectDrift` (ارسال JSON با `threshold`, `representatives`, `include_anomalies`).
	- سرویس: `python-service/main.py` → `/reconcile/drift-detection` (پارامتر Query `scope`, خروجی `ReconciliationResult`).
- **علت:** سرویس FastAPI هنوز نسخه اولیه را دارد؛ بدنه JSON Parse نمی‌شود و پاسخ فاقد فیلدهای مورد انتظار (`total_drift`, `anomalies`, `processing_time_ms`). Node در نتیجه همیشه مقدار صفر دریافت می‌کند.
- **گام‌های رفع:**
	1. مدل ورودی Pydantic با فیلدهای `representative_ids: List[int]`, `threshold: Decimal`, `include_anomalies: bool`, `scope: str` ایجاد کنید و در endpoint استفاده نمایید.
	2. خروجی را با مدل جدیدی که `total_drift`, `drift_ratio`, `anomalies`, `processing_time_ms` شامل شود برگردانید؛ مقدار `legacy_sum` و ... را در `anomalies` یا `meta` قرار دهید.
	3. Node client را فقط برای نگاشت فیلد اضافی (در صورت نیاز) بروزرسانی کنید.
- **تست:**
	- تست واحد Python با `TestClient` برای ورودی/خروجی جدید.
	- تست یکپارچه Node (استفاده از `scripts/compare-python-node-debt.ts`) برای بررسی مقدار drift.
- **Owner:** Python Atlas + Backend Forge.

#### P-02 — Bulk Debt محاسبه به‌صورت سری و بدون batching (High)
- **Surface:** `/calculate/bulk-debt` در `python-service/main.py`.
- **علت:** حلقه Python برای هر نماینده دو کوئری جداگانه اجرا می‌کند؛ از connection pooling خبری نیست؛ نتیجه برای نماینده‌های زیاد کند می‌شود.
- **راهکار:**
	1. با یک کوئری `IN (representative_ids)` داده فاکتورها و پرداخت‌ها را جمع‌آوری و سپس در Python گروه‌بندی کنید.
	2. از `psycopg2.pool.SimpleConnectionPool` یا حداقل یک اتصال singleton استفاده کنید.
	3. مقادیر `invoice_count`, `payment_count`, تاریخ آخرین فاکتور/پرداخت را نیز در کوئری جمع‌آوری کنید تا با انتظار Node هماهنگ شود.
- **تست:** آزمون کارایی (شرط baseline < 1s برای ۱۰۰ نماینده)، تست واحد برای صحت خروجی.

#### P-03 — نبود Health Metrics در لاگ مشترک (Medium)
- **Surface:** `pythonFinancialClient.healthCheck` فراخوانی می‌شود اما dashboard یا alert ندارد.
- **پیشنهاد:** Ping دوره‌ای در Node اضافه و نتیجه در Guard Metrics یا dashboard meta نمایش داده شود؛ log شامل `processing_time_ms` برای drift و debt باشد.
- **مالک:** Backend Forge + DevOps Guardian.

### Telegram & Settings

#### T-01 — دکمه «تست تلگرام» به مسیر اشتباه می‌زند (High)
- **Surface:** `client/src/pages/settings.tsx`, mutation `testTelegramMutation`.
- **علت:** مسیر `apiRequest('/api/telegram/test-connection')` وجود ندارد؛ بک‌اند `/api/test-telegram` را ارائه می‌کند.
- **رفع:** مسیر را تصحیح کرده و پیام‌های بازخورد را از پاسخ سرور (botInfo, hasEnvToken) پر کنید.
- **تست:** تست واحد React برای mutation، smoke دستی ارسال پیام.

#### T-02 — عدم احراز تنظیمات ناقص قبل از ارسال تلگرام (Medium)
- **Surface:** `/api/invoices/send-telegram` در بک‌اند.
- **علت:** در صورت نبود token/chatId، خطا برگردانده می‌شود اما UI پیام قابل فهم ندارد.
- **پیشنهاد:** پیش از فراخوانی ارسال، Config را بررسی و پیام مناسب در UI نمایش دهید؛ همچنین در بک‌اند، پیام خطا شامل راهکار باشد.

### Guard Metrics & Observability

#### G-01 — نبود مسیر Export برای Guard Metrics (Medium)
- **مسیر:** فرانت به اشتباه `/api/allocations/guard-metrics/export` را فراخوانی می‌کند؛ بک چنین مسیری ندارد.
- **راهکار:** یا مسیر موجود برای KPI را استفاده کنید (K-02) یا Endpoint جدیدی ایجاد کنید که snapshot را خروجی دهد؛ در هر صورت، مستندات UI باید توضیح دهد کدام داده export می‌شود.
- **تست:** واحد برای endpoint جدید + تست دانلود.

#### G-02 — حالت Shadow برای کاربران مبهم است (Low)
- **Surface:** `client/src/components/guard-metrics-panel.tsx`.
- **پیشنهاد:** پیام وضعیت برای Shadow اضافه و در README/Runbook جدول رفتار فلگ‌ها درج شود.

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

