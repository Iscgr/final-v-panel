# 📱 مستندات ویژگی مدیریت اپلیکیشن‌ها و اعلانات پرتال

## خلاصه
این ویژگی امکان مدیریت و نمایش لینک‌های دانلود اپلیکیشن‌ها، QR کدها، ویدیوهای آموزشی و اعلانات مهم را در پرتال عمومی نمایندگان فراهم می‌کند.

## 🎯 اهداف

1. **برای ادمین:**
   - مدیریت آسان لیست اپلیکیشن‌های قابل دانلود
   - اضافه کردن/ویرایش/حذف اپلیکیشن‌ها
   - آپلود QR کد و لینک ویدیو آموزشی
   - مدیریت اعلانات و اخبار مهم
   - کنترل نمایش/عدم نمایش هر آیتم

2. **برای نماینده:**
   - دسترسی سریع به جدیدترین نسخه اپلیکیشن‌ها
   - امکان دانلود مستقیم
   - مشاهده QR کد برای اشتراک‌گذاری آسان
   - دسترسی به ویدیوهای آموزشی
   - مطلع شدن از اعلانات و اخبار مهم

## 🏗️ معماری

### Database Schema

#### 1. جدول `portal_apps`
```sql
CREATE TABLE "portal_apps" (
  "id" serial PRIMARY KEY,
  "title" text NOT NULL,                    -- نام اپلیکیشن
  "description" text,                       -- توضیحات
  "download_link" text NOT NULL,            -- لینک دانلود مستقیم
  "qr_code" text,                          -- لینک یا base64 QR کد
  "video_url" text,                        -- لینک ویدیو آموزشی
  "icon_url" text,                         -- آیکون اپلیکیشن
  "order" integer DEFAULT 0,               -- ترتیب نمایش
  "is_active" boolean DEFAULT true,        -- فعال/غیرفعال
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
```

#### 2. جدول `portal_announcements`
```sql
CREATE TABLE "portal_announcements" (
  "id" serial PRIMARY KEY,
  "title" text NOT NULL,                   -- عنوان اعلان
  "content" text NOT NULL,                 -- محتوای اعلان
  "type" text DEFAULT 'info',              -- نوع: info, warning, success, error
  "is_active" boolean DEFAULT true,        -- فعال/غیرفعال
  "priority" integer DEFAULT 0,            -- اولویت نمایش
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
```

### Backend API Routes

#### Portal Apps Management
- `GET /api/portal-apps` - دریافت لیست تمام اپلیکیشن‌ها (ادمین)
- `GET /api/public/portal-apps` - دریافت اپلیکیشن‌های فعال (عمومی)
- `GET /api/portal-apps/:id` - دریافت یک اپلیکیشن
- `POST /api/portal-apps` - ایجاد اپلیکیشن جدید
- `PUT /api/portal-apps/:id` - بروزرسانی اپلیکیشن
- `DELETE /api/portal-apps/:id` - حذف اپلیکیشن

#### Portal Announcements Management
- `GET /api/portal-announcements` - دریافت لیست تمام اعلانات (ادمین)
- `GET /api/public/portal-announcements` - دریافت اعلانات فعال (عمومی)
- `GET /api/portal-announcements/:id` - دریافت یک اعلان
- `POST /api/portal-announcements` - ایجاد اعلان جدید
- `PUT /api/portal-announcements/:id` - بروزرسانی اعلان
- `DELETE /api/portal-announcements/:id` - حذف اعلان

### Frontend Components

#### 1. Admin Panel Components

##### `PortalAppsManager`
- مدیریت کامل اپلیکیشن‌ها
- فرم افزودن/ویرایش با فیلدهای:
  - عنوان (الزامی)
  - توضیحات
  - لینک دانلود (الزامی)
  - QR کد
  - لینک ویدیو
  - آیکون
  - ترتیب نمایش
  - وضعیت فعال/غیرفعال
- نمایش لیست با امکان ویرایش و حذف
- Validation کامل ورودی‌ها

##### `PortalAnnouncementsManager`
- مدیریت کامل اعلانات
- فرم افزودن/ویرایش با فیلدهای:
  - عنوان (الزامی)
  - محتوا (الزامی)
  - نوع (info, warning, success, error)
  - اولویت
  - وضعیت فعال/غیرفعال
- نمایش لیست با رنگ‌بندی مناسب برای هر نوع
- پیش‌نمایش محتوا

#### 2. Public Portal Component

##### `PortalAppsSection`
- نمایش اعلانات فعال در بالای صفحه
  - رنگ‌بندی متناسب با نوع (آبی، زرد، سبز، قرمز)
  - آیکون مناسب
  - محتوای کامل
- نمایش کارت‌های اپلیکیشن با:
  - آیکون و عنوان
  - توضیحات
  - دکمه دانلود مستقیم
  - دکمه نمایش QR کد
  - دکمه دسترسی به ویدیو آموزشی
- طراحی Responsive
- Hover effects و انیمیشن‌ها
- Loading state

## 📋 راهنمای استفاده

### برای ادمین

#### افزودن اپلیکیشن جدید:
1. وارد صفحه تنظیمات (Settings) شوید
2. تب "اپلیکیشن‌ها و اعلانات" را انتخاب کنید
3. در بخش "مدیریت اپلیکیشن‌ها" روی دکمه "افزودن اپلیکیشن جدید" کلیک کنید
4. فرم را پر کنید:
   - **عنوان**: مثلاً "V2Ray Android"
   - **توضیحات**: توضیح مختصر درباره اپلیکیشن
   - **لینک دانلود**: URL دانلود مستقیم فایل APK یا لینک Store
   - **QR کد**: لینک تصویر QR کد یا base64 data
   - **لینک ویدیو**: URL ویدیو آموزشی (YouTube، آپارات، یا سرور خودتان)
   - **آیکون**: URL تصویر آیکون اپلیکیشن
   - **ترتیب**: عدد کوچکتر = نمایش زودتر
   - **فعال**: آیا در پرتال نمایش داده شود؟
5. روی "ذخیره" کلیک کنید

#### ویرایش اپلیکیشن:
1. در لیست اپلیکیشن‌ها، روی آیکون مداد (Edit) کلیک کنید
2. تغییرات را اعمال کنید
3. روی "ذخیره" کلیک کنید

#### افزودن اعلان:
1. در همان صفحه، بخش "مدیریت اعلانات مهم" را پیدا کنید
2. روی "افزودن اعلان جدید" کلیک کنید
3. فرم را پر کنید:
   - **عنوان**: عنوان کوتاه و گویا
   - **محتوا**: متن کامل اعلان
   - **نوع**: 
     - Info (آبی) - اطلاعات عمومی
     - Warning (زرد) - هشدار
     - Success (سبز) - خبر خوب
     - Error (قرمز) - خطای مهم
   - **اولویت**: عدد بزرگتر = نمایش بالاتر
   - **فعال**: آیا نمایش داده شود؟
4. روی "ذخیره" کلیک کنید

### برای نماینده

نمایندگان با ورود به پرتال عمومی خود، بلافاصله:
1. **اعلانات مهم** را در بالای صفحه می‌بینند
2. **بخش اپلیکیشن‌ها** را در یک کارت زیبا مشاهده می‌کنند که شامل:
   - نام و توضیحات هر اپلیکیشن
   - دکمه دانلود مستقیم (کلیک → دانلود)
   - دکمه QR کد (کلیک → نمایش در پنجره جدید)
   - دکمه ویدیو آموزشی (کلیک → باز شدن ویدیو)

## 🎨 طراحی UI

### Admin Panel
- استفاده از کامپوننت‌های shadcn/ui
- فرم‌های مدرن با validation
- نمایش لیست به صورت کارت
- رنگ‌بندی مناسب برای نوع اعلان
- دکمه‌های ویرایش و حذف مشخص

### Public Portal
- **اعلانات:**
  - Gradient backgrounds متناسب با نوع
  - Border رنگی
  - آیکون مناسب (Info, Warning, CheckCircle, AlertCircle)
  - خط‌شکن محتوا (pre-wrap)
  
- **اپلیکیشن‌ها:**
  - کارت glass morphism با backdrop blur
  - Grid responsive (auto-fit)
  - دکمه دانلود سبز با gradient
  - دکمه‌های QR و ویدیو با رنگ‌های متفاوت
  - Hover effects روی همه دکمه‌ها
  - Transform animation روی hover کارت‌ها

## 🔒 امنیت

- تمام API های مدیریتی نیاز به احراز هویت دارند
- Validation در سمت سرور برای تمام ورودی‌ها
- URL validation برای لینک‌ها
- Safe HTML rendering برای محتوای اعلانات
- Escape کردن ورودی‌های کاربر

## 🚀 نکات بهینه‌سازی

1. **Performance:**
   - Query caching برای API calls
   - Lazy loading برای تصاویر بزرگ
   - Debounce برای search/filter (اگر اضافه شود)

2. **UX:**
   - Loading states
   - Error handling مناسب
   - Toast notifications برای اقدامات موفق/ناموفق
   - Confirmation برای حذف

3. **Responsive:**
   - Grid auto-fit برای اپلیکیشن‌ها
   - Flex layouts
   - Mobile-first approach

## 🧪 تست

### تست‌های پیشنهادی:

1. **Backend:**
   - تست CRUD operations
   - Validation rules
   - Authorization checks

2. **Frontend:**
   - رندر کامپوننت‌ها
   - Form validation
   - API integration
   - Responsive design

3. **Integration:**
   - End-to-end flow
   - Create app → View in portal
   - Update app → See changes
   - Delete app → Removed from portal

## 📝 Migration

برای اجرای migration:

```bash
# در محیط توسعه
npm run db:push

# یا اجرای دستی SQL
psql -U your_user -d your_database -f migrations/0001_add_portal_apps_announcements.sql
```

## 🔄 آپدیت‌های آینده (پیشنهادی)

1. آپلود مستقیم فایل QR Code به جای لینک
2. آپلود فایل ویدیو به سرور
3. آمار دانلود برای هر اپلیکیشن
4. History و versioning برای اپلیکیشن‌ها
5. دسته‌بندی اپلیکیشن‌ها (Android, iOS, Windows, etc.)
6. امکان کامنت‌گذاری نمایندگان روی اپلیکیشن‌ها
7. Rate/Review system

## 📞 پشتیبانی

در صورت بروز مشکل:
1. لاگ‌های سرور را بررسی کنید
2. Console browser را چک کنید
3. مطمئن شوید migration اجرا شده است
4. Routes به درستی register شده‌اند

## 📄 لایسنس

این ویژگی بخشی از سیستم مدیریت مالی MarFaNet است.
