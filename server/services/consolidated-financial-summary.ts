/**
 * E-B7 Financial Summary Consolidated Query Service
 * Single Query Implementation for Dashboard Financial Summary
 * 
 * هدف: کاهش تعداد رندر/کوئری ≤ 50% نسبت به baseline قبلی
 * KPI: P95 بارگذاری پنل خلاصه < 120ms؛ بدون اختلاف در ارقام (Diff=0)
 */

import { db } from '../database-manager.js';
import { sql } from 'drizzle-orm';

export interface ConsolidatedDashboardData {
  totalRevenue: number;
  totalDebt: number;
  totalCredit: number;
  totalOutstanding: number;
  totalRepresentatives: number;
  activeRepresentatives: number;
  inactiveRepresentatives: number;
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  totalPayments: number;
  totalPaymentAmount: number;
  unallocatedPaymentAmount: number;
  // D-01 Fix: New metrics for accurate dashboard display
  unsentTelegramInvoices: number;
  totalSalesPartners: number;
  activeSalesPartners: number;
  // D-02 Fix: Enhanced system integrity score with guard metrics
  systemIntegrityScore: number;
  debtScore?: number;
  criticalEventsLastHour?: number;
  warnEventsLastHour?: number;
  lastUpdated: string;
  queryTimeMs: number;
  cacheStatus: 'HEALTHY' | 'STALE' | 'UNAVAILABLE';
}

/**
 * Consolidated Financial Summary Service
 * Replaces multiple separate queries with a single optimized query
 */
export class ConsolidatedFinancialSummaryService {
  
  /**
   * Execute single consolidated query for all dashboard metrics
   * 
   * استراتژی: استفاده از CTE و JOIN برای یک کوئری واحد
   * Performance Target: < 120ms P95
   */
  static async calculateConsolidatedSummary(): Promise<ConsolidatedDashboardData> {
    const startTime = performance.now();
    
    try {
      // Single consolidated query using CTEs for all dashboard metrics
      const result = await db.execute(sql`
        WITH 
        -- CTE 1: Representative Summary
        rep_summary AS (
          SELECT 
            COUNT(*) as total_representatives,
            SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_representatives,
            SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as inactive_representatives
          FROM representatives
        ),
        
        -- CTE 2: Invoice Summary
        invoice_summary AS (
          SELECT 
            COUNT(*) as total_invoices,
            SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_invoices,
            SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_invoices,
            SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_invoices,
            COALESCE(SUM(CAST(amount as DECIMAL)), 0) as total_invoice_amount,
            COALESCE(SUM(CASE WHEN status IN ('unpaid', 'overdue') THEN CAST(amount as DECIMAL) ELSE 0 END), 0) as outstanding_amount
          FROM invoices
        ),
        
        -- CTE 3: Payment Summary
        payment_summary AS (
          SELECT 
            COUNT(*) as total_payments,
            COALESCE(SUM(CASE WHEN amount_dec IS NOT NULL THEN amount_dec ELSE NULLIF(regexp_replace(amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END), 0) as total_payment_amount,
            COALESCE(SUM(CASE WHEN is_allocated = true THEN CASE WHEN amount_dec IS NOT NULL THEN amount_dec ELSE NULLIF(regexp_replace(amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END ELSE 0 END), 0) as allocated_payment_amount,
            COALESCE(SUM(CASE WHEN is_allocated = false THEN CASE WHEN amount_dec IS NOT NULL THEN amount_dec ELSE NULLIF(regexp_replace(amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END ELSE 0 END), 0) as unallocated_payment_amount
          FROM payments
        ),
        
        -- CTE 4: Debt Calculation per Representative
        debt_calculation AS (
          SELECT 
            r.id as representative_id,
            COALESCE(SUM(CAST(i.amount as DECIMAL)), 0) as total_invoices,
            COALESCE(SUM(CASE WHEN p.is_allocated = true THEN CASE WHEN p.amount_dec IS NOT NULL THEN p.amount_dec ELSE NULLIF(regexp_replace(p.amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END ELSE 0 END), 0) as total_allocated_payments,
            GREATEST(0, 
              COALESCE(SUM(CAST(i.amount as DECIMAL)), 0) - 
              COALESCE(SUM(CASE WHEN p.is_allocated = true THEN CASE WHEN p.amount_dec IS NOT NULL THEN p.amount_dec ELSE NULLIF(regexp_replace(p.amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END ELSE 0 END), 0)
            ) as representative_debt
          FROM representatives r
          LEFT JOIN invoices i ON r.id = i.representative_id
          LEFT JOIN payments p ON r.id = p.representative_id
          WHERE r.is_active = true
          GROUP BY r.id
        ),
        
        -- CTE 5: System Totals
        system_totals AS (
          SELECT 
            COALESCE(SUM(representative_debt), 0) as total_system_debt,
            COUNT(*) as active_debt_representatives
          FROM debt_calculation
        ),
        
        -- CTE 6: Telegram Unsent Invoices (D-01 Fix)
        telegram_summary AS (
          SELECT 
            COUNT(*) as unsent_telegram_invoices
          FROM invoices
          WHERE sent_to_telegram = false
        ),
        
        -- CTE 7: Active Sales Partners (D-01 Fix)
        sales_partners_summary AS (
          SELECT 
            COUNT(*) as total_sales_partners,
            COUNT(*) FILTER (WHERE is_active = true) as active_sales_partners
          FROM sales_partners
        )
        
        -- Final SELECT combining all CTEs
        SELECT 
          -- Revenue metrics
          ps.allocated_payment_amount as total_revenue,
          
          -- Debt metrics  
          st.total_system_debt as total_debt,
          
          -- Credit and outstanding (simplified)
          ps.unallocated_payment_amount as total_credit,
          ist.outstanding_amount as total_outstanding,
          
          -- Representative metrics
          rs.total_representatives,
          rs.active_representatives,
          rs.inactive_representatives,
          
          -- Invoice metrics
          ist.total_invoices,
          ist.paid_invoices,
          ist.unpaid_invoices,
          ist.overdue_invoices,
          
          -- Payment metrics
          ps.total_payments,
          ps.total_payment_amount,
          ps.unallocated_payment_amount,
          
          -- D-01 Fix: Telegram & Sales Partners metrics
          ts.unsent_telegram_invoices,
          sps.total_sales_partners,
          sps.active_sales_partners,
          
          -- D-02 Fix: System health with guard metrics consideration
          -- Base score from debt ratio
          CASE 
            WHEN st.total_system_debt = 0 THEN 100
            WHEN st.total_system_debt < 1000000 THEN 90
            WHEN st.total_system_debt < 5000000 THEN 75
            ELSE 60
          END as debt_score,
          
          -- Critical events penalty (from guard_metrics_events in last hour)
          (SELECT COUNT(*) 
           FROM guard_metrics_events 
           WHERE level = 'critical' 
           AND created_at >= NOW() - INTERVAL '1 hour') as critical_events_last_hour,
           
          -- Warning events count
          (SELECT COUNT(*) 
           FROM guard_metrics_events 
           WHERE level = 'warn' 
           AND created_at >= NOW() - INTERVAL '1 hour') as warn_events_last_hour
          
        FROM rep_summary rs
        CROSS JOIN invoice_summary ist
        CROSS JOIN payment_summary ps
        CROSS JOIN system_totals st
        CROSS JOIN telegram_summary ts
        CROSS JOIN sales_partners_summary sps
      `);

      const endTime = performance.now();
      const queryTimeMs = Math.round(endTime - startTime);

      // Extract results from the single row
      const row = (result as any).rows[0];
      
      if (!row) {
        throw new Error('No data returned from consolidated query');
      }

      // D-02 Fix: Calculate system integrity score from debt + guard metrics
      const debtScore = Number(row.debt_score) || 0;
      const criticalEvents = Number(row.critical_events_last_hour) || 0;
      const warnEvents = Number(row.warn_events_last_hour) || 0;
      
      // System Integrity Score Algorithm:
      // Start with debt score, then apply penalties for guard metrics events
      let systemIntegrityScore = debtScore;
      systemIntegrityScore -= (criticalEvents * 5); // Each critical event: -5 points
      systemIntegrityScore -= (warnEvents * 2);      // Each warning event: -2 points
      systemIntegrityScore = Math.max(0, Math.min(100, systemIntegrityScore)); // Clamp 0-100

      const consolidatedData: ConsolidatedDashboardData = {
        totalRevenue: Number(row.total_revenue) || 0,
        totalDebt: Number(row.total_debt) || 0,
        totalCredit: Number(row.total_credit) || 0,
        totalOutstanding: Number(row.total_outstanding) || 0,
        totalRepresentatives: Number(row.total_representatives) || 0,
        activeRepresentatives: Number(row.active_representatives) || 0,
        inactiveRepresentatives: Number(row.inactive_representatives) || 0,
        totalInvoices: Number(row.total_invoices) || 0,
        paidInvoices: Number(row.paid_invoices) || 0,
        unpaidInvoices: Number(row.unpaid_invoices) || 0,
        overdueInvoices: Number(row.overdue_invoices) || 0,
        totalPayments: Number(row.total_payments) || 0,
        totalPaymentAmount: Number(row.total_payment_amount) || 0,
        unallocatedPaymentAmount: Number(row.unallocated_payment_amount) || 0,
        // D-01 Fix: Map new fields from query results
        unsentTelegramInvoices: Number(row.unsent_telegram_invoices) || 0,
        totalSalesPartners: Number(row.total_sales_partners) || 0,
        activeSalesPartners: Number(row.active_sales_partners) || 0,
        // D-02 Fix: Enhanced system integrity score
        systemIntegrityScore,
        debtScore,
        criticalEventsLastHour: criticalEvents,
        warnEventsLastHour: warnEvents,
        lastUpdated: new Date().toISOString(),
        queryTimeMs,
        cacheStatus: queryTimeMs < 120 ? 'HEALTHY' : queryTimeMs < 300 ? 'STALE' : 'UNAVAILABLE'
      };

      console.log(`✅ Consolidated query completed in ${queryTimeMs}ms`);
      return consolidatedData;

    } catch (error) {
      const endTime = performance.now();
      const queryTimeMs = Math.round(endTime - startTime);
      
      console.error(`❌ Consolidated query failed after ${queryTimeMs}ms:`, error);
      throw new Error(`Consolidated financial summary query failed: ${error.message}`);
    }
  }

  /**
   * Legacy method for comparison testing
   * Simulates the old multi-query approach for performance comparison
   */
  static async calculateLegacySummary(): Promise<{
    data: ConsolidatedDashboardData;
    queryCount: number;
    totalTimeMs: number;
  }> {
    const startTime = performance.now();
    let queryCount = 0;

    try {
      // Query 1: Representatives
      queryCount++;
      const repsResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active
        FROM representatives
      `);

      // Query 2: Invoices
      queryCount++;
      const invoicesResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
          SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid,
          SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
          COALESCE(SUM(CAST(amount as DECIMAL)), 0) as total_amount
        FROM invoices
      `);

      // Query 3: Payments
      queryCount++;
      const paymentsResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN amount_dec IS NOT NULL THEN amount_dec ELSE NULLIF(regexp_replace(amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END), 0) as total_amount,
          COALESCE(SUM(CASE WHEN is_allocated = true THEN CASE WHEN amount_dec IS NOT NULL THEN amount_dec ELSE NULLIF(regexp_replace(amount, '[^0-9.-]', '', 'g'), '')::DECIMAL END ELSE 0 END), 0) as allocated_amount
        FROM payments
      `);

      // Query 4: Debt calculation (simplified)
      queryCount++;
      const debtResult = await db.execute(sql`
        SELECT COALESCE(SUM(total_debt::DECIMAL), 0) as total_debt
        FROM representatives 
        WHERE is_active = true
      `);

      const endTime = performance.now();
      const totalTimeMs = Math.round(endTime - startTime);

      // Simulate legacy data structure
      const reps = (repsResult as any).rows[0];
      const invoices = (invoicesResult as any).rows[0];
      const payments = (paymentsResult as any).rows[0];
      const debt = (debtResult as any).rows[0];

      // Query for Telegram and Sales Partners for legacy fallback
      const telegramResult = await db.execute(sql`SELECT COUNT(*) as unsent FROM invoices WHERE sent_to_telegram = false`);
      const salesPartnersResult = await db.execute(sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active FROM sales_partners`);
      const telegram = (telegramResult as any).rows[0];
      const salesPartners = (salesPartnersResult as any).rows[0];
      
      // D-02 Fix: Calculate system integrity for legacy fallback too
      const legacyDebtScore = Number(debt?.total_debt) === 0 ? 100 : 
                               Number(debt?.total_debt) < 1000000 ? 90 :
                               Number(debt?.total_debt) < 5000000 ? 75 : 60;

      const legacyData: ConsolidatedDashboardData = {
        totalRevenue: Number(payments?.allocated_amount) || 0,
        totalDebt: Number(debt?.total_debt) || 0,
        totalCredit: Number(payments?.total_amount) - Number(payments?.allocated_amount) || 0,
        totalOutstanding: Number(invoices?.total_amount) || 0,
        totalRepresentatives: Number(reps?.total) || 0,
        activeRepresentatives: Number(reps?.active) || 0,
        inactiveRepresentatives: Number(reps?.total) - Number(reps?.active) || 0,
        totalInvoices: Number(invoices?.total) || 0,
        paidInvoices: Number(invoices?.paid) || 0,
        unpaidInvoices: Number(invoices?.unpaid) || 0,
        overdueInvoices: Number(invoices?.overdue) || 0,
        totalPayments: Number(payments?.total) || 0,
        totalPaymentAmount: Number(payments?.total_amount) || 0,
        unallocatedPaymentAmount: Number(payments?.total_amount) - Number(payments?.allocated_amount) || 0,
        // D-01 Fix: Add new fields to legacy fallback
        unsentTelegramInvoices: Number(telegram?.unsent) || 0,
        totalSalesPartners: Number(salesPartners?.total) || 0,
        activeSalesPartners: Number(salesPartners?.active) || 0,
        // D-02 Fix: System integrity score for fallback
        systemIntegrityScore: legacyDebtScore,
        debtScore: legacyDebtScore,
        lastUpdated: new Date().toISOString(),
        queryTimeMs: totalTimeMs,
        cacheStatus: totalTimeMs < 120 ? 'HEALTHY' : 'STALE'
      };

      return {
        data: legacyData,
        queryCount,
        totalTimeMs
      };

    } catch (error) {
      const endTime = performance.now();
      const totalTimeMs = Math.round(endTime - startTime);
      
      throw new Error(`Legacy summary calculation failed after ${queryCount} queries in ${totalTimeMs}ms: ${error.message}`);
    }
  }

  /**
   * Performance comparison method for E-B7 validation
   */
  static async comparePerformance(): Promise<{
    consolidated: { data: ConsolidatedDashboardData; queryCount: 1; timeMs: number };
    legacy: { data: ConsolidatedDashboardData; queryCount: number; timeMs: number };
    improvement: {
      queryReduction: string;
      timeReduction: string;
      performanceGain: string;
    };
  }> {
    console.log('🔄 Running E-B7 performance comparison...');

    // Test consolidated approach
    const consolidatedStart = performance.now();
    const consolidatedData = await this.calculateConsolidatedSummary();
    const consolidatedTime = Math.round(performance.now() - consolidatedStart);

    // Test legacy approach
    const legacyResult = await this.calculateLegacySummary();

    // Calculate improvements
    const queryReduction = `${Math.round((1 - 1/legacyResult.queryCount) * 100)}%`;
    const timeReduction = consolidatedTime < legacyResult.totalTimeMs 
      ? `${Math.round((1 - consolidatedTime/legacyResult.totalTimeMs) * 100)}%`
      : `+${Math.round((consolidatedTime/legacyResult.totalTimeMs - 1) * 100)}%`;
    const performanceGain = consolidatedTime < legacyResult.totalTimeMs 
      ? `${Math.round(legacyResult.totalTimeMs/consolidatedTime)}x faster`
      : `${Math.round(consolidatedTime/legacyResult.totalTimeMs)}x slower`;

    return {
      consolidated: {
        data: consolidatedData,
        queryCount: 1,
        timeMs: consolidatedTime
      },
      legacy: {
        data: legacyResult.data,
        queryCount: legacyResult.queryCount,
        timeMs: legacyResult.totalTimeMs
      },
      improvement: {
        queryReduction,
        timeReduction,
        performanceGain
      }
    };
  }
}

// Export for use in routes
export default ConsolidatedFinancialSummaryService;