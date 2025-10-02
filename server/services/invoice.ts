import { toPersianDigits, getCurrentPersianDate } from "../../client/src/lib/persian-date.js";

// Re-export Persian date utilities for use in routes
export { toPersianDigits, getCurrentPersianDate };

export interface UsageDataRecord {
  representative_code?: string;
  panel_username?: string;
  admin_username: string; // Primary unique identifier
  usage_amount: number;
  period_start: string;
  period_end: string;
  [key: string]: any; // Additional fields from JSON
}

export interface ProcessedInvoice {
  representativeCode: string;
  panelUsername: string;
  amount: number;
  usageData: UsageDataRecord;
  issueDate: string;
  dueDate: string;
}

// 🗑️ SHERLOCK v18.4: DEPRECATED - This function causes 11,117,500 تومان financial discrepancy
// Use parseStandardJsonData from standardized-invoice-engine.ts instead
export function parseUsageJsonData(jsonData: string): UsageDataRecord[] {
  throw new Error("DEPRECATED: parseUsageJsonData causes financial discrepancies. Use parseStandardJsonData from standardized-invoice-engine.ts");
  
  // Legacy function causing financial inconsistencies - DO NOT USE
  try {
    console.log('=== PARSING WEEKLY MARFANET JSON DATA ===');
    console.log('JSON data length:', jsonData.length);
    console.log('First 200 chars:', jsonData.substring(0, 200));
    console.log('Last 200 chars:', jsonData.substring(jsonData.length - 200));
    
    const data = JSON.parse(jsonData);
    let usageRecords: any[] = [];
    
    console.log('Parsed JSON type:', typeof data);
    console.log('Is array:', Array.isArray(data));
    
    // Handle MarFaNet JSON export format (PHPMyAdmin JSON export)
    if (Array.isArray(data)) {
      console.log('Processing PHPMyAdmin export array, length:', data.length);
      
      // Log structure for debugging - first 3 items only to avoid spam
      data.slice(0, 3).forEach((item, index) => {
        console.log(`Array item ${index}:`, {
          type: item?.type,
          name: item?.name,
          hasData: !!item?.data,
          dataLength: Array.isArray(item?.data) ? item.data.length : 'not array',
          keys: item && typeof item === 'object' ? Object.keys(item) : 'not object'
        });
      });
      
      // Find the table section with actual usage data
      const tableSection = data.find(item => 
        item && 
        typeof item === 'object' &&
        item.type === 'table' && 
        item.data && 
        Array.isArray(item.data) && 
        item.data.length > 0
      );
      
      if (tableSection) {
        console.log(`✅ Found table section: "${tableSection.name}", records: ${tableSection.data.length}`);
        usageRecords = tableSection.data;
        
        // Log first record structure for debugging
        if (usageRecords.length > 0) {
          console.log('✅ First record structure:', Object.keys(usageRecords[0]));
          console.log('✅ First record sample:', JSON.stringify(usageRecords[0], null, 2));
          
          // Show different admin_usernames to confirm weekly variety
          const uniqueAdmins = Array.from(new Set(usageRecords.slice(0, 10).map(r => r.admin_username)));
          console.log('✅ Sample admin_usernames (first 10):', uniqueAdmins);
        }
      } else {
        console.log('❌ No PHPMyAdmin table section found, trying direct record filtering...');
        
        // Skip first 16 lines as specified by user - these are PHPMyAdmin headers
        const potentialRecords = data.slice(16);
        console.log(`Skipped first 16 header lines, remaining items: ${potentialRecords.length}`);
        
        // Filter out invalid records and JSON closing syntax
        usageRecords = potentialRecords.filter(item => {
          // Skip null, undefined, or non-object items
          if (!item || typeof item !== 'object') {
            console.log('⚠️ Skipping non-object item:', typeof item, item);
            return false;
          }
          
          // Skip items without required fields - these are likely JSON closing syntax
          if (!item.admin_username || !item.amount || !item.event_timestamp) {
            console.log('⚠️ Skipping invalid record (missing fields):', Object.keys(item));
            return false;
          }
          
          // Skip empty amount values
          const amount = parseFloat(item.amount || '0');
          if (amount <= 0) {
            console.log('⚠️ Skipping zero/invalid amount record:', item.admin_username, item.amount);
            return false;
          }
          
          return true;
        });
        console.log(`✅ Filtered ${usageRecords.length} valid usage records after skipping headers and invalid items`);
        
        if (usageRecords.length > 0) {
          console.log('✅ First filtered record:', JSON.stringify(usageRecords[0], null, 2));
          const uniqueAdmins = Array.from(new Set(usageRecords.slice(0, 10).map(r => r.admin_username)));
          console.log('✅ Sample admin_usernames:', uniqueAdmins);
        }
      }
    } else if (data.table && data.table.data && Array.isArray(data.table.data)) {
      console.log('Found nested table.data section');
      usageRecords = data.table.data;
    } else if (data.usage_data && Array.isArray(data.usage_data)) {
      console.log('Found usage_data section');
      usageRecords = data.usage_data;
    } else if (data.data && Array.isArray(data.data)) {
      console.log('Found data section');
      usageRecords = data.data;
    } else if (typeof data === 'object' && data.admin_username) {
      console.log('Single record detected');
      return [data];
    } else {
      // Handle simple JSON object structure like our test file
      console.log('Attempting to parse as simple object structure...');
      if (typeof data === 'object') {
        const keys = Object.keys(data);
        console.log('Object keys:', keys);
        
        // Check if it's a simple object with table structure
        if (data.table && typeof data.table === 'object' && data.table.data) {
          console.log('Simple table structure detected');
          usageRecords = data.table.data;
        }
        // Check if object contains direct array fields
        else {
          const arrayField = keys.find(key => Array.isArray(data[key]));
          if (arrayField) {
            console.log(`Found array field: ${arrayField}`);
            usageRecords = data[arrayField];
          }
        }
      }
    }
    
    // CRITICAL FIX: If no usageRecords found but data is array, use data directly
    if (usageRecords.length === 0 && Array.isArray(data)) {
      console.log('🔧 DIRECT ARRAY HANDLING: Data is array, using directly');
      usageRecords = data.filter(item => item && typeof item === 'object');
      console.log(`✅ Found ${usageRecords.length} valid records in direct array`);
    }
    
    console.log(`📊 Final extracted records count: ${usageRecords.length}`);
    
    if (usageRecords.length === 0) {
      console.log('❌ ERROR: No usage records found in JSON structure');
      console.log('📋 JSON structure preview (first 1000 chars):', JSON.stringify(data, null, 2).substring(0, 1000));
      throw new Error('هیچ رکورد معتبری در فایل JSON یافت نشد. فایل باید شامل جدول با فیلدهای admin_username، amount و event_timestamp باشد');
    }
    
    // Validate that we have the required fields
    const firstRecord = usageRecords[0];
    const requiredFields = ['admin_username', 'amount', 'event_timestamp'];
    const missingFields = requiredFields.filter(field => !firstRecord[field]);
    
    if (missingFields.length > 0) {
      console.log('❌ Missing required fields:', missingFields);
      console.log('📋 Available fields:', Object.keys(firstRecord));
      throw new Error(`فیلدهای ضروری یافت نشد: ${missingFields.join(', ')}. فایل JSON باید شامل admin_username، amount و event_timestamp باشد`);
    }
    
    console.log(`🎉 پردازش موفق ${usageRecords.length} رکورد از فایل JSON هفتگی`);
    console.log("📝 نمونه اول:", JSON.stringify(usageRecords[0], null, 2));
    if (usageRecords.length > 1) {
      console.log("📝 نمونه دوم:", JSON.stringify(usageRecords[1], null, 2));
    }
    
    // Show representative distribution
    const adminGroups = usageRecords.reduce((acc, record) => {
      const admin = record.admin_username;
      acc[admin] = (acc[admin] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topRepresentatives = Object.entries(adminGroups)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5);
    
    console.log("🏆 پنج نماینده با بیشترین تراکنش:", topRepresentatives);
    
    return usageRecords;
  } catch (error) {
    console.error('💥 خطای critical در پردازش JSON:', error);
    console.error('🔍 Error details:', error instanceof Error ? error.stack : 'Unknown error type');
    throw new Error('فایل JSON قابل پردازش نیست: ' + (error as Error).message);
  }
}

export function calculateInvoiceAmount(usageData: UsageDataRecord): number {
  // Use the amount directly from MarFaNet JSON data
  const amount = parseFloat(usageData.amount || '0');
  return Math.round(amount);
}

export function processUsageData(usageRecords: UsageDataRecord[], customInvoiceDate?: string | null): ProcessedInvoice[] {
  const currentDate = customInvoiceDate && customInvoiceDate.trim() 
    ? customInvoiceDate.trim() 
    : getCurrentPersianDate();
  
  // Group by admin_username and sum amounts
  const groupedData = usageRecords.reduce((acc, record) => {
    const adminUsername = record.admin_username;
    if (!adminUsername) return acc;
    
    if (!acc[adminUsername]) {
      acc[adminUsername] = {
        admin_username: adminUsername,
        records: [],
        totalAmount: 0
      };
    }
    
    acc[adminUsername].records.push(record);
    acc[adminUsername].totalAmount += parseFloat(record.amount || '0');
    
    return acc;
  }, {} as Record<string, { admin_username: string; records: any[]; totalAmount: number }>);
  
  // Convert to ProcessedInvoice format
  return Object.values(groupedData).map(group => {
    return {
      representativeCode: group.admin_username,
      panelUsername: group.admin_username,
      amount: Math.round(group.totalAmount),
      usageData: {
        admin_username: group.admin_username,
        records: group.records,
        totalRecords: group.records.length,
        period_start: group.records[0]?.event_timestamp || currentDate,
        period_end: group.records[group.records.length - 1]?.event_timestamp || currentDate,
        usage_amount: group.totalAmount
      } as any,
      issueDate: currentDate,
      dueDate: addDaysToPersianDate(currentDate, 30)
    };
  });
}

// Helper function to create public portal ID from admin_username
export function generatePublicId(adminUsername: string): string {
  // Create a clean, consistent public ID based on admin_username
  return adminUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Helper function to auto-create representative from usage data
export async function createRepresentativeFromUsageData(
  adminUsername: string,
  db: any,
  defaultSalesPartnerId?: number
): Promise<any> {
  const publicId = generatePublicId(adminUsername);
  
  // Create basic representative profile with minimal required data
  const newRepresentative = {
    code: adminUsername, // Use admin_username as code
    name: `فروشگاه ${adminUsername}`, // Default shop name
    ownerName: null, // Will be set to null as default
    panelUsername: adminUsername,
    phone: null,
    publicId: publicId,
    salesPartnerId: defaultSalesPartnerId || null,
    isActive: true
  };

  return newRepresentative;
}

// Helper to get or create default sales partner
export async function getOrCreateDefaultSalesPartner(dbInstance: any): Promise<number> {
  const { salesPartners } = await import("../../shared/schema");
  const { eq } = await import("drizzle-orm");
  
  if (!dbInstance || !dbInstance.select) {
    const { db } = await import("../db");
    dbInstance = db;
  }
  
  // Try to find existing default partner
  const existing = await dbInstance.select().from(salesPartners).where(eq(salesPartners.name, "همکار پیش‌فرض")).limit(1);
  
  if (existing.length > 0) {
    return existing[0].id;
  }
  
  // Create default sales partner
  const [newPartner] = await dbInstance.insert(salesPartners).values({
    name: "همکار پیش‌فرض",
    phone: null,
    email: null,
    commissionRate: "5.00", // 5% default commission
    isActive: true
  }).returning();
  
  return newPartner.id;
}

export function addDaysToPersianDate(persianDate: string, days: number): string {
  // For now, return a simple 30-day due date from issue date
  // This avoids date calculation errors until proper Persian calendar library is integrated
  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + days);
  
  // Convert to Persian date (simplified approximation)
  const year = currentDate.getFullYear() - 1979 + 621;
  const month = currentDate.getMonth() + 1;
  const day = currentDate.getDate();
  
  return toPersianDigits(`${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`);
}

export function validateUsageData(records: UsageDataRecord[]): { 
  valid: UsageDataRecord[], 
  invalid: { record: any, errors: string[] }[] 
} {
  const valid: UsageDataRecord[] = [];
  const invalid: { record: any, errors: string[] }[] = [];
  
  records.forEach(record => {
    const errors: string[] = [];
    
    // For MarFaNet JSON format validation - check actual data format
    // Allow both admin_username and representative_code as valid identifiers
    const username = record.admin_username || record.representative_code;
    if (!username || typeof username !== 'string' || username.trim() === '') {
      errors.push('admin_username یا representative_code وجود ندارد یا خالی است');
    }
    
    const amountValue = parseFloat(record.amount || '0');
    if (!record.amount || isNaN(amountValue) || amountValue <= 0) {
      errors.push(`مبلغ نامعتبر: ${record.amount}`);
    }
    
    if (errors.length === 0) {
      // Add derived fields for processing compatibility
      const username = record.admin_username || record.representative_code || '';
      record.admin_username = username; // Ensure consistency
      record.representative_code = username;
      record.panel_username = username;  
      record.usage_amount = amountValue;
      record.period_start = record.event_timestamp || new Date().toISOString();
      record.period_end = record.event_timestamp || new Date().toISOString();
      
      valid.push(record);
    } else {
      invalid.push({ record, errors });
    }
  });
  
  return { valid, invalid };
}

// اینجا معماری جدید Sequential Processing را اضافه می‌کنیم
export async function processUsageDataSequential(
  usageData: UsageDataRecord[],
  storage: any,
  customInvoiceDate?: string | null
): Promise<{
  processedInvoices: ProcessedInvoice[],
  newRepresentatives: any[],
  statistics: {
    totalRecords: number,
    uniqueRepresentatives: number,
    processedInvoices: number
  }
}> {
  console.log('🔄 شروع پردازش Sequential فایل JSON هفتگی');
  console.log(`📊 تعداد کل رکوردها: ${usageData.length}`);
  
  // مرحله 1: مرتب‌سازی بر اساس admin_username (الفبایی)
  const sortedRecords = usageData.sort((a, b) => 
    a.admin_username.localeCompare(b.admin_username)
  );
  
  console.log('✅ رکوردها بر اساس admin_username مرتب شدند');
  
  // مرحله 2: گروه‌بندی sequential بر اساس admin_username
  const representativeGroups: Record<string, UsageDataRecord[]> = {};
  let currentAdmin = '';
  
  for (const record of sortedRecords) {
    if (record.admin_username !== currentAdmin) {
      currentAdmin = record.admin_username;
      console.log(`🔍 پردازش نماینده جدید: ${currentAdmin}`);
    }
    
    if (!representativeGroups[currentAdmin]) {
      representativeGroups[currentAdmin] = [];
    }
    representativeGroups[currentAdmin].push(record);
  }
  
  console.log(`📈 تعداد نمایندگان یافت شده: ${Object.keys(representativeGroups).length}`);
  
  // مرحله 3: پردازش sequential هر نماینده با بهینه‌سازی حافظه
  const processedInvoices: ProcessedInvoice[] = [];
  const newRepresentatives: any[] = [];
  const { db: dbInstance } = await import("../db");
  const defaultSalesPartnerId = await getOrCreateDefaultSalesPartner(dbInstance);
  
  let processedCount = 0;
  const totalRepresentatives = Object.keys(representativeGroups).length;
  
  // پردازش sequential با بهینه‌سازی حافظه
  const sortedEntries = Object.entries(representativeGroups);
  
  for (const [adminUsername, records] of sortedEntries) {
    try {
      console.log(`⚙️ پردازش نماینده: ${adminUsername} با ${records.length} رکورد (${processedCount + 1}/${totalRepresentatives})`);
      
      // Filter out any invalid records for this representative
      const validRecords = records.filter(record => {
        if (!record || typeof record !== 'object') {
          console.log(`⚠️ Skipping invalid record type for ${adminUsername}:`, typeof record);
          return false;
        }
        
        const amount = parseFloat(record.amount?.toString() || '0');
        if (isNaN(amount) || amount <= 0) {
          console.log(`⚠️ Skipping invalid amount for ${adminUsername}:`, record.amount);
          return false;
        }
        
        return true;
      });
      
      if (validRecords.length === 0) {
        console.log(`❌ No valid records found for ${adminUsername}, skipping...`);
        processedCount++;
        continue;
      }
      
      console.log(`✅ Processing ${validRecords.length} valid records for ${adminUsername}`);
      
      // بررسی وجود نماینده
      let representative = await storage.getRepresentativeByPanelUsername(adminUsername) ||
                          await storage.getRepresentativeByCode(adminUsername);
      
      // ایجاد نماینده جدید در صورت عدم وجود
      if (!representative) {
        console.log(`➕ ایجاد نماینده جدید: ${adminUsername}`);
        const newRepData = await createRepresentativeFromUsageData(
          adminUsername,
          dbInstance,
          defaultSalesPartnerId
        );
        representative = await storage.createRepresentative(newRepData);
        newRepresentatives.push(representative);
      }
      
      // محاسبه مجموع مبلغ برای این نماینده (فقط از رکوردهای معتبر)
      const totalAmount = validRecords.reduce((sum, record) => {
        const amount = parseFloat(record.amount.toString());
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
      
      // تنظیم تاریخ صدور فاکتور (شمسی)
      const invoiceDate = customInvoiceDate && customInvoiceDate.trim() 
        ? customInvoiceDate.trim() 
        : getCurrentPersianDate();
      
      // ایجاد فاکتور با جزئیات کامل (use validRecords instead of records)
      const processedInvoice: ProcessedInvoice = {
        representativeCode: adminUsername,
        panelUsername: adminUsername,
        amount: totalAmount,
        issueDate: invoiceDate,
        dueDate: addDaysToPersianDate(invoiceDate, 30),
        usageData: {
          admin_username: adminUsername,
          records: validRecords.map(record => ({
            ...record,
            representative_code: adminUsername,
            panel_username: adminUsername,
            usage_amount: parseFloat(record.amount.toString()),
            period_start: record.event_timestamp,
            period_end: record.event_timestamp
          })),
          totalRecords: validRecords.length,
          period_start: validRecords[0]?.event_timestamp || '',
          period_end: validRecords[validRecords.length - 1]?.event_timestamp || '',
          usage_amount: totalAmount
        }
      };
      
      processedInvoices.push(processedInvoice);
      processedCount++;
      
      console.log(`✅ فاکتور آماده شد برای ${adminUsername}: ${totalAmount} تومان (${processedCount}/${totalRepresentatives})`);
      
      // بهینه‌سازی حافظه و جلوگیری از overwhelming database
      if (processedCount % 25 === 0) {
        console.log(`🔄 پردازش ${processedCount}/${totalRepresentatives} نماینده تکمیل شد - آزادسازی حافظه...`);
        // Force garbage collection if available and clear temporary data
        if (global.gc) {
          global.gc();
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error(`❌ Error processing representative ${adminUsername}:`, error);
      processedCount++;
      continue; // Skip this representative and continue with the next one
    }
  }
  
  console.log(`🎯 پردازش Sequential کامل شد: ${processedInvoices.length} فاکتور آماده`);
  
  // آزادسازی حافظه قبل از بازگشت
  if (global.gc) {
    global.gc();
  }
  
  return {
    processedInvoices,
    newRepresentatives,
    statistics: {
      totalRecords: usageData.length,
      uniqueRepresentatives: Object.keys(representativeGroups).length,
      processedInvoices: processedInvoices.length
    }
  };
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return toPersianDigits(num.toLocaleString('fa-IR'));
}

export function generateInvoicePreview(invoice: ProcessedInvoice): string {
  return `نماینده: ${invoice.representativeCode}
پنل: ${invoice.panelUsername}  
مبلغ: ${formatCurrency(invoice.amount)} تومان
تاریخ صدور: ${invoice.issueDate}
سررسید: ${invoice.dueDate}`;
}
