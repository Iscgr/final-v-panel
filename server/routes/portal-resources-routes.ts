/**
 * Portal Resources Routes - دریافت منابع برای پرتال عمومی نماینده
 * 
 * Endpoints:
 * GET /api/portal/:publicId/resources - دریافت لیست اپلیکیشن‌ها و اطلاعیه‌ها برای نماینده
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { appDownloads, announcements } from '../../shared/schema.js';
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

    // دریافت اپلیکیشن‌های فعال
    const activeDownloads = await db
      .select()
      .from(appDownloads)
      .where(eq(appDownloads.isActive, true))
      .orderBy(appDownloads.displayOrder, appDownloads.id);

    // دریافت اطلاعیه‌های فعال و منقضی نشده
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

    console.log(`✅ منابع دریافت شد: ${activeDownloads.length} اپلیکیشن، ${activeAnnouncements.length} اطلاعیه`);

    res.json({
      success: true,
      data: {
        appDownloads: activeDownloads,
        announcements: activeAnnouncements
      }
    });
  } catch (error) {
    console.error('❌ خطا در دریافت منابع پرتال:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت منابع'
    });
  }
});

export default router;
