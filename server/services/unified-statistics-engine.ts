/**
 * SHERLOCK v18.0 - UNIFIED STATISTICS ENGINE
 * سیستم یکپارچه آمار و ویجت‌های Dashboard
 * 
 * FEATURES:
 * 1. یک منبع واحد برای تمام آمار (Single Source of Truth)
 * 2. Real-time با cache intelligent
 * 3. استفاده از Financial Integrity Engine
 * 4. Performance optimized queries
 * 5. Type-safe interfaces
 */

import { db } from "../db.js";
import { representatives, invoices, payments, salesPartners, activityLogs } from "@shared/schema";
import { sql, eq, and, or, gte, count, desc } from "drizzle-orm";
import { unifiedFinancialEngine } from "./unified-financial-engine.js";

// ========== INTERFACES ========== 

export interface GlobalStatistics {
  // Financial Overview
  totalSales: number;
  totalRevenue: number;
  totalDebt: number;
  totalCredit: number;
  totalOutstanding: number;

  // Representatives
  totalRepresentatives: number;
  activeRepresentatives: number;
  inactiveRepresentatives: number;
  riskRepresentatives: number;

  // Invoices & Payments
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  unsentTelegramInvoices: number;

  // Sales Partners
  totalSalesPartners: number;
  activeSalesPartners: number;

  // System Health
  systemIntegrityScore: number;
  lastReconciliationDate: string;
  problematicRepresentativesCount: number;

  // Performance Metrics
  responseTime: number;
  cacheStatus: 'FRESH' | 'CACHE' | 'STALE';
  lastUpdated: string;
}

export interface RepresentativeStatistics {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  totalSales: number;
  totalDebt: number;
  avgPerformance: number;
  topPerformers: Array<{
    id: number;
    name: string;
    code: string;
    totalSales: number;
    integrityScore: number;
  }>;
  riskAlerts: number;
  lastSyncTime: string;
}

export interface RecentActivity {
  id: number;
  type: 'invoice_created' | 'payment_received' | 'telegram_sent' | 'representative_created' | 'financial_reconciliation';
  description: string;
  relatedId?: number;
  metadata?: any;
  createdAt: string;
}

// ========== UNIFIED STATISTICS ENGINE ========== 

export class UnifiedStatisticsEngine {
  // Enhanced cache for performance optimization with separate cache keys
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes for better performance
  private static readonly HIGH_PRIORITY_CACHE_TTL = 30 * 1000; // 30 seconds for critical data

  /**
   * Helper to get data from cache
   */
  private static getFromCache(key: string): { data: any; timestamp: number; ttl: number } | undefined {
    const cached = UnifiedStatisticsEngine.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      return cached;
    }
    return undefined;
  }

  /**
   * Helper to set data in cache
   */
  private static setToCache(key: string, data: any, ttl: number = UnifiedStatisticsEngine.CACHE_TTL) {
    UnifiedStatisticsEngine.cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  /**
   * دریافت آمار کامل سیستم - Dashboard اصلی
   */
  async getGlobalStatistics(): Promise<GlobalStatistics> {
    const startTime = Date.now();
    const cacheKey = 'global-statistics';

    // Check cache
    const cached = UnifiedStatisticsEngine.getFromCache(cacheKey);
    if (cached) {
      return { 
        ...cached.data, 
        responseTime: Date.now() - startTime,
        cacheStatus: 'CACHE' as const
      };
    }

    console.log("🚀 SHERLOCK v18.0: Generating fresh global statistics...");
    const perfStart = Date.now();

    // Financial Overview - از Financial Integrity Engine
    const [
      financialOverview,
      representativeStats,
      invoiceStats,
      salesPartnerStats,
      systemHealth,
      recentActivities
    ] = await Promise.all([
      this.calculateFinancialOverview(),
      this.calculateRepresentativeOverview(), 
      this.calculateInvoiceOverview(),
      this.calculateSalesPartnerOverview(),
      this.calculateSystemHealth(),
      this.getRecentActivities(5)
    ]);

    console.log(`⏱️ Calculations completed in ${Date.now() - perfStart}ms`);

    const globalStats: GlobalStatistics = {
      // Financial
      totalSales: representativeStats.totalSales,
      totalRevenue: financialOverview.totalRevenue,
      totalDebt: financialOverview.totalDebt,
      totalCredit: financialOverview.totalCredit,
      totalOutstanding: financialOverview.totalOutstanding,

      // Representatives  
      totalRepresentatives: representativeStats.totalCount,
      activeRepresentatives: representativeStats.activeCount,
      inactiveRepresentatives: representativeStats.inactiveCount,
      riskRepresentatives: representativeStats.riskCount,

      // Invoices & Payments
      totalInvoices: invoiceStats.totalCount,
      paidInvoices: invoiceStats.paidCount,
      unpaidInvoices: invoiceStats.unpaidCount,
      overdueInvoices: invoiceStats.overdueCount,
      unsentTelegramInvoices: invoiceStats.unsentTelegramCount,

      // Sales Partners
      totalSalesPartners: salesPartnerStats.totalCount,
      activeSalesPartners: salesPartnerStats.activeCount,

      // System Health
      systemIntegrityScore: systemHealth.averageIntegrityScore,
      lastReconciliationDate: systemHealth.lastReconciliationDate,
      problematicRepresentativesCount: systemHealth.problematicCount,

      // Performance
      responseTime: Date.now() - startTime,
      cacheStatus: 'FRESH',
      lastUpdated: new Date().toISOString()
    };

    // Cache results
    UnifiedStatisticsEngine.setToCache(cacheKey, globalStats);

    console.log(`✅ SHERLOCK v18.0: Global statistics generated in ${globalStats.responseTime}ms`);
    return globalStats;
  }

  /**
   * آمار تخصصی نمایندگان - صفحه Representatives 
   */
  async getRepresentativeStatistics(): Promise<RepresentativeStatistics> {
    const startTime = Date.now();
    const cacheKey = 'representative-statistics';

    const cached = UnifiedStatisticsEngine.getFromCache(cacheKey);
    if (cached) {
      return { ...cached.data, lastSyncTime: new Date().toISOString() };
    }

    console.log("🚀 SHERLOCK v18.0: Generating representative statistics...");

    const [baseStats, topPerformers] = await Promise.all([
      this.calculateRepresentativeOverview(),
      this.getTopPerformingRepresentatives(5)
    ]);

    const repStats: RepresentativeStatistics = {
      totalCount: baseStats.totalCount,
      activeCount: baseStats.activeCount, 
      inactiveCount: baseStats.inactiveCount,
      totalSales: baseStats.totalSales,
      totalDebt: baseStats.totalDebt,
      avgPerformance: baseStats.activeCount > 0 ? Math.round((baseStats.activeCount / baseStats.totalCount) * 100) : 0,
      topPerformers,
      riskAlerts: baseStats.riskCount,
      lastSyncTime: new Date().toISOString()
    };

    UnifiedStatisticsEngine.setToCache(cacheKey, repStats);

    console.log(`✅ Representative statistics generated in ${Date.now() - startTime}ms`);
    return repStats;
  }

  /**
   * آمار فعالیت‌های اخیر سیستم
   */
  async getRecentActivities(limit: number = 10): Promise<RecentActivity[]> {
    const activities = await db
      .select({
        id: activityLogs.id,
        type: activityLogs.type,
        description: activityLogs.description,
        relatedId: activityLogs.relatedId,
        metadata: activityLogs.metadata,
        createdAt: activityLogs.createdAt
      })
      .from(activityLogs)
      .where(gte(activityLogs.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))) // Last 7 days
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);

    return activities.map(activity => ({
      id: activity.id,
      type: activity.type as RecentActivity['type'],
      description: activity.description,
      relatedId: activity.relatedId || undefined,
      metadata: activity.metadata || undefined,
      createdAt: activity.createdAt ? activity.createdAt.toISOString() : new Date().toISOString()
    }));
  }

  /**
   * پاک‌سازی Cache برای بروزرسانی فوری
   */
  invalidateCache(scope: 'all' | 'global' | 'representatives' | 'financial' = 'all') {
    if (scope === 'all') {
      UnifiedStatisticsEngine.cache.clear();
      console.log("🧹 SHERLOCK v18.0: All statistics cache cleared");
    } else {
      const keys = Array.from(UnifiedStatisticsEngine.cache.keys()).filter(key => key.includes(scope));
      keys.forEach(key => UnifiedStatisticsEngine.cache.delete(key));
      console.log(`🧹 SHERLOCK v18.0: ${scope} statistics cache cleared`);
    }
  }

  // ========== PRIVATE CALCULATION METHODS ========== 

  private async calculateFinancialOverview() {
    const [revenueQuery, debtQuery, creditQuery] = await Promise.all([
      // Total Revenue (All allocated payments)
      db.select({ 
        total: sql<number>`COALESCE(SUM(CAST(amount as DECIMAL)), 0)` 
      }).from(payments).where(eq(payments.isAllocated, true)),

      // Total Debt (Unpaid + Overdue invoices minus allocated payments per representative)
      db.select({
        totalDebt: sql<number>`
          COALESCE(SUM(
            GREATEST(0, 
              COALESCE(inv_total.amount, 0) - COALESCE(pay_total.amount, 0)
            )
          ), 0)
        `
      }).from(sql`(
        SELECT 
          r.id,
          COALESCE(SUM(CASE WHEN i.status IN ('unpaid', 'overdue') THEN CAST(i.amount as DECIMAL) ELSE 0 END), 0) as amount
        FROM representatives r
        LEFT JOIN invoices i ON r.id = i.representative_id
        GROUP BY r.id
      ) inv_total`)
      .leftJoin(sql`(
        SELECT 
          representative_id,
          COALESCE(SUM(CAST(amount as DECIMAL)), 0) as amount
        FROM payments 
        WHERE is_allocated = true
        GROUP BY representative_id
      ) pay_total`, sql`inv_total.id = pay_total.representative_id`),

      // Total Credit (Unallocated payments)
      db.select({ 
        total: sql<number>`COALESCE(SUM(CAST(amount as DECIMAL)), 0)` 
      }).from(payments).where(eq(payments.isAllocated, false))
    ]);

    const totalRevenue = revenueQuery[0]?.total || 0;
    const totalDebt = debtQuery[0]?.totalDebt || 0;
    const totalCredit = creditQuery[0]?.total || 0;

    return {
      totalRevenue,
      totalDebt,
      totalCredit,
      totalOutstanding: totalDebt - totalCredit
    };
  }

  private async calculateRepresentativeOverview() {
    const [countStats, financialStats] = await Promise.all([
      db.select({
        totalCount: count(),
        activeCount: sql<number>`SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END)`,
        inactiveCount: sql<number>`SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END)`
      }).from(representatives),

      db.select({
        totalSales: sql<number>`COALESCE(SUM(CAST(total_sales as DECIMAL)), 0)`,
        totalDebt: sql<number>`COALESCE(SUM(CAST(total_debt as DECIMAL)), 0)`,
        riskCount: sql<number>`SUM(CASE WHEN CAST(total_debt as DECIMAL) > 100000 THEN 1 ELSE 0 END)`
      }).from(representatives)
    ]);

    console.log('Representative Overview Debug:', {
      countStats: countStats[0],
      financialStats: financialStats[0]
    });

    return {
      totalCount: countStats[0].totalCount,
      activeCount: countStats[0].activeCount,
      inactiveCount: countStats[0].inactiveCount,
      totalSales: parseFloat(financialStats[0].totalSales?.toString() || '0'),
      totalDebt: parseFloat(financialStats[0].totalDebt?.toString() || '0'),
      riskCount: financialStats[0].riskCount
    };
  }

  private async calculateInvoiceOverview() {
    const stats = await db.select({
      totalCount: count(),
      paidCount: sql<number>`SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END)`,
      unpaidCount: sql<number>`SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END)`,
      overdueCount: sql<number>`SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END)`,
      unsentTelegramCount: sql<number>`SUM(CASE WHEN sent_to_telegram = false THEN 1 ELSE 0 END)`
    }).from(invoices);

    return stats[0] || {
      totalCount: 0,
      paidCount: 0,
      unpaidCount: 0,
      overdueCount: 0,
      unsentTelegramCount: 0
    };
  }

  private async calculateSalesPartnerOverview() {
    const stats = await db.select({
      totalCount: count(),
      activeCount: sql<number>`SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END)`
    }).from(salesPartners);

    return stats[0] || { totalCount: 0, activeCount: 0 };
  }

  private async calculateSystemHealth() {
    try {
      const cacheKey = 'system-health';
      const cached = UnifiedStatisticsEngine.getFromCache(cacheKey);
      
      if (cached) {
        console.log('⚡ SHERLOCK v18.5: Using cached system health');
        return cached.data;
      }

      console.log('🔥 SHERLOCK v18.5: Calculating fresh system health...');
      
      // Optimized problematic count calculation
      const problematicCount = await this.getProblematicRepresentativesCount();
      
      // Smart sampling for integrity score - use statistical approach
      const totalActiveReps = await db.select({ count: sql<number>`COUNT(*)` })
        .from(representatives)
        .where(eq(representatives.isActive, true));
      
      const sampleSize = Math.min(5, Math.max(1, Math.floor(totalActiveReps[0].count * 0.1))); // 10% sample, min 1, max 5
      
      const sampleReps = await db.select({ id: representatives.id })
        .from(representatives)
        .where(eq(representatives.isActive, true))
        .orderBy(sql`RANDOM()`) // Random sampling
        .limit(sampleSize);

      let totalIntegrityScore = 0;
      let validScores = 0;

      // Process sample representatives
      const samplePromises = sampleReps.map(async (rep) => {
        try {
          // Use lightweight calculation for sampling
          const basicData = await db.select({
            totalDebt: representatives.totalDebt,
            totalSales: representatives.totalSales
          }).from(representatives).where(eq(representatives.id, rep.id));

          const debt = parseFloat(basicData[0]?.totalDebt || '0');
          let integrityScore = 100;
          
          if (debt > 500000) integrityScore = 50;      // CRITICAL
          else if (debt > 200000) integrityScore = 70; // HIGH  
          else if (debt > 50000) integrityScore = 85;  // MODERATE
          
          return integrityScore;
        } catch {
          return 85; // Default score
        }
      });

      const scores = await Promise.all(samplePromises);
      totalIntegrityScore = scores.reduce((sum, score) => sum + score, 0);
      validScores = scores.length;

      const averageIntegrityScore = validScores > 0 ? Math.round(totalIntegrityScore / validScores) : 85;

      const healthData = {
        averageIntegrityScore,
        problematicCount,
        lastReconciliationDate: new Date().toISOString()
      };

      // Cache for 2 minutes
      UnifiedStatisticsEngine.setToCache(cacheKey, healthData, 120000);

      console.log(`✅ SHERLOCK v18.5: System health calculated (${validScores} samples)`);
      return healthData;
    } catch (error) {
      console.error("Error calculating system health:", error);
      return {
        averageIntegrityScore: 85,
        problematicCount: 0,
        lastReconciliationDate: new Date().toISOString()
      };
    }
  }

  private async getTopPerformingRepresentatives(limit: number) {
    const topReps = await db
      .select({
        id: representatives.id,
        name: representatives.name,
        code: representatives.code,
        totalSales: representatives.totalSales
      })
      .from(representatives)
      .where(eq(representatives.isActive, true))
      .orderBy(desc(sql`CAST(total_sales as DECIMAL)`))
      .limit(limit);

    // Get integrity scores for top performers
    const repsWithScores = await Promise.all(
      topReps.map(async (rep) => {
        try {
          const data = await unifiedFinancialEngine.calculateRepresentative(rep.id);
          // محاسبه امتیاز یکپارچگی بر اساس سطح بدهی
          let integrityScore = 100;
          if (data.debtLevel === 'CRITICAL') integrityScore = 50;
          else if (data.debtLevel === 'HIGH') integrityScore = 70;
          else if (data.debtLevel === 'MODERATE') integrityScore = 85;

          return {
            id: rep.id,
            name: rep.name,
            code: rep.code,
            totalSales: data.totalSales,
            integrityScore
          };
        } catch (error) {
          return {
            id: rep.id,
            name: rep.name,
            code: rep.code,
            totalSales: parseFloat(rep.totalSales || '0'),
            integrityScore: 85 // Default score
          };
        }
      })
    );

    return repsWithScores;
  }

  /**
   * محاسبه سریع تعداد نمایندگان مشکل‌دار بدون محاسبات سنگین
   */
  private async getProblematicRepresentativesCount(): Promise<number> {
    try {
      // محاسبه سریع بر اساس بدهی بالا
      const result = await db.select({
        count: sql<number>`COUNT(*)`
      }).from(representatives)
      .where(sql`CAST(total_debt as DECIMAL) > 100000`); // بدهی بالای 100 هزار تومان

      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error calculating problematic representatives count:", error);
      return 0;
    }
  }
}

export const unifiedStatisticsEngine = new UnifiedStatisticsEngine();