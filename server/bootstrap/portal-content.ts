import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { portalContentBlocks } from '../../shared/schema.js';

const seedBlocks = [
  {
    blockKey: 'guidance',
    title: 'راهنمایی و توصیه‌ها',
    body: '• برای مشاهده جزئیات هر فاکتور از دکمه مربوط استفاده کنید.\n• اعلانات مهم در این بخش نمایش داده می‌شود.'
  },
  {
    blockKey: 'contact_info',
    title: 'اطلاعات تماس و پشتیبانی',
    body: 'تلفن: ۰۲۱-۱۲۳۴۵۶۷۸\nایمیل: support@example.com'
  },
  {
    blockKey: 'downloads_intro',
    title: '📱 دانلود اپلیکیشن‌های توصیه شده',
    body: 'برای استفاده بهینه از سرویس‌ها، اپلیکیشن‌های زیر را نصب کنید.'
  },
  {
    blockKey: 'support_hours',
    title: 'ساعات پاسخگویی',
    body: 'شنبه تا چهارشنبه، ۹ تا ۱۸'
  },
  {
    blockKey: 'announcements_title',
    title: 'عنوان بخش اعلانات',
    body: '📢 اعلانات و دانلودها'
  }
] as const;

const createTableStatement = `
CREATE TABLE IF NOT EXISTS portal_content_blocks (
  id SERIAL PRIMARY KEY,
  block_key TEXT UNIQUE NOT NULL,
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE portal_content_blocks IS 'بلوک‌های متنی قابل ویرایش پرتال عمومی (فاز مقدماتی)';
COMMENT ON COLUMN portal_content_blocks.block_key IS 'شناسه منطقی بلوک (enum منطقی)';

CREATE INDEX IF NOT EXISTS idx_portal_content_blocks_key ON portal_content_blocks(block_key);
`;

let bootstrapCompleted = false;

export async function ensurePortalContentBootstrap(log = console): Promise<void> {
  if (bootstrapCompleted) {
    return;
  }

  try {
    await db.execute(sql.raw(createTableStatement));

    if (seedBlocks.length) {
      await db
        .insert(portalContentBlocks)
        .values(
          seedBlocks.map(({ blockKey, title, body }) => ({
            blockKey,
            title,
            body,
            updatedBy: 'bootstrap'
          }))
        )
        .onConflictDoNothing({ target: portalContentBlocks.blockKey });
    }

    bootstrapCompleted = true;
    log.info?.('✅ Portal content blocks verified');
  } catch (error) {
    log.error?.('❌ Failed to bootstrap portal content blocks', error);
    throw error;
  }
}

export default ensurePortalContentBootstrap;
