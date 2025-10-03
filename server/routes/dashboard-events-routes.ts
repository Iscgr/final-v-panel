/**
 * 🔄 Dashboard Real-time Events Routes
 * SSE endpoints برای بروزرسانی لحظه‌ای داشبورد
 */

import { Router, Request, Response } from 'express';
import { dashboardEventsService } from '../services/dashboard-events-service.js';
import { overdueInvoiceService } from '../services/overdue-invoice-service.js';
import { EnhancedHealthScoreService } from '../services/enhanced-health-score-service.js';

const router = Router();

/**
 * SSE Endpoint - اتصال real-time به dashboard
 * GET /api/dashboard/events
 * 
 * Frontend استفاده:
 * const eventSource = new EventSource('/api/dashboard/events');
 * eventSource.addEventListener('dashboard:updated', (e) => {
 *   const data = JSON.parse(e.data);
 *   // invalidate queries
 * });
 */
router.get('/events', (req: Request, res: Response) => {
  console.log('📡 New SSE connection request for dashboard events');

  // نیازی به authentication check نیست - فقط داده‌های عمومی dashboard
  // اگر نیاز به auth بود:
  // if (!req.session?.authenticated) {
  //   res.status(401).json({ error: 'Unauthorized' });
  //   return;
  // }

  dashboardEventsService.addClient(res);
});

/**
 * Test endpoint - ارسال دستی یک event برای تست
 * POST /api/dashboard/events/test
 */
router.post('/events/test', (req: Request, res: Response) => {
  const { type = 'full', data = {} } = req.body;

  dashboardEventsService.broadcastDashboardUpdate({
    type,
    timestamp: new Date().toISOString(),
    data,
    trigger: 'manual'
  });

  res.json({
    success: true,
    message: 'Test event broadcasted',
    clients: dashboardEventsService.getStats().connectedClients
  });
});

/**
 * Stats endpoint - آمار SSE connections
 * GET /api/dashboard/events/stats
 */
router.get('/events/stats', (req: Request, res: Response) => {
  res.json({
    success: true,
    stats: dashboardEventsService.getStats()
  });
});

/**
 * Overdue Job Management
 */

// دریافت وضعیت overdue job
router.get('/overdue-job/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: overdueInvoiceService.getStatus()
  });
});

// اجرای دستی overdue job
router.post('/overdue-job/run', async (req: Request, res: Response) => {
  try {
    const result = await overdueInvoiceService.runManually();
    res.json({
      success: true,
      message: 'Overdue job executed successfully',
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// شروع scheduled job
router.post('/overdue-job/start', (req: Request, res: Response) => {
  overdueInvoiceService.startScheduledJob();
  res.json({
    success: true,
    message: 'Overdue job scheduled successfully'
  });
});

// توقف scheduled job
router.post('/overdue-job/stop', (req: Request, res: Response) => {
  overdueInvoiceService.stopScheduledJob();
  res.json({
    success: true,
    message: 'Overdue job stopped successfully'
  });
});

/**
 * Enhanced Health Score Management
 */

// دریافت Health Score با جزئیات کامل
router.get('/health-score', async (req: Request, res: Response) => {
  try {
    const { totalDebt } = req.query;
    const debt = totalDebt ? parseFloat(totalDebt as string) : 0;
    
    const healthScore = await EnhancedHealthScoreService.calculateHealthScore(debt);
    
    res.json({
      success: true,
      data: healthScore
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// دریافت تنظیمات پیش‌فرض
router.get('/health-score/thresholds', (req: Request, res: Response) => {
  res.json({
    success: true,
    thresholds: EnhancedHealthScoreService.getDefaultThresholds()
  });
});

// محاسبه Health Score با تنظیمات سفارشی
router.post('/health-score/calculate', async (req: Request, res: Response) => {
  try {
    const { totalDebt, customThresholds } = req.body;
    
    if (typeof totalDebt !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'totalDebt is required and must be a number'
      });
    }
    
    const healthScore = await EnhancedHealthScoreService.calculateHealthScore(
      totalDebt,
      customThresholds
    );
    
    res.json({
      success: true,
      data: healthScore
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ذخیره Historical Score
router.post('/health-score/save-snapshot', async (req: Request, res: Response) => {
  try {
    const { score } = req.body;
    
    if (typeof score !== 'number' || score < 0 || score > 100) {
      return res.status(400).json({
        success: false,
        error: 'score must be a number between 0 and 100'
      });
    }
    
    await EnhancedHealthScoreService.saveHistoricalScore(score);
    
    res.json({
      success: true,
      message: 'Health score snapshot saved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
