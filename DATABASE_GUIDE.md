# 🗄️ راهنمای جامع دیتابیس PostgreSQL - MarFaNet

این سند راهنمای کامل کار با دیتابیس PostgreSQL در پروژه MarFaNet است.

---

## 📋 فهرست مطالب

1. [معماری دیتابیس](#معماری-دیتابیس)
2. [Drizzle ORM](#drizzle-orm)
3. [Schema Management](#schema-management)
4. [Migrations](#migrations)
5. [اتصال به دیتابیس](#اتصال-به-دیتابیس)
6. [بکاپ و بازیابی](#بکاپ-و-بازیابی)
7. [بهینه‌سازی](#بهینه‌سازی)
8. [عیب‌یابی](#عیب‌یابی)

---

## 🏗️ معماری دیتابیس

### دیتابیس اصلی: PostgreSQL 14

MarFaNet از PostgreSQL به عنوان دیتابیس اصلی استفاده می‌کند:

- **نسخه:** PostgreSQL 14
- **Driver:** `pg` و `@neondatabase/serverless`
- **ORM:** Drizzle ORM
- **Connection Pooling:** بله
- **SSL Support:** بله (در production)

### تنظیمات اتصال

```typescript
// server/database-manager.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql);
```

**متغیر محیطی:**
```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

---

## 🔧 Drizzle ORM

### چرا Drizzle؟

- Type-safe queries با TypeScript
- Performance بالا (بهتر از Prisma و TypeORM)
- Zero runtime overhead
- SQL-like syntax
- Migration management داخلی

### نصب و تنظیم

```json
// package.json
{
  "dependencies": {
    "drizzle-orm": "^0.29.3",
    "@neondatabase/serverless": "^0.10.4",
    "pg": "^8.16.3"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.9"
  }
}
```

### Config File

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './shared/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

---

## 📊 Schema Management

### تعریف Schema

تمام schema ها در `shared/schema.ts` تعریف می‌شوند:

```typescript
import { pgTable, serial, text, integer, timestamp, boolean, json } from 'drizzle-orm/pg-core';

// مثال: جدول کاربران
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// مثال: جدول نمایندگان
export const representatives = pgTable('representatives', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  phone: text('phone'),
  address: text('address'),
  isActive: boolean('is_active').default(true),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

// مثال: جدول فاکتورها
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  representativeId: integer('representative_id').references(() => representatives.id),
  invoiceNumber: text('invoice_number').notNull().unique(),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('pending'),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### انواع داده PostgreSQL در Drizzle

| Drizzle Type | PostgreSQL Type | مثال |
|--------------|-----------------|------|
| `serial()` | SERIAL | کلید اصلی auto-increment |
| `integer()` | INTEGER | اعداد صحیح |
| `text()` | TEXT | متن بدون محدودیت طول |
| `varchar(n)` | VARCHAR(n) | متن با حداکثر طول |
| `boolean()` | BOOLEAN | true/false |
| `timestamp()` | TIMESTAMP | تاریخ و زمان |
| `json()` | JSON | داده JSON |
| `jsonb()` | JSONB | داده JSONB (بهینه‌تر) |
| `numeric()` | NUMERIC | اعداد اعشاری دقیق |

---

## 🔄 Migrations

### ایجاد Migration جدید

```bash
# تولید migration از schema
npm run db:generate
```

این دستور فایل SQL migration در پوشه `migrations/` ایجاد می‌کند.

### اعمال Migrations

```bash
# اعمال تمام migrations
npm run db:migrate
```

### Push مستقیم Schema (بدون migration)

```bash
# Push schema مستقیماً به دیتابیس
npm run db:push
```

⚠️ **توجه:** `db:push` برای development مناسب است، برای production از `db:migrate` استفاده کنید.

### Drizzle Studio (UI مدیریت دیتابیس)

```bash
npm run db:studio
```

Drizzle Studio در `https://local.drizzle.studio` باز می‌شود.

---

## 🔌 اتصال به دیتابیس

### روش 1: Docker Exec

```bash
docker-compose exec postgres psql -U marfanet_user -d marfanet_db
```

### روش 2: Connection String

```bash
psql "postgresql://marfanet_user:password@localhost:5432/marfanet_db"
```

### روش 3: از طریق Node.js

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const result = await pool.query('SELECT NOW()');
console.log(result.rows[0]);
```

---

## 💾 بکاپ و بازیابی

### بکاپ کامل

```bash
# بکاپ با timestamp
docker-compose exec postgres pg_dump -U marfanet_user -d marfanet_db \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

### بکاپ فشرده

```bash
docker-compose exec postgres pg_dump -U marfanet_user -d marfanet_db \
  | gzip > backup_$(date +%Y%m%d).sql.gz
```

### بکاپ فقط schema (بدون داده)

```bash
docker-compose exec postgres pg_dump -U marfanet_user -d marfanet_db \
  --schema-only > schema_backup.sql
```

### بکاپ فقط داده (بدون schema)

```bash
docker-compose exec postgres pg_dump -U marfanet_user -d marfanet_db \
  --data-only > data_backup.sql
```

### بازیابی از بکاپ

```bash
# بازیابی معمولی
cat backup_20250102.sql | docker-compose exec -T postgres \
  psql -U marfanet_user -d marfanet_db

# بازیابی از فایل فشرده
gunzip -c backup_20250102.sql.gz | docker-compose exec -T postgres \
  psql -U marfanet_user -d marfanet_db
```

### بکاپ خودکار (Cron Job)

```bash
# ویرایش crontab
crontab -e

# اضافه کردن بکاپ روزانه در ساعت 2 صبح
0 2 * * * cd /path/to/project && docker-compose exec postgres pg_dump -U marfanet_user -d marfanet_db | gzip > backups/backup_$(date +\%Y\%m\%d).sql.gz
```

---

## ⚡ بهینه‌سازی

### Indexes

```typescript
// در schema.ts
import { index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  // ... columns
}, (table) => ({
  usernameIdx: index('username_idx').on(table.username),
  emailIdx: index('email_idx').on(table.email),
}));
```

### Query Optimization

```typescript
// بد: N+1 query
const users = await db.select().from(users);
for (const user of users) {
  const invoices = await db.select().from(invoices)
    .where(eq(invoices.userId, user.id));
}

// خوب: JOIN
const usersWithInvoices = await db.select()
  .from(users)
  .leftJoin(invoices, eq(users.id, invoices.userId));
```

### Connection Pooling

```typescript
// server/db.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // حداکثر تعداد اتصالات
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Vacuum و Analyze

```bash
# اجرای vacuum
docker-compose exec postgres psql -U marfanet_user -d marfanet_db \
  -c "VACUUM ANALYZE;"

# vacuum full (زمان‌بر)
docker-compose exec postgres psql -U marfanet_user -d marfanet_db \
  -c "VACUUM FULL;"
```

---

## 🔍 Query های مفید

### مشاهده جداول

```sql
\dt
```

### مشاهده ساختار جدول

```sql
\d table_name
```

### مشاهده Indexes

```sql
\di
```

### مشاهده حجم جداول

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### مشاهده اتصالات فعال

```sql
SELECT * FROM pg_stat_activity;
```

### Kill کردن اتصال

```sql
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'marfanet_db' 
  AND pid <> pg_backend_pid();
```

---

## 🐛 عیب‌یابی

### مشکل: دیتابیس راه نمی‌افتد

```bash
# بررسی لاگ
docker-compose logs postgres

# Restart
docker-compose restart postgres

# پاک کردن و ساخت مجدد
docker-compose down -v
docker-compose up -d postgres
```

### مشکل: خطای "too many connections"

```sql
-- افزایش حداکثر تعداد اتصالات
ALTER SYSTEM SET max_connections = 200;
SELECT pg_reload_conf();
```

### مشکل: Query کند

```sql
-- فعال کردن log برای query های کند
ALTER SYSTEM SET log_min_duration_statement = 1000; -- 1 second
SELECT pg_reload_conf();

-- مشاهده query های کند
SELECT * FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 10;
```

### مشکل: Migration fail

```bash
# Drop تمام جداول
docker-compose exec postgres psql -U marfanet_user -d marfanet_db \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# اجرای مجدد migrations
npm run db:push
```

---

## 📚 منابع بیشتر

- [مستندات رسمی PostgreSQL](https://www.postgresql.org/docs/)
- [مستندات Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)

---

## ⚠️ نکات امنیتی

1. **هرگز** از root user برای اپلیکیشن استفاده نکنید
2. رمزهای قوی برای دیتابیس استفاده کنید
3. در production SSL را فعال کنید
4. بکاپ منظم بگیرید
5. به User ها فقط دسترسی‌های لازم بدهید
6. از prepared statements استفاده کنید (Drizzle این کار را خودکار انجام می‌دهد)

---

**یادآوری:** این پروژه فقط از **PostgreSQL** پشتیبانی می‌کند. استفاده از SQLite امکان‌پذیر نیست.
