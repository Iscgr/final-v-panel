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
