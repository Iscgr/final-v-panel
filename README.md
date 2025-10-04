# MarFaNet – دفترچه عملیاتی ۲۰۲۵

> این سند تنها منبع رسمی برای راه‌اندازی، بهره‌برداری، نگه‌داری و عیب‌یابی سامانه مالی «MarFaNet» است. متن به گونه‌ای نوشته شده که تیم فنی، عملیات و حتی مدیر محصول بتوانند بدون ارجاع به منبع دیگری به جواب برسند.

## فهرست سریع
- [معرفی اجمالی](#معرفی-اجمالی)
- [اسکن سه‌بعدی سامانه](#اسکن-سه‌بعدی-سامانه)
- [ساختار دایرکتوری‌ها](#ساختار-دایرکتوریها)
- [بک‌اند (Node/Express)](#بکاند-nodeexpress)
- [فرانت‌اند (React/Vite)](#فرانتاند-reactvite)
- [سرویس پایتونی مکمل](#سرویس-پایتونی-مکمل)
- [پیکربندی و متغیرهای محیطی](#پیکربندی-و-متغیرهای-محیطی)
- [راه‌اندازی محلی](#راهاندازی-محلی)
- [اجرای Docker و Compose](#اجرای-docker-و-compose)
- [مهاجرت و مدیریت دیتابیس](#مهاجرت-و-مدیریت-دیتابیس)
- [ویژگی‌های زیرساختی و Feature Flag](#ویژگیهای-زیرساختی-و-feature-flag)
- [اسکریپت‌ها و اتوماسیون‌ها](#اسکریپتها-و-اتوماسیونها)
- [تست، مانیتورینگ و سلامت](#تست-مانیتورینگ-و-سلامت)
- [عیب‌یابی سریع](#عیبیابی-سریع)
- [پشتیبان‌گیری و Disaster Recovery](#پشتیبانگیری-و-disaster-recovery)
- [چرخه انتشار و نگه‌داری](#چرخه-انتشار-و-نگهداری)
- [پیشنهادهای بعدی](#پیشنهادهای-بعدی)

## معرفی اجمالی
سامانه MarFaNet یک پلتفرم یکپارچه برای مدیریت مالی نمایندگان، پایش KPI، تولید و ارسال فاکتور، پورتال عمومی و زیرسیستم‌های مانیتورینگ است. مهم‌ترین فناوری‌ها:

| لایه | فناوری/ابزار | توضیح |
|------|---------------|-------|
| Backend | Node.js 20 (TypeScript) + Express | API یکپارچه، احراز هویت، مدیریت Session، Feature Flags |
| Frontend | React 18 + Vite + Tailwind/Radix UI | پنل مدیریتی، پورتال نمایندگان، روندهای Real-time |
| Database | PostgreSQL 14 (Drizzle ORM) | ذخیره فاکتورها، پرداخت‌ها، outbox، محتوا |
| Cache/Session | Redis (alpine) | نگه‌داری Session و کش‌های سبک |
| Automation | Docker/Docker Compose + npm scripts | استقرار، build و عملیات مداوم |
| خدمات تکمیلی | FastAPI (Python) | محاسبات Decimal و Drift Detection دقیق |

خروجی نهایی روی پورت 3000 در دسترس است و API و UI را همزمان سرو می‌کند.

## اسکن سه‌بعدی سامانه
این بخش دید ۳۶۰ درجه‌ای از ارتباط لایه‌ها، داده‌ها و جریان عملیات ارائه می‌کند.

### دید معماری
```mermaid
graph TD
    subgraph Client
        A[React Admin Panel]
        B[Public Portal]
    end
    subgraph Server
        C[Express API]
        D[Unified Auth]
        E[Outbox Worker]
        F[Feature Flag Manager]
    end
    subgraph Data
        G[(PostgreSQL)]
        H[(Redis)]
        I[(Uploads)]
    end
    subgraph Services
        J[Python Drift Engine]
        K[Telegram Bot]
    end

    A -->|REST/JSON| C
    B -->|REST/JSON| C
    C -->|Sessions| H
    C -->|ORM| G
    C -->|File Links| I
    C -->|Enqueue| E
    E -->|Status Updates| G
    J -->|Read/Write| G
    E -->|Send| K
    F --> C
    D --> C
```

### لایه‌ها و مسئولیت‌ها
- **لایه نمایشی**: کامپوننت‌های React با React Query، مدیریت وضعیت احراز هویت، طراحی واکنش‌گرای موبایل.
- **لایه خدمات HTTP**: Express با middlewareهای امنیتی (Headers، Session)، ثبت وقایع ساختاریافته، مدیریت فایل‌های بارگذاری‌شده.
- **لایه داده**: PostgreSQL (schema در `shared/schema.ts`) با Drizzle برای migrations، Redis برای session و کش موقت.
- **لایه یکپارچگی**: Outbox، Drift Job، Feature Flags چندمرحله‌ای، Portal bootstrap.
- **لایه محاسبات دقیق**: سرویس FastAPI برای عملیات Decimal و مقایسه ledger در سناریوهای drift.

### جریان کلیدی «بارگذاری فاکتور تا ارسال تلگرام»
1. کاربر فایل JSON را در UI بارگذاری می‌کند (`client/src/components/invoice-upload.tsx`).
2. API `/api/invoices/generate-standard` فایل را در `uploads/` ذخیره و درون دیتابیس می‌نویسد.
3. رویداد ثبت‌شده وارد outbox می‌شود؛ Outbox Worker طبق Feature Flag فعال شده یا خیر.
4. پیام تلگرام از طریق Outbox Worker و سرویس ارسال (REST) به نماینده ارسال و در `telegram_send_history` ثبت می‌شود.
5. داشبورد لحظه‌ای وضعیت job و ارسال را با APIهای Import Jobs / Outbox رصد می‌کند.

> به‌روزرسانی Phase3: متغیر تازه `telegram_handle` به سیستم قالب پیام تلگرام افزوده شد که از فیلد `telegramId` نماینده (قابل ویرایش در صفحه پروفایل نماینده) استخراج می‌شود. در صورت نبود مقدار، متن «ثبت نشده» جایگزین می‌گردد.

## ساختار دایرکتوری‌ها
```
├── client/             # فرانت‌اند React + Vite
│   ├── src/
│   │   ├── pages/      # صفحات داشبورد و پورتال
│   │   ├── components/ # UI، فرم‌ها، نمودارها
│   │   ├── contexts/   # Auth، Sidebar، Theme
│   │   ├── services/   # لایه ارتباط با API (fetch/query)
│   │   └── hooks/      # Hookهای سفارشی مانند polling
├── server/             # بک‌اند Express + TypeScript
│   ├── routes/         # فایل‌های Route تفکیک‌شده بر اساس دامنه
│   ├── services/       # Outbox، Drift، Feature Flags، Portal
│   ├── middleware/     # Performance، Unified Auth
│   ├── bootstrap/      # Seed اولیه محتوا و تنظیمات پورتال
│   └── tests/          # تست‌های واحد (مثلاً outbox.spec.ts)
├── shared/             # اسکیمای Drizzle ORM و انواع مشترک
├── scripts/            # اسکریپت‌های TypeScript عملیاتی
├── python-service/     # سرویس FastAPI برای محاسبات Decimal
├── uploads/            # مسیر فایل‌های بارگذاری‌شده (ویدیو، QR، JSON)
├── docker-compose.yml  # استقرار چند سرویسه (App + Postgres + Redis)
├── Dockerfile          # build چندمرحله‌ای (builder + production)
└── .env.example        # مثال پیکربندی محیط
```

## بک‌اند (Node/Express)
- فایل ورودی: `server/index.ts`
  - بارگذاری خودکار `.env`
  - تنظیم CORS و هدرهای امنیتی متفاوت برای پورتال عمومی و پنل ادمین
  - مدیریت Session با `connect-pg-simple` (جدول `session` در PostgreSQL)
  - سرو فایل‌های `uploads/` با کنترل نوع محتوا (تصاویر، ویدیو)
  - آمار عملکرد و لاگ‌های ساختاریافته بر اساس مسیرهای `API/ AUTH`
  - ثبت و راه‌اندازی سرویس‌های پس‌زمینه (OutboxWorker، OutboxMonitor، DriftJobService)
  - مسیریابی سلامت (`/health`، `/ready`) و مدیریت خطا
  - در حالت توسعه Vite Dev server را تزریق می‌کند؛ در production دارایی‌های build شده را سرو می‌کند.

- **مسیرها (Routes)** مهم:
  - `standardized-invoice-routes.ts`: بارگذاری و تولید فاکتور استاندارد از فایل JSON
  - `portal-content-routes.ts` + `admin-resources-routes.ts`: مدیریت محتوای پورتال عمومی
  - `feature-flag-routes.ts` و `multistage-flag-routes.ts`: مدیریت فلگ‌ها در حالت چندمرحله‌ای (off/shadow/on)
  - `outbox-routes.ts`: مانیتورینگ و کنترل صف پیام‌های تلگرام (E-C1)
  - `kpi-metrics-routes.ts`, `guard-metrics-routes.ts`: گزارش‌های عملیاتی و SLA

- **سرویس‌ها (Services)**
  - `feature-flag-manager.ts`: ذخیره وضعیت فلگ‌ها (حالت چند مرحله‌ای)، API برای خواندن/نوشتن، پشتیبانی default fallback
  - `outbox.ts`, `outbox-worker.ts`, `outbox-monitor.ts`: الگوی Outbox با retry و متریک‌های لغزش
  - `drift-job-service.ts`: اجرای دوره‌ای آشتی داده و هماهنگی با سرویس پایتون برای محاسبه دقیق
  - `portal-content.ts`: bootstrap اولیه محتوا و fallback برای پورتال

- **مدیریت دیتابیس**
  - اتصال با `pg` و Drizzle ORM (`db.ts`, `database-manager.ts`)
  - `shared/schema.ts` حاوی تمامی جداول (invoices, payments, representatives, outbox, ...)
  - مایگریشن‌ها در `migrations/` و `server/migrations/`

## فرانت‌اند (React/Vite)
- نقطه ورود: `client/src/main.tsx` → `App.tsx`
- Routing با `wouter`، مدیریت Auth یکپارچه از طریق `UnifiedAuthProvider`
- React Query (`queryClient`) برای cache داده و polling هوشمند
- UI بر پایه Radix UI + Tailwind + Shadcn الگوهای ترکیبی (components/ui)
- صفحات کلیدی:
  - `pages/dashboard.tsx`: داشبورد جامع با KPI و نمودارها
  - `pages/invoices.tsx` و `pages/InvoiceManagement.tsx`: مدیریت فاکتور، بارگذاری و پیشرفت
  - `pages/portal.tsx`: نمایش محتوای عمومی برای نمایندگان با دسترسی publicId
  - `pages/admin/DebugActionsPanel.tsx`: عملیات مهندسی (Retry outbox، پاک‌سازی cache و ...)
  - `pages/admin/PortalContentManager.tsx`: UI چهار تبه برای مدیریت محتوا، اطلاعیه‌ها، دانلودها و پیش‌نمایش
- Components مهم:
  - `components/invoice-upload.tsx`: بارگذاری JSON، ساخت FormData، کنترل خطاها و تعامل با API
  - `components/dashboard/LiveProcessingMonitor.tsx`: پایش real-time پردازش فایل و import jobs
  - `components/system/ErrorBoundary.tsx`: مدیریت خطاهای React و نمایش fallback بومی برای فارسی
- Contexts:
  - `unified-auth-context`, `sidebar-context`, `theme` (در صورت نیاز) برای مدیریت وضعیت جهانی UI
- تست‌ها: فولدر `client/src/tests/` برای تست‌های React Testing Library (محیط آماده است، نیازمند گسترش بیشتر)

## سرویس پایتونی مکمل
- مسیر: `python-service/`
- فناوری: FastAPI + Psycopg2 + Decimal با دقت ۲۸ رقم
- کاربرد:
  - `/calculate/bulk-debt`: محاسبه سریع مجموع بدهی نمایندگان به صورت batched و بدون خطای شناور
  - `/reconcile/drift-detection`: مقایسه Legacy Debt، Ledger Allocation و Cache برای یافتن Drift و ارائه متادیتا
  - `/reconcile/drift-detection-legacy`: سازگاری با نسخه‌های قبلی
- اجرای محلی: `uvicorn main:app --host 0.0.0.0 --port 8001`
- اتصال به PostgreSQL با متغیرهای محیطی مستقل (`DB_HOST`, `DB_NAME`, ...)
- در Compose پیش‌فرض فعال نشده؛ می‌توان برای استقرارهای پیشرفته به `docker-compose.yml` افزود.

## پیکربندی و متغیرهای محیطی
مقداردهی از `.env` (نمونه در `.env.example`). مهم‌ترین متغیرها:

| متغیر | توضیح | وضعیت |
|--------|-------|--------|
| `DATABASE_URL` | URL اتصال PostgreSQL | الزامی (در Compose نیز override شده) |
| `SESSION_SECRET` | کلید رمزنگاری Session | الزامی (در production حتماً تصادفی) |
| `PORT` | پورت سرویس Node | پیش‌فرض 3000 |
| `APP_URL` | آدرس عمومی سرویس | برای لینک‌سازی پورتال |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | کاربر اولیه پنل | برای bootstrap و seed |
| `TELEGRAM_BOT_TOKEN` | ارسال پیام تلگرام | ضروری برای Outbox Worker |
| `OPENAI_API_KEY`, `GOOGLE_GEMINI_API_KEY` | قابلیت‌های هوش مصنوعی | اختیاری؛ در صورت عدم تنظیم، API مربوط خاموش است |
| `SMTP_*` | ارسال ایمیل‌های اطلاع‌رسانی | اختیاری |
| `WEBHOOK_URL` | اعلان رویدادها | اختیاری |
| `LOG_LEVEL`, `ENABLE_PERFORMANCE_MONITORING` | کنترل لاگ | گزینه‌های عیب‌یابی |

> در Docker Compose مقدار `DATABASE_URL` و `REDIS_URL` مستقیماً داخل سرویس `app` override می‌شوند.

## راه‌اندازی محلی
۱. پیش‌نیازها: Node.js 20، PostgreSQL، Redis.
۲. نصب وابستگی‌ها: `npm install`
۳. اعمال اسکیمای دیتابیس: `npm run db:push`
۴. اجرای سرور توسعه: `npm run dev`
   - API و UI در http://localhost:3000
   - Vite Hot Reload فعال است.
۵. اجرای تنها فرانت‌اند (برای توسعه UI): `npm run dev:client`
   - سرور در پورتی که Vite تعیین می‌کند بالا می‌آید (معمولاً 5173)، نیازمند پراکسی یا تنظیم CORS است.

## اجرای Docker و Compose
### ساخت تصویر تولیدی (Dockerfile چند مرحله‌ای)
- Stage `builder`: نصب کامل وابستگی‌ها، build سرور (`tsc`) و فرانت (`vite`)، پاک‌سازی devDependencies.
- Stage `production`: تصویر node:20-alpine با کاربر غیر ریشه (`marfanet`)، کپی `dist/` و `node_modules`، آماده اجرا با `start-server.cjs`.

### اجرای تک‌سرویسی
```bash
docker build -t marfanet:local .
docker run --rm -p 3000:3000 --name marfanet \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/marfanet \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -v $(pwd)/logs:/app/logs \
  --add-host=host.docker.internal:host-gateway \
  marfanet:local
```

### Docker Compose (توصیه‌شده برای Production)
`docker-compose.yml` سه سرویس را بالا می‌آورد:
- `app`: تصویر ساخته‌شده از همین مخزن، وابسته به `db` و `redis`
- `db`: PostgreSQL 14 با healthcheck `pg_isready`
- `redis`: Redis Alpine با healthcheck `redis-cli ping`

دستورات کلیدی:
```bash
docker compose build
docker compose up -d
docker compose logs -f app
```
به‌روزرسانی بدون downtime:
```bash
git pull
docker compose build --no-cache app
docker compose up -d app
```
Rollback سریع:
```bash
git checkout <PREVIOUS_COMMIT>
docker compose build app && docker compose up -d app
```

## مهاجرت و مدیریت دیتابیس
- ORM اصلی: Drizzle
- فایل پیکربندی: `drizzle.config.ts`
- پوشه مایگریشن‌ها: `migrations/` (اصلی) و `server/migrations/` (ویژه سرویس)
- دستورات متداول:
  - `npm run db:push`: اعمال مایگریشن به دیتابیس فعلی
  - `npm run check`: اطمینان از سالم بودن TypeScript
  - اسکریپت‌های تخصصی (مانند `scripts/drift-shadow.ts`) وضعیت داده را تحلیل و گزارش می‌کنند.

### جداول حیاتی
- `representatives`, `invoices`, `payments`, `payment_allocations`, `invoice_balance_cache`
- `outbox`, `guard_metrics_events`, `reconciliation_runs`
- `portal_content_blocks`, `announcements`, `app_downloads`

## ویژگی‌های زیرساختی و Feature Flag
- مدیریت فلگ چندمرحله‌ای (off → shadow → on) در `featureFlagManager`
- فلگ‌های نمونه:
  - `outbox_enabled`: فعال‌سازی ارسال تلگرام و مانیتور
  - `guard_metrics_alerts`: روشن کردن مانیتور SLA و هشدارها
  - `portal_content_read_switch`: سوئیچ تدریجی از تنظیمات legacy به بلوک‌های جدید محتوا
- API مدیریت فلگ: `/api/feature-flags/multi-stage/update`
  - Payload نمونه: `{ "feature": "portal_content_read_switch", "state": "shadow" }`

## اسکریپت‌ها و اتوماسیون‌ها
| فایل | هدف |
|------|------|
| `scripts/seed-portal-settings.ts` | مقداردهی اولیه بلوک محتوا، اطلاعیه‌ها و لینک‌های دانلود |
| `scripts/portal-content-regression.ts` | تست رگرسیونی محتوای پورتال پس از تغییرات |
| `scripts/drift-shadow.ts` | اجرای حالت سایه‌ای Drift و گزارش تفاوت‌ها |
| `scripts/backfill-dry-run.ts` | اجرای Dry-run برای Backfill بدون تغییر داده |
| `scripts/payments-cast-shadow.ts` | بررسی تخصیص پرداخت‌ها و سازگاری Decimal |
| `scripts/ingest-real-sample.ts` | تزریق فایل نمونه واقع‌گرایانه برای تست پذیرش |
| `scripts/test-telegram-template-validation.ts` | بررسی قالب پیام تلگرام قبل از انتشار |

## تست، مانیتورینگ و سلامت
- تست واحد Outbox: `npm run test:outbox`
  - اسکریپت `server/tests/outbox.spec.ts` enqueue، retry و متریک‌های Outbox را پوشش می‌دهد.
- مسیرهای پایش:
  - `GET /health`: وضعیت کلی، حافظه، uptime و اتصال دیتابیس
  - `GET /ready`: آمادگی سرویس برای Load Balancer
  - `GET /api/outbox/metrics`: نرخ شکست و جزئیات صف (در صورت فعال بودن فلگ)
- لاگ‌ها:
  - مسیر پیش‌فرض: `logs/server.log` (Mount شده در Docker)
  - لاگ‌های ساختاریافته با پیشوند `STRUCT_LOG`

## عیب‌یابی سریع
| سناریو | بررسی سریع | راه‌حل پیشنهادی |
|--------|-------------|------------------|
| خطای «can’t access lexical declaration» هنگام بارگذاری JSON | نسخه build شده فرانت‌اند را بررسی کنید (متغیرهای تعریف‌نشده) | `client/src/components/invoice-upload.tsx` باید قبل از استفاده متغیر `jobCode` را تعریف کند → build مجدد |
| عدم ارسال پیام تلگرام | وضعیت فلگ `outbox_enabled` و مقدار `TELEGRAM_BOT_TOKEN` | فعال‌سازی فلگ → بررسی جدول `outbox` برای خطاها |
| Timeout در پورتال | بررسی هدرهای Android-specific در `server/index.ts` | آزادسازی cache و اطمینان از تنظیم هدرها |
| اختلاف آمار بدهی | اجرای `/reconcile/drift-detection` در سرویس پایتونی | مقایسه sums و ثبت anomalies |
| session منقضی سریع | بررسی تنظیمات cookie در `server/index.ts` | تغییر `maxAge` یا فعال کردن HTTPS/secure cookie |

## پشتیبان‌گیری و Disaster Recovery
- ایجاد بکاپ کامل دیتابیس:
  ```bash
  mkdir -p backups
  docker compose exec -T db pg_dump -U postgres marfanet > backups/$(date +%F-%H%M).sql
  ```
- بازیابی:
  ```bash
  cat backups/FILE.sql | docker compose exec -T db psql -U postgres -d marfanet
  ```
- پاک‌سازی لاگ‌ها جهت جلوگیری از پر شدن دیسک: `find logs -type f -mtime +15 -delete`
- برای نگه‌داری Session پس از بازیابی، از جدول `session` نسخه پشتیبان بگیرید (اختیاری).

## چرخه انتشار و نگه‌داری
1. ایجاد شاخه جدید و اعمال تغییرات.
2. اجرای محلی `npm run check` و تست‌های موردنیاز.
3. build تصویر جدید: `docker compose build app`
4. استقرار: `docker compose up -d app`
5. پایش لاگ‌ها حداقل ۱۵ دقیقه.
6. در صورت مشاهده خطا: بازگشت به نسخه قبل با checkout commit قبلی.

### Phase 4 – Portal Content Enhancements
| قابلیت | توضیح | فایل‌های کلیدی |
|--------|-------|-----------------|
| Publication Workflow | singleton state با نسخه‌دهی انتشار (`contentVersion`) + endpoints: `/status`, `/publish` | `migrations/0003_portal_publication_state.sql`, `server/routes/portal-content-routes.ts`, `shared/schema.ts` |
| Backend Cache (30s TTL) | کش درون‌حافظه‌ای `/full` و `/status` + اینوالیدیشن پس از Mutation | `server/utils/portalContentCache.ts`, `server/routes/portal-content-routes.ts` |
| Unified Client Invalidation | helper و query keys متمرکز | `client/src/services/portal-content.ts` |
| Preview Warning Banner | هشدار تغییرات منتشرنشده | `client/src/pages/admin/PortalContentManager.tsx` |
| Multi-Select & Bulk Delete | حذف گروهی اعلان‌ها/دانلودها (batch UI) | `PortalContentManager.tsx`, `server/routes/admin-resources-routes.ts` |
| i18n Placeholder & Locale Badge | وضعیت موقت زبان و badge | `PortalContentManager.tsx` |
| Responsiveness Improvements | بهبود grid/spacing/overflow موبایل | `PortalContentManager.tsx` |
| Regression Script | سناریوی CRUD + Publish + Cache HIT/MISS | `scripts/portal-content-regression.ts` |

اجرای اسکریپت رگرسیون:
```bash
TEST_BASE_URL=http://localhost:3000 ADMIN_USERNAME=admin ADMIN_PASSWORD=admin npx ts-node scripts/portal-content-regression.ts
```

### Phase 5 – Backup & Disaster Recovery
| قابلیت | توضیح | فایل‌های کلیدی |
|--------|-------|-----------------|
| Backup Creation | ایجاد پشتیبان کامل از داده‌های حیاتی به فرمت `.tar.gz` شامل فایل‌های NDJSON و متادیتا. | `server/services/backup-service.ts`, `server/routes/system-routes.ts` |
| Backup Restoration | بازیابی اطلاعات از یک فایل پشتیبان آپلود شده. عملیات تمام داده‌های فعلی را حذف می‌کند. | `backup-service.ts`, `system-routes.ts` (با استفاده از `multer`) |
| Audit Logging | ثبت تمام عملیات‌های موفق و ناموفق پشتیبان‌گیری و بازیابی در جدول `backup_audit_log`. | `shared/schema.ts`, `migrations/0004_backup_audit_log.sql` |
| Admin UI | صفحه جدید در پنل ادمین برای ایجاد، بازیابی، مشاهده تاریخچه و دانلود فایل‌های پشتیبان. | `client/src/pages/admin/SystemSettingsPage.tsx`, `client/src/services/system.ts` |

**نکات مهم:**
- **محتوای پشتیبان:** شامل جداول اصلی مانند نمایندگان، فاکتورها، پرداخت‌ها و محتوای پورتال است. جداول موقتی مانند `outbox` و لاگ‌ها به صورت عمدی حذف شده‌اند.
- **امنیت:** اندپوینت‌های پشتیبان‌گیری نیازمند احراز هویت ادمین هستند. فایل‌های پشتیبان روی سرور ذخیره می‌شوند و باید به صورت دوره‌ای به یک فضای ذخیره‌سازی امن منتقل شوند.

## پیشنهادهای بعدی
- تکمیل پوشش تست کلاینت (React Testing Library) و API (Jest/TSX).
- افزودن سرویس پایتونی به Compose با healthcheck جهت پایش مداوم drift.
- پیاده‌سازی داشبورد Grafana سبک با استفاده از لاگ‌های `STRUCT_LOG` برای مانیتورینگ real-time.
- مستندسازی API با ابزارهای خودکار (مانند `ts-rest` یا `openapi-generator`).

---

**آخرین به‌روزرسانی:** {{ تاریخ انتشار این نسخه را قبل از انتشار رسمی تکمیل کنید }}. در صورت تغییر معماری یا افزودن سرویس جدید، این README باید به‌روزرسانی شود.
