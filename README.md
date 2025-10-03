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
## 21.1 مدیریت محتوای پرتال (Phase 1 و 2 ادغام شده)
فاز اولیه پیاده‌سازی بلوک‌های محتوایی، اکنون با ادغام «اطلاعیه‌ها» و «لینک‌های دانلود اپ‌ها» در یک صفحه واحد (`/admin/portal-content`) تکمیل شده است. تب‌های قدیمی مستقل حذف از ناوبری شده‌اند اما فایل‌های legacy تا نهایی‌سازی پاکسازی باقی هستند (مسیر rollback آسان).

مسیرهای Admin (احراز هویت لازم):
| متد | مسیر | توضیح |
|-----|------|-------|
| GET | /api/admin/portal-content-blocks | دریافت لیست بلوک‌های استاندارد (guaranteed keys) |
| PUT | /api/admin/portal-content-blocks/:blockKey | ایجاد/بروزرسانی (upsert) بلوک مشخص |

کلیدهای فعلی:
guidance, contact_info, downloads_intro, support_hours, announcements_title

UI فعلی: صفحه `PortalContentManager` شامل تب‌های:
- Blocks (ویرایش ساخت‌یافته بلوک‌های محتوایی با Save, Save All)
- Announcements (CRUD + اعتبارسنجی طول، نوع، اولویت)
- Downloads (CRUD + Drag & Drop reorder + ذخیره ترتیب)
- Preview (نمای ترکیبی read-only از blocks + announcements + downloads)

ایمن‌سازی:
1. هنوز پرتال عمومی از settings موجود می‌خواند ⇒ بدون ریسک رگرسیون.
2. حذف تب‌های قدیمی «Portal» و «Invoice Template» از صفحه Settings انجام شد (Deprecated) برای جلوگیری از سردرگمی.
3. امکان rollback سریع: کافی است commit مربوط به حذف UI قدیمی revert شود و روتر جدید حذف گردد.

گام‌های انجام‌شده (Phase 2):
1. ادغام تب‌های Announcements و Downloads + Preview.
2. Drag & Drop برای ترتیب نمایش دانلودها + دکمه «ذخیره ترتیب» (POST /app-downloads/reorder).
3. Service ماژولار `portal-content.ts` برای جداسازی منطق API.
4. اعتبارسنجی فرم‌ها (طول، فرمت لینک، محدودیت اولویت).

گام‌های بعد (Phase 3):
1. افزودن نسخه‌بندی بلوک‌ها (history snapshot).
2. A11Y بهبود یافته (کیبوردی برای Drag & Drop، aria-label ها).
3. حذف کامل فایل‌های legacy پس از یک دوره پایش.

Rollback Quick Guide:
```
git revert <commit_that_removed_old_settings_tabs>
# یا حذف دستی مسیر /api/admin/portal-content-blocks و صفحه PortalContentManager
```

تست سریع صحت:
```
curl -s localhost:3000/api/admin/portal-content-blocks -b cookie.txt -c cookie.txt
```
خروجی باید شامل همه کلیدهای استاندارد حتی اگر مقدار body اولیه fallback باشد.

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

Instrumentation پردازش Import (گسترش یافته):
- جدول import_jobs (migration 011) + مسیر جدید `/api/admin/import-jobs/:jobCode/start` برای شبیه‌سازی pipeline سمت سرور.
- مراحل واقعی سمت سرور: pending → validating → ingesting (به‌روزرسانی processedRecords) → enriching → completed (یا failed در صورت خطا).
- کلاینت: محاسبه درصد پیشرفت ترکیبی (stage weight + رکوردهای پردازش‌شده).

Regression Script به‌روزرسانی شده:
```
BASE_URL=http://localhost:3000 ts-node scripts/portal-content-regression.ts
```
خروجی شامل:
1. تایید presence کلیدها
2. تست upsert + revert guidance
3. Snapshot SHA256 برای تشخیص drift
4. (اختیاری) تست round-trip دوم با EXTRA_ROUND_TRIP=1

وضعیت کنونی Import Jobs:
1. UI پیشرفت مرحله‌ای و Event Log تکمیل.
2. سرور اکنون قابلیت progression خودکار دارد (endpoint start).
3. گام بعد: اتصال آپلود واقعی فایل به ایجاد و start خودکار job + احتمالا SSE/WebSocket برای کاهش Polling.

---
## 21.3 مانیتور مرحله‌ای پردازش فایل‌ها (Import Jobs)
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
