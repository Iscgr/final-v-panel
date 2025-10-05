## Final V Panel

**آخرین به‌روزرسانی:** ۲۰۲۵-۱۰-۰۴  
**لایه‌های اصلی:** React 18 + Vite (Frontend) · Node.js 20 + Express + Drizzle (Backend) · FastAPI (Drift/تحلیل) · PostgreSQL 14 + Redis · Docker + Nginx (استقرار)

### نمای کلی سه‌هسته‌ای
- **Frontend:** پنل ادمین و پورتال عمومی با Tailwind، Radix UI و مدیریت State ایزوله، آماده برای تست کمپوننتی و Playwright.
- **Backend:** API کاملاً تایپ‌شده با Drizzle ORM، سیستم Outbox، Feature Flags و سرویس پشتیبان‌گیری.
- **UX & Operations:** تأمین تجربه پایدار، مانیتورینگ SLA، سیاست‌های پشتیبان‌گیری/بازیابی و مسیرهای عیب‌یابی سریع.

## ساختار مخزن
```text
.
├── client/                # اپ React (پنل ادمین + پورتال)
│   ├── src/
│   │   ├── components/    # طراحی ماژولار UI (Radix, Tailwind)
│   │   ├── contexts/      # State Application و Auth
│   │   ├── pages/         # صفحات مدیریتی و پورتال
│   │   ├── services/      # فراخوانی API و کش سمت کلاینت
│   │   └── tests/         # الگوهای Vitest / RTL / Playwright
├── server/                # هسته Node 20 + Express
│   ├── routes/            # ماژول‌های API (Invoices, Portal, System)
│   ├── services/          # Outbox، Drift Shadow، Feature Flags، Backup
│   ├── middleware/        # امنیت، عملکرد، سازگاری Android
│   ├── bootstrap/         # Seed و مقداردهی اولیه
│   └── tests/             # تست‌های Vitest (نمونه: Outbox)
├── shared/                # اسکیمای Drizzle و انواع مشترک
├── scripts/               # اسکریپت‌های عملیاتی و رگرسیون
├── python-service/        # FastAPI برای Drift و محاسبات دقیق
├── Dockerfile             # Build چندمرحله‌ای (Builder + Runtime)
├── docker-compose.yml     # استک توسعه (app + db + redis)
├── nginx.conf             # کانفیگ Reverse Proxy نمونه
├── install.sh             # استقرار خودکار روی Ubuntu 22
├── validate-install.sh    # اعتبارسنجی نصب Production
├── logs/.gitkeep          # نگه‌دار پوشه لاگ (Volume در Production)
├── uploads/.gitkeep       # پوشه فایل‌های آپلودی (Volume در Production)
└── backups/.gitkeep       # مسیر نسخه‌های پشتیبان (Volume در Production)
```

## پیکربندی و متغیرهای محیطی
نمونهٔ پایه در `.env.example` قرار دارد. کلیدهای حیاتی:

| کلید | توضیح | یادداشت |
|------|-------|---------|
| `DATABASE_URL` | اتصال PostgreSQL | در Docker → `postgresql://postgres:postgres@db:5432/marfanet` |
| `SESSION_SECRET` | کلید رمزنگاری Session | در Production طولانی، تصادفی، همراه با HTTPS (`secure=true`) |
| `PORT` | پورت اپلیکیشن | پیش‌فرض `3000` |
| `ADMIN_USERNAME`/`ADMIN_PASSWORD` | حساب اولیهٔ ادمین | توسط `install.sh` نیز تولید می‌شود |
| `TELEGRAM_BOT_TOKEN` | ارسال هشدار تلگرام | برای Worker Outbox ضروری |
| `REDIS_URL` | اتصال Redis | در Compose تنظیم شده |
| `APP_URL` / `PUBLIC_PORTAL_BASE_URL` | نشانی عمومی پنل و پورتال | برای لینک‌سازی ایمیل و Portal |
| `LOG_DIRECTORY` | مسیر لاگ ساختاریافته | در Docker روی `/app/logs` پیکربندی شود |

کلیدهای اختیاری: `OPENAI_API_KEY`, `SMTP_*`, `WEBHOOK_URL`, `ENABLE_PERFORMANCE_MONITORING` و Feature Flagهای فعال‌سازی سرویس‌ها.

> **امنیت:** فایل `.env` در Production با سطح دسترسی `600` نگهداری و از نسخه‌سازی حذف شود.

## راه‌اندازی محلی (Dev / Test)
1. **پیش‌نیازها:** Node.js 20، npm 10، PostgreSQL و Redis محلی.
2. **نصب وابستگی‌ها:**
   ```bash
   npm install
   ```
3. **همگام‌سازی دیتابیس (Drizzle):**
   ```bash
   npm run db:push
   ```
4. **اجرای هم‌زمان API + UI:**
   ```bash
   npm run dev
   ```
   - اپلیکیشن روی `http://localhost:3000`؛ HMR فعال است.
5. **اجرای صرفاً Frontend (در صورت نیاز):**
   ```bash
   npm run dev:client
   ```
   - Vite روی `http://localhost:5173`؛ نیازمند CORS یا Proxy.
6. **اسکریپت‌های پرکاربرد:**
   - `npm run check` → بررسی TypeScript.
   - `npm run test:outbox` → تست واحد Outbox.
   - `npx ts-node scripts/seed-portal-settings.ts` → Seed اولیهٔ محتوا.

## استقرار بر Ubuntu 22 + Docker
### پیش‌نیازها
- Ubuntu 22.04 با دسترسی sudo.
- Docker Engine، Docker Compose Plugin و Nginx (SSL از طریق Certbot).
- حداقل ۱۰GB فضای دیسک و ۲GB RAM.

### فرآیند استاندارد
1. اجرای `sudo bash install.sh` (پیش از اجرا URL مخزن/برنچ را به‌روز کنید).
2. تولید تصویر تولیدی:
   - **Builder:** `npm ci` → `npm run build` → خروجی `dist` → `npm prune --omit=dev`.
   - **Runtime:** کاربر غیرریشه `marfanet`، کپی آرتیفکت‌ها، نصب `postgresql-client` و `curl` برای Healthcheck پیش‌فرض.
3. سازوکار Compose (توسعه): `app`, `db (postgres:14)`, `redis`.
4. استقرار بدون Downtime:
   ```bash
   git pull
   docker compose build --no-cache app
   docker compose up -d app
   ```

### توصیه‌های Production
- فایل `docker-compose.prod.yml` خروجی نصب را بازبینی و متناسب با محیط تنظیم کنید.
- Volumeهای پایدار:
  ```yaml
  volumes:
    - ./logs:/app/logs
    - ./uploads:/app/uploads
    - ./backups:/app/backups
  ```
- در صورت نیاز به سرویس Drift Python:
  ```yaml
  python:
    build: ./python-service
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
  ```
- `nginx.conf` نمونهٔ Reverse Proxy است؛ SSL را با Certbot فعال کنید.
- Rollback سریع:
  ```bash
  git checkout <PREVIOUS_COMMIT>
  docker compose build app && docker compose up -d app
  ```

## استراتژی تست سه‌محوری
### ۱) Frontend
- Vitest + React Testing Library برای کمپوننت‌های بحرانی (`invoice-upload`, `LiveProcessingMonitor`, `SystemSettingsPage`).
- Playwright/Cypress برای سناریوهای کامل (آپلود فاکتور → Outbox، مدیریت محتوا، Flowهای موبایل).
- سنجش دسترس‌پذیری با `axe-core` و هدف Lighthouse ≥ 90.

### ۲) Backend و سرویس‌ها
- Vitest واحد برای `feature-flag-manager`, `portalContentCache`, `backup-service`.
- Integration با Supertest روی مسیرهای `/api/invoices`, `/api/portal`, `/api/outbox`, `/api/system`, `/api/auth`.
- سناریوهای سرتاسری روی استک Compose (Node + Postgres + Redis + Python) و پایش عملکرد با k6/Artillery.

### ۳) UX و عملیات
- Smoke Test پس از استقرار (`scripts/financial-e2e-smoke.ts`).
- تست پیمایش کیبورد در Dialogها (Playwright).
- بررسی هدرهای امنیتی، Session Hijacking کنترل‌شده و Rate Limiting پیشنهادی.

### اسکریپت‌های پیشنهادی در `package.json`
```jsonc
"scripts": {
  "test:unit": "vitest",
  "test:api": "tsx server/tests/api-suite.ts",
  "test:e2e": "playwright test",
  "test:smoke": "npx ts-node scripts/financial-e2e-smoke.ts",
  "lint": "eslint ."
}
```
Pipeline پیشنهادی: Unit → Integration → E2E + Accessibility؛ گزارش‌ها به عنوان آرتیفکت ذخیره شوند.

## عملیات، مانیتورینگ و سلامت
- **Endpointها:** `GET /health` (وابستگی‌ها + حافظه + uptime)، `GET /ready` (آمادگی Load Balancer).
- **لاگ‌ها:** فرمت ساختاریافته با پیشوند `STRUCT_LOG`؛ مسیر پیش‌فرض `logs/` (در Docker حتماً Volume).
- **Outbox Metrics:** مسیر `/api/outbox/metrics` پس از فعال‌سازی `guard_metrics_alerts`؛ پایش SLA و هشدار تلگرام.
- **پیشنهاد مانیتورینگ:** اتصال لاگ‌ها به ELK/Loki و ساخت داشبورد Grafana سبک.

## پشتیبان‌گیری و بازیابی فاجعه
- **PostgreSQL:**
  ```bash
  mkdir -p backups
  docker compose exec -T db pg_dump -U postgres marfanet > backups/$(date +%F-%H%M).sql
  ```
  ```bash
  cat backups/FILE.sql | docker compose exec -T db psql -U postgres -d marfanet
  ```
- **API Backup:**
  - `/api/system/backup` → تولید فایل tar.gz شامل NDJSON جداول اصلی.
  - `/api/system/restore` → بازگردانی کامل (دادهٔ فعلی حذف می‌شود) و ثبت در `backup_audit_log`.
- **حفظ لاگ‌ها و سشن‌ها:** Volume `./backups` و در صورت نیاز بکاپ از جدول `session`.
- **پاک‌سازی دوره‌ای:** `find logs -type f -mtime +15 -delete` (خارج از مخزن اجرا شود).

## عیب‌یابی سریع
| سناریو | بررسی سریع | اقدام اصلاحی |
|--------|-------------|---------------|
| عدم ارسال پیام تلگرام | بررسی `outbox_enabled` و `TELEGRAM_BOT_TOKEN`، لاگ Outbox | فعال‌سازی Flag، رفع خطاهای صف |
| خطای آپلود JSON | اعتبارسنجی Build UI و مقداردهی `jobCode` | Build مجدد Frontend، اصلاح داده ورودی |
| Timeout در پورتال موبایل | هدرهای مخصوص Android در `server/index.ts` | تنظیم مجدد Proxy و Cache |
| Drift ناهماهنگ | اجرای `/reconcile/drift-detection` در سرویس Python | بررسی آستانه‌های Drift و داده Legacy |
| Session کوتاه | تنظیم `cookie.secure`, `maxAge`, اجبار HTTPS | بازآرایی Session Store |

## Feature Flagهای کلیدی
| فلگ | هدف | توضیح حالت‌ها |
|------|-----|---------------|
| `outbox_enabled` | فعال‌سازی صف تلگرام | `off` / `shadow` / `active` |
| `guard_metrics_alerts` | مانیتورینگ SLA | ارسال هشدار براساس متریک Outbox |
| `portal_content_read_switch` | مهاجرت محتوا | `legacy` → `shadow` → `live` |

## اسکریپت‌ها و اتوماسیون‌ها
| فایل | کاربرد |
|------|--------|
| `scripts/seed-portal-settings.ts` | Seed اولیهٔ محتوای پورتال |
| `scripts/portal-content-regression.ts` | سناریوی CRUD + Publish + Cache HIT/MISS |
| `scripts/drift-shadow.ts` | مقایسه Drift در حالت Shadow |
| `scripts/backfill-dry-run.ts` | بررسی Backfill بدون تغییر واقعی |
| `scripts/payments-cast-shadow.ts` | صحت تخصیص پرداخت‌ها و Decimal |
| `scripts/ingest-real-sample.ts` | تزریق نمونهٔ واقعی برای تست پذیرش |
| `scripts/test-telegram-template-validation.ts` | اعتبارسنجی قالب پیام تلگرام |

## نگه‌داری مخزن
- پوشه‌های تولیدی (`dist/`, `node_modules/`, `logs/`, `uploads/`, `backups/`) در نسخه نگهداری نشوند؛ Volume در Production الزامی است.
- از `npm ci` در CI/CD استفاده کنید تا قفل نسخه‌ها پایدار بماند.
- اسکریپت `fix-imports.sh` پس از Build سرور اجرا شود تا مشکلات پسوند (`.js.js`) رفع گردد.
- هر Commit شامل به‌روزرسانی README در صورت تغییر معماری یا وابستگی‌های حیاتی باشد.

## نقشهٔ راه کوتاه‌مدت
1. تکمیل پوشش Vitest/RTL روی کمپوننت‌های حیاتی و افزودن تست‌های API.
2. افزودن سرویس Python به Compose Production با Healthcheck و پایش Drift مداوم.
3. استقرار داشبورد Grafana/Prometheus بر پایه لاگ‌های `STRUCT_LOG`.
4. تولید خودکار مستندات API (OpenAPI یا `ts-rest`).
5. اعمال Rate Limiting و تقویت هدرهای امنیتی (CSP, HSTS).

---

اگر تغییر معماری یا سرویس جدیدی معرفی شد، این سند را به‌روز کنید تا تطابق کامل بین کد، عملیات و تجربهٔ کاربر حفظ گردد.
