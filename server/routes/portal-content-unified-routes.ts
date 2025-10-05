import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { portalContentDocuments, announcements, appDownloads } from '../../shared/schema.js';
import { setUnifiedPublishedCache, invalidateUnifiedPublishedCache } from '../utils/unifiedPortalContentCache.js';
import { eq } from 'drizzle-orm';
import { featureFlagManager } from '../services/feature-flag-manager.js';

// Unified Portal Content Admin Routes
// قرارداد JSON پیشنهادی draft:
// {
//   displayTitle: string,
//   sections: [ { id, title, body, order } ],
//   announcements: [...mirrored active announcements OR custom subset...],
//   downloads: [...mirrored active downloads OR sorted subset...],
//   metadata: { createdAt, lastEditAt? }
// }

const router = Router();

// Helper: shape validation (lightweight) - we avoid hard failure; just sanitize minimal structure
function normalizeDraft(input: any) {
  const out: any = {};
  out.displayTitle = typeof input?.displayTitle === 'string' ? input.displayTitle : 'پرتال نمایندگان';
  out.sections = Array.isArray(input?.sections) ? input.sections.filter((s: any) => s && typeof s.title === 'string') : [];
  out.announcements = Array.isArray(input?.announcements) ? input.announcements : [];
  out.downloads = Array.isArray(input?.downloads) ? input.downloads : [];
  out.metadata = typeof input?.metadata === 'object' && input?.metadata !== null ? input.metadata : { createdAt: new Date().toISOString() };
  return out;
}

// GET /api/admin/portal-content-unified/draft
router.get('/draft', async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(portalContentDocuments).where(eq(portalContentDocuments.docKey, 'portal_main'));
    if (!rows.length) {
      return res.json({ success: true, data: { docKey: 'portal_main', draftJson: { displayTitle: 'پرتال نمایندگان', sections: [], announcements: [], downloads: [], metadata: { createdAt: new Date().toISOString() } }, status: 'draft', draftVersion: 1, publishedVersion: 0 } });
    }
    const doc = rows[0];
    res.json({ success: true, data: doc });
  } catch (e) {
    console.error('❌ unified get draft error:', e);
    res.status(500).json({ success: false, error: 'خطا در دریافت پیش نویس' });
  }
});

// PUT /api/admin/portal-content-unified/draft  { draftJson }
router.put('/draft', async (req: Request, res: Response) => {
  try {
    const rawDraft = req.body?.draftJson;
    const draft = normalizeDraft(rawDraft);
    const rows = await db.select().from(portalContentDocuments).where(eq(portalContentDocuments.docKey, 'portal_main'));
    const username = (req as any).user?.username || 'admin';
    if (!rows.length) {
      await db.insert(portalContentDocuments).values({ docKey: 'portal_main', draftJson: draft, updatedBy: username, status: 'draft', draftVersion: 1 });
      invalidateUnifiedPublishedCache();
      return res.json({ success: true, created: true, draftVersion: 1 });
    }
    const doc = rows[0];
    const nextDraftVersion = (doc.draftVersion || 1) + 1;
    const status = doc.publishedVersion && doc.publishedVersion > 0 ? 'dirty' : 'draft';
    await db.update(portalContentDocuments)
      .set({ draftJson: draft, updatedBy: username, updatedAt: new Date(), draftVersion: nextDraftVersion, status })
      .where(eq(portalContentDocuments.id, doc.id));
    invalidateUnifiedPublishedCache();
    res.json({ success: true, updated: true, draftVersion: nextDraftVersion, status });
  } catch (e) {
    console.error('❌ unified update draft error:', e);
    res.status(500).json({ success: false, error: 'خطا در ذخیره پیش\u200cنویس' });
  }
});

// POST /api/admin/portal-content-unified/publish  (mirrors announcements & downloads unless explicitly provided)
router.post('/publish', async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(portalContentDocuments).where(eq(portalContentDocuments.docKey, 'portal_main'));
    if (!rows.length) return res.status(400).json({ success: false, error: 'پیش نویس موجود نیست' });
    const doc = rows[0];
    const username = (req as any).user?.username || 'admin';

    // Optionally enrich with current active announcements/downloads if arrays empty
    let draft = doc.draftJson as any;
    if (Array.isArray(draft.announcements) && draft.announcements.length === 0) {
      const acts = await db.select().from(announcements);
      draft = { ...draft, announcements: acts.filter(a => a.isActive) };
    }
    if (Array.isArray(draft.downloads) && draft.downloads.length === 0) {
      const dls = await db.select().from(appDownloads);
      draft = { ...draft, downloads: dls.filter(d => d.isActive) };
    }

    // Compute diff (shallow) between previous published and new
    let diff: any = null;
    if (doc.publishedJson) {
      diff = {};
      const keys = new Set([...Object.keys(doc.publishedJson as any), ...Object.keys(draft)]);
      for (const k of keys) {
        const prevVal = (doc.publishedJson as any)[k];
        const newVal = (draft as any)[k];
        if (JSON.stringify(prevVal) !== JSON.stringify(newVal)) {
          diff[k] = { before: prevVal, after: newVal };
        }
      }
    }

    const newPublishedVersion = (doc.publishedVersion || 0) + 1;
    await db.update(portalContentDocuments)
      .set({
        publishedJson: draft,
        publishedVersion: newPublishedVersion,
        publishedBy: username,
        publishedAt: new Date(),
        status: 'published',
        diffJson: diff || null,
        updatedAt: new Date()
      })
      .where(eq(portalContentDocuments.id, doc.id));
    setUnifiedPublishedCache(draft, newPublishedVersion);
    res.json({ success: true, publishedVersion: newPublishedVersion, diffKeys: diff ? Object.keys(diff) : [] , cached:true});
  } catch (e) {
    console.error('❌ unified publish error:', e);
    res.status(500).json({ success: false, error: 'خطا در انتشار' });
  }
});

// GET /api/admin/portal-content-unified/status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(portalContentDocuments).where(eq(portalContentDocuments.docKey, 'portal_main'));
    if (!rows.length) return res.json({ success: true, data: { publishedVersion: 0, draftVersion: 1, status: 'draft' } });
    const doc = rows[0];
    res.json({ success: true, data: { publishedVersion: doc.publishedVersion, draftVersion: doc.draftVersion, status: doc.status, updatedAt: doc.updatedAt, publishedAt: doc.publishedAt } });
  } catch (e) {
    res.status(500).json({ success: false, error: 'خطا در وضعیت' });
  }
});

// (Optional) GET /api/admin/portal-content-unified/diff
router.get('/diff', async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(portalContentDocuments).where(eq(portalContentDocuments.docKey, 'portal_main'));
    if (!rows.length) return res.json({ success: true, diff: null });
    const doc = rows[0];
    res.json({ success: true, diff: doc.diffJson || null });
  } catch (e) {
    res.status(500).json({ success: false, error: 'خطا در diff' });
  }
});

export default router;
