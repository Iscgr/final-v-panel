/**
 * Admin Resources Routes - مدیریت منابع (اپلیکیشن‌ها و اطلاعیه‌ها) در پنل ادمین
 * 
 * Endpoints:
 * GET    /api/admin/app-downloads        - لیست تمام اپلیکیشن‌ها
 * POST   /api/admin/app-downloads        - ایجاد اپلیکیشن جدید
 * PUT    /api/admin/app-downloads/:id    - ویرایش اپلیکیشن
 * DELETE /api/admin/app-downloads/:id    - حذف اپلیکیشن
 * 
 * GET    /api/admin/announcements        - لیست تمام اطلاعیه‌ها
 * POST   /api/admin/announcements        - ایجاد اطلاعیه جدید
 * PUT    /api/admin/announcements/:id    - ویرایش اطلاعیه
 * DELETE /api/admin/announcements/:id    - حذف اطلاعیه
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { appDownloads, announcements } from '../../shared/schema.js';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// ==================== APP DOWNLOADS ====================

/**
 * GET /api/admin/app-downloads
 * دریافت لیست تمام اپلیکیشن‌ها (مرتب شده بر اساس displayOrder)
 */
router.get('/app-downloads', async (req: Request, res: Response) => {
  try {
    const downloads = await db
      .select()
      .from(appDownloads)
      .orderBy(appDownloads.displayOrder, appDownloads.id);

    res.json({
      success: true,
      data: downloads
    });
  } catch (error) {
    console.error('❌ خطا در دریافت لیست اپلیکیشن‌ها:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت لیست اپلیکیشن‌ها'
    });
  }
});

/**
 * POST /api/admin/app-downloads
 * ایجاد اپلیکیشن جدید
 */
router.post('/app-downloads', async (req: Request, res: Response) => {
  try {
    const { title, description, downloadLink, qrCodeUrl, videoUrl, displayOrder, isActive } = req.body;

    // Validation
    if (!title || !downloadLink) {
      return res.status(400).json({
        success: false,
        error: 'عنوان و لینک دانلود الزامی است'
      });
    }

    const [newDownload] = await db
      .insert(appDownloads)
      .values({
        title,
        description: description || null,
        downloadLink,
        qrCodeUrl: qrCodeUrl || null,
        videoUrl: videoUrl || null,
        displayOrder: displayOrder || 0,
        isActive: isActive !== undefined ? isActive : true
      })
      .returning();

    console.log('✅ اپلیکیشن جدید ایجاد شد:', newDownload.id);

    res.json({
      success: true,
      data: newDownload
    });
  } catch (error) {
    console.error('❌ خطا در ایجاد اپلیکیشن:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در ایجاد اپلیکیشن'
    });
  }
});

/**
 * PUT /api/admin/app-downloads/:id
 * ویرایش اپلیکیشن موجود
 */
router.put('/app-downloads/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, downloadLink, qrCodeUrl, videoUrl, displayOrder, isActive } = req.body;

    const [updatedDownload] = await db
      .update(appDownloads)
      .set({
        title,
        description,
        downloadLink,
        qrCodeUrl,
        videoUrl,
        displayOrder,
        isActive,
        updatedAt: new Date()
      })
      .where(eq(appDownloads.id, parseInt(id)))
      .returning();

    if (!updatedDownload) {
      return res.status(404).json({
        success: false,
        error: 'اپلیکیشن پیدا نشد'
      });
    }

    console.log('✅ اپلیکیشن ویرایش شد:', updatedDownload.id);

    res.json({
      success: true,
      data: updatedDownload
    });
  } catch (error) {
    console.error('❌ خطا در ویرایش اپلیکیشن:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در ویرایش اپلیکیشن'
    });
  }
});

/**
 * DELETE /api/admin/app-downloads/:id
 * حذف اپلیکیشن
 */
router.delete('/app-downloads/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [deletedDownload] = await db
      .delete(appDownloads)
      .where(eq(appDownloads.id, parseInt(id)))
      .returning();

    if (!deletedDownload) {
      return res.status(404).json({
        success: false,
        error: 'اپلیکیشن پیدا نشد'
      });
    }

    console.log('✅ اپلیکیشن حذف شد:', deletedDownload.id);

    res.json({
      success: true,
      message: 'اپلیکیشن با موفقیت حذف شد'
    });
  } catch (error) {
    console.error('❌ خطا در حذف اپلیکیشن:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در حذف اپلیکیشن'
    });
  }
});

// ==================== ANNOUNCEMENTS ====================

/**
 * GET /api/admin/announcements
 * دریافت لیست تمام اطلاعیه‌ها (مرتب شده بر اساس اولویت و تاریخ)
 */
router.get('/announcements', async (req: Request, res: Response) => {
  try {
    const allAnnouncements = await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.priority), desc(announcements.createdAt));

    res.json({
      success: true,
      data: allAnnouncements
    });
  } catch (error) {
    console.error('❌ خطا در دریافت لیست اطلاعیه‌ها:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت لیست اطلاعیه‌ها'
    });
  }
});

/**
 * POST /api/admin/announcements
 * ایجاد اطلاعیه جدید
 */
router.post('/announcements', async (req: Request, res: Response) => {
  try {
    const { title, content, priority, type, isActive, expiresAt } = req.body;

    // Validation
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'عنوان و محتوا الزامی است'
      });
    }

    const [newAnnouncement] = await db
      .insert(announcements)
      .values({
        title,
        content,
        priority: priority || 0,
        type: type || 'info',
        isActive: isActive !== undefined ? isActive : true,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      })
      .returning();

    console.log('✅ اطلاعیه جدید ایجاد شد:', newAnnouncement.id);

    res.json({
      success: true,
      data: newAnnouncement
    });
  } catch (error) {
    console.error('❌ خطا در ایجاد اطلاعیه:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در ایجاد اطلاعیه'
    });
  }
});

/**
 * PUT /api/admin/announcements/:id
 * ویرایش اطلاعیه موجود
 */
router.put('/announcements/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, priority, type, isActive, expiresAt } = req.body;

    const [updatedAnnouncement] = await db
      .update(announcements)
      .set({
        title,
        content,
        priority,
        type,
        isActive,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        updatedAt: new Date()
      })
      .where(eq(announcements.id, parseInt(id)))
      .returning();

    if (!updatedAnnouncement) {
      return res.status(404).json({
        success: false,
        error: 'اطلاعیه پیدا نشد'
      });
    }

    console.log('✅ اطلاعیه ویرایش شد:', updatedAnnouncement.id);

    res.json({
      success: true,
      data: updatedAnnouncement
    });
  } catch (error) {
    console.error('❌ خطا در ویرایش اطلاعیه:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در ویرایش اطلاعیه'
    });
  }
});

/**
 * DELETE /api/admin/announcements/:id
 * حذف اطلاعیه
 */
router.delete('/announcements/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [deletedAnnouncement] = await db
      .delete(announcements)
      .where(eq(announcements.id, parseInt(id)))
      .returning();

    if (!deletedAnnouncement) {
      return res.status(404).json({
        success: false,
        error: 'اطلاعیه پیدا نشد'
      });
    }

    console.log('✅ اطلاعیه حذف شد:', deletedAnnouncement.id);

    res.json({
      success: true,
      message: 'اطلاعیه با موفقیت حذف شد'
    });
  } catch (error) {
    console.error('❌ خطا در حذف اطلاعیه:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در حذف اطلاعیه'
    });
  }
});

export default router;
