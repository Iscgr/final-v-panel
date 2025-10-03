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

## 2. سناریوهای اجرا
| سناریو | توضیح | فرمان توصیه‌شده |
|--------|-------|------------------|
| توسعه محلی (بدون Docker) | کدنویسی سریع | `npm run dev` |
| اجرای سریع تصویر ساخته‌شده | تست سلامت build | (بخش 8) |
| Production با Compose (پیشنهادی) | پایدار و قابل نگهداری | `docker-compose up -d` |
| استقرار تک‌مرحله‌ای روی Ubuntu خام | نصب همه اجزا | (بخش 5 + 6) |

---
## 3. حداقل نیازمندی‌ها
| منبع | حداقل | پیشنهاد شده |
|------|--------|-------------|
| CPU | 2 Core | 4 Core |
| RAM | 4 GB | 8 GB |
| دیسک | 15 GB | 40 GB SSD |
| سیستم‌عامل | Ubuntu 22.04/24.04 | Ubuntu LTS جدید |
| پورت‌های باز | 22,80,443 (داخلی:3000,5432,6379) | همان |

---
## 8. استقرار Production با Docker Compose
فایل `docker-compose.yml` شامل سرویس‌های اصلی است (app + postgres + nginx). برای اجرای پایدار:
```bash
docker compose pull   # اگر registry دارید
docker compose build  # در صورت نبود تصویر آماده
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
Rollback در صورت خطا (برگشت به commit قبلی):
```bash
git reflog
git checkout <PREV_COMMIT>
docker compose build app && docker compose up -d app
```

---
## 15. امنیت پایه
1. ایجاد کاربر غیر روت برای اپلیکیشن
2. فعال بودن UFW فقط روی پورت‌های 22,80,443
3. تنظیم منظم backup
````
## 19. بازیابی بحران (Disaster Recovery)
سناریوهای بحرانی و پاسخ:
| رویداد | اقدام فوری | بازیابی |
|--------|-------------|---------|
| حذف اتفاقی کانتینر DB | قطع دسترسی نوشتن | Restore از آخرین Backup |
| خرابی کامل میزبان | راه‌اندازی سرور جدید | استقرار سرویس + Import Backup |
| نشت SESSION_SECRET | Rotate کلید | تغییر متغیر و Restart سرویس |
| پر شدن دیسک | حذف لاگ قدیمی | انتقال Backup به فضای خارجی |

پیشنهاد: Backup روزانه + نگهداری 7 نسخه.

---
پایان سند.
````
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
