import { storage } from "../storage.js";
import { toPersianDigits, getCurrentPersianDate } from "./invoice.js";

export async function generateFinancialReport() {
  try {
    const dashboardData = await storage.getDashboardData();
    const representatives = await storage.getRepresentatives();
    const invoices = await storage.getInvoices();
    
    const report = {
      generatedAt: getCurrentPersianDate(),
      summary: {
        totalRevenue: dashboardData.totalRevenue,
        totalDebt: dashboardData.totalDebt,
        activeRepresentatives: dashboardData.activeRepresentatives,
        totalInvoices: invoices.length
      },
      topRepresentatives: representatives
        .sort((a, b) => parseFloat(b.totalSales || "0") - parseFloat(a.totalSales || "0"))
        .slice(0, 10)
        .map(rep => ({
          name: rep.name,
          totalSales: rep.totalSales,
          totalDebt: rep.totalDebt
        })),
      recentInvoices: invoices
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20)
        .map(inv => ({
          invoiceNumber: inv.invoiceNumber,
          representativeName: inv.representativeName,
          amount: inv.amount,
          status: inv.status,
          createdAt: inv.createdAt
        }))
    };

    return report;
  } catch (error) {
    console.error("Error generating financial report:", error);
    throw new Error("خطا در تولید گزارش مالی");
  }
}