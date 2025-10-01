<div align="center">

<h1>🚀 MarFaNet (نسخه استقرار خودکار 2025)</h1>

**پلتفرم مدیریت مالی، نمایندگان و فاکتورها با استقرار یک‌مرحله‌ای و ابزار خط فرمان**

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Production-blue.svg)](https://docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://postgresql.org/)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04%20LTS-orange.svg)](https://ubuntu.com/)

</div>

---

## ⚡ Quick Start

```bash
# نصب کامل با یک دستور (5-10 دقیقه)
curl -sSL https://raw.githubusercontent.com/Iscgr/AgentPortalShield/prof/install.sh | sudo bash
```

**یا اگر مخزن کلون کرده‌اید:**

```bash
cd /opt/marfanet
sudo bash install.sh
```

**پس از نصب:**
- 🌐 دسترسی: `https://marfanet.irnrefnation.com/admin`
- 📋 اطلاعات ورود: `cat /opt/marfanet/credentials.txt`
- 🛠️ مدیریت: `marfanet` (منوی تعاملی)

📚 **مستندات کامل:**
- [راهنمای نصب تفصیلی](INSTALL_GUIDE.md)
- [مشخصات فنی استقرار](DEPLOYMENT_SPEC.md)
- [اسکریپت اعتبارسنجی](validate-install.sh)

---

## فهرست مطالب
1. معرفی سریع
2. ویژگی‌ها
3. معماری
4. نصب یک‌خطی (Production)
5. ابزار مدیریتی `marfanet`
6. متغیرهای محیطی
7. عملیات نگهداری (Backup / Update / Restore)
8. امنیت و توصیه‌ها
9. عیب‌یابی سریع
10. Roadmap
11. مجوز

---

## 1) معرفی سریع
MarFaNet یک سرویس یکپارچه (App + API + Portal) است که با کمترین ورودی (فقط دامنه) روی Ubuntu 24.04+ نصب می‌شود. تمامی رمزها، کانفیگ‌ها و زیرساخت Docker خودکار ساخته می‌گردد.

### اهداف طراحی
- Zero-Touch Deployment
- Secrets Auto-Generation
- Isolation & Safety (Docker Network)
- عملیات روزمره با یک دستور (`agent`)

---

## 2) ویژگی‌ها
- نصب تمام اجزا با یک اسکریپت (Docker + Nginx + SSL + PostgreSQL + Redis)
- تولید Admin Password, DB Password, Session Secret
- پورتال نمایندگان: `/portal/[ID]`
- پنل مدیریت: `/admin`
- سازوکار Backup + ارسال اختیاری به تلگرام
- Health Endpoint و حالت ایزوله داخلی (App فقط روی 127.0.0.1:3000)
- آپدیت بدون تخریب دیتا (Rebuild فقط کانتینر app)

---

## 3) معماری
```
┌─────────────────────────────────────────┐
│ Nginx (Reverse Proxy + SSL + HTTP/2)    │  ← 80 / 443
└───────────────▲────────────────────────┘
      │  proxy_pass
   ┌───────┴────────────────────────┐
   │  Node.js App (API + UI + Portal)│ ← 127.0.0.1:3000
   └───────▲───────────┬────────────┘
      │           │
     PostgreSQL     Redis(Session)
```

| سرویس | نقش | شبکه | پایداری |
|-------|-----|------|---------|
| app | UI + API + Portal | داخلی | restart unless-stopped |
| db | PostgreSQL 15 | داخلی | volume پایدار |
| redis | Session/Caching | داخلی | AOF on |
| nginx | ورودی خارجی | 80/443 | reverse proxy |

---

## 4) نصب یک‌خطی (Production)
### پیش‌نیاز DNS
دامنه باید به IP سرور اشاره کند (A Record).

### اجرا
```bash
curl -sSL https://YOUR-CDN-DOMAIN/path/auto-install.sh | sudo bash
```
یا:
```bash
git clone -b prof https://github.com/Iscgr/AgentPortalShield.git /opt/marfanet
cd /opt/marfanet
sudo bash scripts/auto-install.sh
```

### خروجی نمونه
```
============================================================
 نصب MarFaNet تکمیل شد
============================================================
دامنه: https://example.com
پنل:  https://example.com/admin
پورتال: https://example.com/portal/[ID]
Admin User: admin
Admin Pass: <RAND_PASS>
DB Pass: <DB_PASS>
ENV: /opt/marfanet/.env
ابزار: agent (backup|update|restart|logs|health)
============================================================
```

### مسیرهای مهم
| مورد | مسیر |
|------|------|
| نصب | /opt/marfanet |
| env | /opt/marfanet/.env |
| compose | /opt/marfanet/docker-compose-stack.yml |
| nginx.conf | /opt/marfanet/nginx.conf |
| بکاپ‌ها | /opt/marfanet/backups |

---

## 5) ابزار مدیریتی `agent`
منوی تعاملی:
```bash
agent
```
گزینه‌ها:
```
1) بکاپ + ارسال تلگرام
2) آپدیت پنل
3) ریستارت پنل
4) نمایش لاگ
5) وضعیت سلامت
q) خروج
```
فرمان‌های مستقیم:
```bash
agent backup
agent update
agent restart
agent logs
agent health
```
فعال‌سازی تلگرام در `.env`:
```env
TELEGRAM_BOT_TOKEN=XXXX
TELEGRAM_CHAT_ID=123456789
```

---

## 6) متغیرهای محیطی
| کلید | شرح | مقدار نمونه | خودکار |
|------|-----|-------------|--------|
| NODE_ENV | محیط اجرا | production | بله |
| PORT | پورت داخلی اپ | 3000 | بله |
| DATABASE_URL | URL اتصال DB | postgresql://... | بله |
| SESSION_SECRET | کلید نشست | rand hex | بله |
| ADMIN_USERNAME | کاربر اولیه | admin | بله |
| ADMIN_PASSWORD | رمز اولیه | rand | بله |
| PUBLIC_BASE_URL | دامنه اصلی | https://example.com | بله |
| PUBLIC_PORTAL_BASE_URL | دامنه پورتال | https://example.com | بله |
| TELEGRAM_BOT_TOKEN | بکاپ تلگرام | - | خیر |
| TELEGRAM_CHAT_ID | چت مقصد | - | خیر |
| SKIP_REDIS_HEALTH | کاهش نویز dev | 1 | اختیاری |

---

## 7) نگهداری
بکاپ:
```bash
agent backup
```
زمانبندی:
```bash
crontab -e
0 3 * * * /usr/local/bin/agent backup >/dev/null 2>&1
```
آپدیت:
```bash
agent update
```
ریستارت:
```bash
agent restart
```
بازیابی:
```bash
gunzip db_20250101_101500.sql.gz
docker compose -f /opt/marfanet/docker-compose-stack.yml exec -T db psql -U marfanet marfanet_db < db_20250101_101500.sql
```

---

## 8) امنیت و توصیه‌ها
- پسورد admin را پس از اولین ورود تغییر دهید.
- فعال‌سازی UFW:
```bash
ufw allow 22; ufw allow 80; ufw allow 443; ufw --force enable
```
- بررسی تمدید گواهی:
```bash
certbot renew --dry-run
```
- محدودسازی SSH به کلید:
```bash
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl restart sshd
```

---

## 9) عیب‌یابی سریع
| مشکل | بررسی | رفع |
|------|--------|-----|
| 502 | `docker compose logs nginx` | صحت اجرای app |
| SSL ندارد | `ls /etc/letsencrypt/live/DOMAIN` | اجرای مجدد certbot |
| عدم ورود | ویرایش ADMIN_PASSWORD در .env | agent restart |
| لاگ لازم | agent logs | تحلیل خطا |
| بکاپ ارسال نشد | مقادیر تلگرام | تصحیح و تکرار |

Health:
```bash
curl -s https://example.com/health | jq
```

---

## 10) Roadmap
- Remote S3 Backup
- Multi-Node Scaling
- Advanced Metrics & Alerting
- OTP & MFA
- ماژول گزارش‌گیری BI

---

## 11) مجوز و قدردانی
مجوز: MIT

اگر مفید بود ⭐ بدهید.

ساخته شده با ❤️ برای اکوسیستم فارسی.

---

<div align="center"><sub>MarFaNet Autonomous Deployment Edition © 2025</sub></div>

## ✨ ویژگی‌های جدید

### �️ تغییرات (حذف/دپرکیشن اخیر – 2025-09-28)
این نسخه شامل پاکسازی‌های ساختاری مطابق نیازمندی‌های عملیاتی است:

- حذف کامل تب «یکپارچگی مالی» از UI (Route و Navigation) – فایل‌های مربوط دپرکت شده و به Placeholder تبدیل شدند.
- حذف ۴ آیکن (خروج، دستیار هوش مصنوعی، وضعیت بات تلگرام، تایمر) از نوار بالا برای ساده‌سازی تجربه.
- فعال‌سازی دکمه خروج در فوتر سایدبار (استفاده از useUnifiedAuth.logout).
- حذف اکشن‌های نمایندگان: بررسی انطباق بدهی، همگام‌سازی آمار مالی، همگام‌سازی تمام بدهی‌ها، تایید مجموع بدهی – Endpointهای متناظر backend فقط با برچسب @deprecated باقی گذاشته شدند (عدم حذف برای جلوگیری از شکستن اسکریپت‌های احتمالی).
- حذف زیرشاخه‌های تنظیمات: پیکربندی چند گروه تلگرام، پیش‌نمایش پرتال، حذف دسته‌جمعی، امنیت – کامپوننت‌های مربوط دپرکت یا حذف شدند.
- ماژول‌های dپرکت شده: FinancialIntegrityDashboard، MultiGroupConfiguration، BatchRollbackManager (غیرفعال در UI).
- هیچ تغییری در موتور مالی یکپارچه (unified-financial) انجام نشد؛ فقط قابلیت‌های بدون UI علامت‌گذاری @deprecated شدند.

> توجه: این تغییرات ساختار اصلی را حفظ کرده و برای جلوگیری از رگرسیون، فایل‌های دپرکت شده به صورت Placeholder باقی مانده‌اند تا در انتشار بعدی حذف فیزیکی شوند.

### �🚀 **نصب و deployment**
- **🐳 کامل Docker Stack**: PostgreSQL + Redis + Nginx + SSL
- **🔐 تولید خودکار پسوردها**: هیچ تنظیم دستی لازم نیست
- **⚡ Zero-Config Installation**: فقط دامنه و ایمیل میپرسد
- **🔒 Lock Mechanism**: جلوگیری از تداخل در deployments
- **🛡️ Ubuntu Support**: 20.04 + 22.04 + 24.04 LTS
- **📦 Atomic Operations**: نصب ایمن با تضمین یکپارچگی

### 🏢 مدیریت نمایندگان
- ثبت و مدیریت اطلاعات نمایندگان
- پورتال اختصاصی برای هر نماینده
- ردیابی عملکرد و گزارش‌گیری
- سیستم اعتبارسنجی و رتبه‌بندی

### 💰 مدیریت مالی
- صدور و مدیریت فاکتورها
- ردیابی پرداخت‌ها با الگوریتم FIFO
- محاسبه بدهی‌ها و مطالبات
- گزارش‌های مالی تفصیلی

### 📊 تحلیل‌های هوشمند
- تحلیل مالی با هوش مصنوعی
- پیش‌بینی جریان نقدی
- شناسایی الگوهای پرداخت
- هشدارهای هوشمند

### 🔒 امنیت و کنترل دسترسی
- احراز هویت مبتنی بر session
- کنترل دسترسی نقش‌محور (RBAC)
- رمزگذاری داده‌ها
- لاگ‌گیری تمام عملیات

### 📱 رابط کاربری مدرن
- طراحی Clay-morphism
- پشتیبانی RTL کامل
- تم تاریک/روشن
- انیمیشن‌های روان

### 🔔 اعلان‌ها و ارتباطات
- ادغام با Telegram Bot
- اعلان‌های بلادرنگ
- ایمیل خودکار
- اطلاع‌رسانی‌های هوشمند

---

## 🏗️ معماری سیستم

### Frontend (کلاینت)
```
React 18 + TypeScript + Vite
├── Components (shadcn/UI + Custom)
├── Pages (Dashboard, Representatives, Invoices)
├── Hooks (Custom hooks for state management)
├── Services (API communication)
└── Utils (Helper functions + Persian support)
```

### Backend (سرور)
```
Node.js + Express + TypeScript
├── Routes (RESTful API endpoints)
├── Services (Business logic + AI integration)
├── Middleware (Auth, Validation, Logging)
├── Database (Drizzle ORM + PostgreSQL)
└── Integrations (AI, Telegram, External APIs)
```

### Database (پایگاه داده)
```
PostgreSQL 15+
├── Representatives (نمایندگان)
├── Invoices (فاکتورها)
├── Payments (پرداخت‌ها)
├── Invoice_Batches (دسته‌بندی فاکتورها)
├── Activity_Logs (لاگ عملیات)
└── Sessions (جلسات کاربری)
```

### Infrastructure (زیرساخت)
```
Docker Containerization
├── App Container (Node.js application)
├── Database Container (PostgreSQL + Redis)
├── Proxy Container (Nginx + SSL)
└── Monitoring (Health checks + Logging)
```

### ⚙️ پرچم‌های محیطی پایش سلامت (Health Monitoring Flags)

برای کاهش نویز در محیط توسعه (development) می‌توانید از پرچم زیر استفاده کنید:

| متغیر | مقدار مجاز | اثر | سناریوی مناسب |
|-------|-----------|-----|----------------|
| `SKIP_REDIS_HEALTH` | `1` / `true` | پرش کامل تست Redis و برگرداندن وضعیت آن به `DEGRADED` با metadata `{ skipped: true }` | وقتی کانتینر Redis را برای توسعه سبک اجرا نکرده‌اید و نمی‌خواهید Overall همیشه `CRITICAL` شود |

نکات:
1. در Production این پرچم را ست نکنید؛ سلامت واقعی Redis باید سنجیده شود.
2. اگر Redis واقعاً نیاز نیست در dev بالا باشد، این پرچم به شما baseline سالم‌تری برای سایر متریک‌ها می‌دهد.
3. بدون ست کردن پرچم، در صورت نبود کانتینر Redis سطح خطای Redis در حالت dev به صورت خودکار از CRITICAL به DEGRADED downgrade می‌شود (fail-soft).


---

## 🔧 پیش‌نیازها

### سیستم عامل (پشتیبانی کامل)
- **Ubuntu 20.04 LTS** ✅
- **Ubuntu 22.04 LTS** ✅
- **Ubuntu 24.04 LTS** ✅
- **Debian 11+** ✅

### سخت‌افزار مینیمم
- **CPU**: 2 هسته (4 هسته پیشنهادی)
- **RAM**: 4GB (8GB پیشنهادی برای Docker)
- **Storage**: 15GB فضای خالی (Docker نیاز بیشتری دارد)
- **Network**: اتصال اینترنت پایدار

### دامنه و DNS
- دامنه معتبر (مثل `your-domain.com`)
- دسترسی به تنظیمات DNS
- گواهی SSL (خودکار نصب می‌شود)

### دسترسی‌های مورد نیاز
- **Root/Sudo access** به سرور
- **SSH access** برای نصب
- **Port 80/443** برای HTTP/HTTPS
- **Port 22** برای SSH

---

## 🚀 گزینه‌های نصب

MarFaNet سه روش نصب مختلف ارائه می‌دهد:

| روش نصب | سطح تکنیکی | زمان نصب | ویژگی‌ها |
|---------|-------------|----------|----------|
| 🐳 **Docker** | مبتدی | 10-15 دقیقه | ایزوله، آسان، پایدار |
| 🔧 **Enhanced Native** | متوسط | 15-20 دقیقه | کنترل بیشتر، monitoring |
| ⚙️ **Classic Native** | پیشرفته | 20-25 دقیقه | کنترل کامل، سفارشی‌سازی |

---

## 🐳 نصب با Docker (پیشنهادی)

**بهترین روش برای اکثر کاربران** - آسان، سریع، و ایزوله

### ✨ مزایای Docker
- **🔒 ایزوله کامل** - هیچ تداخلی با سیستم
- **⚡ نصب سریع** - 10-15 دقیقه
- **🛡️ امنیت بیشتر** - محیط جداگانه
- **🔄 مدیریت آسان** - backup، update، rollback
- **📦 همه‌چیز یکجا** - PostgreSQL + Redis + Nginx + SSL

### 🚀 نصب یک‌دستوری

```bash
# دانلود و اجرای اسکریپت Docker
curl -sSL https://raw.githubusercontent.com/Iscgr/AgentPortalShield/main/docker-deploy.sh | sudo bash
```

---

## ⚡ نصب کاملاً خودکار (یک‌خطی جدید پیشنهادی Production)

این روش جدید، همه چیز (Docker, Nginx, SSL, Database, Redis, Build) را خودکار انجام می‌دهد و فقط «دامنه» از شما می‌پرسد.

### ✅ ویژگی‌ها
- نصب بهینه روی Ubuntu 24.04 / 22.04
- تولید خودکار: پسورد DB، SESSION_SECRET، Admin Password
- پشتیبانی SSL معتبر (Let's Encrypt)
- Reverse Proxy امن (Nginx + HTTP/2)
- اجرای ایزوله (Bridge Network + Internal app binding)
- اسکریپت مدیریتی `agent` برای عملیات روزمره

### 🚀 دستور یک‌خطی
```bash
curl -sSL https://YOUR-CDN-DOMAIN/path/auto-install.sh | sudo bash
```
یا اگر مخزن را کلون کرده‌اید:
```bash
sudo bash scripts/auto-install.sh
```

### 🧪 چه چیزی نصب می‌شود؟
| مولفه | توضیح | پورت خارجی |
|-------|-------|-------------|
| PostgreSQL | دیتابیس مالی | (فقط داخل شبکه Docker) |
| Redis | نشست و کش | (فقط داخل شبکه Docker) |
| App (Node.js) | API + UI یکپارچه | 3000 (فقط 127.0.0.1) |
| Nginx | Reverse Proxy + TLS | 80 / 443 |

### 🗂 مسیر نصب و فایل‌ها
| فایل/دایرکتوری | مسیر |
|----------------|-------|
| ریشه نصب | `/opt/marfanet` |
| فایل env | `/opt/marfanet/.env` |
| compose stack | `/opt/marfanet/docker-compose-stack.yml` |
| کانفیگ nginx | `/opt/marfanet/nginx.conf` |
| بکاپ‌ها | `/opt/marfanet/backups` |

### 🔐 خروجی نهایی پس از نصب
نمونه خروجی:
```
============================================================
 نصب MarFaNet تکمیل شد
============================================================
دامنه: https://example.com
پنل:  https://example.com/admin
پورتال: https://example.com/portal/[ID]

اطلاعات ورود ادمین:
   Username: admin
   Password: <GEN_PASS>

دیتابیس:
   DB User: marfanet
   DB Name: marfanet_db
   DB Pass: <GEN_DB_PASS>

فایل ENV: /opt/marfanet/.env
ابزار مدیریت: agent  (دستورات: agent backup|update|restart|logs|health)
============================================================
```

### 🛠 متغیرهای تولید شده خودکار
| کلید | توضیح |
|------|-------|
| ADMIN_PASSWORD | رمز اولیه ورود پنل |
| DATABASE_URL | اتصال سرویس به PostgreSQL داخلی |
| SESSION_SECRET | کلید نشست Express |
| PUBLIC_BASE_URL | دامنه اصلی پنل |
| PUBLIC_PORTAL_BASE_URL | دامنه لینک‌های پورتال |

---

## 🧭 ابزار مدیریتی Agent

پس از نصب، یک دستور جهانی `agent` در سیستم شما ایجاد می‌شود.

### 🎛 منوی تعاملی
```bash
agent
```
نمایش گزینه‌ها:
```
1) بکاپ + ارسال تلگرام
2) آپدیت پنل
3) ریستارت پنل
4) نمایش لاگ
5) وضعیت سلامت
q) خروج
```

### ⏱ دستورات غیرتعاملی (اسکریپتی)
```bash
agent backup
agent update
agent restart
agent logs
agent health
```

### 💾 بکاپ + ارسال به تلگرام
1. در فایل `.env` مقادیر زیر را مقداردهی کنید:
```env
TELEGRAM_BOT_TOKEN=xxxxxxxxx
TELEGRAM_CHAT_ID=123456789
```
2. اجرا:
```bash
agent backup
```
3. فایل فشرده `db_<timestamp>.sql.gz` در مسیر `/opt/marfanet/backups` ذخیره و به تلگرام ارسال می‌شود.

### 🔄 آپدیت بدون تخریب دیتا
```bash
agent update
```
مراحل: `git fetch/reset` → build مجدد ایمیج app → راه‌اندازی کانتینر جدید.

### ♻️ ریستارت ایمن
```bash
agent restart
```

### 📜 مشاهده لاگ زنده
```bash
agent logs
```

### ❤️ Health Check
```bash
agent health
```
خواندن `/health` از پشت Nginx و نمایش JSON.

---

## ❗ سناریوهای نگهداری مهم

### تمدید SSL (خودکار کرون certbot وجود دارد، ولی تست دستی):
```bash
sudo certbot renew --dry-run
```

### تغییر دامنه بعد از نصب
1. ویرایش `PUBLIC_BASE_URL` در `.env`
2. صدور مجدد گواهی:
```bash
docker stop marfanet-nginx
certbot certonly --standalone -d NEWDOMAIN --agree-tos -m admin@NEWDOMAIN --non-interactive
```
3. ویرایش `nginx.conf` و ریستارت:
```bash
docker compose -f /opt/marfanet/docker-compose-stack.yml up -d nginx
```

### بازگردانی بکاپ
```bash
gunzip db_20250101_101500.sql.gz
docker compose -f /opt/marfanet/docker-compose-stack.yml exec -T db psql -U marfanet marfanet_db < db_20250101_101500.sql
```

---

### 📋 اطلاعات درخواستی

اسکریپت فقط دو چیز از شما می‌پرسد:

```bash
🌐 Enter your domain name: your-domain.com
📧 Enter your email for SSL: your-email@example.com
```

**همه پسوردها و تنظیمات خودکار تولید می‌شوند!**

### ⏱️ مراحل نصب (10-15 دقیقه)

1. **تشخیص سیستم عامل** (30 ثانیه)
2. **بروزرسانی و نصب Docker** (3-5 دقیقه)
3. **دانلود و ساخت containers** (5-7 دقیقه)
4. **تنظیم SSL و امنیت** (2-3 دقیقه)
5. **بررسی نهایی** (30 ثانیه)

### 🎉 نتیجه نصب

پس از نصب موفق، پیام زیر نمایش داده می‌شود:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        🎉 DEPLOYMENT COMPLETED! 🎉                           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  🌐 Application URL: https://your-domain.com                                 ║
║  👨‍💼 Admin Panel: https://your-domain.com/admin                              ║
║  📊 CRM Panel: https://your-domain.com/crm                                   ║
║  🔗 Representative Portal: https://your-domain.com/portal/[ID]               ║
║                                                                              ║
║  🔐 Auto-Generated Credentials:                                              ║
║     📧 Admin Username: admin                                                 ║
║     🔑 Admin Password: [AUTO-GENERATED-PASSWORD]                             ║
║     🗄️ Database Password: [AUTO-GENERATED-PASSWORD]                          ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 🔧 مدیریت Docker

```bash
# مشاهده وضعیت containers
docker compose -f /opt/marfanet/docker-compose.yml ps

# مشاهده logs
docker compose -f /opt/marfanet/docker-compose.yml logs -f

# restart سرویس‌ها
docker compose -f /opt/marfanet/docker-compose.yml restart

# بروزرسانی سیستم
cd /opt/marfanet && git pull && docker compose up -d --build

# backup دیتابیس
docker compose -f /opt/marfanet/docker-compose.yml exec database \
  pg_dump -U marfanet marfanet_db > backup_$(date +%Y%m%d).sql
```

---

## 🔧 نصب خودکار بهبود یافته

**برای کاربران پیشرفته** که کنترل بیشتری روی سیستم می‌خواهند

### ✨ ویژگی‌های Enhanced
- **🔍 File Integrity Verification** - بررسی صحت فایل‌ها
- **🔒 Advanced Lock Mechanism** - جلوگیری از تداخل
- **🔄 Atomic Deployment** - نصب ایمن با rollback
- **📊 Performance Monitoring** - نظارت بر عملکرد
- **⚡ Enhanced Error Handling** - مدیریت خطاهای پیشرفته

### 🚀 نصب

```bash
# دانلود و اجرای اسکریپت بهبود یافته
curl -sSL https://raw.githubusercontent.com/Iscgr/AgentPortalShield/main/enhanced-deploy.sh | sudo bash
```

### 📋 ویژگی‌های اضافی

```bash
# بررسی سیستم قبل از نصب
sudo bash enhanced-deploy.sh --check

# نمایش راهنما
sudo bash enhanced-deploy.sh --help
```

### ⏱️ مراحل نصب (15-20 دقیقه)

1. **بررسی جامع سیستم** (1 دقیقه)
2. **تولید خودکار تنظیمات** (30 ثانیه)
3. **بروزرسانی سیستم** (3-5 دقیقه)
4. **نصب وابستگی‌ها** (5-8 دقیقه)
5. **deploy اتمیک اپلیکیشن** (3-5 دقیقه)
6. **تنظیم SSL و امنیت** (2-3 دقیقه)

---

## ⚙️ نصب خودکار کلاسیک

**روش اصلی** برای کاربران حرفه‌ای که کنترل کامل می‌خواهند

### 🚀 نصب

```bash
# دانلود و اجرای اسکریپت کلاسیک
curl -sSL https://raw.githubusercontent.com/Iscgr/AgentPortalShield/main/deploy.sh | sudo bash
```

### 📋 اطلاعات درخواستی

```bash
🌐 Enter your domain name: your-domain.com
📧 Enter your email for SSL: your-email@example.com
🗄️ PostgreSQL database name [marfanet_db]: 
👤 PostgreSQL username [marfanet]: 
🔑 PostgreSQL password: [your-password]
👨‍💼 Admin username [admin]: 
🔐 Admin password: [your-admin-password]
```

### ⏱️ مراحل نصب (20-25 دقیقه)

1. **بروزرسانی سیستم** (3-5 دقیقه)
2. **نصب Node.js 20** (2-3 دقیقه)
3. **نصب PostgreSQL** (3-5 دقیقه)
4. **نصب Nginx** (1-2 دقیقه)
5. **کلون و ساخت اپلیکیشن** (5-8 دقیقه)
6. **تنظیم SSL** (2-3 دقیقه)
7. **تنظیم فایروال** (1 دقیقه)

---

## 🌐 راهنمای تنظیم دامنه

### مرحله 1: خرید دامنه

دامنه خود را از یکی از ارائه‌دهندگان معتبر خریداری کنید:

**ارائه‌دهندگان پیشنهادی:**
- [Namecheap](https://namecheap.com) - ارزان و قابل اعتماد
- [GoDaddy](https://godaddy.com) - محبوب و گسترده
- [Cloudflare Registrar](https://cloudflare.com) - بهترین قیمت

### مرحله 2: تنظیم DNS Records

پس از خرید دامنه، رکوردهای DNS زیر را اضافه کنید:

```dns
# A Record - دامنه اصلی
Type: A
Name: @
Value: [IP آدرس سرور شما]
TTL: 300

# A Record - ساب‌دامنه www
Type: A
Name: www
Value: [IP آدرس سرور شما]
TTL: 300

# CNAME Record - پورتال نمایندگان
Type: CNAME
Name: portal
Value: your-domain.com
TTL: 300
```

### مرحله 3: تأیید انتشار DNS

```bash
# بررسی انتشار DNS
nslookup your-domain.com
dig your-domain.com

# بررسی آنلاین
# https://dnschecker.org
```

**⏰ زمان انتشار DNS: 1-48 ساعت (معمولاً 1-2 ساعت)**

---

## ☁️ راهنمای کلادفلر (اختیاری)

### 🛰️ تنظیم دامنه پورتال عمومی نمایندگان (SHERLOCK v36.0)
برای حذف وابستگی به دامنه توسعه موقت (Replit) و استانداردسازی لینک‌های ارسال‌شده به نمایندگان، سیستم اکنون از متغیرهای محیطی قابل پیکربندی استفاده می‌کند.

#### متغیرهای محیطی (Backend)
اولویت به ترتیب:
1. `PUBLIC_PORTAL_BASE_URL`
2. `PUBLIC_BASE_URL`
3. اگر تولید و `REPLIT_DOMAIN` موجود باشد: `https://<REPLIT_DOMAIN>`
4. در غیر این صورت fallback به `BASE_URL` (لوکال یا پورت فعلی)

#### متغیرهای محیطی (Frontend - Vite)
اختیاری: `VITE_PUBLIC_PORTAL_BASE_URL`

#### مثال فایل `.env`
```env
PUBLIC_PORTAL_BASE_URL=https://portal.example.com
VITE_PUBLIC_PORTAL_BASE_URL=https://portal.example.com
```

#### نقاط کد اصلاح‌شده
- سرور: تابع `getPortalLink(publicId)` در `server/config.ts`
- کلاینت: ساخت لینک در `client/src/pages/representatives.tsx` (توابع نمایش و کپی لینک)

#### منطق حذف دامنه قدیمی
تمام مراجع هاردکد به `agent-portal-shield-info9071.replit.app` حذف و با لایه پیکربندی جایگزین شد. در نبود متغیر، محیط توسعه از `window.location.origin` استفاده می‌کند.

#### مزایا
- جلوگیری از انتشار دامنه غیررسمی
- تغییر دامنه بدون نیاز به build مجدد (فقط تغییر env و ری‌استارت)
- سازگاری با چند محیط (Dev / Staging / Prod)

#### تست سریع
```bash
export PUBLIC_PORTAL_BASE_URL=https://portal.example.com
npx tsx server/index.ts &
# سپس در نمای پنل: کپی لینک پورتال باید دامنه جدید را نشان دهد
```

#### نکته امنیتی
از قراردادن دامنه موقت در پیام‌های رسمی (تلگرام / ایمیل) خودداری کنید. همیشه متغیر را در سرور Production مقداردهی کنید.


### مرحله 1: ثبت‌نام و اضافه کردن دامنه

1. به [cloudflare.com](https://cloudflare.com) بروید
2. دامنه خود را اضافه کنید
3. پلن **Free** را انتخاب کنید

### مرحله 2: تنظیم DNS Records

```dns
# رکورد اصلی
Type: A
Name: your-domain.com
IPv4 address: [IP سرور]
Proxy status: Proxied 🟠

# رکورد www
Type: A
Name: www
IPv4 address: [IP سرور]
Proxy status: Proxied 🟠

# پورتال نمایندگان
Type: CNAME
Name: portal
Target: your-domain.com
Proxy status: Proxied 🟠
```

### مرحله 3: تنظیمات امنیتی

```
SSL/TLS encryption mode: Full (strict)
Always Use HTTPS: On
Security Level: Medium
Auto Minify: JS, CSS, HTML
Brotli: On
```

---

## 📊 تنظیمات سرور

### دسترسی به پنل‌های مدیریت

پس از نصب موفق:

```bash
# پنل مدیریت اصلی
https://your-domain.com/admin

# پنل CRM
https://your-domain.com/crm

# پورتال نمایندگان
https://your-domain.com/portal/[ID]

# API documentation
https://your-domain.com/api/docs
```

### مدیریت دیتابیس

```bash
# اتصال مستقیم به دیتابیس (Docker)
docker compose -f /opt/marfanet/docker-compose.yml exec database psql -U marfanet marfanet_db

# اتصال مستقیم به دیتابیس (Native)
sudo -u postgres psql marfanet_db

# backup دیتابیس
pg_dump -U marfanet marfanet_db > backup_$(date +%Y%m%d).sql

# restore دیتابیس
psql -U marfanet marfanet_db < backup_file.sql
```

### مشاهده logs

```bash
# Docker logs
docker compose -f /opt/marfanet/docker-compose.yml logs -f app

# Native logs
journalctl -u marfanet -f
tail -f /var/log/marfanet.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 🔧 استفاده از سیستم

### ورود اولیه به سیستم

1. **پنل مدیریت**: `https://your-domain.com/admin`
   - Username: `admin`
   - Password: `[پسورد تولید شده در نصب]`

2. **پنل CRM**: `https://your-domain.com/crm`
   - Username: `admin`
   - Password: `[همان پسورد admin]`

### ایجاد نماینده جدید

1. وارد پنل مدیریت شوید
2. به بخش "نمایندگان" بروید
3. روی "افزودن نماینده" کلیک کنید
4. اطلاعات را تکمیل کنید
5. ID اختصاصی برای نماینده تولید می‌شود

### دسترسی نماینده به پورتال

```
https://your-domain.com/portal/[ID]
```

مثال:
```
https://your-domain.com/portal/ABC123
```

### ثبت فاکتور جدید

1. وارد پنل CRM شوید
2. نماینده مورد نظر را انتخاب کنید
3. روی "فاکتور جدید" کلیک کنید
4. جزئیات فاکتور را وارد کنید
5. فاکتور ذخیره می‌شود و بدهی محاسبه می‌شود

### ثبت پرداخت

1. وارد پنل CRM شوید
2. به بخش "پرداخت‌ها" بروید
3. نماینده و مبلغ را انتخاب کنید
4. پرداخت بر اساس الگوریتم FIFO تخصیص می‌یابد

---

## 🔗 API و ادغام

### تنظیم API Keys

فایل تنظیمات را ویرایش کنید:

```bash
# Docker
nano /opt/marfanet/.env

# Native
nano /var/www/marfanet/.env
```

```env
# Telegram Bot Integration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# OpenAI Integration
OPENAI_API_KEY=your_openai_api_key

# Google Gemini AI
GOOGLE_GEMINI_API_KEY=your_gemini_api_key

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### راهنمای دریافت API Keys

#### Telegram Bot Token
1. به [@BotFather](https://t.me/botfather) در تلگرام پیام دهید
2. دستور `/newbot` را بفرستید
3. نام و username برای ربات انتخاب کنید
4. Token دریافت شده را کپی کنید

#### OpenAI API Key
1. به [platform.openai.com](https://platform.openai.com) بروید
2. وارد حساب کاربری خود شوید
3. به بخش "API Keys" بروید
4. یک کلید جدید ایجاد کنید

#### Google Gemini API Key
1. به [Google AI Studio](https://makersuite.google.com) بروید
2. وارد حساب Google خود شوید
3. یک API key جدید ایجاد کنید

### Restart پس از تغییرات

```bash
# Docker
docker compose -f /opt/marfanet/docker-compose.yml restart

# Native
sudo systemctl restart marfanet
```

---

## 🛠️ نگهداری و پشتیبانی

### بروزرسانی سیستم

#### Docker
```bash
cd /opt/marfanet
git pull origin main
docker compose down
docker compose up -d --build
```

#### Native
```bash
cd /var/www/marfanet
git pull origin main
npm install
npm run build
sudo systemctl restart marfanet
```

### پشتیبان‌گیری خودکار

#### تنظیم Cron Job برای backup روزانه

```bash
# ویرایش crontab
crontab -e

# اضافه کردن خط زیر برای backup روزانه در ساعت 2 شب
0 2 * * * /opt/marfanet/scripts/backup.sh
```

#### اسکریپت backup دستی

```bash
# Docker
docker compose -f /opt/marfanet/docker-compose.yml exec database \
  pg_dump -U marfanet marfanet_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Native
sudo -u postgres pg_dump marfanet_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### مانیتورینگ سیستم

#### بررسی وضعیت سرویس‌ها

```bash
# Docker
docker compose -f /opt/marfanet/docker-compose.yml ps

# Native
sudo systemctl status marfanet
sudo systemctl status postgresql
sudo systemctl status nginx
```

#### بررسی میزان استفاده منابع

```bash
# CPU و Memory
htop

# فضای دیسک
df -h

# مانیتورینگ پورت‌ها
netstat -tlnp | grep :80
netstat -tlnp | grep :443
netstat -tlnp | grep :3000
```

### بررسی سلامت سیستم

```bash
# تست دسترسی به وب‌سایت
curl -I https://your-domain.com

# تست API
curl https://your-domain.com/api/health

# تست دیتابیس
# Docker
docker compose -f /opt/marfanet/docker-compose.yml exec database pg_isready

# Native
sudo -u postgres pg_isready
```

---

## 🐛 عیب‌یابی

### مشکلات متداول

#### 1. سایت باز نمی‌شود

```bash
# بررسی وضعیت سرویس‌ها
docker compose -f /opt/marfanet/docker-compose.yml ps  # Docker
sudo systemctl status marfanet nginx  # Native

# بررسی logs
docker compose -f /opt/marfanet/docker-compose.yml logs  # Docker
journalctl -u marfanet -n 50  # Native

# بررسی فایروال
sudo ufw status
```

#### 2. مشکل SSL Certificate

```bash
# بروزرسانی گواهی
sudo certbot renew --dry-run

# بررسی گواهی
openssl s_client -connect your-domain.com:443

# تجدید گواهی دستی
sudo certbot certonly --nginx -d your-domain.com -d www.your-domain.com
```

#### 3. مشکل دیتابیس

```bash
# بررسی وضعیت PostgreSQL
# Docker
docker compose -f /opt/marfanet/docker-compose.yml exec database pg_isready

# Native
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"

# بررسی logs دیتابیس
# Docker
docker compose -f /opt/marfanet/docker-compose.yml logs database

# Native
tail -f /var/log/postgresql/postgresql-*.log
```

#### 4. مشکل اتصال API

```bash
# بررسی متغیرهای محیطی
cat /opt/marfanet/.env | grep API  # Docker
cat /var/www/marfanet/.env | grep API  # Native

# تست اتصال
curl -X POST "https://api.openai.com/v1/models" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### نظارت بر Performance

```bash
# مشاهده آمار real-time
docker stats  # Docker containers
sudo iotop  # Disk I/O
sudo nethogs  # Network usage

# آنالیز logs
tail -f /var/log/nginx/access.log | grep -E "slow|error"
```

### گزارش مشکل

اگر مشکلی حل نشد:

1. **Logs را جمع‌آوری کنید**:
   ```bash
   # ایجاد پکیج logs
   mkdir problem_report_$(date +%Y%m%d)
   
   # Docker
   docker compose -f /opt/marfanet/docker-compose.yml logs > problem_report/docker.log
   
   # System logs
   journalctl -n 100 > problem_report/system.log
   sudo nginx -T > problem_report/nginx_config.txt
   ```

2. **اطلاعات سیستم**:
   ```bash
   uname -a > problem_report/system_info.txt
   df -h > problem_report/disk_usage.txt
   free -h > problem_report/memory_usage.txt
   ```

3. **ارسال گزارش**: فایل‌ها را به تیم پشتیبانی ارسال کنید

---

## 💻 توسعه

### محیط توسعه محلی
│   ├── alloc-validation.ts        # اعتبارسنجی اینورینت‌های تخصیص (در حال توسعه)
│   ├── financial-e2e-smoke.ts     # تست دود سناریوهای مالی
│   ├── ingest-real-sample.ts      # اسکریپت درج نمونه واقعی + رویدادهای پیشرفت دترمینیستیک (--progress)
│   ├── compare-python-node-debt.ts# هارنس مقایسه بدهی Python vs Node (E-D6)

#### پیش‌نیازها
```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt install postgresql postgresql-contrib

# Git
sudo apt install git
```

#### راه‌اندازی

```bash
# کلون کردن پروژه
git clone https://github.com/Iscgr/AgentPortalShield.git
cd AgentPortalShield

# نصب dependencies
npm install

# تنظیم environment
cp .env.example .env
nano .env

# راه‌اندازی دیتابیس
npm run db:push

# اجرای حالت توسعه
npm run dev
```

### ساختار پروژه

```
MarFaNet/
├── client/                 # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── components/     # UI Components
│   │   ├── pages/         # Page Components
│   │   ├── hooks/         # Custom Hooks
│   │   ├── lib/           # Utilities
│   │   └── styles/        # Styling
├── server/                # Backend (Node.js + Express)
│   ├── routes/           # API Routes
│   ├── services/         # Business Logic
│   ├── middleware/       # Express Middleware
│   └── utils/            # Server Utilities
├── shared/               # Shared Types & Schemas
├── scripts/              # Deployment Scripts
├── docker-compose.yml    # Docker Configuration
├── Dockerfile           # Docker Build
└── package.json         # Dependencies
```

### Contributing

1. Fork کنید
2. Branch جدید بسازید (`git checkout -b feature/amazing-feature`)
3. تغییرات را commit کنید (`git commit -m 'Add amazing feature'`)
4. Push کنید (`git push origin feature/amazing-feature`)
5. Pull Request باز کنید

### API Documentation

مستندات کامل API در آدرس زیر در دسترس است:
```
https://your-domain.com/api/docs
```

---

## 📞 پشتیبانی و تماس

### منابع یادگیری
- **📚 Wiki**: [GitHub Wiki](https://github.com/Iscgr/AgentPortalShield/wiki)
- **🎥 آموزش‌های ویدئویی**: Coming Soon
- **📖 مستندات تکنیکی**: [Technical Docs](TECHNICAL_DOCUMENTATION.md)

### گزارش باگ و درخواست فیچر
- **🐛 Issues**: [GitHub Issues](https://github.com/Iscgr/AgentPortalShield/issues)
- **💡 Feature Requests**: [GitHub Discussions](https://github.com/Iscgr/AgentPortalShield/discussions)

### راه‌های ارتباطی
- **📧 Email**: [ایمیل پشتیبانی]
- **💬 Telegram**: [کانال پشتیبانی]
- **🌐 Website**: [وب‌سایت رسمی]

---

## 📄 مجوز

این پروژه تحت مجوز MIT منتشر شده است. برای اطلاعات بیشتر فایل [LICENSE](LICENSE) را مطالعه کنید.

---

## 🙏 تشکر و قدردانی

از همه کسانی که در توسعه MarFaNet مشارکت داشته‌اند تشکر می‌کنیم:

- **توسعه‌دهندگان**: تیم MarFaNet
- **آزمایش‌کنندگان**: کاربران بتا
- **طراحان**: تیم UI/UX
- **DevOps**: تیم زیرساخت

---

<div align="center">

**🌟 اگر MarFaNet برایتان مفید بود، لطفاً یک ستاره ⭐ بدهید!**

**ساخته شده با ❤️ برای جامعه توسعه‌دهندگان فارسی‌زبان**

[⬆️ برگشت به بالا](#-marfanet-financial-management-system)

</div>