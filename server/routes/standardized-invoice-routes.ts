/**
 * SHERLOCK v18.4 - Standardized Invoice Routes
 * مسیرهای استاندارد برای پردازش فاکتورها - جایگزین تمام endpoint های قدیمی
 */

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  parseStandardJsonData, 
  validateStandardUsageData, 
  processStandardUsageData,
  StandardProcessedInvoice
} from '../services/standardized-invoice-engine.js';

const upload = multer({ storage: multer.memoryStorage() });

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

/**
 * UNIFIED Invoice Generation Endpoint
 * یک endpoint واحد برای تمام نیازهای ایجاد فاکتور
 */
export function registerStandardizedInvoiceRoutes(app: any, requireAuth: any, storage: any) {

  /**
   * POST /api/invoices/generate-standard
   * Endpoint استاندارد برای ایجاد فاکتور از JSON
   */
  app.post("/api/invoices/generate-standard", requireAuth, upload.single('usageFile'), async (req: MulterRequest, res: Response) => {
    try {
      console.log('🚀 SHERLOCK v18.4: STANDARDIZED Invoice Generation Started');

      // بررسی فایل
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: "فایل JSON ارسال نشده است" 
        });
      }

      // استخراج پارامترها
      const { 
        batchName, 
        periodStart, 
        periodEnd, 
        description, 
        invoiceDateMode, 
        customInvoiceDate 
      } = req.body;

      console.log('📋 Batch Parameters:', { batchName, periodStart, periodEnd, description });
      console.log('📅 Date Configuration:', { invoiceDateMode, customInvoiceDate });

      // پردازش JSON با engine استاندارد
      const jsonData = req.file.buffer.toString('utf-8');
      console.log('📄 Processing JSON file:', {
        name: req.file.originalname,
        size: req.file.size,
        dataLength: jsonData.length
      });

      // Parse استاندارد
      const usageRecords = parseStandardJsonData(jsonData);
      console.log(`📊 Parsed ${usageRecords.length} usage records`);

      // Validation استاندارد
      const { valid, invalid } = validateStandardUsageData(usageRecords);

      console.log(`✅ Validation Results: ${valid.length} valid, ${invalid.length} invalid`);

      if (valid.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: "هیچ رکورد معتبری یافت نشد", 
          details: {
            totalRecords: usageRecords.length,
            invalidSample: invalid.slice(0, 3)
          }
        });
      }

      // ایجاد batch (اختیاری)
      let currentBatch = null;
      if (batchName && periodStart && periodEnd) {
        console.log('🗂️ Creating invoice batch...');
        const batchCode = await storage.generateBatchCode(periodStart);

        currentBatch = await storage.createInvoiceBatch({
          batchName,
          batchCode,
          periodStart,
          periodEnd,
          description: description || `Standardized upload: ${req.file.originalname}`,
          status: 'processing',
          uploadedBy: (req.session as any)?.user?.username || 'admin',
          uploadedFileName: req.file.originalname
        });

        console.log('✅ Batch created:', currentBatch.id);
      }

      // تنظیم تاریخ فاکتور
      const invoiceDate = invoiceDateMode === 'custom' && customInvoiceDate 
        ? customInvoiceDate.trim()
        : null;

      // پردازش استاندارد
  const processedInvoices = processStandardUsageData(valid, invoiceDate);
      console.log(`🔄 Processed ${processedInvoices.length} invoices`);

      // ایجاد فاکتورها در دیتابیس
      const createdInvoices = [];
      const newRepresentatives = [];
  const affectedSalesPartnerIds = new Set<number>();

      for (const processedInvoice of processedInvoices) {
        try {
          // جستجو یا ایجاد نماینده
          let representative = await storage.getRepresentativeByPanelUsername(processedInvoice.representativeCode) ||
                             await storage.getRepresentativeByCode(processedInvoice.representativeCode);

          if (!representative) {
            console.log(`➕ Creating new representative: ${processedInvoice.representativeCode}`);

            // ایجاد نماینده جدید با defaultSalesPartner
            const { db } = await import("../db.js");
            const defaultSalesPartnerId = await getOrCreateDefaultSalesPartner(db);

            const newRepData = {
              name: `فروشگاه ${processedInvoice.representativeCode}`,
              code: processedInvoice.representativeCode,
              panelUsername: processedInvoice.representativeCode,
              publicId: generatePublicId(processedInvoice.representativeCode),
              salesPartnerId: defaultSalesPartnerId,
              isActive: true
            };

            representative = await storage.createRepresentative(newRepData);
            newRepresentatives.push(representative);
          }

          if (representative.salesPartnerId != null) {
            affectedSalesPartnerIds.add(representative.salesPartnerId);
          }

          // ایجاد فاکتور
          console.log(`📝 Creating invoice for: ${representative.name}`);

          const invoice = await storage.createInvoice({
            representativeId: representative.id,
            batchId: currentBatch ? currentBatch.id : null,
            amount: processedInvoice.amount.toString(),
            issueDate: processedInvoice.issueDate,
            dueDate: processedInvoice.dueDate,
            status: "unpaid",
            usageData: processedInvoice.usageData
          });

          createdInvoices.push(invoice);

          // بروزرسانی اطلاعات مالی نماینده
          await storage.updateRepresentativeFinancials(representative.id);

          // Create portal link for this invoice
          const publicId = generatePublicId(processedInvoice.representativeCode);
          const baseUrl = process.env.NODE_ENV === 'production' 
            ? (process.env.REPL_SLUG 
                ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
                : `${req.protocol}://${req.get('host')}`)
            : `${req.protocol}://${req.get('host')}`;

          const portalLink = `${baseUrl}/portal/${publicId}`;
          console.log(`🔗 SHERLOCK v32.0: Generated portal link: ${portalLink}`);


        } catch (error) {
          console.error(`❌ Error processing invoice for ${processedInvoice.representativeCode}:`, error);
        }
      }

      // بروزرسانی اطلاعات مالی شرکای فروش تحت تأثیر
      for (const partnerId of affectedSalesPartnerIds) {
        try {
          await storage.recalculateSalesPartnerFinancials(partnerId);
        } catch (partnerError) {
          console.error(`⚠️ خطا در محاسبه مجدد شریک فروش ${partnerId}:`, partnerError);
        }
      }

      // بروزرسانی وضعیت batch
      if (currentBatch) {
        await storage.updateInvoiceBatch(currentBatch.id, {
          status: 'completed',
          totalInvoices: createdInvoices.length,
          totalAmount: createdInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0),
          completedAt: new Date()
        });
      }

      // پاسخ موفقیت‌آمیز
      const response = {
        success: true,
        message: `${createdInvoices.length} فاکتور با موفقیت ایجاد شد`,
        data: {
          createdInvoices: createdInvoices.length,
          newRepresentatives: newRepresentatives.length,
          batchId: currentBatch?.id,
          totalAmount: createdInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0),
          statistics: {
            totalRecords: valid.length,
            processedInvoices: processedInvoices.length,
            successfulInvoices: createdInvoices.length
          }
        }
      };

      console.log('✅ STANDARDIZED Invoice Generation Completed Successfully');
      res.json(response);

    } catch (error) {
      console.error('💥 STANDARDIZED Invoice Generation Error:', error);
      res.status(500).json({ 
        success: false,
        error: "خطا در پردازش فایل JSON",
        details: (error as Error).message 
      });
    }
  });

  console.log('✅ Standardized Invoice Routes Registered');
}

/**
 * Helper functions
 */
async function getOrCreateDefaultSalesPartner(db: any): Promise<number> {
  const { salesPartners } = await import("../../shared/schema.js");
  const { eq } = await import("drizzle-orm");

  try {
    const existing = await db
      .select()
      .from(salesPartners)
      .where(eq(salesPartners.name, 'Default Partner'))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    const [newPartner] = await db
      .insert(salesPartners)
      .values({
        name: 'Default Partner',
        isActive: true
      })
      .returning();

    return newPartner.id;
  } catch (error) {
    console.error('Error with sales partner:', error);
    return 1; // fallback
  }
}

function generatePublicId(adminUsername: string): string {
  return adminUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
}