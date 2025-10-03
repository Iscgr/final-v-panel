/**
 * File Upload & View Tracking Routes
 * مدیریت آپلود فایل و ثبت آمار بازدید
 * 
 * Endpoints:
 * POST   /api/admin/upload/qr-code/:id       - آپلود QR Code برای اپلیکیشن
 * POST   /api/admin/upload/video/:id         - آپلود ویدئو برای اپلیکیشن
 * DELETE /api/admin/upload/qr-code/:id       - حذف QR Code
 * DELETE /api/admin/upload/video/:id         - حذف ویدئو
 * GET    /api/uploads/:type/:filename        - دریافت فایل (public)
 * POST   /api/portal/track-view/:id          - ثبت بازدید اپلیکیشن
 * GET    /api/admin/app-downloads/:id/stats  - آمار یک اپلیکیشن
 * GET    /api/admin/app-downloads/stats/all  - آمار کلی
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import { db } from '../db.js';
import { appDownloads, appDownloadViews, uploadedFiles } from '../../shared/schema.js';
import { eq, desc, count, sql } from 'drizzle-orm';
import { uploadQRCode, uploadVideo, fileService, PATHS } from '../services/file-upload.service.js';

const router = Router();

// ==================== FILE UPLOAD ====================

/**
 * POST /api/admin/upload/qr-code/:id
 * آپلود تصویر QR Code برای اپلیکیشن
 */
router.post('/upload/qr-code/:id', uploadQRCode.single('qrCode'), async (req: Request, res: Response) => {
  const appId = parseInt(req.params.id);
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      error: 'فایلی آپلود نشده است'
    });
  }

  try {
    // بررسی وجود اپلیکیشن
    const app = await db.select().from(appDownloads).where(eq(appDownloads.id, appId)).limit(1);
    
    if (!app || app.length === 0) {
      // حذف فایل آپلود شده
      await fileService.deleteFile(file.path);
      return res.status(404).json({
        success: false,
        error: 'اپلیکیشن یافت نشد'
      });
    }

    // حذف QR Code قبلی (اگر وجود دارد)
    if (app[0].qrCodeFilePath) {
      await fileService.deleteFile(app[0].qrCodeFilePath);
    }

    // به‌روزرسانی مسیر فایل در دیتابیس
    const fileUrl = fileService.getFileUrl(file.path);
    await db
      .update(appDownloads)
      .set({
        qrCodeFilePath: file.path,
        qrCodeUrl: fileUrl,
        updatedAt: new Date()
      })
      .where(eq(appDownloads.id, appId));

    // ذخیره متادیتای فایل
    await db.insert(uploadedFiles).values({
      fileName: file.originalname,
      storedFileName: file.filename,
      filePath: file.path,
      fileType: file.mimetype,
      fileSize: file.size,
      entityType: 'app_download_qr',
      entityId: appId,
      uploadedBy: (req as any).user?.username || 'admin'
    });

    console.log(`✅ QR Code آپلود شد برای اپلیکیشن #${appId}: ${file.filename}`);

    res.json({
      success: true,
      message: 'QR Code با موفقیت آپلود شد',
      data: {
        fileUrl,
        filePath: file.path,
        fileName: file.filename,
        fileSize: file.size
      }
    });
  } catch (error) {
    console.error('❌ خطا در آپلود QR Code:', error);
    // حذف فایل در صورت خطا
    if (file?.path) {
      await fileService.deleteFile(file.path);
    }
    res.status(500).json({
      success: false,
      error: 'خطا در آپلود QR Code'
    });
  }
});

/**
 * POST /api/admin/upload/video/:id
 * آپلود ویدئو برای اپلیکیشن
 */
router.post('/upload/video/:id', uploadVideo.single('video'), async (req: Request, res: Response) => {
  const appId = parseInt(req.params.id);
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      error: 'فایلی آپلود نشده است'
    });
  }

  try {
    // بررسی وجود اپلیکیشن
    const app = await db.select().from(appDownloads).where(eq(appDownloads.id, appId)).limit(1);
    
    if (!app || app.length === 0) {
      await fileService.deleteFile(file.path);
      return res.status(404).json({
        success: false,
        error: 'اپلیکیشن یافت نشد'
      });
    }

    // حذف ویدئوی قبلی (اگر وجود دارد)
    if (app[0].videoFilePath) {
      await fileService.deleteFile(app[0].videoFilePath);
    }

    // به‌روزرسانی مسیر فایل در دیتابیس
    const fileUrl = fileService.getFileUrl(file.path);
    await db
      .update(appDownloads)
      .set({
        videoFilePath: file.path,
        videoUrl: fileUrl,
        updatedAt: new Date()
      })
      .where(eq(appDownloads.id, appId));

    // ذخیره متادیتای فایل
    await db.insert(uploadedFiles).values({
      fileName: file.originalname,
      storedFileName: file.filename,
      filePath: file.path,
      fileType: file.mimetype,
      fileSize: file.size,
      entityType: 'app_download_video',
      entityId: appId,
      uploadedBy: (req as any).user?.username || 'admin'
    });

    console.log(`✅ ویدئو آپلود شد برای اپلیکیشن #${appId}: ${file.filename}`);

    res.json({
      success: true,
      message: 'ویدئو با موفقیت آپلود شد',
      data: {
        fileUrl,
        filePath: file.path,
        fileName: file.filename,
        fileSize: file.size
      }
    });
  } catch (error) {
    console.error('❌ خطا در آپلود ویدئو:', error);
    if (file?.path) {
      await fileService.deleteFile(file.path);
    }
    res.status(500).json({
      success: false,
      error: 'خطا در آپلود ویدئو'
    });
  }
});

/**
 * DELETE /api/admin/upload/qr-code/:id
 * حذف QR Code
 */
router.delete('/upload/qr-code/:id', async (req: Request, res: Response) => {
  const appId = parseInt(req.params.id);

  try {
    const app = await db.select().from(appDownloads).where(eq(appDownloads.id, appId)).limit(1);
    
    if (!app || app.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'اپلیکیشن یافت نشد'
      });
    }

    // حذف فایل از سرور
    if (app[0].qrCodeFilePath) {
      await fileService.deleteFile(app[0].qrCodeFilePath);
    }

    // پاک کردن مسیر فایل از دیتابیس
    await db
      .update(appDownloads)
      .set({
        qrCodeFilePath: null,
        qrCodeUrl: null,
        updatedAt: new Date()
      })
      .where(eq(appDownloads.id, appId));

    console.log(`✅ QR Code حذف شد برای اپلیکیشن #${appId}`);

    res.json({
      success: true,
      message: 'QR Code با موفقیت حذف شد'
    });
  } catch (error) {
    console.error('❌ خطا در حذف QR Code:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در حذف QR Code'
    });
  }
});

/**
 * DELETE /api/admin/upload/video/:id
 * حذف ویدئو
 */
router.delete('/upload/video/:id', async (req: Request, res: Response) => {
  const appId = parseInt(req.params.id);

  try {
    const app = await db.select().from(appDownloads).where(eq(appDownloads.id, appId)).limit(1);
    
    if (!app || app.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'اپلیکیشن یافت نشد'
      });
    }

    // حذف فایل از سرور
    if (app[0].videoFilePath) {
      await fileService.deleteFile(app[0].videoFilePath);
    }

    // پاک کردن مسیر فایل از دیتابیس
    await db
      .update(appDownloads)
      .set({
        videoFilePath: null,
        videoUrl: null,
        updatedAt: new Date()
      })
      .where(eq(appDownloads.id, appId));

    console.log(`✅ ویدئو حذف شد برای اپلیکیشن #${appId}`);

    res.json({
      success: true,
      message: 'ویدئو با موفقیت حذف شد'
    });
  } catch (error) {
    console.error('❌ خطا در حذف ویدئو:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در حذف ویدئو'
    });
  }
});

// ==================== VIEW TRACKING ====================

/**
 * POST /api/portal/track-view/:id
 * ثبت بازدید/دانلود اپلیکیشن (Public - بدون احراز هویت)
 */
router.post('/portal/track-view/:id', async (req: Request, res: Response) => {
  const appId = parseInt(req.params.id);
  const { publicId, actionType = 'view' } = req.body;

  try {
    // دریافت IP و User Agent
    const ipAddress = req.ip || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    // ثبت بازدید
    await db.insert(appDownloadViews).values({
      appDownloadId: appId,
      publicId: publicId || null,
      ipAddress,
      userAgent,
      actionType
    });

    console.log(`📊 بازدید ثبت شد: App #${appId}, Type: ${actionType}, IP: ${ipAddress}`);

    res.json({
      success: true,
      message: 'بازدید ثبت شد'
    });
  } catch (error) {
    console.error('❌ خطا در ثبت بازدید:', error);
    // عدم نمایش خطا به کاربر (silent fail)
    res.json({ success: true });
  }
});

/**
 * GET /api/admin/app-downloads/:id/stats
 * آمار یک اپلیکیشن
 */
router.get('/app-downloads/:id/stats', async (req: Request, res: Response) => {
  const appId = parseInt(req.params.id);

  try {
    // آمار کلی
    const totalViews = await db
      .select({ count: count() })
      .from(appDownloadViews)
      .where(eq(appDownloadViews.appDownloadId, appId));

    // آمار بر اساس نوع عملیات
    const viewsByType = await db
      .select({
        actionType: appDownloadViews.actionType,
        count: count()
      })
      .from(appDownloadViews)
      .where(eq(appDownloadViews.appDownloadId, appId))
      .groupBy(appDownloadViews.actionType);

    // آمار 7 روز گذشته
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentViews = await db
      .select({
        date: sql<string>`DATE(${appDownloadViews.createdAt})`,
        count: count()
      })
      .from(appDownloadViews)
      .where(
        sql`${appDownloadViews.appDownloadId} = ${appId} AND ${appDownloadViews.createdAt} >= ${sevenDaysAgo}`
      )
      .groupBy(sql`DATE(${appDownloadViews.createdAt})`)
      .orderBy(sql`DATE(${appDownloadViews.createdAt}) DESC`);

    res.json({
      success: true,
      data: {
        totalViews: totalViews[0]?.count || 0,
        viewsByType,
        recentViews
      }
    });
  } catch (error) {
    console.error('❌ خطا در دریافت آمار:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت آمار'
    });
  }
});

/**
 * GET /api/admin/app-downloads/stats/all
 * آمار کلی تمام اپلیکیشن‌ها
 */
router.get('/app-downloads/stats/all', async (req: Request, res: Response) => {
  try {
    // Top 5 اپلیکیشن‌ها بر اساس تعداد بازدید
    const topApps = await db
      .select({
        id: appDownloads.id,
        title: appDownloads.title,
        viewCount: appDownloads.viewCount
      })
      .from(appDownloads)
      .where(eq(appDownloads.isActive, true))
      .orderBy(desc(appDownloads.viewCount))
      .limit(5);

    // آمار کل
    const totalStats = await db
      .select({
        totalApps: count(),
        totalViews: sql<number>`COALESCE(SUM(${appDownloads.viewCount}), 0)`
      })
      .from(appDownloads);

    res.json({
      success: true,
      data: {
        topApps,
        totalStats: totalStats[0]
      }
    });
  } catch (error) {
    console.error('❌ خطا در دریافت آمار کلی:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت آمار کلی'
    });
  }
});

export default router;
