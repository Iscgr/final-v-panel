# MarFaNet – استقرار و راه‌اندازی یکپارچه (سند جامع واحد)



> این تنها سند رسمی پروژه است. هرآنچه برای نصب، اجرا، پشتیبان‌گیری، به‌روزرسانی، عیب‌یابی و بهره‌برداری نیاز دارید اینجاست. مناسب کاربری که حتی تجربه‌ی قبلی با Linux یا Docker ندارد.



------



## 1. معرفی سریع
MarFaNet یک سامانه مدیریت مالی و نمایندگان (Invoices, Payments, KPI, Portal) است که بر پایه:
- Node.js 20 + Express (Backend + API)
- React 18 + Vite (Frontend)
- PostgreSQL 14+ (تنها پایگاه داده رسمی)
- Redis (برای Session و کش آینده)
- Docker / Docker Compose (محیط Production)

خروجی نهایی: یک سرویس واحد روی پورت 3000 که API و UI را یکجا سرو می‌کند.

---

## 4. نصب ابزارهای پایه (Ubuntu)
```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release ufw git unzip bash coreutils
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable
```

---
## 5. کلون مخزن و آماده‌سازی
```bash
cd /opt
sudo git clone https://github.com/Iscgr/final-v-panel.git marfanet
cd marfanet
sudo chown -R $USER:$USER .
cp .env.example .env 2>/dev/null || true
```
مقادیر ضروری در `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/marfanet
SESSION_SECRET=$(openssl rand -hex 32)
PORT=3000
LOG_DIRECTORY=./logs
```

---
## 6. توسعه محلی (بدون Docker)
```bash
npm install
npm run db:push
npm run dev
```
آدرس: http://localhost:3000

---
## 7. اجرای سریع با Docker محلی
```bash
docker build -t marfanet:local .
docker run --rm -p 3000:3000 --name marfanet \
	-e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/marfanet \
	-e SESSION_SECRET=$(openssl rand -hex 32) \
	-v $(pwd)/logs:/app/logs \
	marfanet:local
```
Linux:
```bash
--add-host=host.docker.internal:host-gateway
```

---
## 8. استقرار Production (Compose)
```bash
docker compose build
docker compose up -d
```
بررسی:
```bash
docker compose ps
curl -fsSL http://localhost/health
```
بروزرسانی:
```bash
git pull
docker compose build --no-cache app && docker compose up -d app
```
Rollback:
```bash
git reflog
git checkout <PREV_COMMIT>
docker compose build app && docker compose up -d app
```

---
## 9. متغیرهای محیطی کلیدی
| نام | توضیح | نمونه |
|-----|-------|-------|
| DATABASE_URL | اتصال PostgreSQL | postgresql://postgres:postgres@db:5432/marfanet |
| SESSION_SECRET | رمز سشن | خروجی openssl |
| PORT | پورت سرویس | 3000 |
| LOG_DIRECTORY | مسیر لاگ | ./logs |
| TELEGRAM_BOT_TOKEN | اختیاری | - |
| TELEGRAM_CHAT_ID | اختیاری | - |

---
## 10. سلامت
| مسیر | هدف |
|------|-----|
| /health | زنده بودن |
| /ready | اتصال پایگاه داده |

---
## 11. لاگ‌ها
```bash
tail -f logs/server.log
```

---
## 12. مهاجرت دیتابیس
```bash
npm run db:push
npm run db:generate
npm run db:migrate
```

---
## 13. پشتیبان‌گیری
```bash
mkdir -p backups
docker compose exec -T db pg_dump -U postgres marfanet > backups/$(date +%F-%H%M).sql
```
بازیابی:
```bash
cat backups/FILE.sql | docker compose exec -T db psql -U postgres -d marfanet
```

---
## 14. بروزرسانی نسخه
```bash
git pull
docker compose build --no-cache app && docker compose up -d app
```

---
## 15. امنیت پایه
1. UFW فعال (22,80,443)
2. SESSION_SECRET قوی
3. Backup روزانه
4. عدم اشتراک گذاری `.env`
5. محدود کردن اجرا در `uploads`

---
## 16. Feature Flags
فعال/غیرفعال کردن زیرسیستم‌ها (مثل Outbox Worker). افزودن فلگ جدید: ویرایش ماژول featureFlagManager.

---
## 17. ساختار پروژه
```
client/  server/  shared/  scripts/  uploads/  docker-compose.yml  Dockerfile
```

---
## 18. اسکریپت‌های مهم
| فایل | کار |
|------|-----|
| seed-portal-settings.ts | Seed اولیه |
| alloc-validation.ts | اعتبارسنجی تخصیص |
| drift-shadow.ts | تحلیل drift |

---
## 19. بازیابی بحران
| رویداد | اقدام |
|--------|-------|
| حذف DB | Restore آخرین بکاپ |
| نشت SESSION_SECRET | Rotate + Restart |
| پر شدن دیسک | حذف لاگ قدیمی |

---
## 20. FAQ
| سوال | پاسخ |
|------|-------|
| چرا یک پورت؟ | سادگی و ادغام UI+API |
| چرا فقط PostgreSQL؟ | یکپارچگی و ثبات |

---
## 21. API های نمونه
| متد | مسیر | توضیح |
|-----|------|-------|
| GET | /health | وضعیت |
| GET | /ready | آمادگی |
| GET | /api/invoices | لیست فاکتورها |

---
## 21.1 مدیریت محتوای پرتال (Phase 1 و 2 ادغام شده - بهبود یافته)
این بخش امکان مدیریت کامل محتوای پرتال عمومی را فراهم می‌کند:

### معماری کلی
- **صفحه مدیریت**: `/admin/portal-content` (UI یکپارچه با 4 تب)
- **Backend API**: ماژولار و جداسازی شده در `server/routes/`
- **Frontend Service**: `client/src/services/portal-content.ts`

### تب‌های موجود

#### 1. بلوک‌های محتوایی (Blocks)
مدیریت بلوک‌های متنی استاندارد پرتال:
- `guidance`: راهنمایی و توصیه‌ها
- `contact_info`: اطلاعات تماس
- `downloads_intro`: مقدمه دانلود اپلیکیشن‌ها
- `support_hours`: ساعات پشتیبانی
- `announcements_title`: عنوان بخش اعلانات

**ویژگی‌ها**:
- ذخیره تک‌تک یا دسته‌جمعی (Save / Save All)
- ردیابی تغییرات با dirty state
- Optimistic UI updates
- میانبر کیبورد: `Ctrl+S` / `Cmd+S`

#### 2. اطلاعیه‌ها (Announcements)
- CRUD کامل (ایجاد، خواندن، ویرایش، حذف)
- فیلدها: عنوان، محتوا، اولویت، نوع (info/warning/success/error), فعال/غیرفعال، تاریخ انقضا
- اعتبارسنجی فرم (طول عنوان، محتوا، اولویت)
- مرتب‌سازی بر اساس اولویت

#### 3. لینک‌های دانلود اپلیکیشن (Downloads)
- CRUD کامل
- **Drag & Drop Reorder**: تغییر ترتیب نمایش با کشیدن
- دکمه "ذخیره ترتیب": POST به `/api/admin/app-downloads/reorder`
- فیلدها: عنوان، لینک، توضیحات، QR Code, Video, displayOrder, isActive

#### 4. پیش‌نمایش (Preview)
- نمایش ترکیبی read-only از تمام محتوای پرتال
- شامل: بلوک‌ها + اطلاعیه‌های فعال + اپلیکیشن‌ها
- Endpoint: `GET /api/admin/portal-content-blocks/full`

### API های Backend

**بلوک‌های محتوایی** (`/api/admin/portal-content-blocks`):
| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/` | لیست همه بلوک‌ها (guaranteed keys با fallback) |
| PUT | `/:blockKey` | بروزرسانی/ایجاد یک بلوک |
| GET | `/full` | محتوای کامل (بلوک‌ها + اطلاعیه‌ها + دانلودها) |
| PUT | `/settings` | بروزرسانی دسته‌جمعی بلوک‌ها |

**اطلاعیه‌ها** (`/api/admin/announcements`):
| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/` | لیست همه اطلاعیه‌ها |
| POST | `/` | ایجاد اطلاعیه جدید |
| PUT | `/:id` | ویرایش اطلاعیه |
| DELETE | `/:id` | حذف اطلاعیه |

**لینک‌های دانلود** (`/api/admin/app-downloads`):
| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/` | لیست همه اپلیکیشن‌ها |
| POST | `/` | ایجاد اپلیکیشن جدید |
| PUT | `/:id` | ویرایش اپلیکیشن |
| DELETE | `/:id` | حذف اپلیکیشن |
| PATCH | `/reorder` | ذخیره ترتیب جدید (payload: `{items: [{id, displayOrder}]}`) |

### تست API (نمونه)
```bash
# لیست بلوک‌ها
curl -s http://localhost:3000/api/admin/portal-content-blocks -b cookie.txt

# بروزرسانی یک بلوک
curl -X PUT http://localhost:3000/api/admin/portal-content-blocks/guidance \
  -H "Content-Type: application/json" \
  -d '{"title":"راهنمایی","body":"متن جدید راهنما"}' \
  -b cookie.txt

# محتوای کامل
curl -s http://localhost:3000/api/admin/portal-content-blocks/full -b cookie.txt
```

### Migration & Rollback
- **جداول**: `portal_content_blocks`, `announcements`, `app_downloads` (migrations موجود)
- **Rollback**: ساختار legacy `settings` هنوز حفظ شده (برای بازگشت سریع)

---

## 21.2 مهاجرت خواندن محتوای پرتال (Feature Flag)
فلگ چندمرحله‌ای جدید: portal_content_read_switch

حالات:
| حالت | توضیح |
|------|-------|
| off | رفتار legacy (خواندن از settings) |
| shadow | خواندن موازی از portal_content_blocks + لاگ تفاوت‌ها (بدون تغییر خروجی) |
| full | جایگزینی کامل فیلدهای متنی پرتال با بلوک‌های جدید |

فعال‌سازی (نمونه API):
```
curl -X POST -H 'Content-Type: application/json' \
	-d '{"feature":"portal_content_read_switch","state":"shadow"}' \
	http://localhost:3000/api/feature-flags/multi-stage/update -b cookie.txt -c cookie.txt
```

لاگ Shadow: سطرهایی با برچسب 🌓 portal_content_read_switch shadow diffs در server.log که اختلاف طول محتوای legacy و بلوک جدید را نشان می‌دهد.

Switch به full پس از بررسی تفاوت‌ها:
```
curl -X POST -H 'Content-Type: application/json' \
	-d '{"feature":"portal_content_read_switch","state":"full"}' \
	http://localhost:3000/api/feature-flags/multi-stage/update -b cookie.txt -c cookie.txt
```

Rollback: برگرداندن به off (ساختار legacy هنوز حفظ شده است)
```
curl -X POST -H 'Content-Type: application/json' \
	-d '{"feature":"portal_content_read_switch","state":"off"}' \
	http://localhost:3000/api/feature-flags/multi-stage/update -b cookie.txt -c cookie.txt
```

Deprecated Tabs: در صفحه Settings تب‌های Portal و Invoice Template حذف نشده‌اند بلکه با برچسب Deprecated و هشدار هدایت به صفحه جدید (/admin/portal-content) نشانه‌گذاری شده‌اند (اصل "حذف نه، ارتقا").

Regression Script:
```
BASE_URL=http://localhost:3000 ts-node scripts/portal-content-regression.ts
```

---

## 21.3 پردازش فایل JSON و مانیتورینگ Real-Time (بهبود یافته)
سیستم پردازش فایل‌های JSON ریز جزئیات با نمایش گرافیکی پیشرفته و پیگیری real-time.

### معماری سیستم

#### Frontend Components
1. **`LiveProcessingMonitor`** (`client/src/components/dashboard/LiveProcessingMonitor.tsx`)
   - نمایش زنده پیشرفت بر اساس Import Jobs API
   - Polling هوشمند (متوقف می‌شود در صورت completed/failed)
   - نمایش آمار: کل رکوردها، پردازش شده، خطاها
   - Status badges برای وضعیت‌های مختلف

2. **`ProcessingProgressBar`** (`client/src/components/dashboard/ProcessingProgressBar.tsx`)
   - Progress bar با انیمیشن shimmer
   - آیکون‌های متحرک بر اساس فاز (Upload, Validating, Processing)
   - تم رنگی بر اساس وضعیت (blue, green, yellow, red)
   - نمایش مراحل پردازش

3. **`JobProgress`** (`client/src/components/JobProgress.tsx`)
   - Timeline نمایش مراحل: pending → validating → ingesting → enriching → completed
   - Progress bar چندمرحله‌ای
   - نمایش خطاها

#### Backend Infrastructure
1. **Import Jobs Table** (migration `011_import_jobs.sql`)
   ```sql
   CREATE TABLE import_jobs (
     id SERIAL PRIMARY KEY,
     job_code VARCHAR(100) UNIQUE NOT NULL,
     source_file_name VARCHAR(255),
     status VARCHAR(50) DEFAULT 'pending',
     total_records INTEGER DEFAULT 0,
     processed_records INTEGER DEFAULT 0,
     error_count INTEGER DEFAULT 0,
     started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     finished_at TIMESTAMP,
     last_error TEXT
   );
   ```

2. **API Endpoints** (`/api/admin/import-jobs`)
   | متد | مسیر | توضیح |
   |-----|------|-------|
   | GET | `/` | لیست آخرین 50 job |
   | POST | `/` | ایجاد job جدید |
   | PATCH | `/:jobCode` | بروزرسانی وضعیت/شمارنده‌ها |
   | POST | `/:jobCode/start` | شروع خودکار progression |

3. **Services** (`client/src/services/import-jobs.ts`)
   - `createImportJob()`: ایجاد job در سرور
   - `updateImportJob()`: بروزرسانی پیشرفت
   - `useImportJobPolling()`: Hook polling برای یک job خاص
   - `useImportJobs()`: Hook polling برای لیست jobs
   - `calculateProgress()`: محاسبه درصد بر اساس stage + records

### جریان کامل پردازش (Workflow)

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant UploadFlow
    participant API
    participant Worker

    User->>Dashboard: انتخاب فایل JSON
    Dashboard->>UploadFlow: selectFile(file)
    UploadFlow->>UploadFlow: اعتبارسنجی محلی
    UploadFlow->>API: createImportJob(jobCode, fileName, totalRecords)
    API-->>UploadFlow: {success, jobCode}
    UploadFlow->>API: POST /api/admin/upload-json
    API->>Worker: شروع پردازش background
    Worker->>API: PATCH /import-jobs/:jobCode {status: 'validating'}
    API-->>Dashboard: polling data
    Dashboard->>User: LiveProcessingMonitor نمایش پیشرفت
    Worker->>API: PATCH {status: 'ingesting', processedRecords: X}
    Worker->>API: PATCH {status: 'enriching'}
    Worker->>API: PATCH {status: 'completed'}
    Dashboard->>User: نمایش موفقیت
```

### مراحل Processing
1. **pending**: Job ایجاد شده، منتظر شروع
2. **validating**: اعتبارسنجی ساختار JSON
3. **ingesting**: وارد کردن رکوردها به دیتابیس
4. **enriching**: غنی‌سازی داده‌ها (محاسبه فاکتورها، نمایندگان)
5. **completed** / **failed**: پایان موفق یا با خطا

### محاسبه Progress
```typescript
const stageIndex = STATUS_ORDER.indexOf(job.status);
const stageWeight = stageIndex / (STATUS_ORDER.length - 2);
const recordProgress = job.processedRecords / job.totalRecords;
const totalProgress = Math.min(stageWeight * 40 + recordProgress * 60, 99);
```

### صفحات مرتبط
- **داشبورد**: `/` - نمایش آپلود و پیشرفت live
- **مانیتور Jobs**: `/admin/import-jobs` - لیست تمام jobs و وضعیت آن‌ها
- **Debug Actions**: `/admin/debug-actions` - نمایش jobs فعال + feature flags

### تست و Debugging
```bash
# ایجاد یک job تستی
curl -X POST http://localhost:3000/api/admin/import-jobs \
  -H "Content-Type: application/json" \
  -d '{"jobCode":"test-123","sourceFileName":"test.json","totalRecords":1000}' \
  -b cookie.txt

# بروزرسانی پیشرفت
curl -X PATCH http://localhost:3000/api/admin/import-jobs/test-123 \
  -H "Content-Type: application/json" \
  -d '{"status":"ingesting","processedRecords":500}' \
  -b cookie.txt

# دریافت وضعیت
curl http://localhost:3000/api/admin/import-jobs -b cookie.txt | jq
```

### اسکریپت Demo
```bash
BASE_URL=http://localhost:3000 ts-node scripts/demo-import-job.ts
```

### بهبودهای آتی (Roadmap)
- [ ] اتصال خودکار Job به آپلود واقعی فایل
- [ ] WebSocket / SSE برای کاهش polling
- [ ] پشتیبانی از pause/resume
- [ ] نمایش preview رکوردهای invalid
- [ ] Export گزارش خطاها به CSV

---

## 21.4 مانیتور مرحله‌ای پردازش فایل‌ها (Import Jobs) [DEPRECATED - جایگزین شده]
این فاز، قابلیت مشاهده پیشرفت Job های پردازش فایل JSON را با مراحل زیر فراهم می‌کند:
pending → validating → ingesting → enriching → completed (یا failed)

جداول / API:
| متد | مسیر | توضیح |
|-----|------|-------|
| GET | /api/admin/import-jobs | لیست آخرین Job ها (حداکثر ۵۰ مورد) |
| POST | /api/admin/import-jobs | ایجاد Job اولیه (status=pending) |
| PATCH | /api/admin/import-jobs/:jobCode | به‌روزرسانی status / شمارنده‌ها |
| GET | /api/admin/active-actions | تجمیع import jobs فعال + فلگ‌های multi-stage فعال |

UI جدید:
| مسیر | توضیح |
|------|-------|
| /admin/import-jobs | Progress Bar مرحله‌ای + Polling خودکار (۴ ثانیه) |
| /admin/debug-actions | نمایش ترکیبی Jobs فعال + فلگ‌های فعال |

اسکریپت دمو:
```
BASE_URL=http://localhost:3000 ADMIN_COOKIE="$(cat cookie.txt 2>/dev/null)" ts-node scripts/demo-import-job.ts
```
نمایش Job در مسیر /admin/import-jobs.

ملاحظات:
1. Migration 011 ایجاد جدول import_jobs (افزودنی ایمن).
2. هنوز اتصال خودکار به جریان واقعی آپلود JSON انجام نشده (Phase بعد: hook در file-upload-routes + ایجاد job در شروع پردازش).
3. endpoint /api/admin/active-actions برای داشبورد دیباگ سبک وزن.
4. ساختار فعلی status قابل توسعه به زیرمرحله (subStage) یا درصد واقعی ingestion.

گام‌های بعد پیشنهادی:
1. اتصال خودکار: ایجاد job با POST هنگام آپلود فایل.
2. ثبت خطا در job.lastError هنگام exception در pipeline.
3. افزودن websocket یا Server-Sent Events برای کاهش Polling.
4. نگارش شاخص SLA (مدت validating، مدت ingesting و ...) برای تحلیل عملکرد.

---

---
## 22. Cheat Sheet
```bash
npm run dev
npm run build && npm start
docker compose up -d
curl -s localhost/health
```

---
پایان سند.

## 📄 لایسنس

این پروژه تحت لایسنس MIT منتشر شده است.

---

## 🆘 پشتیبانی
در صورت مواجهه با مشکل:
1. مسیرهای سلامت را بررسی کنید (`/health`, `/ready`)
2. لاگ‌ها را ببینید: `tail -n 200 logs/server.log`
3. صحت متغیرهای `.env` (خصوصا DATABASE_URL و SESSION_SECRET) را تأیید کنید
4. در صورت نیاز Issue در مخزن GitHub ثبت کنید
2. لاگ‌های سیستم را بررسی کنید: `docker-compose logs -f`
3. Issue جدیدی در GitHub ایجاد کنید

---

**نکته مهم:** این پروژه **فقط از PostgreSQL** استفاده می‌کند. هیچ‌گونه پشتیبانی از SQLite وجود ندارد.
