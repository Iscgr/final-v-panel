
/**
 * SHERLOCK v34.1: Payment Management Router
 * ATOMOS COMPLIANT - Enhanced payment allocation management
 */

import { Router } from 'express';
import { storage } from '../storage.js';
import { unifiedAuthMiddleware } from '../middleware/unified-auth.js';
import { featureFlagManager } from '../services/feature-flag-manager.js';
import { AllocationService } from '../services/allocation-service.js';
import { db } from '../database-manager.js';
import { payments as paymentsTable, invoices as invoicesTable, paymentAllocations } from '@shared/schema';
import { sql, eq } from 'drizzle-orm';

export const paymentManagementRouter = Router();
export const requireAuth = unifiedAuthMiddleware;

// Apply authentication to all routes
paymentManagementRouter.use(requireAuth);

// Get all payments
paymentManagementRouter.get('/', async (req, res) => {
  try {
    console.log('🔍 SHERLOCK v34.1: Fetching payments with enhanced allocation data');
    
    const payments = await storage.getPayments();
    
    res.json({
      success: true,
      data: payments,
      total: payments.length,
      allocated: payments.filter(p => p.isAllocated).length,
      unallocated: payments.filter(p => !p.isAllocated).length
    });
  } catch (error) {
    console.error('❌ Error fetching payments:', error);
    res.status(500).json({ error: "خطا در دریافت پرداخت‌ها" });
  }
});

// Get unallocated payments for a representative
paymentManagementRouter.get('/unallocated/:representativeId', async (req, res) => {
  try {
    const representativeId = parseInt(req.params.representativeId);
    console.log(`🔍 SHERLOCK v34.1: Fetching unallocated payments for representative ${representativeId}`);
    
    const unallocatedPayments = await storage.getUnallocatedPayments(representativeId);
    
    res.json({
      success: true,
      data: unallocatedPayments,
      representativeId,
      count: unallocatedPayments.length
    });
  } catch (error) {
    console.error('❌ Error fetching unallocated payments:', error);
    res.status(500).json({ error: "خطا در دریافت پرداخت‌های تخصیص نیافته" });
  }
});

// ❌ [ODIN v5.0] AUTO-ALLOCATION REMOVED - Use manual allocation via POST /api/payments
paymentManagementRouter.post('/auto-allocate/:representativeId', async (req, res) => {
  return res.status(410).json({
    error: "Auto-allocation feature has been removed",
    message: "تخصیص خودکار حذف شده است. لطفاً از تخصیص دستی استفاده کنید.",
    deprecatedSince: "2025-10-01",
    alternative: "POST /api/payments with selectedInvoiceNumber parameter for manual allocation"
  });
});

// Manual allocation endpoint
paymentManagementRouter.post('/manual-allocate', async (req, res) => {
  try {
    const { paymentId, invoiceId, amount, reason } = req.body;
    const performedBy = (req.session as any)?.username || 'ADMIN';
    
    console.log(`🎯 SHERLOCK v34.1: Manual allocation - Payment ${paymentId} -> Invoice ${invoiceId}, Amount: ${amount}`);
    
    const result = await storage.manualAllocatePaymentToInvoice(
      paymentId,
      invoiceId,
      amount,
      performedBy,
      reason
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          allocatedAmount: result.allocatedAmount,
          transactionId: result.transactionId
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
    
  } catch (error) {
    console.error('❌ Manual allocation error:', error);
    res.status(500).json({ error: "خطا در تخصیص دستی" });
  }
});

// PHASE B: Partial allocation (shadow ledger) endpoint
paymentManagementRouter.post('/partial-allocate', async (req, res) => {
  try {
    const mode = featureFlagManager.getMultiStageFlagState('allocation_partial_mode');
    if (mode === 'off') {
      return res.status(403).json({ success: false, error: 'Partial allocation feature disabled' });
    }
    const { paymentId, lines } = req.body;
    if (!paymentId || !Array.isArray(lines)) {
      return res.status(400).json({ success: false, error: 'paymentId و lines الزامی است' });
    }
    const performedBy = (req.session as any)?.username || 'ADMIN';
    const result = await AllocationService.allocatePartial(Number(paymentId), lines, performedBy);
    res.json({ success: true, data: result });
  } catch (error:any) {
    console.error('❌ Partial allocate error:', error);
    res.status(400).json({ success: false, error: error.message || 'خطای ناشناخته' });
  }
});

// PHASE B: Candidates for partial allocation (fetch unpaid/partial invoices with remaining)
paymentManagementRouter.get('/partial-candidates/:paymentId', async (req, res) => {
  try {
    const mode = featureFlagManager.getMultiStageFlagState('allocation_partial_mode');
    if (mode === 'off') {
      return res.status(403).json({ success: false, error: 'Partial allocation feature disabled' });
    }
    const paymentId = Number(req.params.paymentId);
    if (!paymentId) return res.status(400).json({ success: false, error: 'paymentId نامعتبر' });

    // دریافت پرداخت برای استخراج representative
    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
    if (!payment) return res.status(404).json({ success: false, error: 'پرداخت پیدا نشد' });
    const representativeId = payment.representativeId;
    if (!representativeId) return res.status(400).json({ success: false, error: 'پرداخت فاقد representative است' });

    // انتخاب فاکتورهای unpaid/partial آن نماینده + محاسبه remaining با aggregate روی payment_allocations
    const rows = await db.execute(sql`
      SELECT i.id, i.amount::DECIMAL AS invoice_amount,
             COALESCE(SUM(pa.allocated_amount),0) AS allocated_sum
      FROM invoices i
      LEFT JOIN payment_allocations pa ON pa.invoice_id = i.id
      WHERE i.representative_id = ${representativeId}
        AND (i.status IN ('unpaid','partial') OR i.status IS NULL)
      GROUP BY i.id, i.amount
      ORDER BY i.issue_date ASC
      LIMIT 200;
    `);
    const candidates = (rows as any).rows.map((r:any) => {
      const allocated = Number(r.allocated_sum || 0);
      const invoiceAmount = Number(r.invoice_amount || 0);
      const remaining = invoiceAmount - allocated;
      return {
        invoiceId: Number(r.id),
        invoiceAmount,
        allocated,
        remaining,
        status: remaining <= 0 ? 'paid' : (remaining < invoiceAmount ? 'partial' : 'unpaid')
      };
    }).filter(c => c.remaining > 0.000001);

    res.json({ success: true, data: { paymentId, representativeId, candidates } });
  } catch (error:any) {
    console.error('❌ Partial candidates error:', error);
    res.status(500).json({ success: false, error: error.message || 'خطا در دریافت فاکتورهای کاندید' });
  }
});

// Get payment allocation summary for a representative
paymentManagementRouter.get('/allocation-summary/:representativeId', async (req, res) => {
  try {
    const representativeId = parseInt(req.params.representativeId);
    
    const summary = await storage.getPaymentAllocationSummary(representativeId);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('❌ Error getting allocation summary:', error);
    res.status(500).json({ error: "خطا در دریافت خلاصه تخصیص" });
  }
});

// ❌ [ODIN v5.0] BATCH AUTO-ALLOCATION ENDPOINTS REMOVED
// The following endpoints were removed as part of auto-allocation system deprecation:
// - POST /batch-allocate/:representativeId (used autoAllocatePaymentToInvoices)
// - GET /allocation-report/:representativeId (statistics for auto-allocation)
// - GET /smart-recommendations/:representativeId (auto-allocation recommendations)
// These endpoints were only used in the deprecated allocation-management.tsx page.

export default paymentManagementRouter;
