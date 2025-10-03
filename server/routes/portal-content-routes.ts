import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { portalContentBlocks } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Admin Portal Content Routes (Phase 1)
 * موقتا فقط بلوک‌های متنی را مدیریت می‌کند. فرانت پرتال عمومی هنوز از settings قدیمی می‌خواند.
 */
const router = Router();

// Map of allowed logical keys to default titles (fallback safety)
const ALLOWED_BLOCKS: Record<string, { title: string; fallbackBody: string }> = {
  guidance: { title: 'راهنمایی و توصیه‌ها', fallbackBody: 'متن راهنما در دسترس نیست.' },
  contact_info: { title: 'اطلاعات تماس', fallbackBody: 'تلفن: -\nایمیل: -' },
  downloads_intro: { title: 'دانلود اپلیکیشن‌ها', fallbackBody: 'لیست اپلیکیشن‌ها را بررسی کنید.' },
  support_hours: { title: 'ساعات پشتیبانی', fallbackBody: '—' },
  announcements_title: { title: '📢 اعلانات و دانلودها', fallbackBody: '📢 اعلانات و دانلودها' }
};

// GET all blocks
router.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(portalContentBlocks);
    // Ensure all allowed keys exist (even if not yet seeded)
    const normalized = Object.entries(ALLOWED_BLOCKS).map(([key, meta]) => {
      const existing = rows.find(r => r.blockKey === key);
      return existing || { id: 0, blockKey: key, title: meta.title, body: meta.fallbackBody, updatedAt: null, updatedBy: null };
    });
    res.json({ success: true, data: normalized });
  } catch (err) {
    console.error('❌ Error fetching portal content blocks:', err);
    res.status(500).json({ success: false, error: 'خطا در دریافت بلوک‌ها' });
  }
});

// PUT update (upsert) a block
router.put('/:blockKey', async (req: Request, res: Response) => {
  try {
    const { blockKey } = req.params;
    const { body, title } = req.body as { body?: string; title?: string };
    if (!ALLOWED_BLOCKS[blockKey]) {
      return res.status(400).json({ success: false, error: 'blockKey نامعتبر است' });
    }
    if (typeof body !== 'string') {
      return res.status(400).json({ success: false, error: 'body الزامی است' });
    }
    const updatedBy = (req as any).user?.username || 'system';

    // Try update first
    const existing = await db.select().from(portalContentBlocks).where(eq(portalContentBlocks.blockKey, blockKey));
    if (existing.length > 0) {
      await db.update(portalContentBlocks)
        .set({ body, title: title ?? existing[0].title, updatedBy, updatedAt: new Date() })
        .where(eq(portalContentBlocks.blockKey, blockKey));
    } else {
      await db.insert(portalContentBlocks).values({ blockKey, body, title: title ?? ALLOWED_BLOCKS[blockKey].title, updatedBy });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error updating portal content block:', err);
    res.status(500).json({ success: false, error: 'خطا در ذخیره بلوک' });
  }
});

export default router;