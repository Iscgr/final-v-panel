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

      const normalizedValidRecords = valid.map(record => ({
        ...record,
        admin_username: record.admin_username.trim()
      }));

      const validAdminSet = new Set(normalizedValidRecords.map(record => record.admin_username));
      const invalidRepresentativeMeta = new Map<string, { reasons: Set<string>; count: number }>();

      invalid.forEach(({ record, errors }) => {
        const rawAdmin = typeof record?.admin_username === 'string' ? record.admin_username.trim() : '';
        if (!rawAdmin) {
          return;
        }

        const entry = invalidRepresentativeMeta.get(rawAdmin) ?? { reasons: new Set<string>(), count: 0 };
        errors.forEach(error => entry.reasons.add(error));
        entry.count += 1;
        invalidRepresentativeMeta.set(rawAdmin, entry);
      });

      const invalidOnlyAdminSet = new Set<string>();
      invalidRepresentativeMeta.forEach((_meta, admin) => {
        if (!validAdminSet.has(admin)) {
          invalidOnlyAdminSet.add(admin);
        }
      });

      if (normalizedValidRecords.length === 0) {
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
      const processedInvoices = processStandardUsageData(normalizedValidRecords, invoiceDate);
      console.log(`🔄 Processed ${processedInvoices.length} invoices`);

      const { db } = await import("../db.js");
      const defaultSalesPartnerId = await getOrCreateDefaultSalesPartner(db);

      // ایجاد فاکتورها در دیتابیس
      const createdInvoices = [];
      const newRepresentatives = [];
      const placeholderRepresentatives: Array<{ code: string; reasons: string[]; recordCount: number }> = [];
      const affectedSalesPartnerIds = new Set<number>();

      for (const processedInvoice of processedInvoices) {
        try {
          // جستجو یا ایجاد نماینده
          let representative = await storage.getRepresentativeByPanelUsername(processedInvoice.representativeCode) ||
                             await storage.getRepresentativeByCode(processedInvoice.representativeCode);

          if (!representative) {
            console.log(`➕ Creating new representative: ${processedInvoice.representativeCode}`);

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

      if (invalidOnlyAdminSet.size > 0) {
        console.log(`⚠️ Creating placeholder representatives for ${invalidOnlyAdminSet.size} admin_username(s) with invalid usage totals`);
      }

      for (const adminUsername of invalidOnlyAdminSet) {
        try {
          let representative = await storage.getRepresentativeByPanelUsername(adminUsername) ||
                               await storage.getRepresentativeByCode(adminUsername);

          if (representative) {
            continue;
          }

          console.log(`➕ Creating placeholder representative (no invoice) for: ${adminUsername}`);
          const newRepData = {
            name: `فروشگاه ${adminUsername}`,
            code: adminUsername,
            panelUsername: adminUsername,
            publicId: generatePublicId(adminUsername),
            salesPartnerId: defaultSalesPartnerId,
            isActive: true
          };

          representative = await storage.createRepresentative(newRepData);
          newRepresentatives.push(representative);
          placeholderRepresentatives.push({
            code: adminUsername,
            reasons: Array.from(invalidRepresentativeMeta.get(adminUsername)?.reasons ?? []),
            recordCount: invalidRepresentativeMeta.get(adminUsername)?.count ?? 0
          });

          await storage.updateRepresentativeFinancials(representative.id);

          if (representative.salesPartnerId != null) {
            affectedSalesPartnerIds.add(representative.salesPartnerId);
          } else {
            affectedSalesPartnerIds.add(defaultSalesPartnerId);
          }
        } catch (error) {
          console.error(`❌ Error creating placeholder representative for ${adminUsername}:`, error);
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
            totalRecords: usageRecords.length,
            validRecords: normalizedValidRecords.length,
            invalidRecords: invalid.length,
            invalidOnlyRepresentatives: invalidOnlyAdminSet.size,
            processedInvoices: processedInvoices.length,
            successfulInvoices: createdInvoices.length,
            placeholderRepresentatives: placeholderRepresentatives.length,
            totalUniqueRepresentatives: validAdminSet.size + invalidOnlyAdminSet.size
          },
          placeholderRepresentatives
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