# 🌱 MarFaNet - پنل مدیریت نمایندگان و گزارش‌های مالی# 🌱 راهنمای شروع سریع MarFaNet



MarFaNet یک پنل تحت‌وب برای مدیریت نمایندگان، فاکتورها، گزارش‌های مالی و تحلیل عملکرد است که به صورت کامل با Docker عملیاتی می‌شود.این سند مخصوص کسانی است که اولین بار می‌خواهند MarFaNet را روی یک سرور تازه راه‌اندازی کنند. اگر تاکنون با Docker یا لینوکس کار نکرده‌اید، نگران نباشید؛ مراحل را قدم‌به‌قدم دنبال کنید.



------



## 🏗️ معماری سیستم## 🧭 MarFaNet چیست؟

MarFaNet یک پنل تحت‌وب برای مدیریت نمایندگان، فاکتورها و گزارش‌های مالی است که همه اجزای لازم (اپلیکیشن، پایگاه‌داده، کش، وب‌سرور و SSL) را خودش نصب می‌کند. تنها کاری که باید انجام دهید اجرای یک اسکریپت است؛ بقیه کارها خودکار انجام می‌شود.

### تکنولوژی‌های اصلی

- **دیتابیس:** PostgreSQL 14 (دیتابیس اصلی پروژه)### تکنولوژی‌های اصلی

- **کش:** Redis 7- **دیتابیس:** PostgreSQL 14+ (با Drizzle ORM)

- **Backend:** Node.js 18+ + Express + TypeScript- **کش:** Redis 7

- **Frontend:** React 18 + Vite + Tailwind CSS- **Backend:** Node.js + Express + TypeScript

- **ORM:** Drizzle ORM (PostgreSQL driver)- **Frontend:** React 18 + Vite + Tailwind CSS

- **کانتینریزاسیون:** Docker + Docker Compose

---

### ساختار Monorepo

```## ✅ قبل از شروع

/workspaces/final-v-panel/| مورد | توضیح |

├── client/              # React frontend application|------|-------|

├── server/              # Express backend API| سیستم‌عامل | Ubuntu 20.04 یا 22.04 یا 24.04 (کاربر روت یا sudo) |

├── shared/              # Shared types and schemas (Drizzle)| دسترسی | اتصال SSH به سرور و دسترسی اینترنت |

├── python-service/      # Python microservice| دامنه | رکورد `A` باید به IP سرور اشاره کند (برای گواهی SSL) |

├── migrations/          # Drizzle PostgreSQL migrations| پورت‌ها | پورت‌های 80 و 443 باید باز باشند |

├── scripts/             # Utility scripts| منابع | حداقل 2 هسته CPU، 4 گیگ RAM و 15 گیگ فضای خالی |

└── docker-compose.yml   # Container orchestration

```> اگر هنوز دامنه ندارید می‌توانید نصب را انجام دهید، اما SSL صادر نمی‌شود و باید بعداً آن را تکرار کنید.



------



## ✅ پیش‌نیازها## ۱. نصب خودکار (۳ گام ساده)

1. از طریق SSH وارد سرور شوید.

| مورد | توضیح |2. فایل نصب را دانلود کنید:

|------|-------|   ```bash

| سیستم‌عامل | Ubuntu 20.04+ / Debian 11+ / macOS / Windows (WSL2) |   curl -sSL https://raw.githubusercontent.com/Iscgr/final-v-panel/prof/scripts/auto-install.sh -o auto-install.sh

| Docker | Docker Engine 20.10+ |   chmod +x auto-install.sh

| Docker Compose | v2.0+ |   ```

| Node.js | v18 یا بالاتر (برای توسعه محلی) |3. اسکریپت را با دسترسی روت اجرا کنید:

| منابع | حداقل 2 CPU، 4GB RAM، 15GB فضای دیسک |   ```bash

| پورت‌ها | 3000 (Frontend), 5000 (Backend), 5432 (PostgreSQL), 6379 (Redis) |   sudo ./auto-install.sh

   ```

---

### اگر دامنه اختصاصی خودتان را دارید

## 🚀 نصب و راه‌اندازی (محیط توسعه)قبل از اجرای اسکریپت، نام دامنه را به شکل زیر تعیین کنید:

```bash

### 1️⃣ کلون کردن پروژهsudo DOMAIN=your-domain.com ./auto-install.sh

```bash```

git clone https://github.com/Iscgr/final-v-panel.git- اسکریپت Docker، PostgreSQL، Redis و Nginx را نصب و پیکربندی می‌کند.

cd final-v-panel- گواهی SSL (Let’s Encrypt) به‌صورت خودکار درخواست می‌شود.

```- تمام رمزهای مهم تولید و در فایل `.env` ذخیره می‌شوند.



### 2️⃣ تنظیم متغیرهای محیطی> نصب کامل معمولاً 5 تا 10 دقیقه طول می‌کشد. هنگام اجرا صفحه را نبندید.

```bash

cp .env.example .env---

```

## ۲. بررسی نتیجه نصب

فایل `.env` را ویرایش کنید و مقادیر زیر را تنظیم نمایید:پس از پایان اسکریپت، خروجی شبیه نمونه زیر است:

```env```

# Database (PostgreSQL)============================================================

POSTGRES_USER=marfanet_user نصب MarFaNet تکمیل شد

POSTGRES_PASSWORD=your_secure_password============================================================

POSTGRES_DB=marfanet_dbدامنه: https://example.com

DATABASE_URL=postgresql://marfanet_user:your_secure_password@postgres:5432/marfanet_dbپنل:  https://example.com/admin

پورتال: https://example.com/portal/[ID]

# RedisAdmin User: admin

REDIS_URL=redis://redis:6379Admin Pass: <RAND_PASS>

...

# Server============================================================

NODE_ENV=development```

PORT=5000

SESSION_SECRET=your_session_secret_here### اطلاعات مهم بعد از نصب

| مورد | مسیر / دستور |

# Client|------|---------------|

VITE_API_URL=http://localhost:5000| آدرس پنل مدیریت | `https://YOUR-DOMAIN/admin` |

```| رمز و نام کاربری ادمین | فایل `/opt/marfanet/.env` (متغیرهای `ADMIN_USERNAME`, `ADMIN_PASSWORD`) |

| فایل تنظیمات محیطی | `/opt/marfanet/.env` |

### 3️⃣ راه‌اندازی سرویس‌های Docker| فایل‌های Compose و Nginx | `/opt/marfanet/docker-compose-stack.yml` و `/opt/marfanet/nginx.conf` |

```bash| ابزار مدیریت | دستور `agent` |

docker-compose up -d postgres redis

```> پیشنهاد می‌شود در اولین ورود، رمز کاربر `admin` را تغییر دهید.



بررسی سلامت سرویس‌ها:---

```bash

docker-compose ps## ۳. آشنایی با ابزار `agent`

```اسکریپت نصب یک دستور ساده به نام `agent` می‌سازد. کافی است بنویسید:

```bash

### 4️⃣ نصب وابستگی‌هاagent

```bash```

npm installو یکی از گزینه‌ها را انتخاب کنید:

``````

1) بکاپ + ارسال تلگرام

### 5️⃣ اجرای Migrations (ایجاد جداول PostgreSQL)2) آپدیت پنل

```bash3) ریستارت پنل

npm run db:push4) نمایش لاگ

```5) وضعیت سلامت

q) خروج

یا برای استفاده از migration files:```

```bash

npm run db:migrate### دستورهای پرکاربرد

```| فرمان | کارکرد |

|--------|--------|

### 6️⃣ اجرای اپلیکیشن در محیط توسعه| `agent backup` | تهیه نسخه پشتیبان از دیتابیس (فایل در `/opt/marfanet/backups`) |

```bash| `agent update` | دریافت آخرین کدها و بازسازی کانتینر اپلیکیشن |

npm run dev| `agent restart` | راه‌اندازی مجدد تمام سرویس‌ها |

```| `agent logs` | نمایش 200 خط آخر لاگ اپلیکیشن |

| `agent health` | بررسی آدرس `/health` بدون نیاز به مرورگر |

اپلیکیشن در آدرس‌های زیر در دسترس خواهد بود:

- **Frontend:** http://localhost:3000اگر می‌خواهید بکاپ به تلگرام ارسال شود، شناسه ربات و چت را در فایل `.env` مقداردهی کنید:

- **Backend API:** http://localhost:5000```env

TELEGRAM_BOT_TOKEN=xxx

---TELEGRAM_CHAT_ID=123456

```

## 🏭 استقرار در محیط Production

---

### استفاده از Docker Compose (توصیه شده)

## ۴. به‌روزرسانی یا نصب دوباره

```bashاگر از قبل MarFaNet را نصب کرده‌اید و می‌خواهید نسخه جدید را بگیرید، کافی است اسکریپت تازه را دانلود و اجرا کنید؛ ابزار به‌طور خودکار مخزن را روی نسخه جدید تنظیم می‌کند.

# Build کردن تمام سرویس‌ها```bash

docker-compose buildcurl -sSL https://raw.githubusercontent.com/Iscgr/final-v-panel/prof/scripts/auto-install.sh -o auto-install.sh

chmod +x auto-install.sh

# اجرای تمام سرویس‌هاsudo ./auto-install.sh

docker-compose up -d```

# بررسی وضعیت
docker-compose ps

# مشاهده لاگ‌ها
docker-compose logs -f
```

### دستورات مفید

```bash
# توقف سرویس‌ها
docker-compose down

# پاک کردن volumes (حذف داده‌های دیتابیس)
docker-compose down -v

# Restart کردن یک سرویس خاص
docker-compose restart server

# اجرای دستورات داخل کانتینر
docker-compose exec server npm run db:push
```

---

## 🗄️ مدیریت دیتابیس PostgreSQL

### اتصال مستقیم به PostgreSQL
```bash
docker-compose exec postgres psql -U marfanet_user -d marfanet_db
```

### بکاپ از دیتابیس
```bash
docker-compose exec postgres pg_dump -U marfanet_user marfanet_db > backup_$(date +%Y%m%d).sql
```

### بازیابی از بکاپ
```bash
cat backup_20250102.sql | docker-compose exec -T postgres psql -U marfanet_user -d marfanet_db
```

### مشاهده جداول
```sql
\dt
```

### مشاهده ساختار یک جدول
```sql
\d table_name
```

---

## 📊 Drizzle ORM

### مدیریت Schema
تمام schema های دیتابیس در فایل `shared/schema.ts` تعریف شده‌اند:

```typescript
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### دستورات Drizzle

```bash
# Push schema به دیتابیس (بدون migration)
npm run db:push

# ایجاد migration جدید
npm run db:generate

# اعمال migrations
npm run db:migrate

# باز کردن Drizzle Studio (UI مدیریت دیتابیس)
npm run db:studio
```

---

## 🧪 تست‌ها

```bash
# اجرای تمام تست‌ها
npm test

# اجرای تست‌های یک فایل خاص
npm test -- scripts/alloc-validation.ts
```

---

## 📦 Build برای Production

```bash
# Build کردن Client و Server
npm run build

# اجرای Build شده
npm start
```

---

## 🔧 عیب‌یابی

### مشکلات رایج

#### دیتابیس به راه نمی‌افتد
```bash
# بررسی لاگ PostgreSQL
docker-compose logs postgres

# Restart کردن سرویس
docker-compose restart postgres
```

#### Port در حال استفاده است
```bash
# پیدا کردن پروسه‌ای که از port استفاده می‌کند
sudo lsof -i :3000
sudo lsof -i :5000

# Kill کردن پروسه
kill -9 <PID>
```

#### مشکل در Migration
```bash
# Drop کردن تمام جداول و اجرای مجدد
npm run db:push -- --force
```

#### پاک کردن کامل و شروع مجدد
```bash
docker-compose down -v
docker-compose up -d postgres redis
npm run db:push
npm run dev
```

---

## 📚 مستندات بیشتر

برای اطلاعات تکمیلی به فایل‌های زیر مراجعه کنید:
- [DATABASE_GUIDE.md](./DATABASE_GUIDE.md) - راهنمای کامل PostgreSQL و Drizzle
- [DEPLOYMENT_SPEC.md](./DEPLOYMENT_SPEC.md) - مشخصات استقرار در Production
- [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md) - مستندات فنی سیستم
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - راهنمای عیب‌یابی پیشرفته
- [CHANGELOG.md](./CHANGELOG.md) - تاریخچه تغییرات

---

## 🤝 مشارکت

برای مشارکت در پروژه:
1. Fork کردن repository
2. ایجاد branch جدید (`git checkout -b feature/amazing-feature`)
3. Commit کردن تغییرات (`git commit -m 'Add amazing feature'`)
4. Push کردن به branch (`git push origin feature/amazing-feature`)
5. ایجاد Pull Request

---

## 📄 لایسنس

این پروژه تحت لایسنس MIT منتشر شده است.

---

## 🆘 پشتیبانی

در صورت مواجهه با مشکل:
1. ابتدا [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) را مطالعه کنید
2. لاگ‌های سیستم را بررسی کنید: `docker-compose logs -f`
3. Issue جدیدی در GitHub ایجاد کنید

---

**نکته مهم:** این پروژه **فقط از PostgreSQL** استفاده می‌کند. هیچ‌گونه پشتیبانی از SQLite وجود ندارد.
