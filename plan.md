# نقشه مهندسی و معماری هدف (Target Engineering Plan)

این مستند، ساختار کامل و جامع اپلیکیشن را به منظور برنامه‌ریزی برای ریفکتور کامل، ترسیم می‌کند.

## ۱. دامنه و صفحات (Domain & Pages)

این بخش‌ها بدون نیاز به احراز هویت در پنل ادمین قابل دسترسی هستند.

- **`/admin-login`**: صفحه ورود به پنل مدیریت.
- **`/unified-auth`**: صفحه اصلی برای کاربران احراز هویت نشده.
- **`/portal/:publicId`**: پورتال عمومی ایزوله برای نمایش اطلاعات خاص (مانند وضعیت یک فاکتور یا پروژه) به کاربران خارج از سیستم.
- **`/representative/:publicId`**: پورتال عمومی مشابه، مخصوص نمایندگان.

این صفحات هسته اصلی اپلیکیشن را تشکیل می‌دهند و پس از احراز هویت موفق در دسترس هستند.

- **`/dashboard`**: **داشبورد اصلی**
  - نمایش کلی آمار و اطلاعات حیاتی سیستم.
  - ویجت‌های سریع برای دسترسی به بخش‌های مهم.

- **`/kpi-dashboard`**: **داشبورد KPI مالی**
  - نمایش شاخص‌های کلیدی عملکرد مالی.
  - نمودارها و گزارش‌های تحلیلی پیشرفته.

- **`/representatives`**: **مدیریت نمایندگان**
  - لیست کامل نمایندگان.
  - قابلیت افزودن، ویرایش و حذف نماینده.
  - مشاهده پروفایل و اطلاعات هر نماینده.

- **`/invoices`**: **لیست فاکتورها**
  - نمایش جدولی از تمام فاکتورها با قابلیت جستجو، فیلتر و صفحه‌بندی.
  - مشاهده وضعیت هر فاکتور (پرداخت شده، معوق، و غیره).

- **`/invoice-management`**: **مدیریت پیشرفته فاکتورها**
  - ابزار ایجاد فاکتور جدید.
  - فرم‌های ویرایش پیچیده فاکتورها.
  - عملیات‌های گروهی بر روی فاکتورها.

- **`/sales-partners`**: **مدیریت همکاران فروش**
  - لیست کامل همکاران فروش.
  - مدیریت قراردادها و پورسانت‌ها.

- **`/settings`**: **تنظیمات سیستم**
  - تنظیمات مربوط به حساب کاربری ادمین.
  - تنظیمات عمومی اپلیکیشن.
  - مدیریت سطوح دسترسی (در صورت وجود).

---

## ۲. مدل ناوبری (Navigation Model)
- لایه ۱: Main Routes (Dashboard, KPI, Representatives, Invoices, Invoice Management, Sales Partners, Settings)
- لایه ۲: Contextual Views (Profile drawers, Detail drawers, Portals)
- لایه ۳: Modal / Overlay Flows (Create/Edit, Bulk Ops, Diff Views)
- ناوبری تعاملی: Hover prefetch + lightweight route transitions با Suspense.

## ۳. معماری لایه‌ای (Layered Architecture)
- Presentation Layer: کامپوننت‌های UI + Composed Components (StatCard, DataTable, Wizard)
- State Layer: React Query (Server State) + Context (Auth, Layout, Theme)
- Domain Services: ماژول‌های fetch + schema validation (zod)
- Integration Layer: Adapter ها (File Upload Adapter, Chart Data Adapter)
- Cross-Cutting: Error Boundary, Telemetry, Theming, Accessibility

## ۴. Design Tokens (System Primitives)
```ts
// tokens.ts (پیشنهادی)
export const color = {
  primary: 'hsl(var(--primary))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  danger: 'hsl(var(--destructive))',
  bg: 'hsl(var(--background))',
  fg: 'hsl(var(--foreground))'
};
export const radius = { sm: '4px', md: '8px', lg: '16px' };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 20, xl: 32 };
export const motion = { fast: '120ms', base: '200ms', slow: '320ms' };
export const z = { header: 40, overlay: 100, modal: 120 };
```

## ۵. استراتژی مدیریت وضعیت (State Strategy)
- Query Segmentation: کلیدها بر اساس: موجودیت + فیلترها + صفحه + نقش کاربر
- Optimistic Updates: ویرایش‌های سلول جدول + ویرایش وضعیت فاکتور
- Cache Invalidation Matrix: پس از ایجاد فاکتور => invalidate(['invoices','list']), prefetch(['invoices','recent'])

## ۶. الگوهای بارگذاری و خطا (Loading & Error Patterns)
- Skeleton: برای KPI, Tables, Profile Header, Charts
- Fallback Boundaries: هر سکشن نمودار یک Suspense boundary مستقل
- Toast Adapter: خطای Mutation => Toast + optional Retry

## ۷. الگوی فرم‌ها (Form Architecture)
- React Hook Form + zod resolver
- Input Mapping Layer (Adapters برای تبدیل مدل API به مدل UI)
- Error Presentation: inline + summary در Wizard Step

## ۸. بهینه‌سازی عملکرد (Performance Plan)
| هدف | تکنیک |
|------|-------|
| کاهش JS اولیه | Dynamic import صفحات + lazy charts |
| کاهش رندر مجدد | memo + virtualization + context slicing |
| پاسخ‌گویی سریع | Prefetch hover + hydration تدریجی |
| پایدارسازی Layout | Skeleton با ارتفاع ثابت |

## ۹. دسترسی‌پذیری (A11y Commitments)
- هدینگ سلسله مراتبی صحیح در هر صفحه
- Focus Trap در Modal ها + Escape to close
- ARIA Live Region برای پردازش‌های طولانی (Upload / Batch Ops)
- پشتیبانی کامل کیبورد: جدول، تب، دیالوگ

## ۱۰. مشاهده‌پذیری (Observability Hooks)
- Hook: useSectionMountLogger(sectionId)
- Performance Marks: mark('upload:start') / measure('upload_total')
- Error Channel: window.dispatchEvent(CustomEvent('ui:error'))

## ۱۱. ریسک‌ها و کاهش (Risks & Mitigations)
| ریسک | تاثیر | کاهش |
|------|-------|-------|
| تورم دامنه تدریجی | کندی تحویل | Freeze Scope per Sprint |
| رگرسیون عملکرد | تجربه بد | Lighthouse Budget + پروفایل دوره‌ای |
| تداخل کد Legacy و جدید | ناسازگاری | Feature Flag + مسیر مهاجرت تدریجی |
| ناهماهنگی طراحی | تجربه ناپایدار | Design Tokens + PR Checklist |

## ۱۲. فازبندی اجرا (Execution Phasing)
1. Foundation Sprint: State Layer, Tokens, Error Boundary
2. Data Surfaces Sprint: Dashboard + KPI Base
3. Entity Core Sprint: Representatives + Invoices Tables
4. Deep Interaction Sprint: Invoice Management Wizards + Batch Import
5. Portal & Public Layer Sprint
6. Hardening & A11y + Performance Pass

## ۱۳. تعریف Done (Definition of Done)
- تست دستی Critical Flows (CRUD، Upload، Allocation)
- عدم وجود خطای کنسول
- پوشش Lighthouse Performance > 85, A11y > 95
- Snapshot UI پایدار
- رد شدن از PR Checklist (Design / Perf / A11y / DX)

## ۱۴. ردیابی (Traceability)
- هر PR شامل Trace IDs از `memory.md`.
- ماتریس پوشش در `review.md` به‌روزرسانی دوره‌ای.
