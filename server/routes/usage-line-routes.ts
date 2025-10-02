import type { Express, Request, Response } from 'express';
import { db } from '../db.js';
import { paymentAllocations, payments, invoices } from '@shared/schema';
import { sql, eq, and, desc, isNull, isNotNull } from 'drizzle-orm';
import { featureFlagManager } from '../services/feature-flag-manager.js';

/**
 * E-B6: Usage Line Visibility & Audit Routes
 * شفاف‌سازی کامل خطوط تخصیص/مصرف (usage lines) برای هر پرداخت و فاکتور.
 * 
 * Endpoints:
 * - GET /api/allocations/lines?representative=X&limit=200&filter=synthetic|manual|auto
 * - GET /api/allocations/lines/payment/:paymentId  
 * - GET /api/allocations/lines/invoice/:invoiceId
 */
export function registerUsageLineRoutes(app: Express, authMiddleware: any) {
  
  // Main usage lines endpoint with filtering
  app.get('/api/allocations/lines', authMiddleware, async (req: Request, res: Response) => {
    try {
      // Check feature flag
      const flagState = featureFlagManager.getMultiStageFlagState('usage_line_visibility');
      if (flagState === 'off') {
        return res.status(501).json({ 
          success: false, 
          error: 'Usage line visibility feature is disabled',
          flag: 'usage_line_visibility=off'
        });
      }

      // Parse query parameters  
      const representativeId = req.query.representative ? parseInt(req.query.representative as string) : undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 200, 200); // Max 200 per spec
      const filter = (req.query.filter as string) || 'all'; // synthetic|manual|auto|all

      console.log(`🔍 E-B6: Fetching usage lines - representative: ${representativeId}, filter: ${filter}, limit: ${limit}`);

      // Build where conditions
      let whereConditions = [];
      
      // Representative filter (via payment or invoice)
      if (representativeId) {
        whereConditions.push(sql`(p.representative_id = ${representativeId} OR i.representative_id = ${representativeId})`);
      }

      // Method filter
      if (filter === 'synthetic') {
        whereConditions.push(eq(paymentAllocations.synthetic, true));
      } else if (filter === 'manual') {
        whereConditions.push(and(
          eq(paymentAllocations.synthetic, false),
          eq(paymentAllocations.method, 'manual')
        ));
      } else if (filter === 'auto') {
        whereConditions.push(and(
          eq(paymentAllocations.synthetic, false),
          eq(paymentAllocations.method, 'auto')
        ));
      }

      // Execute query with joins
      const query = sql`
        SELECT 
          pa.id,
          pa.payment_id,
          pa.invoice_id,
          pa.allocated_amount,
          pa.method,
          pa.synthetic,
          pa.idempotency_key,
          pa.performed_by,
          pa.created_at,
          p.amount as payment_amount,
          p.payment_date,
          p.representative_id as payment_representative_id,
          i.amount as invoice_amount,
          i.invoice_number,
          i.representative_id as invoice_representative_id,
          i.status as invoice_status
        FROM payment_allocations pa
        LEFT JOIN payments p ON pa.payment_id = p.id  
        LEFT JOIN invoices i ON pa.invoice_id = i.id
        ${whereConditions.length > 0 ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}` : sql``}
        ORDER BY pa.created_at DESC, pa.id DESC
        LIMIT ${limit}
      `;

      const result = await db.execute(query);
      const lines = (result as any).rows || [];

      // Calculate summary stats
      const totalLines = lines.length;
      const syntheticCount = lines.filter((l: any) => l.synthetic).length;
      const manualCount = lines.filter((l: any) => !l.synthetic && l.method === 'manual').length;
      const autoCount = lines.filter((l: any) => !l.synthetic && l.method === 'auto').length;
      const totalAmount = lines.reduce((sum: number, l: any) => sum + parseFloat(l.allocated_amount || 0), 0);

      res.json({
        success: true,
        data: {
          lines,
          summary: {
            total: totalLines,
            synthetic: syntheticCount,
            manual: manualCount,  
            auto: autoCount,
            totalAmount: totalAmount.toFixed(2)
          },
          filters: {
            representative: representativeId,
            filter,
            limit
          },
          meta: {
            maxLimit: 200,
            hasMore: totalLines === limit,
            timestamp: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('❌ Error fetching usage lines:', error);
      res.status(500).json({
        success: false,
        error: 'خطا در دریافت خطوط تخصیص'
      });
    }
  });

  // Usage lines for specific payment
  app.get('/api/allocations/lines/payment/:paymentId', authMiddleware, async (req: Request, res: Response) => {
    try {
      const flagState = featureFlagManager.getMultiStageFlagState('usage_line_visibility');
      if (flagState === 'off') {
        return res.status(501).json({ 
          success: false, 
          error: 'Usage line visibility feature is disabled'
        });
      }

      const paymentId = parseInt(req.params.paymentId);
      
      const query = sql`
        SELECT 
          pa.id,
          pa.payment_id,
          pa.invoice_id,
          pa.allocated_amount,
          pa.method,
          pa.synthetic,
          pa.created_at,
          i.invoice_number,
          i.amount as invoice_amount,
          i.status as invoice_status
        FROM payment_allocations pa
        LEFT JOIN invoices i ON pa.invoice_id = i.id
        WHERE pa.payment_id = ${paymentId}
        ORDER BY pa.created_at DESC
      `;

      const result = await db.execute(query);
      const lines = (result as any).rows || [];

      res.json({
        success: true,
        data: {
          paymentId,
          lines,
          count: lines.length,
          totalAllocated: lines.reduce((sum: number, l: any) => sum + parseFloat(l.allocated_amount || 0), 0).toFixed(2)
        }
      });

    } catch (error) {
      console.error('❌ Error fetching payment usage lines:', error);
      res.status(500).json({
        success: false,
        error: 'خطا در دریافت خطوط تخصیص پرداخت'
      });
    }
  });

  // Usage lines for specific invoice
  app.get('/api/allocations/lines/invoice/:invoiceId', authMiddleware, async (req: Request, res: Response) => {
    try {
      const flagState = featureFlagManager.getMultiStageFlagState('usage_line_visibility');
      if (flagState === 'off') {
        return res.status(501).json({ 
          success: false, 
          error: 'Usage line visibility feature is disabled'
        });
      }

      const invoiceId = parseInt(req.params.invoiceId);
      
      const query = sql`
        SELECT 
          pa.id,
          pa.payment_id,
          pa.invoice_id,
          pa.allocated_amount,
          pa.method,
          pa.synthetic,
          pa.created_at,
          p.amount as payment_amount,
          p.payment_date
        FROM payment_allocations pa
        LEFT JOIN payments p ON pa.payment_id = p.id
        WHERE pa.invoice_id = ${invoiceId}
        ORDER BY pa.created_at DESC
      `;

      const result = await db.execute(query);
      const lines = (result as any).rows || [];

      res.json({
        success: true,
        data: {
          invoiceId,
          lines,
          count: lines.length,
          totalAllocated: lines.reduce((sum: number, l: any) => sum + parseFloat(l.allocated_amount || 0), 0).toFixed(2)
        }
      });

    } catch (error) {
      console.error('❌ Error fetching invoice usage lines:', error);
      res.status(500).json({
        success: false,
        error: 'خطا در دریافت خطوط تخصیص فاکتور'
      });
    }
  });

  console.log('✅ E-B6: Usage Line Visibility routes registered');
}