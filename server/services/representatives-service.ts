/**
 * Representatives Service - Modular Business Logic Layer
 * 
 * مسئولیت‌ها:
 * - محاسبه real-time مالی نمایندگان
 * - فرمت‌دهی response برای frontend
 * - مدیریت filter و sort
 */

import { eq, desc, asc, sql, like, or } from 'drizzle-orm';
import { db } from '../db.js';
import { representatives, invoices, payments, paymentAllocations } from '../../shared/schema.js';
import { unifiedFinancialEngine } from './unified-financial-engine.js';

export interface RepresentativeListItem {
  id: number;
  code: string;
  name: string; // نام فروشگاه
  ownerName: string | null; // همکار فروش (صاحب فروشگاه)
  totalSales: string; // میزان فروش کل
  totalDebt: string; // مانده بدهی
  isActive: boolean;
  // برای navigation
  panelUsername: string;
}

export interface RepresentativesQueryParams {
  search?: string;
  sortBy?: 'totalSales' | 'totalDebt' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface RepresentativesListResponse {
  representatives: RepresentativeListItem[];
  total: number;
  page: number;
  pageSize: number;
}

class RepresentativesService {
  /**
   * دریافت لیست نمایندگان با محاسبات real-time
   */
  async getRepresentativesList(params: RepresentativesQueryParams = {}): Promise<RepresentativesListResponse> {
    const {
      search = '',
      sortBy = 'name',
      sortOrder = 'asc',
      limit = 50,
      offset = 0
    } = params;

    try {
      console.log('🔍 RepresentativesService: Fetching representatives list');

      // Build query با search
      let query = db.select({
        id: representatives.id,
        code: representatives.code,
        name: representatives.name,
        ownerName: representatives.ownerName,
        panelUsername: representatives.panelUsername,
        isActive: representatives.isActive,
        // از database برای initial load
        totalSales: representatives.totalSales,
        totalDebt: representatives.totalDebt
      }).from(representatives);

      // اعمال search filter
      if (search) {
        query = query.where(
          or(
            like(representatives.name, `%${search}%`),
            like(representatives.ownerName, `%${search}%`),
            like(representatives.code, `%${search}%`)
          ) as any
        ) as any;
      }

      // Sort order
      const sortColumn = sortBy === 'totalSales' 
        ? representatives.totalSales
        : sortBy === 'totalDebt'
        ? representatives.totalDebt
        : representatives.name;

      const sortedQuery = sortOrder === 'asc' 
        ? query.orderBy(asc(sortColumn))
        : query.orderBy(desc(sortColumn));

      // اجرای query با pagination
      const results = await (sortedQuery as any).limit(limit).offset(offset);

      // محاسبه total count
      const [{ count: totalCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(representatives)
        .where(
          search
            ? or(
                like(representatives.name, `%${search}%`),
                like(representatives.ownerName, `%${search}%`),
                like(representatives.code, `%${search}%`)
              )
            : undefined
        );

      // ✅ محاسبه real-time برای هر نماینده
      const enhancedResults = await Promise.all(
        results.map(async (rep) => {
          try {
            const financialData = await unifiedFinancialEngine.calculateRepresentative(rep.id);
            
            return {
              id: rep.id,
              code: rep.code,
              name: rep.name,
              ownerName: rep.ownerName || '-',
              totalSales: financialData.totalSales.toFixed(0),
              totalDebt: financialData.actualDebt.toFixed(0),
              isActive: rep.isActive,
              panelUsername: rep.panelUsername
            };
          } catch (error) {
            console.warn(`⚠️ Failed to calculate financial for rep ${rep.id}, using cached:`, error);
            // Fallback to cached data
            return {
              id: rep.id,
              code: rep.code,
              name: rep.name,
              ownerName: rep.ownerName || '-',
              totalSales: rep.totalSales || '0',
              totalDebt: rep.totalDebt || '0',
              isActive: rep.isActive,
              panelUsername: rep.panelUsername
            };
          }
        })
      );

      console.log(`✅ RepresentativesService: Loaded ${enhancedResults.length} representatives with real-time data`);

      return {
        representatives: enhancedResults,
        total: totalCount || 0,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit
      };
    } catch (error) {
      console.error('❌ RepresentativesService: Error fetching representatives:', error);
      throw error;
    }
  }

  /**
   * دریافت آمار کلی نمایندگان
   */
  async getStatistics() {
    try {
      const allReps = await db.select().from(representatives);

      const stats = {
        total: allReps.length,
        active: allReps.filter(r => r.isActive).length,
        totalSales: allReps.reduce((sum, r) => sum + parseFloat(r.totalSales || '0'), 0),
        totalDebt: allReps.reduce((sum, r) => sum + parseFloat(r.totalDebt || '0'), 0)
      };

      return stats;
    } catch (error) {
      console.error('❌ RepresentativesService: Error fetching statistics:', error);
      throw error;
    }
  }

  /**
   * دریافت جزئیات یک نماینده بر اساس code
   */
  async getRepresentativeByCode(code: string) {
    try {
      const [rep] = await db
        .select()
        .from(representatives)
        .where(eq(representatives.code, code))
        .limit(1);

      if (!rep) {
        return null;
      }

      // محاسبه real-time مالی
      try {
        const financialData = await unifiedFinancialEngine.calculateRepresentative(rep.id);
        
        return {
          id: rep.id,
          code: rep.code,
          name: rep.name,
          ownerName: rep.ownerName || '-',
          phone: rep.phone,
          email: rep.email,
          address: rep.address,
          publicId: rep.publicId,
          totalSales: financialData.totalSales || parseFloat(rep.totalSales || '0'),
          totalDebt: financialData.actualDebt || parseFloat(rep.totalDebt || '0'),
          isActive: rep.isActive,
          createdAt: rep.createdAt,
          panelUsername: rep.panelUsername
        };
      } catch (calcError) {
        console.warn(`⚠️  Calculation failed for ${code}, using cached data:`, calcError);
        return {
          id: rep.id,
          code: rep.code,
          name: rep.name,
          ownerName: rep.ownerName || '-',
          phone: rep.phone,
          email: rep.email,
          address: rep.address,
          publicId: rep.publicId,
          totalSales: parseFloat(rep.totalSales || '0'),
          totalDebt: parseFloat(rep.totalDebt || '0'),
          isActive: rep.isActive,
          createdAt: rep.createdAt,
          panelUsername: rep.panelUsername
        };
      }
    } catch (error) {
      console.error(`❌ RepresentativesService: Error fetching representative ${code}:`, error);
      throw error;
    }
  }

  /**
   * دریافت فاکتورهای یک نماینده
   */
  async getRepresentativeInvoices(code: string, page: number = 1, pageSize: number = 10) {
    try {
      const [rep] = await db
        .select({ id: representatives.id })
        .from(representatives)
        .where(eq(representatives.code, code))
        .limit(1);

      if (!rep) {
        throw new Error(`Representative with code ${code} not found`);
      }

      const offset = (page - 1) * pageSize;

      const invoicesList = await db
        .select()
        .from(invoices)
        .where(eq(invoices.representativeId, rep.id))
        .orderBy(desc(invoices.issueDate))
        .limit(pageSize)
        .offset(offset);

      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(invoices)
        .where(eq(invoices.representativeId, rep.id));

      const total = Number(totalResult?.count || 0);

      // محاسبه remainingAmount برای هر فاکتور
      const invoicesWithBalance = await Promise.all(
        invoicesList.map(async (inv) => {
          // محاسبه مجموع پرداخت‌های تخصیص یافته به این فاکتور
          const [allocResult] = await db
            .select({ 
              totalAllocated: sql<number>`COALESCE(SUM(${paymentAllocations.allocatedAmount}::numeric), 0)` 
            })
            .from(paymentAllocations)
            .where(eq(paymentAllocations.invoiceId, inv.id));

          const totalAllocated = Number(allocResult?.totalAllocated || 0);
          const invoiceAmount = parseFloat(inv.amount || '0');
          const remainingAmount = Math.max(0, invoiceAmount - totalAllocated);

          return {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            amount: invoiceAmount,
            remainingAmount,
            date: inv.issueDate,
            status: inv.status,
            usageData: inv.usageData
          };
        })
      );

      return {
        invoices: invoicesWithBalance,
        total
      };
    } catch (error) {
      console.error(`❌ RepresentativesService: Error fetching invoices for ${code}:`, error);
      throw error;
    }
  }

  /**
   * دریافت پرداخت‌های یک نماینده
   */
  async getRepresentativePayments(code: string, page: number = 1, pageSize: number = 10) {
    try {
      const [rep] = await db
        .select({ id: representatives.id })
        .from(representatives)
        .where(eq(representatives.code, code))
        .limit(1);

      if (!rep) {
        throw new Error(`Representative with code ${code} not found`);
      }

      const offset = (page - 1) * pageSize;

      const paymentsList = await db
        .select()
        .from(payments)
        .where(eq(payments.representativeId, rep.id))
        .orderBy(desc(payments.paymentDate))
        .limit(pageSize)
        .offset(offset);

      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(payments)
        .where(eq(payments.representativeId, rep.id));

      const total = Number(totalResult?.count || 0);

      return {
        payments: paymentsList.map(pay => ({
          id: pay.id,
          amount: parseFloat(pay.amount || '0'),
          date: pay.paymentDate,
          description: pay.description || undefined
        })),
        total
      };
    } catch (error) {
      console.error(`❌ RepresentativesService: Error fetching payments for ${code}:`, error);
      throw error;
    }
  }
}

export const representativesService = new RepresentativesService();
export default representativesService;
