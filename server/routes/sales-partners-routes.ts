import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { unifiedAuthMiddleware } from "../middleware/unified-auth.js";
import { insertSalesPartnerSchema, insertPartnerCommissionPaymentSchema } from "@shared/schema";

const router = Router();

// همه‌ی مسیرها نیاز به احراز هویت دارند
router.use(unifiedAuthMiddleware);

const partnerIdParamSchema = z.object({
  partnerId: z.coerce.number().int().positive()
});

const partnerPaymentIdParamSchema = partnerIdParamSchema.extend({
  paymentId: z.coerce.number().int().positive()
});

const updateSalesPartnerSchema = insertSalesPartnerSchema.partial();

const updateCommissionPaymentSchema = insertPartnerCommissionPaymentSchema.partial();
type UpdateCommissionPaymentPayload = z.infer<typeof updateCommissionPaymentSchema>;

// Schema برای تسویه جزئی
const partialSettlementBodySchema = z.object({
  amount: z.coerce.number().positive('مبلغ باید بزرگتر از صفر باشد'),
  note: z.string().trim().max(500).optional()
});

router.get("/", async (_req: Request, res: Response) => {
  try {
    const partners = await storage.getSalesPartners();
    res.json({ data: partners, count: partners.length });
  } catch (error) {
    console.error("❌ Error in GET /api/sales-partners:", error);
    res.status(500).json({
      error: "خطا در دریافت لیست همکاران فروش",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.get("/statistics", async (_req: Request, res: Response) => {
  try {
    const stats = await storage.getSalesPartnersStatistics();
    res.json(stats);
  } catch (error) {
    console.error("❌ Error in GET /api/sales-partners/statistics:", error);
    res.status(500).json({
      error: "خطا در دریافت آمار همکاران فروش",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

const commissionPaymentsQuerySchema = z.object({
  partnerId: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Number(value)), "partnerId نامعتبر است")
    .transform((value) => (value ? Number(value) : undefined)),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional().refine(v => !v || ['pending','paid','cancelled'].includes(v), 'status نامعتبر است')
});

router.get("/payments", async (req: Request, res: Response) => {
  try {
    const parsed = commissionPaymentsQuerySchema.parse(req.query);

    const filters = {
      partnerId: parsed.partnerId,
      startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
      endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
      status: parsed.status
    };

    if (filters.startDate && Number.isNaN(filters.startDate.getTime())) {
      return res.status(400).json({ error: "startDate نامعتبر است" });
    }

    if (filters.endDate && Number.isNaN(filters.endDate.getTime())) {
      return res.status(400).json({ error: "endDate نامعتبر است" });
    }

    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      return res.status(400).json({ error: "بازه زمانی نامعتبر است" });
    }

    const payments = await storage.getPartnerCommissionPaymentsFiltered(filters);

    const summary = payments.reduce(
      (acc, payment) => {
        const amount = Number(payment.amount ?? 0);
        acc.totalAmount += Number.isFinite(amount) ? amount : 0;
        return acc;
      },
      { totalAmount: 0 }
    );

    res.json({
      data: payments,
      count: payments.length,
      summary
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "پارامترهای نامعتبر", details: error.flatten() });
    }
    console.error("❌ Error in GET /api/sales-partners/payments:", error);
    res.status(500).json({
      error: "خطا در دریافت رویدادهای پورسانت",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.get("/:partnerId", async (req: Request, res: Response) => {
  try {
    const { partnerId } = partnerIdParamSchema.parse(req.params);
    const partner = await storage.getSalesPartner(partnerId);

    if (!partner) {
      return res.status(404).json({
        error: "همکار فروش یافت نشد",
        message: `همکار فروش با شناسه ${partnerId} در سیستم موجود نیست`
      });
    }

    res.json(partner);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "شناسه نامعتبر است" });
    }
    console.error("❌ Error in GET /api/sales-partners/:partnerId:", error);
    res.status(500).json({
      error: "خطا در دریافت اطلاعات همکار فروش",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const payload = insertSalesPartnerSchema.parse(req.body);
    const created = await storage.createSalesPartner(payload);
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "داده نامعتبر است",
        details: error.flatten()
      });
    }
    console.error("❌ Error in POST /api/sales-partners:", error);
    res.status(500).json({
      error: "خطا در ایجاد همکار فروش",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.put("/:partnerId", async (req: Request, res: Response) => {
  try {
    const { partnerId } = partnerIdParamSchema.parse(req.params);
    const payload = updateSalesPartnerSchema.parse(req.body);

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: "هیچ داده‌ای برای به‌روزرسانی ارسال نشده است" });
    }

    const updated = await storage.updateSalesPartner(partnerId, payload);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "داده نامعتبر است",
        details: error.flatten()
      });
    }
    console.error("❌ Error in PUT /api/sales-partners/:partnerId:", error);
    res.status(500).json({
      error: "خطا در به‌روزرسانی همکار فروش",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.delete("/:partnerId", async (req: Request, res: Response) => {
  try {
    const { partnerId } = partnerIdParamSchema.parse(req.params);
    await storage.deleteSalesPartner(partnerId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "شناسه نامعتبر است" });
    }
    console.error("❌ Error in DELETE /api/sales-partners/:partnerId:", error);
    res.status(500).json({
      error: "خطا در حذف همکار فروش",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Commission Payments
router.get("/:partnerId/payments", async (req: Request, res: Response) => {
  try {
    const { partnerId } = partnerIdParamSchema.parse(req.params);
    const payments = await storage.getPartnerCommissionPayments(partnerId);
    res.json({ data: payments, count: payments.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "شناسه نامعتبر است" });
    }
    console.error("❌ Error in GET /api/sales-partners/:partnerId/payments:", error);
    res.status(500).json({
      error: "خطا در دریافت پرداخت‌های کمیسیون",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/:partnerId/payments", async (req: Request, res: Response) => {
  try {
    const { partnerId } = partnerIdParamSchema.parse(req.params);
    const createdBy = (req.body?.createdBy ?? (req.session as any)?.user?.username) ?? "SYSTEM";

    const payload = insertPartnerCommissionPaymentSchema.parse({
      ...req.body,
      salesPartnerId: partnerId,
      createdBy
    });

    const createdPayment = await storage.createPartnerCommissionPayment(payload);

    res.status(201).json(createdPayment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "داده نامعتبر است",
        details: error.flatten()
      });
    }
    console.error("❌ Error in POST /api/sales-partners/:partnerId/payments:", error);
    res.status(500).json({
      error: "خطا در ثبت پرداخت کمیسیون",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.put("/:partnerId/payments/:paymentId", async (req: Request, res: Response) => {
  try {
    const { partnerId, paymentId } = partnerPaymentIdParamSchema.parse(req.params);
    if (req.body?.salesPartnerId && Number(req.body.salesPartnerId) !== partnerId) {
      return res.status(400).json({ error: "تغییر salesPartnerId مجاز نیست" });
    }

    const payload: UpdateCommissionPaymentPayload = updateCommissionPaymentSchema.parse(req.body);

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: "هیچ داده‌ای برای به‌روزرسانی ارسال نشده است" });
    }

    // کنترل transition وضعیت
    if (payload.status) {
      const allowed = ['pending','paid','cancelled'];
      if (!allowed.includes(payload.status as string)) {
        return res.status(400).json({ error: 'وضعیت ارسالی نامعتبر است' });
      }
      // سیاست: جلوگیری از بازگشت از paid یا cancelled به pending / تغییر بین paid و cancelled
      const existingList = await storage.getPartnerCommissionPaymentsFiltered({});
      const existing = existingList.find(p => p.id === paymentId);
      if (!existing) {
        return res.status(404).json({ error: 'پرداخت یافت نشد' });
      }
      const currentStatus = (existing as any).status || 'pending';
      if (currentStatus !== 'pending' && payload.status !== currentStatus) {
        return res.status(400).json({ error: 'تغییر وضعیت پس از خروج از pending مجاز نیست' });
      }
    }

    const updatedPayment = await storage.updatePartnerCommissionPayment(paymentId, payload);

    res.json(updatedPayment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "داده نامعتبر است",
        details: error.flatten()
      });
    }
    console.error("❌ Error in PUT /api/sales-partners/:partnerId/payments/:paymentId:", error);
    res.status(500).json({
      error: "خطا در به‌روزرسانی پرداخت کمیسیون",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.delete("/:partnerId/payments/:paymentId", async (req: Request, res: Response) => {
  try {
    partnerPaymentIdParamSchema.parse(req.params);
    const paymentId = Number(req.params.paymentId);

    await storage.deletePartnerCommissionPayment(paymentId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "شناسه نامعتبر است" });
    }
    console.error("❌ Error in DELETE /api/sales-partners/:partnerId/payments/:paymentId:", error);
    res.status(500).json({
      error: "خطا در حذف پرداخت کمیسیون",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Partial Settlement Endpoint
router.post('/:partnerId/payments/:paymentId/partial-settlement', async (req: Request, res: Response) => {
  try {
    const { partnerId, paymentId } = partnerPaymentIdParamSchema.parse(req.params);
    const body = partialSettlementBodySchema.parse(req.body);

    // بازیابی برای اعتبار همخوانی مالکیت (اختیاری: می‌توان حذف کرد اگر applyPartialSettlement تضمین کند)
    // (در این نسخه ساده به storage بسنده می‌کنیم)
    const result = await storage.applyPartialSettlement(paymentId, body.amount, body.note, (req.session as any)?.user?.username);

    if (result.salesPartnerId !== partnerId) {
      return res.status(400).json({ error: 'شناسه همکار با پرداخت تطابق ندارد' });
    }

    res.status(200).json({
      data: result,
      remaining: result.remaining
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'داده نامعتبر', details: error.flatten() });
    }
    console.error('❌ Error in POST /api/sales-partners/:partnerId/payments/:paymentId/partial-settlement:', error);
    res.status(500).json({
      error: 'خطا در تسویه جزئی پرداخت',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;