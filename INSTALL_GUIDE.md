# 🚀 راهنمای نصب سریع MarFaNet

## نصب با یک دستور (توصیه شده)

### روش 1: اجرای مستقیم از مخزن (پس از push)

```bash
curl -sSL https://raw.githubusercontent.com/Iscgr/AgentPortalShield/prof/install.sh | sudo bash
```

### روش 2: نصب دستی (برای سرورهایی که مخزن کلون شده)

اگر مخزن را از قبل کلون کرده‌اید:

```bash
cd /opt/marfanet  # یا مسیری که کلون کرده‌اید
sudo bash install.sh
```

### روش 3: دانلود و اجرا

```bash
wget https://raw.githubusercontent.com/Iscgr/AgentPortalShield/prof/install.sh
chmod +x install.sh
sudo ./install.sh
```

---

## پیش‌نیازها

✅ **سیستم عامل:** Ubuntu 20.04+ یا 22.04+ (توصیه شده: Ubuntu 24.04)  
✅ **دسترسی:** Root یا sudo  
✅ **رم:** حداقل 2GB (توصیه: 4GB+)  
✅ **دیسک:** حداقل 20GB فضای خالی  
✅ **شبکه:** دسترسی به اینترنت و پورت‌های 80, 443 باز  
✅ **DNS:** رکورد A دامنه به IP سرور اشاره کند

---

## چه اتفاقی می‌افتد؟

اسکریپت به طور خودکار این مراحل را انجام می‌دهد:

1. ✅ نصب پیش‌نیازها (Docker, Git, Nginx, Certbot, ...)
2. ✅ کلون یا آپدیت مخزن از GitHub
3. ✅ تولید خودکار رمزهای امن
4. ✅ ایجاد فایل‌های پیکربندی (.env, docker-compose, nginx)
5. ✅ ساخت و راه‌اندازی کانتینرها (DB, Redis, App, Nginx)
6. ✅ اجرای migrations دیتابیس
7. ✅ ایجاد کاربر admin اولیه
8. ✅ صدور گواهی SSL از Let's Encrypt
9. ✅ نصب ابزار مدیریت (`marfanet`)
10. ✅ پیکربندی Firewall

**مدت زمان:** 5-10 دقیقه (بسته به سرعت اینترنت و سرور)

---

## پس از نصب

### دسترسی به سیستم

- **پنل ادمین:** `https://marfanet.irnrefnation.com/admin`
- **پورتال عمومی:** `https://marfanet.irnrefnation.com/portal/{id}`

### نمایش اطلاعات ورود

```bash
cat /opt/marfanet/credentials.txt
```

یا

```bash
marfanet credentials
```

### ابزار مدیریت

```bash
marfanet              # منوی تعاملی
marfanet status       # وضعیت سیستم
marfanet logs         # لاگ‌های زنده
marfanet backup       # بکاپ دیتابیس
marfanet restart      # ریستارت سیستم
marfanet update       # آپدیت به آخرین نسخه
marfanet health       # تست سلامت
```

---

## عیب‌یابی

### بررسی وضعیت کانتینرها

```bash
cd /opt/marfanet
docker compose -f docker-compose.prod.yml ps
```

### مشاهده لاگ‌ها

```bash
# لاگ اپلیکیشن
docker compose -f /opt/marfanet/docker-compose.prod.yml logs app

# لاگ دیتابیس
docker compose -f /opt/marfanet/docker-compose.prod.yml logs db

# لاگ نصب
cat /var/log/marfanet-install.log
```

### ریستارت سرویس‌ها

```bash
cd /opt/marfanet
docker compose -f docker-compose.prod.yml restart
```

### SSL کار نمی‌کند؟

1. بررسی DNS:
```bash
dig +short marfanet.irnrefnation.com
curl ifconfig.me  # باید با نتیجه بالا یکسان باشد
```

2. اجرای دستی certbot:
```bash
certbot certonly --standalone -d marfanet.irnrefnation.com
```

3. ریستارت nginx:
```bash
docker compose -f /opt/marfanet/docker-compose.prod.yml restart nginx
```

### دیتابیس متصل نمی‌شود؟

```bash
# تست اتصال دیتابیس
docker compose -f /opt/marfanet/docker-compose.prod.yml exec db pg_isready -U marfanet

# ریستارت دیتابیس
docker compose -f /opt/marfanet/docker-compose.prod.yml restart db
```

---

## حذف کامل (Uninstall)

```bash
cd /opt/marfanet
docker compose -f docker-compose.prod.yml down -v
rm -rf /opt/marfanet
rm /usr/local/bin/marfanet
```

**⚠️ هشدار:** این کار تمام داده‌ها را حذف می‌کند!

---

## پشتیبانی

- **مستندات:** [README.md](/opt/marfanet/README.md)
- **مشکلات:** [GitHub Issues](https://github.com/Iscgr/AgentPortalShield/issues)

---

## یادداشت‌های امنیتی

✅ تمام رمزها به صورت خودکار و تصادفی تولید می‌شوند  
✅ فایل `.env` فقط توسط root قابل خواندن است (chmod 600)  
✅ پورت‌های دیتابیس و Redis فقط داخلی هستند  
✅ SSL/TLS به صورت خودکار پیکربندی می‌شود  
✅ Firewall به صورت خودکار تنظیم می‌شود  

**توصیه:** بعد از نصب حتماً:
1. رمز admin را تغییر دهید
2. فایل `credentials.txt` را در جای امن نگهداری کنید
3. بکاپ منظم بگیرید (`marfanet backup`)

---

**نصب موفق! 🎉**
