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

export default router;