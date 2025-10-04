# برنامه عملیاتی دیباگ چندفازه MarFaNet – 1404/07/12

> خروجی این سند برای هدایت کامل پنج فاز دیباگ است و در برگیرنده ایزوله‌سازی محیط، اسکن ۳۶۰ درجه سامانه و چک‌لیست‌های عملیاتی با جزئیات در سه محور فرانت‌اند، بک‌اند و تجربه کاربری است.

---

## ۱. ایزوله‌سازی و آماده‌سازی محیط

- [ ] ایجاد شاخه‌ی کاری مستقل (پیشنهاد: `feature/five-phase-debug`) و فعال‌سازی Git hooks اندازه‌گیری لاگ.
- [ ] تهیه بکاپ کامل از پایگاه داده فعلی با `docker compose exec -T db pg_dump -U postgres marfanet > backups/pre-debug-$(date +%F-%H%M).sql`.
- [ ] فعال‌سازی لاگ ساختاریافته (سطح `debug`) در `.env` آزمایشی برای ردگیری فلو‌های مالی و محتوا.
- [ ] همگام‌سازی `uploads/` و ثبت هش SHA256 برای بازرسى تطابق پس از تست.
- [x] اجرای smoke تست پایه (`npm run check`, `npm run test:outbox`) جهت اطمینان از سلامت فعلی قبل از تغییرات.
- [ ] مستندسازی نسخه‌های سرویس پایتونی و Node جهت ردیابی ناسازگاری احتمالی.

## ۲. اسکن ۳۶۰° لایه‌ها و وابستگی‌ها

```mermaid
graph LR
  subgraph AdminPanel[React Admin Panel]
    IM[InvoiceManagement.tsx]
    SF[SalesPartnersPage]
    RP[RepresentativeProfile]
    PC[PortalContentManager]
    ST[SettingsBackupTab]
  end

  subgraph API[Express API / server/routes]
    MI[/api/invoices/create-manual]
    SP[/api/sales-partners/*]
    RPAPI[/api/representatives/*]
    PCAPI[/api/portal-content/*]
    BKAPI[/api/system/backup]
  end

  subgraph Services[Domain Services]
    DBM[database-manager.ts]
    OUT[Outbox Worker]
    FF[Feature Flag Manager]
    PCSRV[portal-content service]
    BKSRV[backup orchestration]
  end

  subgraph Data[(PostgreSQL + Redis + Storage)]
    invoices[(invoices, manual_invoices_view)]
    salesPartners[(sales_partners, partner_commissions)]
    reps[(representatives, representative_profiles)]
    portal[(portal_content_blocks, announcements, app_downloads)]
    backups[(backup_audit_log, s3/minio bucket)]
  end

  subgraph External
    PY[Python Drift Engine]
    TG[Telegram Bot]
  end

  IM --> MI
  SF --> SP
  RP --> RPAPI
  PC --> PCAPI
  ST --> BKAPI
  MI --> DBM
  SP --> DBM
  RPAPI --> DBM
  PCAPI --> PCSRV
  BKAPI --> BKSRV
  BKSRV --> backups
  PCSRV --> portal
  DBM --> invoices
  DBM --> salesPartners
  DBM --> reps
  PCSRV --> Redis
  BKSRV --> S3
  OUT --> invoices
  OUT --> TG
  FF --> API
  PY --> invoices
```

### ریسک‌های مشترک
- **Front/Back Contract Drift**: ناهماهنگی تایپ‌ها بین Zod schema فرانت و Drizzle schema بک‌اند.
- **Job Cascade**: تغییر در محاسبات پورسانت می‌تواند آمار KPI و Outbox را متاثر کند.
- **Portal Cache**: محتوای پرتال عمدتاً از Redis خوانده می‌شود؛ همگام‌سازی با DB ضروری است.
- **Backup Consistency**: عملیات بکاپ/ریستور باید ACID-safe باشد تا drift ایجاد نشود.

---

## ۳. چک‌لیست فازی تفصیلی

### فاز ۱ – «ایجاد فاکتور دستی»

**Frontend**
- [ ] بررسی خط مسیر ناوبری: آیا کلیک روی «ایجاد فاکتور دستی» مودال/بخش صحیح را رندر می‌کند؟
- [x] بررسی وضعیت کوئری TanStack Query (`/api/representatives`, `/api/invoice-batches`).
- [ ] اطمینان از مدیریت خطا در `InvoiceManualForm` و مؤلفه فراخوان (`InvoiceManagement.tsx`).
- [ ] پایش DevTools برای خطای شبکه یا استثنای runtime (مانند undefined component).

**Backend**
- [ ] ارزیابی `insertInvoiceSchema` و تبدیل تاریخ (Persian -> Gregorian).
- [x] بررسی middleware احراز هویت (`authMiddleware`) و session قبل از endpoint. *(1404/07/13: جدول `session` به اسکیمای Drizzle اضافه شد و `db:push` اجرا گردید تا خطای `relation "session" does not exist` حذف شود.)*
- [ ] اطمینان از وجود متد `createInvoice` و فیلد `isManual` در Drizzle schema.
- [ ] پایش لاگ سرور برای مشاهده `🔧 فاز ۲` هنگام ارسال درخواست.

**Data / UX**
- [ ] نمایش پیام‌های موفقیت/خطا در Toast مطابق راهنمای فارسی.
- [ ] اطمینان از ریست فرم بعد از موفقیت و عدم نشت داده.
- [ ] بررسی نمای جدول فاکتور که رکورد جدید را نشان دهد.

### فاز ۲ – «تب همکاران فروش و پورسانت»

**Frontend**
- [ ] ردیابی مسیر کامپوننت‌های تب (به احتمال `client/src/pages/admin/SalesPartners.tsx`).
- [ ] تکمیل دکمه «همکار جدید» با فرم، اعتبارسنجی، و ارسال واقعی.
- [ ] حذف پیام placeholder «این قابلیت در دست توسعه است» و جایگزینی با فرم ویرایش فعال.
- [ ] افزودن جدول رویدادهای پورسانت (پرداخت/تسویه) با فیلتر زمانی.

**Backend**
- [x] ایجاد یا تکمیل مسیرهای `/api/sales-partners` (POST/PUT/DELETE/GET).
- [x] تعریف مدل داده برای ثبت تاریخچه محاسبه پورسانت و پرداخت‌های مرتبط (جداول `partner_commission_payments`).
- [x] پیاده‌سازی job به‌روزرسانی پورسانت پس از آپلود فایل‌های فروش (hook روی `generate-standard`).
- [ ] ثبت Activity log برای هر ویرایش پورسانت.

**محاسبات مالی**
- [ ] Cross-check فرمول: پورسانت = مجموع فروش تخصیص‌یافته * درصد کمیسیون فعال.
- [ ] پشتیبانی از حالت‌های جزئی (partial settle) و تسویه کامل با ثبت سند تراکنش.
- [x] انبار کردن رکوردهای تسویه برای auditing.

**UX**
- [ ] ارائه جدول خلاصه پورسانت به‌همراه فیلتر نماینده، دوره، وضعیت تسویه.
- [ ] افزودن دیالوگ تأیید هنگام تسویه.
- [ ] تضمین ترجمه فارسی و دسترس‌پذیری (ARIA labels).

### فاز ۳ – «ویرایش پروفایل نماینده و آیدی تلگرام»

**Frontend**
- [ ] افزودن دکمه «ویرایش» در باکس اطلاعات نماینده.
- [ ] ساخت فرم ویرایش (Drawer یا Modal) با فیلدهای: `username`, `ownerName`, `salesPartnerId`, `phone`, `telegramHandle`.
- [ ] همگام‌سازی داده با React Query (`/api/representatives/:id`).
- [ ] به‌روزرسانی قالب فاکتور در تب تنظیمات تلگرام برای placeholder آیدی.

**Backend**
- [ ] پیاده‌سازی endpoint PUT `/api/representatives/:id/profile` با Zod validation.
- [ ] به‌روزرسانی Drizzle schema برای ذخیره `telegramHandle` در جدول نمایندگان (در صورت نبود).
- [ ] انتشار webhook یا log برای تغییرات حساس (owner, sales partner).

**UX/Content**
- [ ] تضمین نمایش آیدی تلگرام در فاکتور (template fetch در `settings/telegram`).
- [ ] افزودن mask/validation برای شماره تماس و آیدی تلگرام (شروع با `@`).
- [ ] به‌روزرسانی Tooltipها و legend جهت آگاهی کاربران.

### فاز ۴ – «پرتال محتوا و CRUD کامل»

**Frontend**
- [ ] تحلیل `PortalContentManager` و تب‌های چهارگانه (Blocks, Announcements, Apps, Preview).
- [ ] اصلاح mutationها تا نتیجه در QueryCache و نهایتاً پرتال عمومی (`client/src/pages/portal.tsx`) نمایش یابد.
- [ ] افزودن قابلیت افزودن/حذف چندگانه و ترتیب‌گذاری Drag & Drop (در صورت وجود نیاز).
- [ ] نمایش پیغام وضعیت انتشار و آخرین همگام‌سازی.

**Backend**
- [ ] مرور سرویس `server/services/portal-content.ts` برای کش/اینوالیدیشن.
- [ ] اطمینان از آپدیت Redis یا In-memory cache پس از هرmutation.
- [ ] همگام‌سازی endpointهای GET عمومی (`/api/public/portal/*`).
- [ ] افزودن تست‌های کاهشی برای جلوگیری از رگرسیون.

**UX**
- [ ] نمایش پیش‌نمایش زنده و هشدار اگر انتشار انجام نشده.
- [ ] امکان انتخاب زبان آینده (I18n placeholder).
- [ ] اطمینان از واکنش‌گرایی موبایل.

### فاز ۵ – «بکاپ/ریستور در تب تنظیمات»

**Frontend**
- [ ] طراحی تب جدید یا گسترش تب موجود با کارت‌های «گرفتن بکاپ» و «بازیابی».
- [ ] پیشرفت بصری هنگام اجرای عملیات (Progress + Toast).
- [ ] محدودسازی دسترسی با نقش ادمین سطح بالا.

**Backend**
- [ ] طراحی API های `POST /api/system/backup` و `POST /api/system/restore`.
- [ ] انتخاب فرمت (پیشنهاد: `tar.gz` حاوی `schema.json` + `data.ndjson` per table) با حداکثر قابلیت بازیابی.
- [ ] استفاده از stream و chunking برای جلوگیری از memory spike.
- [ ] ثبت رکورد در `backup_audit_log` شامل `performedBy`, `checksum`, `size`.
- [ ] افزودن اعتبارسنجی امضا/هش هنگام ریستور.

**Infrastructure**
- [ ] در نظر گرفتن محدودیت حجم و ذخیره‌سازی (Persistent Volume / S3).
- [ ] اطمینان از هماهنگی با سرویس پایتون (sync schema).
- [ ] تهیه مسیر Rollback: در صورت شکست ریستور، restore قبلی.

---

## ۴. قراردادهای پذیرش (Acceptance Criteria)

| فاز | معیار اصلی | آزمون پیشنهادی |
|-----|-------------|----------------|
| ۱ | دکمه ایجاد فاکتور دستی بدون خطا فرم را باز کند و درخواست موفقیت‌آمیز ثبت شود | تست E2E Cypress: `manual_invoice_creates_record.spec.ts` |
| ۲ | افزودن/ویرایش همکار فروش کلاینت و سرور را به‌روزرسانی کند و محاسبه پورسانت پس از آپلود اجرا شود | تست یکپارچه Jest: `sales-partner-commission.spec.ts` |
| ۳ | ویرایش در UI اعمال شود و آیدی تلگرام در فاکتور و تنظیمات دیده شود | تست UI + Snapshot قالب فاکتور |
| ۴ | تغییرات محتوا در ۳۰ ثانیه داخل پرتال عمومی رندر شوند | تست Playwright با mock Redis |
| ۵ | بکاپ ۱۰۰٪ رکوردها را برگرداند و checksum تطابق داشته باشد | اسکریپت `scripts/system-backup-restore.e2e.ts` |

---

## ۵. مسیر پیشروی

1. **تحلیل عمیق فاز ۱**: ردیابی خطاهای Runtime، بررسی Network، هم‌خوانی Schema.
2. **توسعه Backoffice پورسانت**: طراحی مدل داده، Migration جدید، API های CRUD و محاسبات پس‌زمینه.
3. **UI/UX نمایندگان**: پیاده‌سازی فرم ویرایش و به‌روزرسانی قالب تلگرام.
4. **Sync محتوای پورتال**: کش پویا، به‌روزرسانی real-time و تست پوششی.
5. **Backup Suite**: طراحی فرمت، پیاده‌سازی API، حفاظت امنیتی (JWT + نقش).
6. **کیفیت و مستندسازی**: اجرای تست‌ها، به‌روز کردن README و اضافه نمودن راهنمای عملیات بکاپ.

---

## ۶. ریسک‌ها و اقدامات مقابله‌ای

- **هنگ شدن هنگام ریستور** → پیاده‌سازی Stream + محدودیت حجم + مانیتورینگ پیش از عمل.
- **عدم سازگاری داده‌های پورسانت با Ledger** → اجرای `scripts/drift-shadow.ts` بعد از هر آپلود.
- **عدم انتشار محتوا** → Invalidating Redis و افزودن TTL کوتاه مدت تا زمان اطمینان.
- **تأثیر بر Outbox** → تست‌های رگرسیون برای ارسال تلگرام بعد از تغییرات پورسانت.

---

## ۷. یادداشت‌ها

- کلیه تغییرات باید با استاندارد README جاری همسو باشند (Node 20، Vite، Drizzle ORM).
- توکن‌های حساس (Telegram, Session) هنگام بکاپ نباید در خروجی متنی ذخیره شوند؛ Mask یا رمزنگاری ضروری است.
- برای هر فاز، لاگ‌های `STRUCT_LOG` با شناسه فاز (`PHASE1_MANUAL_INVOICE` و ...) ثبت گردد.
- اسکیمای `sales_partners` پس از اجرای مایگریشن 0003 همگام‌سازی شد (افزودن ستون‌های `code` و `contact_person` و جدول `partner_commission_payments`)؛ در استقرارهای بعدی اجرای push الزامی است.
- جدول `session` اکنون در `shared/schema.ts` تعریف شده و باید در چک‌های استقرار کنترل شود تا از حذف تصادفی session store جلوگیری گردد.
