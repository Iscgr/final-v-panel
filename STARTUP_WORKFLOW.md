# 🚀 روند صحیح اجرای اپلیکیشن MarFaNet

> **مهم**: این سند روند صحیح و تست شده برای اجرای اپلیکیشن MarFaNet در محیط‌های مختلف را مستند می‌کند.

## 📋 فهرست مطالب
- [پیش‌نیازها](#-پیش‌نیازها)
- [محیط Development](#-محیط-development)
- [محیط Production](#-محیط-production)
- [تست عملکرد](#-تست-عملکرد)
- [خطایابی](#-خطایابی)

---

## 🔧 پیش‌نیازها

### نرم‌افزارهای مورد نیاز
```bash
# Node.js 20+
node --version  # باید v20.0.0+ باشد

# npm 10+
npm --version   # باید v10.0.0+ باشد

# PostgreSQL 15+
psql --version  # باید 15.0+ باشد

# Docker & Docker Compose (اختیاری)
docker --version
docker-compose --version
```

### متغیرهای محیطی مورد نیاز
```bash
# در فایل .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/marfanet
LOG_DIRECTORY=./logs
NODE_ENV=development
PORT=3000
```

---

## 🛠️ محیط Development

### مرحله 1: راه‌اندازی Database
```bash
# روش A: با Docker (پیشنهادی)
# توجه: نام services در docker-compose.yml همان db و redis است
docker-compose up -d db redis

# روش B: نصب محلی PostgreSQL
sudo systemctl start postgresql
sudo -u postgres createdb marfanet
```

### مرحله 2: تنظیم Dependencies
```bash
# نصب dependencies
npm install

# setup database schema
npm run db:push
```

### مرحله 3: اجرای سرور Development
```bash
# روش صحیح - دستور اصلی
npm run dev

# این دستور معادل است با:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/marfanet 
# LOG_DIRECTORY=./logs 
# NODE_ENV=development 
# tsx server/index.ts
```

### مرحله 4: تأیید اجرای صحیح
```bash
# بررسی status سرور (باید port 3000 در لیست باشد)
netstat -tlnp | grep 3000

# تست API health
curl http://127.0.0.1:3000/api/health

# تست authentication
curl http://127.0.0.1:3000/api/auth/me

# تست dashboard data
curl http://127.0.0.1:3000/api/dashboard
```

### مرحله 5: دسترسی به UI
```bash
# باز کردن در مرورگر
# روش A: VS Code Simple Browser
# روش B: مرورگر محلی
http://127.0.0.1:3000/
```

---

## 🏭 محیط Production

### مرحله 1: Build کردن Application
```bash
# build TypeScript
npm run build

# یا استفاده از Docker
docker build -t marfanet .
```

### مرحله 2: اجرا در Production
```bash
# روش A: با Node.js
NODE_ENV=production node start-server.js

# روش B: با Docker Compose
docker-compose up -d

# روش C: با PM2
pm2 start ecosystem.config.js
```

---

## ✅ تست عملکرد

### Checklist اجرای صحیح
- [ ] سرور روی port 3000 در حال اجراست
- [ ] Database connection موفق است
- [ ] API endpoints پاسخ می‌دهند
- [ ] React UI loading می‌شود
- [ ] Authentication کار می‌کند
- [ ] Dashboard data نمایش داده می‌شود

### دستورات تست خودکار
```bash
# تست کامل API endpoints
curl -s http://127.0.0.1:3000/api/health | jq '.status'
curl -s http://127.0.0.1:3000/api/auth/me | jq '.user'
curl -s http://127.0.0.1:3000/api/dashboard | jq '.success'

# تست React UI rendering
curl -s http://127.0.0.1:3000/ | grep -q '<div id="root">' && echo "UI OK"
```

---

## 🐛 خطایابی

### مشکلات رایج و راه‌حل

#### 1. سرور start نمی‌شود
```bash
# بررسی port conflict
sudo lsof -i :3000

# kill process
sudo kill -9 $(lsof -t -i:3000)

# restart
npm run dev
```

#### 2. Database connection خطا
```bash
# بررسی PostgreSQL status
sudo systemctl status postgresql

# restart PostgreSQL
sudo systemctl restart postgresql

# test connection
psql postgresql://postgres:postgres@localhost:5432/marfanet -c "SELECT 1;"
```

#### 3. صفحه خالی/سرمه‌ای
```bash
# بررسی import paths در main.tsx
# باید: import App from "./App" (نه App-simple)

# اگر import نادرست است، اصلاح کنید:
# 1. باز کردن client/src/main.tsx
# 2. تغییر: import App from "./App-simple" 
# 3. به: import App from "./App"
# 4. restart سرور

# بررسی Vite build
# terminal باید نشان دهد: "✨ optimized dependencies changed. reloading"
```

#### 4. API 404 errors
```bash
# بررسی routes setup
grep -r "router\." server/routes/

# بررسی middleware order در server/index.ts
```

### لاگ‌های مهم
```bash
# server logs
tail -f logs/marfanet-$(date +%Y-%m-%d).log

# docker logs
docker-compose logs -f

# npm logs
npm run dev 2>&1 | tee debug.log
```

---

## 🎯 نکات مهم

### ⚠️ خطاهای رایج که باید اجتناب کرد
1. **اجرا بدون Docker/PostgreSQL**: سرور start نخواهد شد
2. **import غلط در main.tsx**: صفحه خالی نمایش داده می‌شود
3. **port conflict**: سرور روی port دیگری اجرا می‌شود
4. **environment variables نامعتبر**: database connection fail می‌شود

### ✅ Best Practices
1. همیشه `npm run dev` را برای development استفاده کنید
2. قبل از start، وضعیت database را بررسی کنید
3. terminal output را برای خطایابی نظارت کنید
4. برای production، حتماً `NODE_ENV=production` تنظیم کنید

---

## 📚 منابع مرتبط
- [README.md](./README.md) - راهنمای کلی
- [INSTALLATION.md](./INSTALLATION.md) - راهنمای نصب
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - راهنمای خطایابی
- [docker-compose.yml](./docker-compose.yml) - تنظیمات Docker

---

**آخرین بروزرسانی**: 1 اکتبر 2025  
**تست شده روی**: Ubuntu 24.04 LTS, Node.js 20.17.0, PostgreSQL 15.8