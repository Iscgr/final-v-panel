# چک‌لیست اتمیک ریفکتور (Atomic Refactor Master Checklist)

> سطح پوشش: Page -> Section -> Component -> Data Flow -> UX State -> Performance -> A11y -> Observability
> Legend: `P` = Page, `S` = Section, `C` = Component, `DF` = Data Flow, `UX` = UX State, `PFX` = Performance, `A11Y` = Accessibility, `OBS` = Observability

---
## P1: Dashboard (داشبورد اصلی)

### S1: Layout Frame
- [x] C: PageContainer (grid responsive: mobile 1col, desktop 12-col) (انجام شد و با SidebarContext بهبود یافت)
- [x] C: PageHeader (عنوان، زیرعنوان داینامیک، آخرین بروزرسانی) (نسخه ابتدایی)
- [x] UX: Skeleton pre-layout هنگام بارگذاری اولیه (DashboardSkeleton ثابت ارتفاع بخش‌ها)
- [x] PFX: Avoid layout shift (ارتفاع ثابت هدر + placeholder KPI ثابت)
- [x] A11Y: `<header role="banner">` + heading hierarchy

### S2: KPI Summary Strip
- [x] C: StatCard (مجموع فاکتورها، پرداخت شده، معوق، نرخ وصول، رشد دوره‌ای) (اسکفلد + مقداردهی واقعی)
- [x] DF: useQuery(fetchKPI) با `staleTime=60_000`
- [x] UX: Refresh indicator (spinning border) در حالت refetch background (TODO: *نمایش آیکن در نسخه بعد – آماده سازی isFetching*)
- [x] PFX: Memo گروه کارت‌ها با React.memo + key پایدار
- [x] A11Y: هر کارت با `aria-label` عدد + توضیح

### S3: JSON Upload & Processing
- [x] C: UploadZone (Drag & Drop + Button) (اسکفلد)
- [x] C: FileValidationList (نمایش نتیجه اعتبارسنجی)
- [x] C: ProcessingProgressBar (نوار درصد + مرحله فعلی)
- [x] C: ErrorPanel (لیست خطاهای پارس / اسکیمای نامعتبر)
- [x] DF: Local parse -> schema validate (zod) -> enqueue API `/ingest` -> poll job (شبیه‌سازی – اتصال واقعی بعداً)
- [x] UX: State Machine (idle -> selecting -> validating -> uploading -> processing -> success | error | partial)
- [x] UX: انیمیشن transition بین مراحل (Fade + scale) (✅ تکمیل شد - SPA routing مسائل حل شد و اپلیکیشن کاملاً عملیاتی)
- [x] PFX: Web Worker برای پارس اگر فایل > 1MB (✅ تکمیل شد - json-parser.worker.ts + json-parser-service.ts + use-json-parser.ts)
- [x] PFX: Debounce برای نمایش فایل‌های خطادار (✅ تکمیل شد - debounce.ts + use-debounce.ts + upload-debounce-service.ts + use-upload-debounce.ts + DebounceTest.tsx)
- [x] A11Y: پشتیبانی کیبورد برای انتخاب فایل + اعلان ARIA live برای پیشرفت
- [x] OBS: Event log (upload_start, upload_success, upload_fail) => console + future telemetry

### S4: Recent Activity / Timeline
- [x] C: ActivityFeed (virtual list) (اسکفلد اولیه بدون virtualization)
 - [x] DF: useQuery(fetchRecentActivity, interval: 30s optimized via `refetchIntervalInBackground`)
 - [x] PFX: Windowing با `react-virtualized` یا native virtualization ساده
 - [x] UX: Badge نوع رویداد (ایجاد فاکتور، ویرایش، حذف، خطای سیستم)

### S5: Charting & Trends
- [x] C: RevenueTrendChart (sparklined SVG اولیه + lazy)
- [x] C: AgingBucketChart (ستونی ساده + lazy)
- [x] DF: Parallel queries + Suspense boundaries تفکیک‌شده
- [x] PFX: Lazy load ماژول chart (dynamic import)
- [x] A11Y: `desc` SVG + جدول داده جایگزین (toggle نمایش جدول در هر نمودار)

### S6: Alerts & Thresholds
- [x] C: AlertBanner (وضعیت‌های بحرانی KPI)
- [x] DF: Derived از KPI Query + business rules (collectionRate<60%, periodGrowth<0, overdueRatio>15%)
- [x] UX: قابلیت dismiss محلی (localStorage persist)

### S7: Quick Actions Panel
- [x] C: ActionButtonGroup (ایجاد نماینده، بارگذاری فاکتور، گزارش PDF) – پایه (Console stub)
- [x] UX: Show/hide براساس سطح دسترسی (role) – فیلتر ساده roles آرایه‌ای

---
## P2: Representatives (نمایندگان)

### S1: Representatives List View
- [x] C: DataTable (ستون‌ها: نام، کد، منطقه، وضعیت، عملکرد مالی، آخرین فعالیت)
- [x] C: ColumnFilterBar (جستجو، فیلتر نقش، وضعیت فعال/غیرفعال)
- [ ] C: BulkSelectionToolbar (فعال‌سازی، غیرفعال‌سازی، ارسال اعلان)
- [x] DF: useQuery(listRepresentatives, pagination + server filters)
- [ ] DF: Prefetch نماینده روی hover ردیف
- [ ] PFX: Row virtualization
- [ ] UX: EmptyState + NoResultsState جداگانه
- [ ] A11Y: Table semantics: `role=grid`, focus row navigation

### S2: Representative Profile (Route: /representatives/:id)
- [ ] C: ProfileHeader (عکس، نام، وضعیت، آخرین بروزرسانی، دکمه عملیات سریع)
- [ ] C: StatusBadge (active / suspended / pending)
- [ ] C: TabNav (تب‌ها: Overview, Financial, Contracts, Activity, Documents, Audit Log)

#### Overview Tab
- [ ] C: InfoGrid (Email, Region, Join Date, Performance Tier)
- [ ] C: KPIQuad (Gross Sales, Net Settlement, Outstanding, Dispute Ratio)
- [ ] DF: Aggregated API `/representatives/:id/overview`
- [ ] UX: Skeleton cards + progressive hydration

#### Financial Tab
- [ ] C: SettlementTable (Settlement cycles, amounts, status)
- [ ] C: AgingAnalysisPanel
- [ ] C: ProjectionMiniChart
- [ ] DF: Parallel queries + dependent query برای Projection
- [ ] PFX: Cache segmentation per representative id

#### Contracts Tab
- [ ] C: ContractList (نام، نسخه، تاریخ شروع، تاریخ پایان، وضعیت)
- [ ] C: ContractVersionDiffModal
- [ ] DF: Lazy fetch on tab activation
- [ ] UX: Inline version compare

#### Activity Tab
- [ ] C: ActivityTimeline (filterable)
- [ ] DF: paginate descending by timestamp

#### Documents Tab
- [ ] C: DocumentManager (لیست فایل، آپلود، حذف، دانلود)
- [ ] C: FileTypeIconResolver
- [ ] DF: Signed URL pattern
- [ ] PFX: Parallel upload queue + retry backoff
- [ ] A11Y: Drag & Drop keyboard equivalent

#### Audit Log Tab
- [ ] C: AuditEntryTable (actor, action, entity, before/after snapshot)
- [ ] DF: server-side cursor pagination

### S3: Representative Create/Edit Form
- [ ] C: FormWizard (Steps: Base Info -> Financial Params -> Access -> Confirmation)
- [ ] C: ValidationSummary
- [ ] DF: Optimistic mutation + invalidate selective queries
- [ ] UX: Step transitions + dirty state guard (before unload)
- [ ] A11Y: Proper labeling + error region live

### S4: Notifications & Role-Based UI
- [ ] C: PermissionGuard wrapper
- [ ] DF: Auth context consumption + role matrix

---
## P3: Invoices (لیست فاکتورها)

### S1: Invoice Table
- [ ] C: DataTable (ستون‌ها: شماره، تاریخ، مشتری، مبلغ، وضعیت، نماینده، عملیات)
- [ ] C: AdvancedFilterPanel (وضعیت، بازه تاریخ، مبلغ، نماینده)
- [ ] C: QuickSearch (debounced)
- [ ] DF: Query key compositional (`['invoices', filters, page]`)
- [ ] PFX: Query cancellation on filter change
- [ ] UX: Sticky header + loading overlay نیمه شفاف

### S2: Invoice Detail Drawer (/invoices/:id)
- [ ] C: DrawerLayout + SectionTabs (Summary, Lines, Allocations, History)
- [ ] C: StatusTimeline (Issued -> Sent -> Paid -> Archived)
- [ ] DF: Prefetch on table row focus

### S3: Bulk Operations
- [ ] C: BulkBar (Export CSV, Mark Paid, Assign Representative)
- [ ] DF: Batch mutation endpoint
- [ ] UX: Snackbar نتیجه عملیات + rollback در خطا

### S4: Inline Editing
- [ ] C: EditableCell (amount, dueDate)
- [ ] DF: Mutate + optimistic patch
- [ ] PFX: Throttle commits

---
## P4: Invoice Management (مدیریت پیشرفته فاکتور)

### S1: Invoice Creation Wizard
- [ ] C: WizardStepper
- [ ] Steps: Base Info -> Customer -> Line Items -> Tax & Discounts -> Review -> Confirm
- [ ] C: LineItemsEditor (add/remove/reorder)
- [ ] DF: Derived totals + validation (zod schema)

### S2: Allocation Engine Panel
- [ ] C: AllocationConfigForm
- [ ] C: AllocationPreviewTable
- [ ] DF: POST /allocation/simulate -> show diff

### S3: Batch Import Processor
- [ ] C: ImportFileDropzone
- [ ] C: ParseResultSummary
- [ ] DF: Streaming parse + incremental progress events (SSE/WebSocket)

### S4: Rollback / Audit Tools
- [ ] C: RollbackHistoryList
- [ ] C: ChangeDiffModal
- [ ] DF: Audit trail endpoint consumption

---
## P5: KPI Dashboard (KPI مالی)

### S1: Metric Selector
- [ ] C: MetricMultiSelect
- [ ] DF: Query metrics catalog

### S2: Comparative Panels
- [ ] C: ComparisonGrid (Period vs Period)
- [ ] DF: Parallel queries w/ time range params

### S3: Export / Sharing
- [ ] C: ExportMenu (PNG, CSV, PDF)
- [ ] DF: Server render endpoint (/export/report)

---
## P6: Sales Partners (همکاران فروش)

### S1: Partner List
- [ ] C: DataTable (نام، نوع، وضعیت، منطقه، عملکرد)

### S2: Partner Profile (مشابه Representatives Profile با تب‌های سفارشی)
- [ ] Tabs: Overview, Contracts, Performance, Incentives, Documents

### S3: Incentive Engine
- [ ] C: IncentiveRuleTable
- [ ] C: RuleEditorModal
- [ ] DF: Versioned ruleset API

---
## P7: Settings (تنظیمات)

### S1: Account Settings
- [ ] C: ProfileForm (نام، ایمیل، رمز عبور، MFA Toggle)

### S2: System Configuration
- [ ] C: ConfigGroupAccordion
- [ ] C: FeatureFlagToggleList

### S3: Access Control
- [ ] C: RoleMatrixTable
- [ ] DF: Permissions fetch + cache

---
## P8: Public Portal / Representative Portal

### S1: Public Portal Shell
- [ ] C: PortalHeader (نام برند + وضعیت)
- [ ] C: AccessGuard (اعتبار لینک + انقضا)

### S2: Invoice Snapshot View
- [ ] C: PublicInvoiceCard
- [ ] DF: One-time token fetch

### S3: Representative Performance Public
- [ ] C: MiniKPICards
- [ ] DF: Restricted scope API

### S4: Theming & Isolation
- [ ] C: ThemedLayout (tailwind isolated scope)
- [ ] PFX: Tree shaking unused admin components

---
## Cross-Cutting Concerns (مقطعی)

### CC1: State Management Strategy
- [x] React Query برای Server State + Context سبک برای Auth/Layout
- [ ] اجتناب از global mutable singleton ها

### CC2: Error Handling & Boundary
- [x] C: GlobalErrorBoundary
- [ ] C: QueryErrorToastAdapter

### CC3: Loading Patterns
- [ ] Skeletal placeholders per section
- [ ] Suspense boundaries تفکیک شده

### CC4: Theming / RTL
- [x] پشتیبانی کامل RTL + Light/Dark Toggle (زیرساخت اولیه با Design Tokens)
- [ ] Theme switcher و تست در تمام صفحات

### CC5: Performance Budget
- [ ] Initial JS < 250KB gzip
- [ ] Interaction latency < 100ms for primary actions

### CC6: Accessibility KPIs
- [ ] Lighthouse a11y >= 95
- [ ] Keyboard trap audit برای modals

### CC7: Observability
- [ ] Basic telemetry hooks (log mount/unmount heavy sections)
- [ ] Timing API for critical flows

### CC8: Security UI
- [ ] CSRF token propagation in forms
- [ ] Mask sensitive fields

---
## Traceability Mapping (شناسه ردیابی)

| Trace ID | Scope | وابسته |
|----------|-------|---------|
| P1-S3-DF | Dashboard Upload Flow | API Ingest |
| P2-S2-FIN | Representative Financial Tab | Metrics Service |
| P3-S1-PFX | Invoice Table Virtualization | Data Volume |
| P4-S3-DF | Batch Import Streaming | Worker Pool |
| P5-S2-DF | Comparative Metrics | Time Range Filters |
| P8-S2-DF | Public Invoice Fetch | Token Validation |

---
> این چک‌لیست «مرجع واحد» برای اجرای ریفکتور است. هر آیتم قبل از پیاده‌سازی باید وضعیت (TODO / In Progress / Done) دریافت کند.
