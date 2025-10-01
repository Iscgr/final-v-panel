# Changelog

## [Unreleased]

### Added - تکمیل چک‌لیست اتمیک ممیزی (۱ اکتبر ۲۰۲۵)

#### 🔴 Critical Fixes
- **D-01**: تصحیح mapping فیلدهای dashboard - افزودن CTEs برای `telegram_summary` و `sales_partners_summary` در `ConsolidatedFinancialSummaryService`. فیلدهای `unsentTelegramInvoices` و `totalSalesPartners` دیگر به فیلدهای اشتباه map نمی‌شوند.
- **K-01**: جایگزینی Mock data با queries واقعی در `/api/allocations/kpi-metrics` - تمام ۴ تابع (`calculateDebtDriftPpm`, `calculateAllocationLatency`, `calculatePartialAllocationRatio`, `calculateOverpaymentBuffer`) از SQL واقعی استفاده می‌کنند.
- **P-01**: همسان‌سازی قرارداد Python drift detection - افزودن Pydantic models (`DriftDetectionRequest`, `DriftDetectionResult`) با پشتیبانی از JSON body. endpoint حالا `total_drift`, `drift_ratio`, `anomalies`, `processing_time_ms` برمی‌گرداند.

#### 🟡 High Priority Fixes
- **S-01/S-02**: Sales Partners API & UI - افزودن financial aggregation (`totalSales`, `totalDebt`, `lastActivity`) در `getSalesPartners`, تبدیل string به number در `getSalesPartnersStatistics`, اصلاح UI برای نمایش داده‌های واقعی.
- **P-02**: بهینه‌سازی bulk debt calculation - جایگزینی N+1 loop با single aggregated query استفاده از CTEs. Performance: ۱۰ نماینده در ~۷ms (قبلاً ~۳۰ms).
- **T-01**: تصحیح مسیر test telegram از `/api/telegram/test-connection` به `/api/test-telegram` در `settings.tsx`.
- **K-02**: تصحیح مسیر export KPI از `/api/allocations/guard-metrics/export` به `/api/allocations/kpi-metrics/export` در `kpi-dashboard.tsx`.
- **D-02**: اتصال `systemIntegrityScore` به guard metrics واقعی - الگوریتم: `debtScore - (criticalEvents × 5) - (warnEvents × 2)`, محدوده ۰-۱۰۰.

#### 🟢 Medium Priority Fixes
- **S-03**: افزودن `overdueCount` به `getManualInvoicesStatistics` interface و return object.
- **S-04**: بهینه‌سازی `/api/invoices/statistics` با single SQL query + `COUNT FILTER` به جای fetch all + in-memory filtering.
- **T-02**: افزودن validation پیش از ارسال تلگرام در `invoices.tsx` و `invoice-upload.tsx` - بررسی `/api/test-telegram` قبل از `/api/invoices/send-telegram`.
- **G-01**: مستندسازی endpoint موجود `/api/allocations/kpi-metrics/export` (قبلاً وجود داشت اما path در frontend اشتباه بود).
- **G-02**: افزودن توضیحات Shadow/Enforce modes در `guard-metrics-panel.tsx` با UI بهتر.

### Performance Improvements
- Python bulk debt calculation: ۳× سریع‌تر (۳۰ms → ۷ms برای ۱۰ نماینده)
- Invoice statistics: حذف fetch all invoices از memory
- Dashboard CTE query: اضافه شدن guard metrics بدون افزایش قابل توجه زمان

### Testing & Validation
تست یکپارچگی انجام شده:
- ✅ D-01: `unsentTelegramInvoices=343`, `totalSalesPartners=1`, `activeSalesPartners=1`
- ✅ K-01: KPI metrics با SQL واقعی (debtDriftPpm, allocationLatency structure کامل)
- ✅ P-01: Python drift detection `total_drift=1741000`, `processing=21ms`
- ✅ S-01: `totalCoupledSales=1028000`, `totalCoupledDebt=78614480` (numeric)
- ✅ S-03: `overdueCount` field موجود در manual invoices statistics
- ✅ S-04: `totalInvoices=343` via single SQL query
- ✅ P-02: bulk debt `10 reps در 6.9ms`

### Removed / Refactored (Financial Integrity Hardcodes)
- حذف تمام اعداد هاردکد مربوط به مجموع بدهی سیستم (`186099690` و `183146990`) از:
	- `unified-financial-engine.verifyTotalDebtSum`
	- روت‌های: `/api/unified-financial/verify-total-debt` و `/api/unified-financial/calculate-immediate-debt-sum`
- جایگزینی مقایسه‌های ثابت با منطق پویا و استفاده اختیاری از متغیر محیطی `EXPECTED_DASHBOARD_DEBT`.
- افزودن threshold پویای بدهکاران از طریق ENV: `MIN_DEBT_THRESHOLD` (پیش‌فرض 1000) در `getDebtorRepresentatives`.
- جلوگیری از بروز خطاهای ورودی اعشاری در limit با نرمال‌سازی عددی.

### Added
- ENV اختیاری: `EXPECTED_DASHBOARD_DEBT` برای مانیتورینگ تحلیلی (در صورت عدم تعریف، مقایسه ثابت انجام نمی‌شود).
- ENV: `MIN_DEBT_THRESHOLD` برای کنترل حداقل بدهی ورود به لیست بدهکاران.

### Technical Notes / Breaking Change
- فیلدهای `expectedAmount` و مقایسه‌های accuracy اکنون می‌توانند `null` باشند اگر ENV مرجع تعریف نشده باشد (به‌روزرسانی مصرف‌کنندگان ضروری است).
- لاگ ها اکنون پیام: `No EXPECTED_DASHBOARD_DEBT env provided` یا مقدار dynamic را چاپ می‌کنند.


## v0.34.0 (Multi-Payment FIFO Allocation)
- NEW: مهاجرت به معماری Direct Multi-Payment Allocation (هر تخصیص = رکورد مستقل).
- ADDED: `invalidateFinancialCaches` برای ابطال متمرکز کش.
- UPDATED: بازگردانی کارت خلاصه مالی نماینده در دیالوگ جزئیات.
- FIXED: عدم نمایش فوری نماینده جدید (یکپارچه سازی کلید `/representatives`).
- FIXED: نقص تخصیص پرداخت (عدم ثبت invoiceId) در حالت خودکار.
- FIXED: UX دکمه ذخیره ویرایش فاکتور با پیام علت غیرفعال بودن.
- DOCS: به‌روزرسانی مستندات مالی و اضافه شدن بخش معماری جدید تخصیص.

## Deprecated (Pending Removal)
- مسیرهای قدیمی auto-allocation پس‌ازپرداخت (موتور تخصیص سرور) – در حال حاضر به عنوان fallback نگه داشته می‌شود.

## Next
- کاهش نویز لاگ های SHERLOCK در محیط production.
- تست E2E گسترده شامل سناریو overpayment و partial multi-invoice.
