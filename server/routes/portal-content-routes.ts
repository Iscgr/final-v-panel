import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { portalContentBlocks, announcements, appDownloads, portalContentPublicationState } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { getCachedFull, cacheFull, getCachedStatus, cacheStatus, invalidateAllPortalContent } from '../utils/portalContentCache.js';

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
    invalidateAllPortalContent();
    res.json({ success: true, cacheInvalidated: true });
  } catch (err) {
    console.error('❌ Error updating portal content block:', err);
    res.status(500).json({ success: false, error: 'خطا در ذخیره بلوک' });
  }
});

// GET /full  → بلوک‌ها + اطلاعیه‌های فعال + اپ‌های فعال
router.get('/full', async (req: Request, res: Response) => {
  try {
    const cached = getCachedFull();
    if (cached) return res.json({ success: true, data: cached, cache: 'HIT' });
    const [blocksRows, annRows, dlRows] = await Promise.all([
      db.select().from(portalContentBlocks),
      db.select().from(announcements).orderBy(announcements.priority, announcements.id),
      db.select().from(appDownloads).orderBy(appDownloads.displayOrder, appDownloads.id)
    ]);
    const normalizedBlocks = Object.entries(ALLOWED_BLOCKS).map(([key, meta]) => {
      const existing = blocksRows.find(r => r.blockKey === key);
      return existing || { id: 0, blockKey: key, title: meta.title, body: meta.fallbackBody, updatedAt: null, updatedBy: null };
    });
    const payload = { blocks: normalizedBlocks, announcements: annRows, downloads: dlRows };
    cacheFull(payload);
    res.json({ success: true, data: payload, cache: 'MISS' });
  } catch (e) {
    console.error('❌ Error fetching full portal content:', e);
    res.status(500).json({ success:false, error:'خطا در دریافت محتوای کامل پرتال' });
  }
});

// GET /status → وضعیت انتشار و نسخه محتوا
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const cached = getCachedStatus();
    if (cached) return res.json({ success: true, data: cached, cache: 'HIT' });
    const rows = await db.select().from(portalContentPublicationState).limit(1);
    const state = rows[0] || null;
    const payload = state ? {
      contentVersion: state.contentVersion,
      lastPublishedAt: state.lastPublishedAt,
      lastPublishedBy: state.lastPublishedBy
    } : { contentVersion: 0, lastPublishedAt: null, lastPublishedBy: null };
    cacheStatus(payload);
    res.json({ success: true, data: payload, cache: 'MISS' });
  } catch (e) {
    console.error('❌ Error fetching portal content status:', e);
    res.status(500).json({ success:false, error:'خطا در دریافت وضعیت انتشار' });
  }
});

// POST /publish → افزایش نسخه و ثبت timestamp انتشار
router.post('/publish', async (req: Request, res: Response) => {
  try {
    const username = (req as any).user?.username || 'system';
    const existing = await db.select().from(portalContentPublicationState).limit(1);
    if (existing.length === 0) {
      await db.insert(portalContentPublicationState).values({
        contentVersion: 1,
        lastPublishedAt: new Date(),
        lastPublishedBy: username
      });
      const payload = { contentVersion:1, lastPublishedAt:new Date(), lastPublishedBy: username };
      invalidateAllPortalContent();
      cacheStatus(payload);
      return res.json({ success:true, data: payload, cacheInvalidated: true });
    } else {
      const current = existing[0];
      const newVersion = (current.contentVersion || 0) + 1;
      await db.update(portalContentPublicationState)
        .set({ contentVersion: newVersion, lastPublishedAt: new Date(), lastPublishedBy: username, updatedAt: new Date() })
        .where(eq(portalContentPublicationState.id, current.id));
      const payload = { contentVersion:newVersion, lastPublishedAt:new Date(), lastPublishedBy: username };
      invalidateAllPortalContent();
      cacheStatus(payload);
      return res.json({ success:true, data: payload, cacheInvalidated: true });
    }
  } catch (e) {
    console.error('❌ Error publishing portal content:', e);
    res.status(500).json({ success:false, error:'خطا در انتشار محتوا' });
  }
});

// PUT /settings (batch update blocks only for now; extensible)
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const { blocks } = req.body || {};
    if (!Array.isArray(blocks)) return res.status(400).json({ success:false, error:'blocks باید آرایه باشد' });
    const username = (req as any).user?.username || 'system';
    for (const b of blocks) {
      if (!b || typeof b.blockKey !== 'string' || typeof b.body !== 'string') {
        return res.status(400).json({ success:false, error:'ساختار بلوک نامعتبر' });
      }
      if (!ALLOWED_BLOCKS[b.blockKey]) {
        return res.status(400).json({ success:false, error:`blockKey نامعتبر: ${b.blockKey}` });
      }
      const existing = await db.select().from(portalContentBlocks).where(eq(portalContentBlocks.blockKey, b.blockKey));
      if (existing.length) {
        await db.update(portalContentBlocks)
          .set({ body: b.body, title: b.title ?? existing[0].title, updatedBy: username, updatedAt: new Date() })
          .where(eq(portalContentBlocks.blockKey, b.blockKey));
      } else {
        await db.insert(portalContentBlocks)
          .values({ blockKey: b.blockKey, body: b.body, title: b.title ?? ALLOWED_BLOCKS[b.blockKey].title, updatedBy: username });
      }
    }
    invalidateAllPortalContent();
    res.json({ success:true, updated: blocks.length, cacheInvalidated: true });
  } catch (e) {
    console.error('❌ Error batch updating portal content blocks:', e);
    res.status(500).json({ success:false, error:'خطا در بروزرسانی گروهی بلوک‌ها' });
  }
});

export default router;