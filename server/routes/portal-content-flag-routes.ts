import { Router, Request, Response } from 'express';
import { featureFlagManager } from '../services/feature-flag-manager.js';

// روت اختصاصی مدیریت state پرچم چندمرحله‌ای portal_content_read_switch
// هدف: مهاجرت کنترل‌شده بدون تداخل با feature flags تک‌مرحله‌ای موجود
// امنیت: فقط ادمین سشن معتبر
const router = Router();

const requireAuth = (req: any, res: any, next: any) => {
  if (req.session?.authenticated === true) return next();
  return res.status(401).json({ success: false, error: 'دسترسی غیرمجاز' });
};

// GET وضعیت فعلی
router.get('/state', requireAuth, (_req: Request, res: Response) => {
  try {
    const state = featureFlagManager.getMultiStageFlagState('portal_content_read_switch');
    res.json({ success: true, data: { state } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST تغییر state
router.post('/state', requireAuth, (req: Request, res: Response) => {
  try {
    const { state } = req.body || {};
    if (state !== 'full') {
      return res.status(400).json({ success:false, error:'حالت معتبر تنها full است.' });
    }
    featureFlagManager.updateMultiStageFlag('portal_content_read_switch', 'full', (req as any).user?.username || 'admin');
    res.json({ success:true, data:{ state: 'full' } });
  } catch (e: any) {
    res.status(500).json({ success:false, error: e.message });
  }
});

export default router;
