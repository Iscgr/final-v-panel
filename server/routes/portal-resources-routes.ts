/**
 * Portal Resources Routes - دریافت منابع برای پرتال عمومی نماینده
 * 
 * Endpoints:
 * GET /api/portal/:publicId/resources - دریافت لیست اپلیکیشن‌ها و اطلاعیه‌ها برای نماینده
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { appDownloads, announcements, portalContentDocuments } from '../../shared/schema.js';
import { getUnifiedPublishedCached, setUnifiedPublishedCache } from '../utils/unifiedPortalContentCache.js';
import { featureFlagManager } from '../services/feature-flag-manager.js';
import { eq, and, or, gt } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/portal/:publicId/resources
 * دریافت منابع (اپلیکیشن‌ها و اطلاعیه‌ها) برای پرتال عمومی
 * 
 * این endpoint عمومی است و نیازی به احراز هویت ندارد
 */
router.get('/:publicId/resources', async (req: Request, res: Response) => {
  try {
    const { publicId } = req.params;

    console.log(`📦 درخواست منابع برای نماینده: ${publicId}`);

    // کنترل feature flag چندمرحله‌ای
    const flagState = featureFlagManager.getMultiStageFlagState('portal_content_read_switch');

    // فقط در حالت full مجاز به ارائه unified هستیم؛ در shadow صرفاً diff/مشاهده خاموش (اینجا ساده log)
    let unified: any = null;
    if (flagState === 'full' || flagState === 'shadow') {
      const cached = getUnifiedPublishedCached();
      if (cached) {
        unified = cached.doc;
      } else {
        try {
          const unifiedRows = await db.select().from(portalContentDocuments).where(eq(portalContentDocuments.docKey, 'portal_main'));
          if (unifiedRows.length && unifiedRows[0].publishedJson) {
            unified = unifiedRows[0].publishedJson;
            setUnifiedPublishedCache(unified, unifiedRows[0].publishedVersion || 0);
          }
        } catch (e) {
          console.warn('⚠️ unified portal content fetch failed (will fallback to legacy):', (e as Error).message);
        }
      }
    }

    if (flagState === 'full' && unified) {
      console.log('✅ Unified portal content served (FULL mode)');
      return res.json({ success: true, data: { unified, source: 'unified', mode: flagState } });
    }

    if (flagState === 'shadow' && unified) {
      // در حالت shadow خروجی public را هنوز legacy نگه می‌داریم ولی اختلاف اندازه (ساده) را لاگ می‌کنیم
      try {
        const sectionCount = Array.isArray(unified.sections) ? unified.sections.length : 0;
        const annCount = Array.isArray(unified.announcements) ? unified.announcements.length : 0;
        const dlCount = Array.isArray(unified.downloads) ? unified.downloads.length : 0;
        console.log(`🌓 portal_content_read_switch shadow: unified(draft) sizes sections=${sectionCount} announcements=${annCount} downloads=${dlCount}`);
      } catch {}
      // ادامه مسیر legacy
    }

    // Fallback legacy path (announcements + downloads) برای سازگاری موقت
    const activeDownloads = await db
      .select()
      .from(appDownloads)
      .where(eq(appDownloads.isActive, true))
      .orderBy(appDownloads.displayOrder, appDownloads.id);

    const now = new Date();
    const activeAnnouncements = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.isActive, true),
          or(
            eq(announcements.expiresAt, null),
            gt(announcements.expiresAt, now)
          )
        )
      )
      .orderBy(announcements.priority, announcements.createdAt);

  console.log(`✅ Legacy resources served: ${activeDownloads.length} downloads, ${activeAnnouncements.length} announcements (mode=${flagState})`);

  res.json({ success: true, data: { appDownloads: activeDownloads, announcements: activeAnnouncements, source: 'legacy', mode: flagState } });
  } catch (error) {
    console.error('❌ خطا در دریافت منابع پرتال:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت منابع'
    });
  }
});

export default router;
