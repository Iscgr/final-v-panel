/**
 * Representatives Routes - RESTful API Endpoints
 * 
 * Endpoints:
 * GET /api/representatives - List با search, sort, pagination
 * GET /api/representatives/statistics - آمار کلی
 * GET /api/representatives/:id - جزئیات یک نماینده
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { representativesService } from '../services/representatives-service.js';

const router = Router();

/**
 * GET /api/representatives
 * لیست نمایندگان با قابلیت search و sort
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, sortBy, sortOrder, page = '1', pageSize = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    const offset = (pageNum - 1) * pageSizeNum;

    const result = await representativesService.getRepresentativesList({
      search: search as string,
      sortBy: sortBy as 'totalSales' | 'totalDebt' | 'name',
      sortOrder: sortOrder as 'asc' | 'desc',
      limit: pageSizeNum,
      offset
    });

    res.json(result);
  } catch (error) {
    console.error('❌ Error in GET /api/representatives:', error);
    res.status(500).json({ 
      error: 'خطا در دریافت لیست نمایندگان',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/representatives/statistics
 * آمار کلی نمایندگان
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const stats = await representativesService.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('❌ Error in GET /api/representatives/statistics:', error);
    res.status(500).json({ 
      error: 'خطا در دریافت آمار نمایندگان',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/representatives/:code
 * جزئیات یک نماینده
 */
router.get('/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const representative = await representativesService.getRepresentativeByCode(code);
    
    if (!representative) {
      return res.status(404).json({ 
        error: 'نماینده یافت نشد',
        message: `نماینده با کد ${code} در سیستم موجود نیست`
      });
    }

    res.json(representative);
  } catch (error) {
    console.error(`❌ Error in GET /api/representatives/${req.params.code}:`, error);
    res.status(500).json({ 
      error: 'خطا در دریافت اطلاعات نماینده',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/representatives/:code/invoices
 * فاکتورهای یک نماینده
 */
router.get('/:code/invoices', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { page = '1', pageSize = '10' } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    
    const result = await representativesService.getRepresentativeInvoices(
      code, 
      pageNum, 
      pageSizeNum
    );
    
    res.json(result);
  } catch (error) {
    console.error(`❌ Error in GET /api/representatives/${req.params.code}/invoices:`, error);
    res.status(500).json({ 
      error: 'خطا در دریافت فاکتورهای نماینده',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/representatives/:code/payments
 * پرداخت‌های یک نماینده
 */
router.get('/:code/payments', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { page = '1', pageSize = '10' } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    
    const result = await representativesService.getRepresentativePayments(
      code, 
      pageNum, 
      pageSizeNum
    );
    
    res.json(result);
  } catch (error) {
    console.error(`❌ Error in GET /api/representatives/${req.params.code}/payments:`, error);
    res.status(500).json({ 
      error: 'خطا در دریافت پرداخت‌های نماینده',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ================== Phase 3: Update Representative Profile ==================
const updateRepresentativeProfileSchema = z.object({
  ownerName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(32).regex(/^\+?[\d\s-]{5,18}$/,'شماره تماس نامعتبر است').optional(),
  telegramHandle: z.string().trim().regex(/^@?[A-Za-z0-9_]{5,32}$/,'آیدی تلگرام نامعتبر است').optional(),
  salesPartnerId: z.number().int().positive().nullable().optional(),
  panelUsername: z.string().trim().min(3).max(64).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'بدون فیلد برای بروزرسانی',
  path: ['_root']
});

router.put('/:id/profile', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'شناسه نامعتبر است' });
    }
    const payload = updateRepresentativeProfileSchema.parse(req.body);
    const updated = await representativesService.updateRepresentativeProfile(id, payload as any);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'داده نامعتبر', details: error.flatten() });
    }
    console.error('❌ Error in PUT /api/representatives/:id/profile:', error);
    res.status(500).json({
      error: 'خطا در بروزرسانی پروفایل نماینده',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
