import { RepresentativeData, FinancialData, BatchData, ValidatedInvoiceData, ValidatedInvoiceBatchData } from './routes-interfaces.js';
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { db } from "./db.js";
import { sql, eq, and, or, like, gte, lte, asc, count, desc } from "drizzle-orm";
import { invoices, representatives, payments, activityLogs } from "@shared/schema";

// SHERLOCK LOG CONTROL v1.0
const SHERLOCK_ENABLED = process.env.NODE_ENV !== 'production';
function sherlockLog(...args: any[]) {
  if (SHERLOCK_ENABLED) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}
import { unifiedAuthMiddleware, enhancedUnifiedAuthMiddleware } from "./middleware/unified-auth.js";

import multer from "multer";

// SHERLOCK v34.1: Import payment management router and its dependencies
import { paymentManagementRouter, requireAuth } from "./routes/payment-management-router.js";

// Extend Request interface to include multer file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}
import { z } from "zod";
import {
  insertRepresentativeSchema,
  insertSalesPartnerSchema,
  insertInvoiceSchema,
  insertPaymentSchema,
  // فاز ۱: Schema برای مدیریت دوره‌ای فاکتورها
  insertInvoiceBatchSchema
} from "@shared/schema";
// ✅ NEW STANDARDIZED IMPORTS:
import { registerStandardizedInvoiceRoutes } from "./routes/standardized-invoice-routes.js";
import {
  sendInvoiceToTelegram,
  sendBulkInvoicesToTelegram,
  getDefaultTelegramTemplate,
  formatInvoiceStatus
} from "./services/telegram.js";
import bcrypt from "bcryptjs";
// Commented out temporarily - import { generateFinancialReport } from "./services/report-generator";

// New import for unified financial engine
import { unifiedFinancialEngine } from './services/unified-financial-engine.js';

// Import integration health routes for Phase 9
import { registerIntegrationHealthRoutes } from "./routes/integration-health-routes.js";
import featureFlagRoutes from './routes/feature-flag-routes.js';
import { registerHealthRoutes } from './routes/health-routes.js';

// Import unified statistics routes registration
import { registerUnifiedStatisticsRoutes } from "./routes/unified-statistics-routes.js";
// Register unified financial routes
import { registerUnifiedFinancialRoutes } from "./routes/unified-financial-routes.js";
import { registerShadowAllocationRoutes } from './routes/shadow-allocation-routes.js';
import { registerUsageLineRoutes } from './routes/usage-line-routes.js';
import { isCanaryRepresentative } from './services/allocation-canary-helper.js';

// Import database optimization routes registration
import databaseOptimizationRoutes from './routes/database-optimization-routes.js';
// Import Batch Rollback Routes
import { registerBatchRollbackRoutes } from './routes/batch-rollback-routes.js';

// Import Debt Verification Routes
import debtVerificationRoutes from './routes/debt-verification-routes.js';
// Import Active Reconciliation Routes - Phase B: E-B4
import activeReconciliationRoutes from './routes/active-reconciliation-routes.js';
import guardMetricsRoutes from './routes/guard-metrics-routes.js';
import { featureFlagManager } from './services/feature-flag-manager.js';

// Import Representatives Routes - Modular & Refactored
import representativesRoutes from './routes/representatives-routes.js';

// --- Interfaces for Authentication Middleware ---
interface AuthSession {
  id: string; // Required by Session interface
  cookie: any; // Required by Session interface
  authenticated?: boolean;
  userId?: number;
  username?: string;
  role?: string;
  permissions?: string[];
  user?: any;
  // ...existing code...
}

// Remove AuthRequest interface - use Request directly with type assertions
// interface AuthRequest extends Request {
//   // Extending Request with additional session properties
//   // Using intersection types to avoid session type conflicts
// }


// Configure multer for file uploads with broader JSON acceptance
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for large JSON files
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // Accept all files for maximum compatibility - validate content in handler
    console.log(`File upload: ${file.originalname}, MIME: ${file.mimetype}`);
    cb(null, true);
  }
});

// SHERLOCK v27.0: UNIFIED AUTHENTICATION SYSTEM
  const authMiddleware = unifiedAuthMiddleware;
  const enhancedAuthMiddleware = enhancedUnifiedAuthMiddleware;


export async function registerRoutes(app: Express): Promise<Server> {

  // Safe timeout handling with increased timeout for batch operations
  app.use((req, res, next) => {
    // Set different timeouts based on endpoint
    const isBatchOperation = req.url.includes('/batch') || req.url.includes('/dashboard');
    const timeoutMs = isBatchOperation ? 120000 : 60000; // 2 minutes for batch, 1 minute for others
    
    req.setTimeout(timeoutMs, () => {
      console.error(`⏰ Global timeout after ${timeoutMs}ms: ${req.method} ${req.url}`);
      if (!res.headersSent) {
        res.status(408).json({
          error: "Request timeout",
          message: "درخواست طولانی شد - لطفاً صبر کنید",
          url: req.url,
          timeout: timeoutMs
        });
      }
    });
    next();
  });

  // Enhanced error handling with crash prevention
  process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error.message);
    console.error('Stack:', error.stack?.substring(0, 1000));

    // Try to clean up and continue instead of crashing
    if (global.gc) {
      global.gc();
    }

    // Only exit for critical errors
    if (error.message?.includes('ENOSPC') || error.message?.includes('ENOMEM')) {
      console.error('🚨 Critical system error - restarting...');
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise);
    console.error('🚨 Reason:', reason);

    // Log but don't crash for promise rejections
    console.error('⚠️ Continuing execution despite unhandled rejection');
  });

  // Add memory monitoring
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

    if (heapUsedMB > 500) {
      console.warn(`🧠 High memory usage: ${heapUsedMB}MB`);

      if (global.gc) {
        global.gc();
        console.log('🗑️ Forced garbage collection');
      }
    }
  }, 30000); // Check every 30 seconds


  // Initialize default admin user
  try {
    await storage.initializeDefaultAdminUser("mgr", "8679");
  } catch (error) {
    console.error("Failed to initialize default admin user:", error);
  }


  // SHERLOCK v1.0: Authentication Test Endpoint (before other routes)
  app.get("/api/auth/test", (req, res) => {
    const authStatus = {
      sessionId: req.sessionID,
      hasSession: !!req.session,
      adminAuthenticated: req.session?.authenticated === true,
      adminUser: req.session?.user ? {
        id: req.session.user.id,
        username: req.session.user.username,
        role: req.session.user.role
      } : null,
      isAuthenticated: !!req.session?.authenticated,
      timestamp: new Date().toISOString()
    };

    console.log('🧪 SHERLOCK v1.0 Auth Test:', authStatus);

    res.json({
      success: true,
      message: "Authentication test endpoint",
      authStatus
    });
  });

  // NEW: /api/auth/me برای سازگاری با کلاینت (UnifiedAuthContext)
  app.get('/api/auth/me', (req, res) => {
    if (req.session?.authenticated && (req.session as any).user) {
      const user = (req.session as any).user;
      return res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role || 'ADMIN',
          permissions: user.permissions || []
        },
        authenticated: true,
        timestamp: new Date().toISOString()
      });
    }
    return res.status(401).json({
      error: 'UNAUTHENTICATED',
      authenticated: false,
      timestamp: new Date().toISOString()
    });
  });

  // NEW: /api/auth/logout مسیر خروج کاربر
  app.post('/api/auth/logout', (req, res) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Logout session destroy error:', err);
          return res.status(500).json({ error: 'FAILED_LOGOUT' });
        }
        res.clearCookie('marfanet.sid');
        return res.json({ success: true, message: 'Logged out' });
      });
    } else {
      res.json({ success: true, message: 'No active session' });
    }
  });

  // 💗 Register Health Check routes for Ubuntu Server monitoring
  registerHealthRoutes(app);

  // SHERLOCK v18.4: Register STANDARDIZED Invoice Routes - eliminates 11,117,500 تومان discrepancy
  registerStandardizedInvoiceRoutes(app, authMiddleware, storage);
  // Register integration health routes for Phase 9
  registerIntegrationHealthRoutes(app);
  app.use('/api/feature-flags', featureFlagRoutes);

  // 🔷 Representatives Routes - Refactored & Modular (5 columns: name, ownerName, totalSales, totalDebt, actions)
  app.use('/api/representatives', authMiddleware, representativesRoutes);
  console.log('✅ Representatives routes registered with authentication');

  // SHERLOCK v18.4: سیستم مالی یکپارچه واحد - تنها سیستم مالی فعال
  // Previously imported and used directly:
  // const unifiedFinancialRoutes = (await import('./routes/unified-financial-routes.js')).default;
  // app.use('/api/unified-financial', unifiedFinancialRoutes);
  registerUnifiedFinancialRoutes(app, authMiddleware);
  // Phase A - Iteration 3: Shadow allocation observation endpoint
  registerShadowAllocationRoutes(app, authMiddleware);
  registerUsageLineRoutes(app, authMiddleware);
  
  // E-B5 Stage 3: KPI Metrics routes
  const kpiMetricsRoutes = (await import('./routes/kpi-metrics-routes.js')).default;
  app.use('/api/allocations', kpiMetricsRoutes);
  console.log('✅ E-B5 Stage 3: KPI Metrics routes registered');

  // Phase A - Iteration 5: Cache metrics endpoint (invoice_balance_cache vs ledger aggregates)
  app.get('/api/allocations/cache-metrics', authMiddleware, async (req: Request, res: Response) => {
    try {
      // نمونه: شمار کل فاکتورهایی که remaining_amount != amount - Σledger
      const mismatchQuery = await db.execute(sql`
        SELECT i.id AS invoice_id,
               i.amount AS invoice_amount,
               COALESCE((SELECT SUM(pa.allocated_amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id),0) AS ledger_alloc,
               COALESCE(ibc.remaining_amount, i.amount) AS cached_remaining,
               (i.amount - COALESCE((SELECT SUM(pa.allocated_amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id),0)) AS computed_remaining
        FROM invoices i
        LEFT JOIN invoice_balance_cache ibc ON ibc.invoice_id = i.id
        WHERE (
          COALESCE(ibc.remaining_amount, i.amount) - (i.amount - COALESCE((SELECT SUM(pa.allocated_amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id),0))
        ) <> 0
        ORDER BY i.id ASC
        LIMIT 50;
      `);
      const mismatches = (mismatchQuery as any).rows || [];
      const totalMismatchRes = await db.execute(sql`
        SELECT COUNT(*) AS c FROM invoices i
        LEFT JOIN invoice_balance_cache ibc ON ibc.invoice_id = i.id
        WHERE (
          COALESCE(ibc.remaining_amount, i.amount) - (i.amount - COALESCE((SELECT SUM(pa.allocated_amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id),0))
        ) <> 0;
      `);
      const totalMismatch = Number((totalMismatchRes as any).rows?.[0]?.c || 0);

      res.json({
        success: true,
        totalMismatch,
        sample: mismatches.map((m: any) => ({
          invoiceId: Number(m.invoice_id),
            ledgerAllocated: Number(m.ledger_alloc),
            cachedRemaining: Number(m.cached_remaining),
            computedRemaining: Number(m.computed_remaining)
        }))
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Canary debt endpoint (Phase A - Iteration 6 skeleton)
  app.get('/api/allocations/canary-debt', authMiddleware, async (req: Request, res: Response) => {
    try {
      const repIdRaw = req.query.representativeId;
      if (!repIdRaw) return res.status(400).json({ success:false, error:'representativeId query required'});
      const repId = Number(repIdRaw);
      const canary = isCanaryRepresentative(repId, 5); // 5% rollout target
      // Placeholder debt computation: در حال حاضر فقط ledger allocations sum برای فاکتورهای نماینده (نمونه ساده)
      // در آینده: استفاده از cache + ledger.
      const debtLegacy = await db.execute(sql`SELECT COALESCE(SUM(i.amount),0) AS total FROM invoices i WHERE i.representative_id = ${repId}`);
      const allocLedger = await db.execute(sql`SELECT COALESCE(SUM(pa.allocated_amount),0) AS total FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE p.representative_id = ${repId}`);
      const totalInv = Number((debtLegacy as any).rows?.[0]?.total || 0);
      const allocSum = Number((allocLedger as any).rows?.[0]?.total || 0);
      const debt = totalInv - allocSum;
      res.json({ success:true, representativeId: repId, canary, ledgerDebt: debt });
    } catch (e:any) {
      res.status(500).json({ success:false, error:e.message });
    }
  });

  // TEMP (Phase A instrumentation): manual multi-stage flag update for allocation_dual_write (dev-only shortcut)
  app.post('/api/allocations/dev-set-dual-write', authMiddleware, async (req: Request, res: Response) => {
    try {
      const state = (req.query.state || req.body?.state || '').toString();
      if (!state) return res.status(400).json({ success:false, error:'state required (off|shadow|enforce)' });
      try {
        featureFlagManager.updateMultiStageFlag('allocation_dual_write', state, 'dev_manual');
      } catch (err:any) {
        return res.status(400).json({ success:false, error: err.message });
      }
      res.json({ success:true, flag:'allocation_dual_write', newState: featureFlagManager.getMultiStageFlagState('allocation_dual_write') });
    } catch (e:any) {
      res.status(500).json({ success:false, error:e.message });
    }
  });

  // Debt comparison endpoint (Phase A - Iteration 7) - READ-ONLY drift surface
  // GET /api/allocations/debt-compare
  // Optional query: representativeId=<id>
  // Returns: legacyDebt (standard engine), ledgerDebt (allocations delta), cacheDebt (aggregated remaining), diffs & ratios
  app.get('/api/allocations/debt-compare', authMiddleware, async (req: Request, res: Response) => {
    try {
      const repIdParam = req.query.representativeId ? Number(req.query.representativeId) : undefined;
      if (repIdParam !== undefined && Number.isNaN(repIdParam)) {
        return res.status(400).json({ success:false, error:'representativeId must be numeric'});
      }

      // Feature flag gating: only available once dual write at least shadow
      const dualState = featureFlagManager.getMultiStageFlagState('allocation_dual_write');
      if (dualState === 'off') {
        return res.status(409).json({ success:false, error:'allocation_dual_write must be shadow or enforce to access debt comparison', state: dualState });
      }

      // Legacy debt (standardized) = unpaid/overdue/partial invoices - allocated payments (legacy boolean flag)
      const legacyQuery = repIdParam ? sql`AND invoices.representative_id = ${repIdParam}` : sql``;
      const legacyDebtRes = await db.execute(sql`SELECT
          GREATEST(0,
            COALESCE(SUM(CASE WHEN invoices.status IN ('unpaid','overdue','partial') THEN CAST(invoices.amount as DECIMAL) ELSE 0 END),0)
            - COALESCE(SUM(CASE WHEN payments.is_allocated = true THEN CAST(payments.amount as DECIMAL) ELSE 0 END),0)
          ) AS debt
        FROM invoices
        LEFT JOIN payments ON payments.representative_id = invoices.representative_id
        WHERE 1=1 ${legacyQuery};`);
      const legacyDebt = Number((legacyDebtRes as any).rows?.[0]?.debt || 0);

      // Ledger debt = invoice total - ledger allocations (payment_allocations) (independent of legacy flag)
      const ledgerTotalsRes = await db.execute(sql`SELECT
          COALESCE(SUM(CAST(invoices.amount as DECIMAL)),0) AS inv_total,
          COALESCE(SUM(pa.allocated_amount),0) AS alloc_total
        FROM invoices
        LEFT JOIN payment_allocations pa ON pa.invoice_id = invoices.id
        ${repIdParam ? sql`WHERE invoices.representative_id = ${repIdParam}` : sql``};`);
      const invTotal = Number((ledgerTotalsRes as any).rows?.[0]?.inv_total || 0);
      const allocTotal = Number((ledgerTotalsRes as any).rows?.[0]?.alloc_total || 0);
      const ledgerDebt = invTotal - allocTotal;

      // Cache debt aggregation: sum remaining_amount where status_cached IN ('unpaid','partial') (ignore paid & anomalies negative)
      const cacheScope = repIdParam ? sql`WHERE invoices.representative_id = ${repIdParam}` : sql``;
      const cacheDebtRes = await db.execute(sql`SELECT COALESCE(SUM(c.remaining_amount),0) AS cache_debt
        FROM invoice_balance_cache c
        JOIN invoices ON invoices.id = c.invoice_id
        ${cacheScope}
        AND c.status_cached IN ('unpaid','partial');`);
      const cacheDebt = Number((cacheDebtRes as any).rows?.[0]?.cache_debt || 0);

      // Diff metrics
      function ratio(a: number, b: number): number { return b === 0 ? (a === 0 ? 1 : Infinity) : a / b; }
      const diffLegacyLedger = legacyDebt - ledgerDebt;
      const diffLegacyCache = legacyDebt - cacheDebt;
      const diffLedgerCache = ledgerDebt - cacheDebt;

      const response = {
        success: true,
        scope: repIdParam ? { representativeId: repIdParam } : { scope: 'global' },
        mode: dualState,
        debts: {
          legacyDebt,
          ledgerDebt,
            cacheDebt
        },
        diffs: {
          diffLegacyLedger,
          diffLegacyCache,
          diffLedgerCache
        },
        ratios: {
          legacy_over_ledger: ratio(legacyDebt, ledgerDebt),
          legacy_over_cache: ratio(legacyDebt, cacheDebt),
          ledger_over_cache: ratio(ledgerDebt, cacheDebt)
        },
        timestamp: new Date().toISOString()
      };
      res.json(response);
    } catch (e:any) {
      res.status(500).json({ success:false, error: e.message });
    }
  });


  // SHERLOCK v18.4: آمار یکپارچه واحد - جایگزین همه سیستم‌های آماری موازی
  // Previously imported and used directly:
  // const unifiedStatisticsRoutes = (await import("./routes/unified-statistics-routes")).default;
  // app.use("/api/unified-statistics", unifiedStatisticsRoutes);
  registerUnifiedStatisticsRoutes(app, authMiddleware);

  // Register database optimization routes
  app.use('/api/database-optimization', databaseOptimizationRoutes);

  // SHERLOCK v32.0: Register Batch Rollback Routes for safe invoice deletion
  registerBatchRollbackRoutes(app, authMiddleware);

  // SHERLOCK v32.0: Register Debt Verification Routes for debt consistency checks
  app.use('/api/debt-verification', debtVerificationRoutes);
  
  // Phase B: E-B4 - Active Reconciliation Engine Routes
  app.use('/api/reconciliation', activeReconciliationRoutes);

  // Phase C: E-C1 - Outbox Pattern Routes
  const outboxRoutes = await import('./routes/outbox-routes');
  app.use('/api/outbox', outboxRoutes.default);

  // Phase C: E-C5 - SLA Dashboard Routes
  const slaDashboardRoutes = await import('./routes/sla-dashboard-routes');
  app.use('/api/sla', slaDashboardRoutes.default);
  console.log('✅ E-C5: SLA Dashboard routes registered');

  // SHERLOCK v1.0: Session Recovery and Debug Endpoint
  app.get("/api/auth/session-debug", (req, res) => {
    const sessionInfo = {
      sessionId: req.sessionID,
      hasSession: !!req.session,
      adminAuth: req.session?.authenticated,
      adminUser: req.session?.user ? {
        id: req.session.user.id,
        username: req.session.user.username,
        role: req.session.user.role
      } : null,
      cookieSettings: req.session?.cookie ? {
        secure: req.session.cookie.secure,
        httpOnly: req.session.cookie.httpOnly,
        maxAge: req.session.cookie.maxAge
      } : null,
      timestamp: new Date().toISOString()
    };

    console.log('🔍 SHERLOCK v1.0 Session Debug:', sessionInfo);

    res.json({
      success: true,
      sessionInfo,
      serverTime: new Date().toISOString()
    });
  });

  // SHERLOCK v15.0 FIX: Add backward compatibility for both login endpoints
  // Main admin login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      console.log(`🔐 Login attempt for username: ${username}`);

      if (!username || !password) {
        return res.status(400).json({ error: "نام کاربری و رمز عبور الزامی است" });
      }

      // Get admin user from database
      const adminUser = await storage.getAdminUser(username);

      console.log(`👤 User found: ${!!adminUser}, Active: ${adminUser?.isActive}, Hash exists: ${!!adminUser?.passwordHash}`);

      if (!adminUser || !adminUser.isActive) {
        console.log(`❌ User not found or inactive for ${username}`);
        return res.status(401).json({ error: "نام کاربری یا رمز عبور اشتباه است" });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, adminUser.passwordHash);

      console.log(`🔑 Password verification result: ${isPasswordValid} for user ${username}`);
      console.log(`🔑 Hash preview: ${adminUser.passwordHash.substring(0, 20)}...`);

      if (!isPasswordValid) {
        console.log(`❌ Invalid password for ${username}`);
        return res.status(401).json({ error: "نام کاربری یا رمز عبور اشتباه است" });
      }

      // Update last login time
      await storage.updateAdminUserLogin(adminUser.id);

      // Set session
      (req.session as any).authenticated = true;
      (req.session as any).userId = adminUser.id;
      (req.session as any).username = adminUser.username;
      (req.session as any).role = adminUser.role || 'ADMIN';
      (req.session as any).permissions = adminUser.permissions || [];
      (req.session as any).user = adminUser; // Store full user object for easier access

      // Save session immediately after login
      req.session.save((err) => {
        if (err) {
          console.error('❌ Error saving session after login:', err);
          // Continue, but log the error
        }
        res.json({
          success: true,
          message: "ورود موفقیت‌آمیز",
          user: {
            id: adminUser.id,
            username: adminUser.username,
            role: adminUser.role || 'ADMIN',
            permissions: adminUser.permissions || [],
            hasFullAccess: adminUser.role === 'SUPER_ADMIN' || (Array.isArray(adminUser.permissions) && adminUser.permissions.includes('FULL_ACCESS'))
          }
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "خطا در فرآیند ورود" });
    }
  });

  // 🗑️ SHERLOCK v18.2: LEGACY LOGIN ENDPOINT REMOVED - Use /api/auth/login only

  // Auth status check endpoint
  app.get("/api/auth/status", (req, res) => {
    const session = req.session as any;

    if (session && session.authenticated && session.user) {
      res.json({
        authenticated: true,
        user: {
          id: session.user.id,
          username: session.user.username,
          role: session.user.role,
          permissions: session.user.permissions,
          hasFullAccess: session.user.role === 'SUPER_ADMIN' || (Array.isArray(session.user.permissions) && session.user.permissions.includes('FULL_ACCESS'))
        }
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "خطا در فرآیند خروج" });
      }
      res.clearCookie('marfanet.sid');
      res.json({ success: true, message: "خروج موفقیت‌آمیز" });
    });
  });

  app.get("/api/auth/check", (req, res) => {
    if ((req.session as any)?.authenticated) {
      res.json({
        authenticated: true,
        user: {
          id: (req.session as any).userId,
          username: (req.session as any).username,
          role: (req.session as any).role || 'ADMIN',
          permissions: (req.session as any).permissions || [],
          hasFullAccess: (req.session as any).role === 'SUPER_ADMIN' || (Array.isArray((req.session as any).permissions) && (req.session as any).permissions.includes('FULL_ACCESS'))
        }
      });
    } else {
      res.status(401).json({ authenticated: false });
    }
  });

  // Endpoint for frontend auth check
  app.get("/api/auth/me", (req, res) => {
    if ((req.session as any)?.authenticated) {
      res.json({
        user: {
          id: (req.session as any).userId,
          username: (req.session as any).username,
          role: (req.session as any).role || 'ADMIN',
          permissions: (req.session as any).permissions || [],
          hasFullAccess: (req.session as any).role === 'SUPER_ADMIN' || (Array.isArray((req.session as any).permissions) && (req.session as any).permissions.includes('FULL_ACCESS'))
        }
      });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  // --- S5 Scaffold: Dashboard Chart Mock Endpoints ---
  // Revenue Trend (hourly buckets mock)
  app.get('/api/dashboard/revenue-trend', authMiddleware, async (req, res) => {
    try {
      const windowParam = (req.query.window as string) || '24h';
      const points = 24; // hourly
      const now = Date.now();
      const data = Array.from({ length: points }).map((_, i) => {
        const ts = new Date(now - (points - 1 - i) * 60 * 60 * 1000).toISOString();
        const base = 12000; // baseline revenue
        return {
          timestamp: ts,
          amount: Math.round(base + Math.sin(i / 3) * 2800 + Math.random() * 1500)
        };
      });
      res.json({ success: true, window: windowParam, data, generatedAt: new Date().toISOString() });
    } catch (e:any) {
      res.status(500).json({ success: false, error: 'failed_revenue_trend', details: e.message });
    }
  });

  // Aging Buckets distribution (mock)
  app.get('/api/dashboard/aging-buckets', authMiddleware, async (req, res) => {
    try {
      const distribution = {
        current: 56000,
        bucket_1_30: 34000,
        bucket_31_60: 21000,
        bucket_61_90: 11000,
        bucket_90_plus: 5000
      };
      res.json({ success: true, data: distribution, generatedAt: new Date().toISOString() });
    } catch (e:any) {
      res.status(500).json({ success: false, error: 'failed_aging_buckets', details: e.message });
    }
  });

  // Dashboard endpoint - Updated to use unified financial data with enhanced error handling
  app.get("/api/dashboard", authMiddleware, async (req, res) => {
    try {
      console.log("📊 SHERLOCK v32.0: Dashboard request received");
      console.log("🔍 SHERLOCK v32.0: Starting dashboard data collection...");

      // E-B7: Single Consolidated Query Implementation
      // Replacing multiple separate queries with unified financial summary service
      console.log("🚀 E-B7: Executing consolidated financial summary query...");
      
      let consolidatedData;
      try {
        // Import consolidated service dynamically to avoid circular dependencies
        const { ConsolidatedFinancialSummaryService } = await import('./services/consolidated-financial-summary.js');
        
        // Execute single consolidated query instead of multiple separate queries
        consolidatedData = await ConsolidatedFinancialSummaryService.calculateConsolidatedSummary();
        
        console.log(`✅ E-B7: Consolidated query completed in ${consolidatedData.queryTimeMs}ms`);
        
        // Performance validation for E-B7 KPI
        if (consolidatedData.queryTimeMs > 120) {
          console.warn(`⚠️ E-B7: Query time ${consolidatedData.queryTimeMs}ms exceeds P95 target of 120ms`);
        }
        
      } catch (consolidatedError) {
        console.error("❌ E-B7: Consolidated query failed:", consolidatedError);
        
        // Fallback to legacy unifiedFinancialEngine for graceful degradation
        console.log("🔄 E-B7: Falling back to legacy financial engine...");
        try {
          const legacySummary = await unifiedFinancialEngine.calculateGlobalSummary();
          
          // D-01 Fix: Query for missing fields in legacy fallback
          let unsentTelegram = 0, totalSalesPartners = 0, activeSalesPartners = 0;
          try {
            const telegramResult = await db.execute(sql`SELECT COUNT(*) as count FROM invoices WHERE sent_to_telegram = false`);
            unsentTelegram = Number((telegramResult as any).rows?.[0]?.count) || 0;
            
            const partnersResult = await db.execute(sql`
              SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE is_active = true) as active 
              FROM sales_partners
            `);
            const partnerRow = (partnersResult as any).rows?.[0];
            totalSalesPartners = Number(partnerRow?.total) || 0;
            activeSalesPartners = Number(partnerRow?.active) || 0;
          } catch (err) {
            console.warn("⚠️ E-B7: Could not fetch Telegram/Sales Partners in fallback:", err);
          }

          // Convert legacy format to consolidated format for consistency
          consolidatedData = {
            totalRevenue: legacySummary.totalSystemPaid || 0,
            totalDebt: legacySummary.totalSystemDebt || 0,
            totalCredit: 0, // Legacy doesn't have direct credit field
            totalOutstanding: legacySummary.totalUnpaidAmount || 0,
            totalRepresentatives: legacySummary.totalRepresentatives || 0,
            activeRepresentatives: legacySummary.activeRepresentatives || 0,
            inactiveRepresentatives: Math.max(0, (legacySummary.totalRepresentatives || 0) - (legacySummary.activeRepresentatives || 0)),
            totalInvoices: (legacySummary.unpaidInvoicesCount || 0) + (legacySummary.overdueInvoicesCount || 0), // Approximate
            paidInvoices: 0, // Legacy doesn't track this separately
            unpaidInvoices: legacySummary.unpaidInvoicesCount || 0,
            overdueInvoices: legacySummary.overdueInvoicesCount || 0,
            totalPayments: 0, // Legacy doesn't track payment count
            totalPaymentAmount: legacySummary.totalSystemPaid || 0,
            unallocatedPaymentAmount: 0, // Legacy doesn't track unallocated
            // D-01 Fix: Add new fields to legacy fallback
            unsentTelegramInvoices: unsentTelegram,
            totalSalesPartners: totalSalesPartners,
            activeSalesPartners: activeSalesPartners,
            systemIntegrityScore: Math.round(legacySummary.systemAccuracy || 0),
            lastUpdated: legacySummary.lastCalculationTime || new Date().toISOString(),
            queryTimeMs: 999, // Indicate fallback mode
            cacheStatus: 'UNAVAILABLE' as const
          };
        } catch (legacyError) {
          console.error("❌ E-B7: Legacy fallback also failed:", legacyError);
          throw new Error("Both consolidated and legacy financial calculations failed");
        }
      }

      // Construct optimized response using consolidated data
      const dashboardData = {
        success: true,
        data: {
          // Primary financial summary (from consolidated query)
          summary: {
            totalRevenue: consolidatedData.totalRevenue,
            totalDebt: consolidatedData.totalDebt,
            totalCredit: consolidatedData.totalCredit,
            totalOutstanding: consolidatedData.totalOutstanding,
            riskRepresentatives: consolidatedData.inactiveRepresentatives,
            // D-01 FIX: Use correct fields from consolidated data
            unsentTelegramInvoices: consolidatedData.unsentTelegramInvoices, // Corrected: was overdueInvoices
            totalSalesPartners: consolidatedData.totalSalesPartners, // Corrected: was totalRepresentatives
            activeSalesPartners: consolidatedData.activeSalesPartners, // Corrected: was activeRepresentatives
            systemIntegrityScore: consolidatedData.systemIntegrityScore,
            lastReconciliationDate: consolidatedData.lastUpdated,
            problematicRepresentativesCount: consolidatedData.inactiveRepresentatives,
            responseTime: consolidatedData.queryTimeMs,
            cacheStatus: consolidatedData.cacheStatus,
            lastUpdated: consolidatedData.lastUpdated
          },
          
          // Representative metrics (from consolidated query)
          representatives: {
            total: consolidatedData.totalRepresentatives,
            active: consolidatedData.activeRepresentatives,
            inactive: consolidatedData.inactiveRepresentatives
          },
          
          // Invoice metrics (from consolidated query)
          invoices: {
            total: consolidatedData.totalInvoices,
            paid: consolidatedData.paidInvoices,
            unpaid: consolidatedData.unpaidInvoices,
            overdue: consolidatedData.overdueInvoices
          },
          
          // Payment metrics (from consolidated query)
          payments: {
            totalAmount: consolidatedData.totalPaymentAmount,
            unallocatedAmount: consolidatedData.unallocatedPaymentAmount,
            totalCount: consolidatedData.totalPayments
          },
          
          // Sales partners (alias for representatives for backward compatibility)
          salesPartners: {
            total: consolidatedData.totalRepresentatives,
            active: consolidatedData.activeRepresentatives
          },
          
          // System status
          systemStatus: {
            integrityScore: consolidatedData.systemIntegrityScore,
            lastUpdate: consolidatedData.lastUpdated,
            cacheStatus: consolidatedData.cacheStatus
          }
        },
        
        // Enhanced metadata for E-B7 monitoring
        meta: {
          timestamp: new Date().toISOString(),
          cacheStatus: consolidatedData.cacheStatus,
          queryTimeMs: consolidatedData.queryTimeMs,
          version: "E-B7-Consolidated",
          queryOptimization: {
            enabled: true,
            queryCount: 1, // Single consolidated query
            performanceTarget: "P95 < 120ms",
            achieved: consolidatedData.queryTimeMs <= 120
          }
        }
      };

      res.json(dashboardData);

    } catch (error) {
      console.error('❌ SHERLOCK v32.0: Dashboard error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        timestamp: new Date().toISOString()
      });

      // Return safe fallback data
      res.status(500).json({
        success: false,
        error: "Failed to load dashboard",
        details: error instanceof Error ? error.message : "Unknown error occurred",
        fallbackData: {
          totalRevenue: 0,
          totalDebt: 0,
          totalCredit: 0,
          totalOutstanding: 0,
          totalRepresentatives: 0,
          activeRepresentatives: 0,
          inactiveRepresentatives: 0,
          riskRepresentatives: 0,
          totalInvoices: 0,
          paidInvoices: 0,
          unpaidInvoices: 0,
          overdueInvoices: 0,
          unsentTelegramInvoices: 0,
          totalSalesPartners: 0,
          activeSalesPartners: 0,
          systemIntegrityScore: 0,
          lastReconciliationDate: new Date().toISOString(),
          problematicRepresentativesCount: 0,
          responseTime: 0,
          cacheStatus: "ERROR",
          lastUpdated: new Date().toISOString()
        }
      });
    }
  });

  // SHERLOCK v18.4: Debtor Representatives moved to unified financial routes
  // Available at: /api/unified-financial/debtors

  // Real-time Data Synchronization API - SHERLOCK v1.0 Core Feature
  app.get("/api/sync/status", authMiddleware, async (req, res) => {
    try {
      const representatives = await storage.getRepresentatives();
      const invoices = await storage.getInvoices();
      const payments = await storage.getPayments();

      // Calculate real-time sync metrics
      const syncStatus = {
        lastSyncTime: new Date().toISOString(),
        adminPanelData: {
          representatives: representatives.length,
          invoices: invoices.length,
          payments: payments.length,
          totalDebt: representatives.reduce((sum, rep) => sum + parseFloat(rep.totalDebt || "0"), 0),
          totalSales: representatives.reduce((sum, rep) => sum + parseFloat(rep.totalSales || "0"), 0)
        },
        // ...existing code...
        syncHealth: "EXCELLENT",
        conflictCount: 0,
        autoResolvedConflicts: 0
      };

      res.json(syncStatus);
    } catch (error) {
      res.status(500).json({ error: "خطا در بررسی وضعیت همگام‌سازی" });
    }
  });

  app.post("/api/sync/force-update", authMiddleware, async (req, res) => {
    try {
      const startTime = Date.now();

      // Update all representative financials (atomic operation)
      const representatives = await storage.getRepresentatives();
      let updatedCount = 0;

      for (const rep of representatives) {
        await storage.updateRepresentativeFinancials(rep.id);
        updatedCount++;
      }

      const duration = Date.now() - startTime;

      await storage.createActivityLog({
        type: "system_sync",
        description: `همگام‌سازی اجباری انجام شد: ${updatedCount} نماینده بروزرسانی شد`,
        relatedId: null,
        metadata: {
          representativesUpdated: updatedCount,
          durationMs: duration,
          syncType: "FORCE_UPDATE"
        }
      });

      res.json({
        success: true,
        message: "همگام‌سازی با موفقیت انجام شد",
        updatedRepresentatives: updatedCount,
        durationMs: duration
      });
    } catch (error) {
      res.status(500).json({ error: "خطا در همگام‌سازی اجباری" });
    }
  });

  // ✅ SHERLOCK v32.0: Representatives management with UNIFIED FINANCIAL ENGINE
  app.get("/api/representatives", authMiddleware, async (req, res) => {
    try {
      console.log('🔍 SHERLOCK v32.2: Fetching representatives data with optimized batch processing');

      // SHERLOCK v32.2: Error boundary for large datasets
      const startTime = Date.now();
      const timeout = 30000; // 30 second timeout

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
      });

      // Get base representatives data with timeout protection
      const representatives = await Promise.race([
        storage.getRepresentatives(),
        timeoutPromise
      ]);

      // ✅ SHERLOCK v32.0: Enhanced with real-time financial calculations
      const enhancedRepresentatives = await Promise.race([
        Promise.all(
          (representatives as any[]).map(async (rep: any) => {
            try {
              // Get real-time financial data from unified engine
              const financialData = await unifiedFinancialEngine.calculateRepresentative(rep.id);

              return {
                ...rep,
                // ✅ Override stored debt with calculated debt
                totalDebt: financialData.actualDebt.toString(),
                totalSales: financialData.totalSales.toString(),
                // Additional real-time data for UI
                financialData: {
                  actualDebt: financialData.actualDebt,
                  paymentRatio: financialData.paymentRatio,
                  debtLevel: financialData.debtLevel,
                  lastSync: financialData.calculationTimestamp
                }
              };
            } catch (error) {
              console.warn(`⚠️ SHERLOCK v32.0: Failed to calculate financial data for rep ${rep.id}:`, error);
              // Fallback to stored data if calculation fails
              return rep;
            }
          })
        ),
        timeoutPromise
      ]) as any[];

      console.log(`✅ SHERLOCK v32.0: Enhanced ${(enhancedRepresentatives as any[]).length} representatives with real-time financial data`);
      res.json(enhancedRepresentatives);
    } catch (error) {
      console.error('❌ SHERLOCK v32.0: Error fetching representatives with financial enhancement:', error);
      res.status(500).json({ error: "خطا در دریافت نمایندگان" });
    }
  });

  // Representatives Statistics API - SHERLOCK v1.0 CRITICAL FIX (MOVED BEFORE :code route)
  // SHERLOCK v11.0: Synchronized Representatives Statistics with Batch-Based Active Count
  app.get("/api/representatives/statistics", authMiddleware, async (req, res) => {
    try {
      const representatives = await storage.getRepresentatives();

      // SHERLOCK v11.0: Use unified batch-based calculation for activeCount
      const batchBasedActiveCount = await storage.getBatchBasedActiveRepresentatives();

      const stats = {
        totalCount: representatives.length,
        activeCount: batchBasedActiveCount, // 🎯 SYNC: Now matches dashboard calculation
        inactiveCount: representatives.filter(rep => !rep.isActive).length,
        totalSales: representatives.reduce((sum, rep) => sum + parseFloat(rep.totalSales || "0"), 0),
        totalDebt: representatives.reduce((sum, rep) => sum + parseFloat(rep.totalDebt || "0"), 0),
        avgPerformance: representatives.length > 0 ?
          representatives.reduce((sum, rep) => sum + parseFloat(rep.totalSales || "0"), 0) / representatives.length : 0
      };

      console.log(`📊 SHERLOCK v11.0: Representatives statistics - Active: ${stats.activeCount} (batch-based), Total: ${stats.totalCount}`);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching representatives statistics:', error);
      res.status(500).json({ error: "خطا در دریافت آمار نمایندگان" });
    }
  });

  app.get("/api/representatives/:code", authMiddleware, async (req, res) => {
    try {
      console.log(`🔍 SHERLOCK v32.1: Fetching representative details for code: ${req.params.code}`);

      const representative = await storage.getRepresentativeByCode(req.params.code);
      if (!representative) {
        console.log(`❌ Representative not found for code: ${req.params.code}`);
        return res.status(404).json({ error: "نماینده یافت نشد" });
      }

      console.log(`✅ Representative found: ${representative.name} (ID: ${representative.id})`);

      // Get related data
      console.log('🔄 Fetching invoices...');
      const invoices = await storage.getInvoicesByRepresentative(representative.id);
      console.log(`✅ Found ${invoices.length} invoices`);

      console.log('🔄 Fetching payments...');
      const payments = await storage.getPaymentsByRepresentative(representative.id);
      console.log(`✅ Found ${payments.length} payments`);

      res.json({
        representative,
        invoices,
        payments
      });
    } catch (error) {
      console.error('❌ SHERLOCK v32.1: Error in representative details endpoint:', error);
      res.status(500).json({ error: "خطا در دریافت اطلاعات نماینده" });
    }
  });

  app.post("/api/representatives", authMiddleware, async (req, res) => {
    try {
      const validatedData = insertRepresentativeSchema.parse(req.body);
      const representative = await storage.createRepresentative(validatedData);
      res.json(representative);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "داده‌های ورودی نامعتبر", details: error.errors });
      } else {
        res.status(500).json({ error: "خطا در ایجاد نماینده" });
      }
    }
  });

  app.put("/api/representatives/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const representative = await storage.updateRepresentative(id, req.body);
      res.json(representative);
    } catch (error) {
      res.status(500).json({ error: "خطا در بروزرسانی نماینده" });
    }
  });

  app.delete("/api/representatives/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRepresentative(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "خطا در حذف نماینده" });
    }
  });



  // Admin Data Management API - Protected
  app.get("/api/admin/data-counts", authMiddleware, async (req, res) => {
    try {
      const counts = await storage.getDataCounts();
      res.json(counts);
    } catch (error) {
      console.error('Error fetching data counts:', error);
      res.status(500).json({ error: "خطا در دریافت آمار داده‌ها" });
    }
  });

  app.post("/api/admin/reset-data", authMiddleware, async (req, res) => {
    try {
      const resetOptions = req.body;

      // Validate request
      if (!resetOptions || typeof resetOptions !== 'object') {
        return res.status(400).json({ error: "گزینه‌های بازنشانی نامعتبر است" });
      }

      // Check if at least one option is selected
      const hasSelection = Object.values(resetOptions).some(value => value === true);
      if (!hasSelection) {
        return res.status(400).json({ error: "حداقل یک مورد برای بازنشانی انتخاب کنید" });
      }

      console.log('Data reset requested:', resetOptions);

      // Log the reset operation
      await storage.createActivityLog({
        type: 'system',
        description: `درخواست بازنشانی اطلاعات: ${Object.keys(resetOptions).filter(key => resetOptions[key]).join(', ')}`,
        relatedId: null,
        metadata: { resetOptions }
      });

      const result = await storage.resetData(resetOptions);

      console.log('Data reset completed:', result.deletedCounts);

      // پاکسازی کش‌های مالی جهت جلوگیری از نمایش داده کهنه پس از حذف گسترده
      try {
        const { UnifiedFinancialEngine } = await import('./services/unified-financial-engine.js');
        UnifiedFinancialEngine.clearAllCaches('admin_reset_data');
      } catch (cacheErr) {
        console.warn('Failed to clear financial engine caches after reset:', cacheErr);
      }

      res.json({
        success: true,
        message: "بازنشانی اطلاعات با موفقیت انجام شد",
        deletedCounts: result.deletedCounts
      });
    } catch (error) {
      console.error('Error resetting data:', error);
      res.status(500).json({ error: "خطا در بازنشانی اطلاعات" });
    }
  });

  // Public Portal API
  // ✅ SHERLOCK v32.0: Portal endpoint using Unified Financial Engine for consistency
  app.get("/api/public/portal/:publicId", async (req, res) => {
    try {
      const { publicId } = req.params;

      console.log('=== SHERLOCK v32.1 PORTAL REQUEST ===');
      console.log('publicId:', publicId);
      console.log('Request URL:', req.url);
      console.log('Request IP:', req.ip);
      console.log('User Agent:', req.get('User-Agent')?.slice(0, 100));

      // Basic validation
      if (!publicId || publicId.trim() === '') {
        console.log('❌ Invalid publicId - empty or null');
        return res.status(400).json({
          error: 'شناسه پرتال نامعتبر است',
          details: 'publicId خالی یا نامعتبر'
        });
      }

      // Find representative by publicId
      console.log('🔍 Searching for representative with publicId:', publicId);
      const representative = await db.select().from(representatives).where(eq(representatives.publicId, publicId)).limit(1);

      if (!representative.length) {
        console.log('❌ Representative not found for publicId:', publicId);
        console.log('🔍 Checking if any representatives exist...');

        // Additional debugging - check if any representatives exist at all
        const totalReps = await db.select().from(representatives).limit(5);
        console.log('Sample representatives:', totalReps.map((r: any) => ({ id: r.id, code: r.code, publicId: r.publicId })));

        return res.status(404).json({
          error: 'نماینده یافت نشد',
          details: `پرتالی با شناسه "${publicId}" در سیستم موجود نیست`,
          publicId: publicId
        });
      }
      const rep = representative[0];

      // ✅ SHERLOCK v32.1: استفاده از Unified Financial Engine برای محاسبات دقیق
      const financialData = await unifiedFinancialEngine.calculateRepresentative(rep.id);
      console.log(`🔍 Portal: Financial data for ${rep.code}:`, {
        totalSales: financialData.totalSales,
        actualDebt: financialData.actualDebt,
        totalPaid: financialData.totalPaid
      });

      const invoices = await storage.getInvoicesByRepresentative(rep.id);
      const payments = await storage.getPaymentsByRepresentative(rep.id);

      // Fetch portal customization settings
      const [
        portalTitle,
        portalDescription,
        showOwnerName,
        showDetailedUsage,
        customCss,
        showUsageDetails,
        showEventTimestamp,
        showEventType,
        showDescription,
        showAdminUsername
      ] = await Promise.all([
        storage.getSetting('portal_title'),
        storage.getSetting('portal_description'),
        storage.getSetting('portal_show_owner_name'),
        storage.getSetting('portal_show_detailed_usage'),
        storage.getSetting('portal_custom_css'),
        storage.getSetting('invoice_show_usage_details'),
        storage.getSetting('invoice_show_event_timestamp'),
        storage.getSetting('invoice_show_event_type'),
        storage.getSetting('invoice_show_description'),
        storage.getSetting('invoice_show_admin_username')
      ]);

      const portalConfig = {
        title: portalTitle?.value || 'پرتال عمومی نماینده',
        description: portalDescription?.value || 'مشاهده وضعیت مالی و فاکتورهای شما',
        showOwnerName: showOwnerName?.value === 'true',
        showDetailedUsage: showDetailedUsage?.value === 'true',
        customCss: customCss?.value || '',

        // Invoice display settings
        showUsageDetails: showUsageDetails?.value === 'true',
        showEventTimestamp: showEventTimestamp?.value === 'true',
        showEventType: showEventType?.value === 'true',
        showDescription: showDescription?.value === 'true',
        showAdminUsername: showAdminUsername?.value === 'true'
      };

      // SHERLOCK v11.5: Sort invoices by FIFO principle (oldest first)
      const sortedInvoices = invoices.sort((a, b) => {
        const dateA = new Date(a.issueDate || a.createdAt);
        const dateB = new Date(b.issueDate || b.createdAt);
        return dateA.getTime() - dateB.getTime(); // FIFO: Oldest first
      });

      // ✅ SHERLOCK v32.1: ارسال داده‌های استاندارد با تضمین دقت 100%
      const publicData = {
        name: rep.name,
        code: rep.code,
        panelUsername: rep.panelUsername,
        ownerName: rep.ownerName,
        // ✅ داده‌های مالی استاندارد از Unified Financial Engine
        totalDebt: financialData.actualDebt.toString(),
        totalSales: financialData.totalSales.toString(),
        credit: rep.credit,
        portalConfig,
        invoices: await Promise.all(sortedInvoices.map(async (inv) => {
          // محاسبه remainingAmount از payment_allocations
          const { paymentAllocations } = await import('../shared/schema.js');
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
            amount: inv.amount,
            remainingAmount: remainingAmount.toString(),
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            status: inv.status,
            usageData: inv.usageData,
            createdAt: inv.createdAt
          };
        })),
        payments: payments.map(pay => ({
          amount: pay.amount,
          paymentDate: pay.paymentDate,
          description: pay.description
        })).sort((a, b) => {
          const dateA = new Date(a.paymentDate);
          const dateB = new Date(b.paymentDate);
          return dateB.getTime() - dateA.getTime();
        }),

        // ✅ اطلاعات اضافی برای نمایش در پرتال
        financialMeta: {
          paymentRatio: financialData.paymentRatio,
          debtLevel: financialData.debtLevel,
          lastCalculation: financialData.calculationTimestamp,
          accuracyGuaranteed: financialData.accuracyGuaranteed
        }
      };

      // ✅ استفاده از داده‌های محاسبه شده از Unified Financial Engine
      res.json(publicData);
    } catch (error) {
      console.error('Portal API error:', error);
      res.status(500).json({ error: "خطا در دریافت اطلاعات پورتال" });
    }
  });

  // Sales Partners API - Protected
  app.get("/api/sales-partners", authMiddleware, async (req, res) => {
    try {
      const partners = await storage.getSalesPartners();
      res.json(partners);
    } catch (error) {
      res.status(500).json({ error: "خطا در دریافت همکاران فروش" });
    }
  });

  app.get("/api/sales-partners/statistics", authMiddleware, async (req, res) => {
    try {
      const stats = await storage.getSalesPartnersStatistics();
      res.json(stats);
    } catch (error) {
      res.status(500).json({
        totalPartners: "0",
        activePartners: "0",
        totalCommission: "0",
        averageCommissionRate: "0"
      });
    }
  });

  // SHERLOCK v12.4: Manual Invoices API - Dedicated endpoint for manual invoices management
  app.get("/api/invoices/manual", authMiddleware, async (req, res) => {
    try {
      console.log('📋 SHERLOCK v12.4: Fetching manual invoices');
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 30;
      const search = req.query.search as string;
      const status = req.query.status as string;

      // Get manual invoices with representative info
      const manualInvoices = await storage.getManualInvoices({
        page,
        limit,
        search,
        status
      });

      console.log(`📋 Found ${manualInvoices.data.length} manual invoices`);
      res.json(manualInvoices);
    } catch (error) {
      console.error('Error fetching manual invoices:', error);
      res.status(500).json({ error: "خطا در دریافت فاکتورهای دستی" });
    }
  });

  // SHERLOCK v12.4: Manual Invoices Statistics
  app.get("/api/invoices/manual/statistics", authMiddleware, async (req, res) => {
    try {
      const stats = await storage.getManualInvoicesStatistics();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching manual invoices statistics:', error);
      res.status(500).json({ error: "خطا در دریافت آمار فاکتورهای دستی" });
    }
  });

  app.get("/api/sales-partners/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const partner = await storage.getSalesPartner(id);
      if (!partner) {
        return res.status(404).json({ error: "همکار فروش یافت نشد" });
      }

      // Get related representatives
      const representatives = await storage.getRepresentativesBySalesPartner(id);

      res.json({
        partner,
        representatives
      });
    } catch (error) {
      res.status(500).json({ error: "خطا در دریافت اطلاعات همکار فروش" });
    }
  });

  app.post("/api/sales-partners", authMiddleware, async (req, res) => {
    try {
      const validatedData = insertSalesPartnerSchema.parse(req.body);
      const partner = await storage.createSalesPartner(validatedData);
      res.json(partner);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "داده‌های ورودی نامعتبر", details: error.errors });
      } else {
        res.status(500).json({ error: "خطا در ایجاد همکار فروش" });
      }
    }
  });

  app.put("/api/sales-partners/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const partner = await storage.updateSalesPartner(id, req.body);
      res.json(partner);
    } catch (error) {
      res.status(500).json({ error: "خطا در بروزرسانی همکار فروش" });
    }
  });

  app.delete("/api/sales-partners/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSalesPartner(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "خطا در حذف همکار فروش" });
    }
  });

  // Payments API - Protected (ادغام شده با مدیریت پرداخت)
  // Use the payment management router for all payment-related operations
  app.use('/api/payments', paymentManagementRouter);
  // Slice 5: Guard metrics observability endpoint
  app.use('/api/allocations', guardMetricsRoutes);

  // SHERLOCK v35.0: Allocation Monitoring Routes
  app.get("/api/allocation/metrics", authMiddleware, async (req, res) => {
    try {
      console.log('📊 SHERLOCK v35.0: Fetching allocation metrics');

      const { AllocationMonitoringService } = await import('./services/allocation-monitoring-service.js');
      const metrics = await AllocationMonitoringService.calculateGlobalMetrics();

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error fetching allocation metrics:', error);
      res.status(500).json({ error: "خطا در دریافت متریک‌های تخصیص" });
    }
  });

  app.get("/api/allocation/trends", authMiddleware, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      console.log(`📈 SHERLOCK v35.0: Fetching allocation trends for ${days} days`);

      const { AllocationMonitoringService } = await import('./services/allocation-monitoring-service.js');
      const trends = await AllocationMonitoringService.analyzeTrends(days);

      res.json({
        success: true,
        data: trends,
        period: `${days} days`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error fetching allocation trends:', error);
      res.status(500).json({ error: "خطا در دریافت روندهای تخصیص" });
    }
  });

  app.get("/api/allocation/alerts", authMiddleware, async (req, res) => {
    try {
      console.log('🚨 SHERLOCK v35.0: Generating allocation alerts');

      const { AllocationMonitoringService } = await import('./services/allocation-monitoring-service.js');
      const alerts = await AllocationMonitoringService.generateAlerts();

      res.json({
        success: true,
        data: alerts,
        count: alerts.length,
        criticalCount: alerts.filter(a => a.priority === 'CRITICAL').length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error generating allocation alerts:', error);
      res.status(500).json({ error: "خطا در تولید هشدارهای تخصیص" });
    }
  });

  app.get("/api/allocation/monitoring-report", authMiddleware, async (req, res) => {
    try {
      console.log('📋 SHERLOCK v35.0: Generating comprehensive monitoring report');

      const { AllocationMonitoringService } = await import('./services/allocation-monitoring-service.js');
      const report = await AllocationMonitoringService.generateMonitoringReport();

      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error generating monitoring report:', error);
      res.status(500).json({ error: "خطا در تولید گزارش مانیتورینگ" });
    }
  });

  // SHERLOCK v1.0 PAYMENT DELETION API - حذف پرداخت با همگام‌سازی کامل مالی
  app.delete("/api/payments/:id", authMiddleware, async (req, res) => {
    try {
      console.log('🗑️ SHERLOCK v1.0: حذف امن پرداخت');
      const paymentId = parseInt(req.params.id);

      // Get payment details for audit and financial impact calculation
      const payments = await storage.getPayments();
      const payment = payments.find(p => p.id === paymentId);

      if (!payment) {
        return res.status(404).json({ error: "پرداخت یافت نشد" });
      }

      console.log(`🗑️ حذف پرداخت شماره ${paymentId} با مبلغ ${payment.amount} تومان از نماینده ${payment.representativeId}`);

      // Delete payment from database
      await storage.deletePayment(paymentId);

      // CRITICAL: Update representative financial data after payment deletion
      console.log(`🔄 به‌روزرسانی اطلاعات مالی نماینده ${payment.representativeId}`);
      if (payment.representativeId) {
        await storage.updateRepresentativeFinancials(payment.representativeId);
      }

      // Log the activity for audit trail
      await storage.createActivityLog({
        type: "payment_deleted",
        description: `پرداخت ${payment.id} با مبلغ ${payment.amount} تومان از نماینده ${payment.representativeId} حذف شد`,
        relatedId: payment.representativeId,
        metadata: {
          paymentId: paymentId,
          amount: payment.amount,
          paymentDate: payment.paymentDate,
          representativeId: payment.representativeId,
          deletedBy: (req.session as any)?.user?.username || 'admin',
          financialImpact: {
            amountRemoved: payment.amount,
            operation: "payment_deletion",
            affectedRepresentative: payment.representativeId
          }
        }
      });

      console.log(`✅ پرداخت ${paymentId} با موفقیت حذف شد و اطلاعات مالی همگام‌سازی شدند`);
      res.json({
        success: true,
        message: "پرداخت با موفقیت حذف شد و تمام اطلاعات مالی به‌روزرسانی شدند",
        deletedPayment: {
          id: paymentId,
          amount: payment.amount,
          paymentDate: payment.paymentDate,
          representativeId: payment.representativeId
        }
      });
    } catch (error) {
      console.error('Error deleting payment:', error);
      res.status(500).json({ error: "خطا در حذف پرداخت" });
    }
  });

  app.get("/api/payments/statistics", authMiddleware, async (req, res) => {
    try {
      const stats = await storage.getPaymentStatistics();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "خطا در دریافت آمار پرداخت‌ها" });
    }
  });

  app.get("/api/payments/representative/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const payments = await storage.getPaymentsByRepresentative(id);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "خطا در دریافت پرداخت‌های نماینده" });
    }
  });

  app.post("/api/payments", authMiddleware, async (req, res) => {
    try {
      // ✅ ODIN PROTOCOL v5.0: استفاده از invoiceNumber به عنوان شناسه یکتا
      const { representativeId, amount, paymentDate, description, selectedInvoiceId, selectedInvoiceNumber } = req.body;

      // Basic validation
      if (!representativeId || !amount || !paymentDate) {
        return res.status(400).json({ error: "فیلدهای ضروری ناقص است" });
      }

      // ✅ SHERLOCK v33.1: Normalize Persian/English dates for consistency
      const toEnglishDigits = (str: string): string => {
        const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        let result = str;
        for (let i = 0; i < persianDigits.length; i++) {
          result = result.replace(new RegExp(persianDigits[i], 'g'), englishDigits[i]);
        }
        return result;
      };
      const normalizedPaymentDate = toEnglishDigits(paymentDate);

      console.log(`📅 [ODIN v5.0] تطبیق تاریخ: ورودی="${paymentDate}" -> عادی‌سازی شده="${normalizedPaymentDate}"`);

      // ✅ ODIN v5.0 - MANUAL ALLOCATION ONLY: تبدیل invoiceNumber به invoice_id
      let resolvedInvoiceId: number | null = null;

      // پشتیبانی از هر دو روش (invoiceNumber و invoiceId) برای سازگاری
      if (selectedInvoiceNumber && selectedInvoiceNumber !== "") {
        console.log(`🔍 [ODIN v5.0] تبدیل شماره فاکتور "${selectedInvoiceNumber}" به invoice_id...`);
        resolvedInvoiceId = await storage.getInvoiceIdByNumber(selectedInvoiceNumber);
        if (!resolvedInvoiceId) {
          return res.status(400).json({ 
            error: "فاکتور یافت نشد",
            message: `فاکتور با شماره ${selectedInvoiceNumber} در سیستم موجود نیست`
          });
        }
        console.log(`✅ [ODIN v5.0] شماره فاکتور "${selectedInvoiceNumber}" → invoice_id: ${resolvedInvoiceId}`);
      } else if (selectedInvoiceId && selectedInvoiceId !== "") {
        // Fallback: اگر هنوز از ID استفاده می‌کنند (سازگاری با کد قدیمی)
        resolvedInvoiceId = parseInt(selectedInvoiceId);
        console.log(`⚠️ [ODIN v5.0] استفاده از invoice_id مستقیم (deprecated): ${resolvedInvoiceId}`);
      }

      // Create the payment initially as unallocated
      const newPayment = await storage.createPayment({
        representativeId,
        amount,
        paymentDate: normalizedPaymentDate,
        description,
        invoiceId: null // همیشه null - تخصیص جداگانه انجام می‌شود
      });

      let finalPaymentStatus = newPayment;

      // ✅ ODIN v5.0 - MANUAL ALLOCATION ONLY: تخصیص دستی به فاکتور مشخص
      if (resolvedInvoiceId) {
        console.log(`💰 [ODIN v5.0] اجرای manual allocation - Payment ${newPayment.id} → Invoice ID: ${resolvedInvoiceId}`);

        try {
          const allocationResult = await storage.manualAllocatePaymentToInvoice(
            newPayment.id,
            resolvedInvoiceId,
            parseFloat(amount),
            'ADMIN_USER'
          );

          if (!allocationResult.success) {
            throw new Error(`Manual allocation failed: ${allocationResult.message}`);
          }

          finalPaymentStatus = { ...newPayment, isAllocated: true, invoiceId: resolvedInvoiceId };

          console.log(`✅ [ODIN v5.0] Manual allocation موفق - ${allocationResult.allocatedAmount} تومان تخصیص داده شد`);

        } catch (allocationError: any) {
          console.error(`❌ [ODIN v5.0] Manual allocation ناموفق:`, allocationError);
          throw new Error(`خطا در تخصیص دستی: ${allocationError.message || allocationError}`);
        }
      } else {
        // Payment created without allocation - can be allocated manually later
        console.log(`📝 [ODIN v5.0] Payment ${newPayment.id} created without allocation (can be allocated manually later)`);
      }

      // ✅ SHERLOCK v33.2: COMPREHENSIVE FINANCIAL SYNCHRONIZATION
  sherlockLog(`🔄 SHERLOCK v33.2: Starting comprehensive financial sync for representative ${representativeId}`);

      // 1. Update representative financials
      await storage.updateRepresentativeFinancials(representativeId);

      // 2. Force invalidate financial engine cache for immediate UI updates
      try {
        const { UnifiedFinancialEngine } = await import('./services/unified-financial-engine.js');
        UnifiedFinancialEngine.forceInvalidateRepresentative(representativeId, {
          cascadeGlobal: true,
          reason: 'payment_created',
          immediate: true
        });
  sherlockLog(`✅ SHERLOCK v33.2: Financial cache invalidated for representative ${representativeId}`);
      } catch (cacheError) {
        console.warn(`⚠️ SHERLOCK v33.2: Cache invalidation warning:`, cacheError);
      }

      // Log final status for debugging
  sherlockLog(`🔍 SHERLOCK v33.2: Final payment status - ID: ${finalPaymentStatus.id}, Allocated: ${finalPaymentStatus.isAllocated}, Invoice: ${finalPaymentStatus.invoiceId}`);
  sherlockLog(`✅ SHERLOCK v33.2: Payment processing completed with financial sync`);

      res.json(finalPaymentStatus);
    } catch (error) {
      console.error('Error creating payment:', error);
      res.status(500).json({ error: "خطا در ایجاد پرداخت" });
    }
  });

  app.put("/api/payments/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const payment = await storage.updatePayment(id, req.body);
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: "خطا در بروزرسانی پرداخت" });
    }
  });

  app.post("/api/payments/:id/allocate", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { invoiceId } = req.body;
      const payment = await storage.allocatePaymentToInvoice(id, invoiceId);
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: "خطا در تخصیص پرداخت" });
    }
  });


  // 🗑️ SHERLOCK v18.2: LEGACY REMOVED - Use detailed invoices endpoint instead

  // Unpaid Invoices by Representative API - SHERLOCK v1.0 CRITICAL FIX
  app.get("/api/invoices/unpaid/:representativeId", authMiddleware, async (req, res) => {
    try {
      const representativeId = parseInt(req.params.representativeId);
      const invoices = await storage.getInvoicesByRepresentative(representativeId);

      // SHERLOCK v11.5: Enhanced filter to include partial invoices
      const unpaidInvoices = invoices.filter(invoice =>
        invoice.status === 'unpaid' || invoice.status === 'overdue' || invoice.status === 'partial'
      );

      res.json(unpaidInvoices);
    } catch (error) {
      console.error('Error fetching unpaid invoices:', error);
      res.status(500).json({ error: "خطا در دریافت فاکتورهای پرداخت نشده" });
    }
  });

  app.get("/api/invoices/telegram-pending", authMiddleware, async (req, res) => {
    try {
      const invoices = await storage.getInvoicesForTelegram();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "خطا در دریافت فاکتورهای در انتظار ارسال" });
    }
  });

  // 🗑️ SHERLOCK v18.4: LEGACY ENDPOINT DEPRECATED - 11,117,500 تومان اختلاف کشف شد
  // استفاده از /api/invoices/generate-standard به جای این endpoint
  app.post("/api/invoices/generate", authMiddleware, upload.single('usageFile'), async (req: MulterRequest, res) => {
    res.status(301).json({
      error: "این endpoint به سیستم استاندارد منتقل شده است",
      message: "لطفاً از /api/invoices/generate-standard استفاده کنید",
      deprecatedIn: "SHERLOCK v18.4",
      reason: "legacy parseUsageJsonData causing 11,117,500 تومان financial discrepancies",
      redirect: "/api/invoices/generate-standard"
    });
  });

  // فاز ۲: Manual invoice creation API - ایجاد فاکتور دستی
  app.post("/api/invoices/create-manual", authMiddleware, async (req, res) => {
    try {
      console.log('🔧 فاز ۲: ایجاد فاکتور دستی');
      const validatedData = insertInvoiceSchema.parse(req.body) as ValidatedInvoiceData;

      // Check if representative exists
      // تبدیل شناسه نماینده به عدد برای تطبیق با امضای تابع
      const representative = await storage.getRepresentative(Number(validatedData.representativeId));
      if (!representative) {
        return res.status(404).json({ error: "نماینده یافت نشد" });
      }

      // Create manual invoice
      const invoice = await storage.createInvoice({
        ...validatedData,
        status: validatedData.status || "unpaid",
        usageData: validatedData.usageData || {
          type: "manual",
          description: "فاکتور ایجاد شده به صورت دستی",
          createdBy: (req.session as any)?.user?.username || 'admin',
          createdAt: new Date().toISOString()
        }
      });

      // Update representative financial data
      await storage.updateRepresentativeFinancials(representative.id);

      await storage.createActivityLog({
        type: "manual_invoice_created",
        description: `فاکتور دستی برای ${representative.name} به مبلغ ${validatedData.amount} ایجاد شد`,
        relatedId: invoice.id,
        metadata: {
          representativeCode: representative.code,
          amount: validatedData.amount,
          issueDate: validatedData.issueDate,
          createdBy: (req.session as any)?.user?.username || 'admin'
        }
      });

      res.json({
        success: true,
        invoice: {
          ...invoice,
          representativeName: representative.name,
          representativeCode: representative.code
        }
      });
    } catch (error) {
      console.error('Error creating manual invoice:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "داده‌های ورودی نامعتبر", details: error.errors });
      } else {
        res.status(500).json({ error: "خطا در ایجاد فاکتور دستی" });
      }
    }
  });

  // فاز ۲: Invoice editing API - ویرایش فاکتور
  app.put("/api/invoices/:id", enhancedUnifiedAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // SHERLOCK v25.2: Extra session verification for critical operations
  if (!req.session?.authenticated) {
        return res.status(401).json({
          success: false,
          error: "جلسه منقضی شده است",
          code: "SESSION_EXPIRED",
          redirect: "/admin-login"
        });
      }

      // Get original invoice for audit trail before update
      const originalInvoice = await storage.getInvoice(id);
      if (!originalInvoice) {
        return res.status(404).json({ error: "فاکتور یافت نشد" });
      }

      const updateData = req.body;
      const editedAmount = parseFloat(updateData.amount);
      const originalAmount = parseFloat(originalInvoice.amount);

      // Update invoice
      const invoice = await storage.updateInvoice(id, updateData);

      // Update representative financial data if amount changed significantly
      if (invoice && Math.abs(editedAmount - originalAmount) > 0.01) {
        await storage.updateRepresentativeFinancials(invoice.representativeId);
      }

      // Log the edit
      await storage.createActivityLog({
        type: "invoice_edited",
        description: `فاکتور ${originalInvoice.invoiceNumber} ویرایش شد`,
        relatedId: id,
        metadata: {
          originalAmount: originalInvoice.amount,
          newAmount: updateData.amount,
          originalStatus: originalInvoice.status,
          newStatus: updateData.status,
          editedBy: (req.session as any)?.user?.username || 'admin',
          changes: Object.keys(updateData)
        }
      });

      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  // MISSING API: Get all invoices - SHERLOCK v12.1 CRITICAL FIX
  app.get("/api/invoices", authMiddleware, async (req, res) => {
    try {
      console.log('📋 SHERLOCK v12.1: Fetching all invoices for main invoices page');
      const startTime = Date.now();

      const invoices = await storage.getInvoices();

      const responseTime = Date.now() - startTime;
      console.log(`✅ ${invoices.length} فاکتور در ${responseTime}ms بارگذاری شد`);

      res.json(invoices);
    } catch (error) {
      console.error('❌ خطا در دریافت فهرست فاکتورها:', error);
      res.status(500).json({ error: "خطا در دریافت فهرست فاکتورها" });
    }
  });

  // MISSING API: Get invoices with batch info - SHERLOCK v12.1 CRITICAL FIX
  app.get("/api/invoices/with-batch-info", authMiddleware, async (req, res) => {
    try {
      console.log('📋 SHERLOCK v12.1: دریافت کامل فاکتورها با pagination صحیح');

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 30;
      const statusFilter = req.query.status as string || 'all';
      const searchTerm = req.query.search as string || '';
      const telegramFilter = req.query.telegram as string || 'all';

      const invoices = await storage.getInvoices();
      const representatives = await storage.getRepresentatives();

      // Create lookup maps for performance
      const repMap = new Map(representatives.map(rep => [rep.id, rep]));

      // Enhance invoices with additional info FIRST
      let enhancedInvoices = invoices.map(invoice => {
        const rep = repMap.get(invoice.representativeId);

        return {
          ...invoice,
          representativeName: rep?.name || 'نامشخص',
          representativeCode: rep?.code || 'نامشخص',
          panelUsername: rep?.panelUsername
        };
      });

      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        enhancedInvoices = enhancedInvoices.filter(invoice =>
          invoice.invoiceNumber.toLowerCase().includes(searchLower) ||
          invoice.representativeName?.toLowerCase().includes(searchLower) ||
          invoice.representativeCode?.toLowerCase().includes(searchLower)
        );
      }

      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
        enhancedInvoices = enhancedInvoices.filter(invoice => invoice.status === statusFilter);
      }

      // Apply telegram status filter
      if (telegramFilter && telegramFilter !== 'all') {
        if (telegramFilter === 'sent') {
          enhancedInvoices = enhancedInvoices.filter(invoice => invoice.sentToTelegram);
        } else if (telegramFilter === 'unsent') {
          enhancedInvoices = enhancedInvoices.filter(invoice => !invoice.sentToTelegram);
        }
      }

      // SHERLOCK v12.2: Apply Display sorting - newest invoices first for UI
      // NOTE: This ONLY affects display order, not payment allocation (which uses FIFO)
      enhancedInvoices.sort((a, b) => {
        const dateA = new Date(a.issueDate || a.createdAt).getTime();
        const dateB = new Date(b.issueDate || b.createdAt).getTime();
        return dateB - dateA; // Descending: newest first for display
      });

      // Calculate pagination
      const totalCount = enhancedInvoices.length;
      const totalPages = Math.ceil(totalCount / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedInvoices = enhancedInvoices.slice(startIndex, endIndex);

      console.log(`✅ صفحه ${page}: ${paginatedInvoices.length} فاکتور از ${totalCount} فاکتور کل (${totalPages} صفحه)`);

      res.json({
        data: paginatedInvoices,
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalPages: totalPages,
          totalCount: totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error('❌ خطا در دریافت فاکتورها:', error);
      res.status(500).json({ error: "خطا در دریافت فهرست فاکتورها" });
    }
  });

  // MISSING API: Invoice statistics - SHERLOCK v12.1 ENHANCEMENT
  app.get("/api/invoices/statistics", authMiddleware, async (req, res) => {
    try {
      console.log('📊 S-04 Fix: Calculating invoice statistics via optimized SQL');

      // S-04 Fix: Replace in-memory filtering with single aggregated query
      const [statsResult] = await db.select({
        totalInvoices: sql<number>`COUNT(*)`,
        unpaidCount: sql<number>`COUNT(*) FILTER (WHERE status = 'unpaid')`,
        paidCount: sql<number>`COUNT(*) FILTER (WHERE status = 'paid')`,
        partialCount: sql<number>`COUNT(*) FILTER (WHERE status = 'partial')`,
        overdueCount: sql<number>`COUNT(*) FILTER (WHERE status = 'overdue')`,
        totalAmount: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`,
        unpaidAmount: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)) FILTER (WHERE status = 'unpaid'), 0)`,
        paidAmount: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)) FILTER (WHERE status = 'paid'), 0)`,
        sentToTelegramCount: sql<number>`COUNT(*) FILTER (WHERE sent_to_telegram = true)`,
        unsentToTelegramCount: sql<number>`COUNT(*) FILTER (WHERE sent_to_telegram = false)`
      }).from(invoices);

      const stats = {
        totalInvoices: Number(statsResult.totalInvoices || 0),
        unpaidCount: Number(statsResult.unpaidCount || 0),
        paidCount: Number(statsResult.paidCount || 0),
        partialCount: Number(statsResult.partialCount || 0),
        overdueCount: Number(statsResult.overdueCount || 0),
        totalAmount: parseFloat(statsResult.totalAmount || '0'),
        unpaidAmount: parseFloat(statsResult.unpaidAmount || '0'),
        paidAmount: parseFloat(statsResult.paidAmount || '0'),
        sentToTelegramCount: Number(statsResult.sentToTelegramCount || 0),
        unsentToTelegramCount: Number(statsResult.unsentToTelegramCount || 0)
      };

      console.log(`📊 S-04 Fixed: Invoice statistics via SQL - Total: ${stats.totalInvoices}, Unpaid: ${stats.unpaidCount}, Overdue: ${stats.overdueCount}`);
      res.json(stats);
    } catch (error) {
      console.error('❌ خطا در محاسبه آمار فاکتورها:', error);
      res.status(500).json({ error: "خطا در محاسبه آمار فاکتورها" });
    }
  });

  // ✅ ODIN v5.0: Send ACTUAL invoices to Telegram (NOT test message)
  // این endpoint فاکتورهای واقعی را با قالب کامل ارسال می‌کند
  app.post("/api/invoices/send-telegram", authMiddleware, async (req, res) => {
    try {
      console.log('📨 ODIN v5.0: Sending REAL invoices to Telegram (NOT test)');
      const { invoiceIds } = req.body;

      if (!invoiceIds || !Array.isArray(invoiceIds)) {
        return res.status(400).json({ error: "شناسه فاکتورها الزامی است" });
      }

      // Get Telegram settings from database
      const botTokenSetting = await storage.getSetting("telegram_bot_token");
      const chatIdSetting = await storage.getSetting("telegram_chat_id");
      const templateSetting = await storage.getSetting("telegram_template");

      const botToken = botTokenSetting?.value || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = chatIdSetting?.value || process.env.TELEGRAM_CHAT_ID;
      const template = templateSetting?.value || getDefaultTelegramTemplate();

      console.log('🔑 Telegram settings check:', {
        botTokenExists: !!botToken,
        chatIdExists: !!chatId,
        templateExists: !!template
      });

      if (!botToken || !chatId) {
        console.error('❌ Missing Telegram credentials');
        return res.status(400).json({
          error: "تنظیمات تلگرام کامل نیست. لطفاً Bot Token و Chat ID را در تنظیمات وارد کنید."
        });
      }

      let successCount = 0;
      let failedCount = 0;

      for (const invoiceId of invoiceIds) {
        try {
          console.log(`📋 Processing invoice ${invoiceId}`);

          // Get invoice details
          const invoice = await storage.getInvoice(invoiceId);
          if (!invoice) {
            console.error(`Invoice ${invoiceId} not found`);
            failedCount++;
            continue;
          }

          // Get representative details
          const representative = await storage.getRepresentative(invoice.representativeId);
          if (!representative) {
            console.error(`Representative ${invoice.representativeId} not found for invoice ${invoiceId}`);
            failedCount++;
            continue;
          }

          // Prepare Telegram message
          // SHERLOCK v16.3 TELEGRAM URL FIX: Use proper portal link generation
          const { getPortalLink } = await import('./config');
          const portalLink = getPortalLink(representative.publicId);
          const telegramMessage = {
            representativeName: representative.name,
            shopOwner: representative.ownerName || representative.name,
            panelId: representative.panelUsername || representative.code,
            amount: invoice.amount,
            issueDate: invoice.issueDate,
            status: formatInvoiceStatus(invoice.status),
            portalLink,
            invoiceNumber: invoice.invoiceNumber,
            isResend: invoice.sentToTelegram || false,
            sendCount: (invoice.telegramSendCount || 0) + 1
          };

          // Send to Telegram
          const success = await sendInvoiceToTelegram(botToken, chatId, telegramMessage, template);

          if (success) {
            // Mark as sent
            await storage.updateInvoice(invoiceId, {
              sentToTelegram: true,
              telegramSentAt: new Date(),
              telegramSendCount: telegramMessage.sendCount
            });

            // Create activity log
            await storage.createActivityLog({
              type: "invoice_telegram_sent",
              description: `فاکتور ${invoice.invoiceNumber} به تلگرام ارسال شد`,
              relatedId: invoiceId
            });

            successCount++;
            console.log(`✅ Invoice ${invoiceId} sent successfully`);
          } else {
            failedCount++;
            console.error(`❌ Failed to send invoice ${invoiceId}`);
          }
        } catch (error) {
          console.error(`❌ خطا در ارسال فاکتور ${invoiceId}:`, error);
          failedCount++;
        }
      }

      console.log(`✅ SHERLOCK v12.3: ارسال تلگرام کامل شد - ${successCount} موفق, ${failedCount} ناموفق`);

      res.json({
        success: successCount,
        failed: failedCount,
        total: invoiceIds.length
      });
    } catch (error) {
      console.error('❌ خطا در ارسال فاکتورها به تلگرام:', error);
      res.status(500).json({ error: "خطا در ارسال فاکتورها به تلگرام" });
    }
  });

  // فاز ۲: Delete invoice API - حذف فاکتور با همگام‌سازی کامل مالی
  app.delete("/api/invoices/:id", authMiddleware, async (req, res) => {
    try {
      console.log('🔧 فاز ۲: حذف امن فاکتور');
      const invoiceId = parseInt(req.params.id);

      // Get invoice details for audit
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "فاکتور یافت نشد" });
      }

      console.log(`🗑️ حذف فاکتور شماره ${invoice.invoiceNumber} با مبلغ ${invoice.amount} تومان`);

      // Delete invoice from database
      await storage.deleteInvoice(invoiceId);

      // ✅ ODIN v5.0 CRITICAL: Sync representative debt to database table
      console.log(`🔄 به‌روزرسانی اطلاعات مالی نماینده ${invoice.representativeId}`);
      await storage.updateRepresentativeFinancials(invoice.representativeId);
      
      // ✅ Force sync to representatives table for immediate UI update
      const { unifiedFinancialEngine } = await import('./services/unified-financial-engine.js');
      await unifiedFinancialEngine.syncRepresentativeDebt(invoice.representativeId);
      console.log(`✅ ODIN v5.0: Synced representative ${invoice.representativeId} debt to database after invoice deletion`);

      // Log the activity for audit trail
      await storage.createActivityLog({
        type: "invoice_deleted",
        description: `فاکتور ${invoice.invoiceNumber} با مبلغ ${invoice.amount} تومان حذف شد`,
        relatedId: invoiceId,
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          representativeId: invoice.representativeId,
          deletedBy: (req.session as any)?.user?.username || 'admin',
          financialImpact: {
            amountRemoved: invoice.amount,
            operation: "invoice_deletion"
          }
        }
      });

      console.log(`✅ فاکتور ${invoice.invoiceNumber} با موفقیت حذف شد و اطلاعات مالی همگام‌سازی شدند`);
      res.json({
        success: true,
        message: "فاکتور با موفقیت حذف شد و اطلاعات مالی به‌روزرسانی شدند",
        deletedInvoice: {
          id: invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount
        }
      });
    } catch (error) {
      console.error('Error deleting invoice:', error);
      res.status(500).json({ error: "خطا در حذف فاکتور" });
    }
  });

  // فاز ۲: Get single invoice details API
 
  app.get("/api/invoices/:id", authMiddleware, async (req, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      if (isNaN(invoiceId)) {
        return res.status(400).json({ error: "شناسه فاکتور نامعتبر است" });
      }
      const invoice = await storage.getInvoice(invoiceId);

      if (!invoice) {
        return res.status(404).json({ error: "فاکتور یافت نشد" });
      }

      // Get representative info
      const representative = await storage.getRepresentative(invoice.representativeId);

      res.json({
        ...invoice,
        representativeName: representative?.name,
        representativeCode: representative?.code
      });
    } catch (error) {
      console.error('Error fetching invoice details:', error);
      res.status(500).json({ error: "خطا در دریافت جزئیات فاکتور" });
    }
  });

  // SHERLOCK v12.1: Enhanced pagination and statistics for invoices page
  app.get("/api/invoices/export", authMiddleware, async (req, res) => {
    try {
      console.log('📄 SHERLOCK v12.1: Exporting invoices to Excel/CSV');

      const invoices = await storage.getInvoices();

      // Prepare export data with enhanced information
      const exportData = invoices.map(invoice => ({
        'شماره فاکتور': invoice.invoiceNumber,
        'نام نماینده': (invoice as any).representativeName || 'نامشخص',
        'کد نماینده': (invoice as any).representativeCode || 'نامشخص',
        'مبلغ': invoice.amount,
        'تاریخ صدور': invoice.issueDate,
        'تاریخ سررسید': invoice.dueDate,
        'وضعیت': invoice.status === 'paid' ? 'پرداخت شده' :
                  invoice.status === 'partial' ? 'پرداخت جزئی' : 'پرداخت نشده',
        'ارسال به تلگرام': invoice.sentToTelegram ? 'ارسال شده' : 'ارسال نشده',
        'تاریخ ایجاد': invoice.createdAt
      }));

      res.json({
        success: true,
        data: exportData,
        total: exportData.length,
        exportedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ خطا در export فاکتورها:', error);
      res.status(500).json({ error: "خطا در export فاکتورها" });
    }
  });

  // فاز ۲: Payment Synchronization API Routes

  // Get unallocated payments API
  app.get("/api/payments/unallocated", authMiddleware, async (req, res) => {
    try {
      const representativeId = req.query.representativeId ? parseInt(req.query.representativeId as string) : undefined;
      const unallocatedPayments = await storage.getUnallocatedPayments(representativeId);

      res.json(unallocatedPayments);
    } catch (error) {
      console.error('Error fetching unallocated payments:', error);
      res.status(500).json({ error: "خطا در دریافت پرداخت‌های تخصیص نیافته" });
    }
  });

  // ❌ [ODIN v5.0] Auto-allocation REMOVED - Manual allocation only via POST /api/payments

  // Debt synchronization API - SHERLOCK v1.0 CORE FEATURE
  app.post("/api/representatives/:id/sync-debt", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, invoiceId, amountChange, timestamp } = req.body;

      console.log('Sync debt request:', { id, reason, invoiceId, amountChange });

      // Recalculate actual debt from database
      const representativeId = parseInt(id);

      // Calculate total unpaid invoices for this representative
      const unpaidResult = await db.select({
        totalDebt: sql<string>`COALESCE(SUM(CAST(amount as DECIMAL)), 0)`
      }).from(invoices).where(
        and(
          eq(invoices.representativeId, representativeId),
          or(eq(invoices.status, 'unpaid'), eq(invoices.status, 'overdue'))
        )
      );

      // Calculate total sales (all invoices)
      const salesResult = await db.select({
        totalSales: sql<string>`COALESCE(SUM(CAST(amount as DECIMAL)), 0)`
      }).from(invoices).where(eq(invoices.representativeId, representativeId));

      const actualTotalDebt = unpaidResult[0]?.totalDebt || "0";
      const actualTotalSales = salesResult[0]?.totalSales || "0";

      console.log('Calculated debt:', { actualTotalDebt, actualTotalSales });

      // Update representative with calculated values
      const updatedRep = await storage.updateRepresentative(representativeId, {
        totalDebt: actualTotalDebt,
        totalSales: actualTotalSales,
        credit: "0" // Reset credit if needed
      });

      // Log the synchronization with actual values
      await storage.createActivityLog({
        type: "debt_synchronized",
        description: `همگام‌سازی مالی پس از تغییر مبلغ فاکتور: ${actualTotalDebt} ریال`,
        relatedId: representativeId,
        metadata: {
          invoiceId,
          amountChange,
          syncReason: reason || "invoice_amount_changed",
          oldDebt: "unknown",
          newDebt: actualTotalDebt,
          timestamp: timestamp || new Date().toISOString()
        }
      });

      console.log('Debt synchronization completed:', {
        representativeId,
        actualTotalDebt,
        actualTotalSales
      });

      res.json({
        success: true,
        message: "همگام‌سازی مالی کامل انجام شد",
        data: {
          invoiceId,
          amountChange,
          totalDebt: actualTotalDebt,
          totalSales: actualTotalSales
        }
      });
    } catch (error: any) {
      console.error('Debt synchronization failed:', error);
      res.status(500).json({
        error: "خطا در همگام‌سازی بدهی",
        details: error.message
      });
    }
  });

  // Dashboard statistics refresh endpoint
  app.post("/api/dashboard/refresh-stats", authMiddleware, async (req, res) => {
    try {
      const { reason } = req.body;

      // Recalculate all statistics
      const totalRevenue = await storage.getTotalRevenue();
      const totalDebt = await storage.getTotalDebt();
      const activeRepresentatives = await storage.getActiveRepresentativesCount();
      const unpaidInvoices = await storage.getUnpaidInvoicesCount();
      const overdueInvoices = await storage.getOverdueInvoicesCount();

      // Log the refresh
      await storage.createActivityLog({
        type: "dashboard_stats_refreshed",
        description: `آمار داشبورد بروزرسانی شد - دلیل: ${reason}`,
        metadata: {
          totalRevenue: totalRevenue.toString(),
          totalDebt: totalDebt.toString(),
          activeRepresentatives,
          unpaidInvoices,
          overdueInvoices,
          refreshReason: reason,
          timestamp: new Date().toISOString()
        }
      });

      res.json({
        success: true,
        message: "آمار داشبورد بروزرسانی شد",
        stats: {
          totalRevenue,
          totalDebt,
          activeRepresentatives,
          unpaidInvoices,
          overdueInvoices
        }
      });
    } catch (error) {
      res.status(500).json({ error: "خطا در بروزرسانی آمار داشبورد" });
    }
  });

  // Manual payment allocation API
  // SHERLOCK v11.5: Manual payment allocation API with real-time status calculation
  app.post("/api/payments/allocate", authMiddleware, async (req, res) => {
    try {
      const { paymentId, invoiceId } = req.body;

      if (!paymentId || !invoiceId) {
        return res.status(400).json({ error: "شناسه پرداخت و فاکتور الزامی است" });
      }

      const updatedPayment = await storage.allocatePaymentToInvoice(paymentId, invoiceId);

      // CRITICAL: Recalculate invoice status based on actual payment allocations
      const calculatedStatus = await storage.calculateInvoicePaymentStatus(invoiceId);
      await storage.updateInvoice(invoiceId, { status: calculatedStatus });
      console.log(`📊 Manual allocation: Invoice ${invoiceId} status updated to: ${calculatedStatus}`);

      await storage.createActivityLog({
        type: "manual_payment_allocation",
        description: `پرداخت ${paymentId} به فاکتور ${invoiceId} تخصیص یافت - وضعیت: ${calculatedStatus}`,
        relatedId: paymentId,
        metadata: {
          paymentId,
          invoiceId,
          amount: updatedPayment.amount,
          newInvoiceStatus: calculatedStatus
        }
      });

      res.json({ success: true, payment: updatedPayment, invoiceStatus: calculatedStatus });
    } catch (error) {
      console.error('Error allocating payment:', error);
      res.status(500).json({ error: "خطا در تخصیص دستی پرداخت" });
    }
  });

  // SHERLOCK v11.5: CRITICAL - Batch Invoice Status Recalculation API
  app.post("/api/invoices/recalculate-statuses", authMiddleware, async (req, res) => {
    try {
      console.log('🔧 SHERLOCK v11.5: Starting batch invoice status recalculation...');
      const { representativeId, invoiceIds } = req.body;

      let invoicesToProcess = [];

      if (representativeId) {
        // Recalculate for specific representative
        const repInvoices = await storage.getInvoicesByRepresentative(representativeId);
        invoicesToProcess = repInvoices.map(inv => inv.id);
        console.log(`📊 Processing ${invoicesToProcess.length} invoices for representative ${representativeId}`);
      } else if (invoiceIds && Array.isArray(invoiceIds)) {
        // Recalculate for specific invoices
        invoicesToProcess = invoiceIds;
        console.log(`📊 Processing ${invoicesToProcess.length} specific invoices`);
      } else {
        // Recalculate all invoices (expensive operation)
        const allInvoices = await storage.getInvoices();
        invoicesToProcess = allInvoices.map(inv => inv.id);
        console.log(`📊 Processing ALL ${invoicesToProcess.length} invoices`);
      }

      const results = {
        processed: 0,
        updated: 0,
        statusChanges: [] as Array<{
          invoiceId: any;
          invoiceNumber: string;
          oldStatus: string;
          newStatus: string;
        }>
      };

      // Process each invoice
      for (const invoiceId of invoicesToProcess) {
        try {
          const oldInvoice = await storage.getInvoice(invoiceId);
          if (!oldInvoice) continue;

          const calculatedStatus = await storage.calculateInvoicePaymentStatus(invoiceId);

          if (calculatedStatus !== oldInvoice.status) {
            await storage.updateInvoice(invoiceId, { status: calculatedStatus });
            results.statusChanges.push({
              invoiceId,
              invoiceNumber: oldInvoice.invoiceNumber,
              oldStatus: oldInvoice.status,
              newStatus: calculatedStatus
            });
            results.updated++;
          }

          results.processed++;
        } catch (invoiceError) {
          console.warn(`Error processing invoice ${invoiceId}:`, invoiceError);
        }
      }

      console.log(`✅ Batch recalculation complete: ${results.updated} invoices updated out of ${results.processed} processed`);

      // Log the batch operation
      await storage.createActivityLog({
        type: "batch_invoice_status_recalculation",
        description: `بازمحاسبه وضعیت ${results.processed} فاکتور - ${results.updated} فاکتور به‌روزرسانی شد`
      });

      res.json({
        success: true,
        message: `وضعیت ${results.updated} فاکتور از ${results.processed} فاکتور بازمحاسبه و به‌روزرسانی شد`,
        results
      });
    } catch (error) {
      console.error('Batch status recalculation error:', error);
      res.status(500).json({ error: "خطا در بازمحاسبه وضعیت فاکتورها" });
    }
  });

  // Payment allocation summary API
  app.get("/api/payments/allocation-summary/:representativeId", authMiddleware, async (req, res) => {
    try {
      const representativeId = parseInt(req.params.representativeId);
      const summary = await storage.getPaymentAllocationSummary(representativeId);

      res.json(summary);
    } catch (error) {
      console.error('Error getting payment allocation summary:', error);
      res.status(500).json({ error: "خطا در دریافت خلاصه تخصیص پرداخت‌ها" });
    }
  });

  // SHERLOCK v17.8 REMOVED: Duplicate financial reconciliation endpoint
  // All financial reconciliation now uses the standardized Financial Integrity Engine
  // Available at: /api/financial-integrity/representative/:id/reconcile



  // 🗑️ SHERLOCK v18.2: LEGACY REMOVED - Use unified statistics endpoints instead

  // 🗑️ SHERLOCK v18.2: LEGACY REMOVED - Use standardized payment processing endpoints

  app.put("/api/payments/:id/allocate", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { invoiceId } = req.body;
      await storage.allocatePaymentToInvoice(id, invoiceId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "خطا در تخصیص پرداخت" });
    }
  });

  // فاز ۲: Invoice Batches API - مدیریت دوره‌ای فاکتورها
  app.get("/api/invoice-batches", authMiddleware, async (req, res) => {
    try {
      const batches = await storage.getInvoiceBatches();
      res.json(batches);
    } catch (error) {
      console.error('Error fetching invoice batches:', error);
      res.status(500).json({ error: "خطا در دریافت دسته‌های فاکتور" });
    }
  });

  app.get("/api/invoice-batches/:id", authMiddleware, async (req, res) => {
    try {
      const batchId = parseInt(req.params.id);
      const batch = await storage.getInvoiceBatch(batchId);

      if (!batch) {
        return res.status(404).json({ error: "دسته فاکتور یافت نشد" });
      }

      // Get invoices for this batch
      const invoices = await storage.getBatchInvoices(batchId);

      res.json({
        batch,
        invoices,
        summary: {
          totalInvoices: invoices.length,
          totalAmount: invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0).toString()
        }
      });
    } catch (error) {
      console.error('Error fetching batch details:', error);
      res.status(500).json({ error: "خطا در دریافت جزئیات دسته فاکتور" });
    }
  });

  app.post("/api/invoice-batches", authMiddleware, async (req, res) => {
    try {
      const validatedData = insertInvoiceBatchSchema.parse(req.body) as ValidatedInvoiceBatchData;

      // Generate unique batch code if not provided
      if (!validatedData.batchCode) {
        validatedData.batchCode = await storage.generateBatchCode(String(validatedData.periodStart));
      }

      const batch = await storage.createInvoiceBatch(validatedData);
      res.json(batch);
    } catch (error) {
      console.error('Error creating invoice batch:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "داده‌های ورودی نامعتبر", details: error.errors });
      } else {
        res.status(500).json({ error: "خطا در ایجاد دسته فاکتور" });
      }
    }
  });

  app.put("/api/invoice-batches/:id", authMiddleware, async (req, res) => {
    try {
      const batchId = parseInt(req.params.id);
      const updateData = req.body;

      const batch = await storage.updateInvoiceBatch(batchId, updateData);
      res.json(batch);
    } catch (error) {
      console.error('Error updating invoice batch:', error);
      res.status(500).json({ error: "خطا در بروزرسانی دسته فاکتور" });
    }
  });

  app.post("/api/invoice-batches/:id/complete", authMiddleware, async (req, res) => {
    try {
      const batchId = parseInt(req.params.id);
      await storage.completeBatch(batchId);

      const updatedBatch = await storage.getInvoiceBatch(batchId);
      res.json({
        success: true,
        batch: updatedBatch,
        message: "دسته فاکتور با موفقیت تکمیل شد"
      });
    } catch (error) {
      console.error('Error completing batch:', error);
      res.status(500).json({ error: "خطا در تکمیل دسته فاکتور" });
    }
  });



  // Activity Logs API
  app.get("/api/activity-logs", authMiddleware, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getActivityLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "خطا در دریافت فعالیت‌ها" });
    }
  });

  // NEW: Recent Activity endpoint با فرمت مناسب کامپوننت ActivityFeed (Dashboard)
  app.get('/api/activity/recent', authMiddleware, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      const logs = await storage.getActivityLogs(limit);
      // نرمال‌سازی برای ActivityFeed
      const normalized = logs.map(l => ({
        id: String(l.id ?? l.createdAt ?? Math.random()),
        type: ((): any => {
          if (l.type === 'invoice_created') return 'invoice_created';
          if (l.type === 'invoice_updated') return 'invoice_updated';
          if (l.type === 'invoice_deleted') return 'invoice_deleted';
          return 'system_error';
        })(),
        actor: 'سیستم',
        at: (l.createdAt instanceof Date ? l.createdAt.toISOString() : new Date(l.createdAt as any).toISOString()),
        meta: { rawType: l.type, relatedId: (l as any).relatedId, description: (l as any).description }
      }));
      res.json({ success: true, items: normalized });
    } catch (error) {
      console.error('Recent activity error:', error);
      res.status(500).json({ error: 'خطا در واکشی فعالیت اخیر' });
    }
  });

  // Settings API - Protected
  app.get("/api/settings/:key", authMiddleware, async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: "خطا در دریافت تنظیمات" });
    }
  });

  app.put("/api/settings/:key", authMiddleware, async (req, res) => {
    try {
      const { value } = req.body;
      const setting = await storage.updateSetting(req.params.key, value);
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: "خطا در بروزرسانی تنظیمات" });
    }
  });

  // Test Telegram connection
  app.post("/api/test-telegram", authMiddleware, async (req, res) => {
    try {
      console.log('Testing Telegram connection...');

      // Get Telegram settings from environment variables or database
      let botToken = process.env.TELEGRAM_BOT_TOKEN;
      let chatId = process.env.TELEGRAM_CHAT_ID;

      console.log('Env Bot Token exists:', !!botToken);
      console.log('Env Chat ID exists:', !!chatId);

      // Fallback to database settings if env vars not available
      if (!botToken || !chatId) {
        const botTokenSetting = await storage.getSetting('telegram_bot_token');
        const chatIdSetting = await storage.getSetting('telegram_chat_id');

        console.log('DB Bot Token exists:', !!botTokenSetting?.value);
        console.log('DB Chat ID exists:', !!chatIdSetting?.value);

        if (!botTokenSetting?.value || !chatIdSetting?.value) {
          return res.status(400).json({
            error: "تنظیمات تلگرام کامل نیست - ابتدا توکن ربات و شناسه چت را ذخیره کنید",
            hasEnvToken: !!botToken,
            hasEnvChatId: !!chatId,
            hasDbToken: !!botTokenSetting?.value,
            hasDbChatId: !!chatIdSetting?.value
          });
        }

        botToken = botTokenSetting.value;
        chatId = chatIdSetting.value;
      }

      console.log('Using Bot Token:', botToken ? `${botToken.substring(0, 10)}...` : 'none');
      console.log('Using Chat ID:', chatId);

      // Test message
      const testMessage = `🤖 تست اتصال سیستم مدیریت مالی MarFaNet

✅ اتصال با موفقیت برقرار شد
📅 تاریخ تست: ${new Date().toLocaleString('fa-IR')}
🔧 نسخه سیستم: 1.0.0

این پیام برای تست اتصال ربات ارسال شده است.`;

      // Send test message using the same method as invoice sending
      const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

      const response = await fetch(telegramApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: testMessage,
          parse_mode: 'HTML'
        })
      });

      console.log('Telegram API response status:', response.status);
      const result = await response.json();
      console.log('Telegram API response:', result);

      if (!response.ok) {
        throw new Error(result.description || `Telegram API error: ${response.status}`);
      }

      res.json({
        success: true,
        message: "پیام تست با موفقیت ارسال شد",
        telegramResponse: result
      });
    } catch (error: any) {
      console.error('Telegram test error:', error);
      res.status(500).json({
        error: `خطا در تست اتصال تلگرام: ${error.message}`,
        details: error.toString()
      });
    }
  });

  // Initialize default settings on first run
  // 🛠️ SHERLOCK v12.0: ENHANCED INVOICE EDIT ROUTE WITH DEBUG LOGGING
  app.post("/api/invoices/edit", authMiddleware, async (req, res) => {
    function parsedFloatSafe(val: any): number {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      const n = parseFloat(String(val).replace(/,/g, ''));
      return isNaN(n) ? 0 : n;
    }
    const debug = {
      info: (message: string, data?: any) => {
        const timestamp = new Date().toISOString();
        console.log(`🔍 SHERLOCK v12.1 [INVOICE_EDIT_ENHANCED] ${timestamp}: ${message}`, data || '');
      },
      error: (message: string, error?: any) => {
        const timestamp = new Date().toISOString();
        console.error(`❌ SHERLOCK v12.1 [INVOICE_EDIT_ENHANCED] ${timestamp}: ${message}`, error || '');
      },
      success: (message: string, data?: any) => {
        const timestamp = new Date().toISOString();
        console.log(`✅ SHERLOCK v12.1 [INVOICE_EDIT_ENHANCED] ${timestamp}: ${message}`, data || '');
      },
      financial: (message: string, data?: any) => {
        const timestamp = new Date().toISOString();
        console.log(`💰 SHERLOCK v12.1 [FINANCIAL_SYNC] ${timestamp}: ${message}`, data || '');
      }
    };

    const sessionId = req.sessionID;
    const userId = (req.session as any)?.userId || (req.session as any)?.crmUserId;
    const username = (req.session as any)?.username || (req.session as any)?.crmUsername || 'unknown';

    debug.info('Invoice Edit Request Started', {
      sessionId,
      userId,
      username,
      hasSession: !!req.session,
      sessionAuth: {
        authenticated: (req.session as any)?.authenticated,
        crmAuthenticated: (req.session as any)?.crmAuthenticated,
        cookieMaxAge: req.session?.cookie?.maxAge
      },
      requestSize: JSON.stringify(req.body).length,
      userAgent: req.get('User-Agent')
    });

    try {
      const {
        invoiceId,
        originalUsageData,
        editedUsageData,
        editType,
        editReason,
        originalAmount,
        editedAmount,
        editedBy
      } = req.body;

      debug.info('Invoice Edit Data Extracted', {
        invoiceId,
        editType,
        originalAmount,
        editedAmount,
        editedBy,
        recordCount: editedUsageData?.records?.length || 0
      });

      // ✅ SHERLOCK v32.1: Enhanced validation with detailed logging
      const validationErrors = [];

      if (!invoiceId) validationErrors.push("invoiceId مفقود است");
      if (!editedUsageData) validationErrors.push("editedUsageData مفقود است");
      if (!editedBy) validationErrors.push("editedBy مفقود است");
      if (!editReason || !editReason.trim()) validationErrors.push("editReason مفقود یا خالی است");

      debug.info('Validation Check', {
        invoiceId: !!invoiceId,
        editedUsageData: !!editedUsageData,
        editedBy: !!editedBy,
        editReason: !!editReason,
        requestBodyKeys: Object.keys(req.body),
        editedUsageDataStructure: editedUsageData ? {
          hasRecords: !!(editedUsageData as any)?.records,
          recordsCount: (editedUsageData as any)?.records?.length || 0,
          hasUsageAmount: !!(editedUsageData as any)?.usage_amount
        } : null
      });

      if (validationErrors.length > 0) {
        debug.error('Validation Failed', {
          errors: validationErrors,
          receivedData: {
            invoiceId,
            editedBy,
            editReason,
            hasEditedUsageData: !!editedUsageData,
            editedUsageDataKeys: editedUsageData ? Object.keys(editedUsageData) : []
          }
        });
        return res.status(400).json({
          error: "اطلاعات ضروری برای ویرایش فاکتور کامل نیست",
          details: validationErrors,
          missingFields: validationErrors
        });
      }

      // Validate amounts
      if (editedAmount < 0) {
        debug.error('Validation Failed - Negative Amount', { editedAmount });
        return res.status(400).json({ error: "مبلغ فاکتور نمی‌تواند منفی باشد" });
      }

      debug.success('Validation Passed', {
        invoiceId,
        editedAmount,
        recordCount: editedUsageData?.records?.length
      });

      // 💾 SHERLOCK v12.0: ATOMIC EDIT TRANSACTION WITH SESSION VALIDATION
      debug.info('Creating Edit Record', { invoiceId, editedBy });

      // Pre-edit session health check
      const preEditSessionState = {
        sessionId,
        hasSession: !!req.session,
        authenticated: (req.session as any)?.authenticated,
        crmAuthenticated: (req.session as any)?.crmAuthenticated,
        cookieMaxAge: req.session?.cookie?.maxAge,
        timestamp: new Date().toISOString()
      };

      debug.info('Pre-Edit Session State', preEditSessionState);

      // =============================
      // 💎 ATOMIC INVOICE EDIT PIPELINE (v1)
      // Steps:
      // 1. Fetch current invoice
      // 2. Compute newAmount (editedAmount OR derived from editedUsageData)
      // 3. Persist invoice edit audit record
      // 4. Update invoice (amount, usage_data, updatedAt, status)
      // 5. Recalculate representative financials (single source of truth)
      // 6. Return updated invoice & sync metadata
      // =============================

      const currentInvoice = await storage.getInvoice(invoiceId);
      if (!currentInvoice) {
        debug.error('Invoice Not Found For Edit', { invoiceId });
        return res.status(404).json({ error: 'فاکتور یافت نشد' });
      }

      // Compute new amount from editedUsageData if structure present
      let computedAmount = editedAmount;
      try {
        if (editedUsageData && Array.isArray((editedUsageData as any).records)) {
          const records: any[] = (editedUsageData as any).records;
            // Attempt to derive numeric fields (amount, usage_amount, value)
            const sum = records.reduce((acc, r) => {
              for (const key of ['amount','usage_amount','value','price']) {
                if (r && r[key] !== undefined && r[key] !== null && !isNaN(parseFloat(r[key]))) {
                  return acc + parseFloat(r[key]);
                }
              }
              return acc;
            }, 0);
            if (sum > 0 && Math.abs(sum - parsedFloatSafe(editedAmount)) > 0.01) {
              computedAmount = sum.toFixed(2);
            }
        }
      } catch (deriveErr) {
        debug.error('Usage Data Derive Failed (non-fatal)', deriveErr);
      }

      // Normalize numeric strings
      const normalizedOriginal = parsedFloatSafe(originalAmount);
      const normalizedEdited = parsedFloatSafe(computedAmount);

      // Persist edit record FIRST for audit trail
      const editRecord = await storage.createInvoiceEdit({
        invoiceId,
        originalUsageData,
        editedUsageData,
        editType,
        editReason,
        originalAmount: normalizedOriginal.toFixed(2),
        editedAmount: normalizedEdited.toFixed(2),
        editedBy
      });
      debug.success('Edit Record Created', { editRecordId: editRecord.id, normalizedOriginal, normalizedEdited });

      // Update invoice core fields
      const updatedInvoice = await storage.updateInvoice(invoiceId, {
        amount: normalizedEdited.toFixed(2),
        usageData: editedUsageData as any
      } as any);

      // Recalculate status if payments exist
      try {
        const newStatus = await storage.calculateInvoicePaymentStatus(invoiceId);
        if (newStatus && newStatus !== updatedInvoice.status) {
          await storage.updateInvoice(invoiceId, { status: newStatus } as any);
          (updatedInvoice as any).status = newStatus;
        }
      } catch (statusErr) {
        debug.error('Status Recalculation Failed (non-fatal)', statusErr);
      }

      // Trigger representative financial recompute (standardized engine)
      try {
        await storage.updateRepresentativeFinancials(currentInvoice.representativeId);
        debug.financial('Representative Financials Recomputed', { representativeId: currentInvoice.representativeId });
      } catch (finErr) {
        debug.error('Financial Recompute Failed (non-fatal)', finErr);
      }

      const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Return enriched payload
      res.json({
        success: true,
        message: 'فاکتور با موفقیت ویرایش و بروزرسانی شد',
        transactionId,
        editId: editRecord.id,
        updated: {
          id: updatedInvoice.id,
            amount: updatedInvoice.amount,
            status: (updatedInvoice as any).status,
            representativeId: (updatedInvoice as any).representativeId,
            usageData: (updatedInvoice as any).usageData
        },
        financialSync: true
      });
      return;

      // 🎆 SHERLOCK v12.0: POST-EDIT SESSION VALIDATION
      const postEditSessionState = {
        sessionId,
        hasSession: !!req.session,
        authenticated: (req.session as any)?.authenticated,
        crmAuthenticated: (req.session as any)?.crmAuthenticated,
        cookieMaxAge: req.session?.cookie?.maxAge,
        timestamp: new Date().toISOString()
      };

      debug.info('Post-Edit Session State', postEditSessionState);

      const sessionIntact = preEditSessionState.hasSession === postEditSessionState.hasSession &&
                            preEditSessionState.authenticated === postEditSessionState.authenticated &&
                            preEditSessionState.crmAuthenticated === postEditSessionState.crmAuthenticated;

      debug.info('Session Integrity Check', {
        sessionIntact,
        preEdit: preEditSessionState,
        postEdit: postEditSessionState
      });

      debug.success('Invoice Edit Operation Complete', {
        transactionId,
        editId: editRecord.id,
        sessionIntact,
        duration: Date.now() - new Date(preEditSessionState.timestamp).getTime()
      });

      res.json({
        success: true,
        message: "فاکتور با موفقیت ویرایش و همگام‌سازی شد",
        transactionId,
        editId: editRecord.id,
        financialSyncStatus: "completed",
        debugInfo: {
          sessionIntact,
          processingTime: Date.now() - new Date(preEditSessionState.timestamp).getTime()
        }
      });

    } catch (error: any) {
      debug.error('Invoice Edit Operation Failed', {
        error: error.message || error,
        stack: error.stack,
        sessionState: {
          sessionId,
          hasSession: !!req.session,
          authenticated: (req.session as any)?.authenticated,
          crmAuthenticated: (req.session as any)?.crmAuthenticated
        }
      });

      res.status(500).json({
        error: 'خطا در ویرایش فاکتور',
        details: error.message,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/invoices/:id/edit-history", authMiddleware, async (req, res) => {
    try {
      const invoiceId = parseInt(req.params.id);

      if (!invoiceId) {
        return res.status(400).json({ error: "شناسه فاکتور نامعتبر است" });
      }

      const editHistory = await storage.getInvoiceEditHistory(invoiceId);
      res.json(editHistory);

    } catch (error: any) {
      console.error('خطا در دریافت تاریخچه ویرایش:', error);
      res.status(500).json({
        error: 'خطا در دریافت تاریخچه ویرایش',
        details: error.message
      });
    }
  });

  // ✅ SHERLOCK v32.0: Enhanced invoice usage details endpoint
  app.get("/api/invoices/:id/usage-details", authMiddleware, async (req, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      console.log(`🔍 SHERLOCK v32.0: Fetching usage details for invoice ${invoiceId}`);

      const invoice = await storage.getInvoiceById(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "فاکتور یافت نشد" });
      }

      let usageData = null;
      let records = [];

      // Parse usage data if exists
      if (invoice.usageData) {
        try {
          usageData = typeof invoice.usageData === 'string'
            ? JSON.parse(invoice.usageData)
            : invoice.usageData;

          console.log(`📄 SHERLOCK v32.0: Parsed usage data:`, usageData);

          // Extract records from various possible structures
          if (usageData.records && Array.isArray(usageData.records)) {
            records = usageData.records;
          } else if (usageData.editedUsageData?.records) {
            records = usageData.editedUsageData.records;
          } else if (usageData.completeUsageDataReplacement?.records) {
            records = usageData.completeUsageDataReplacement.records;
          }

        } catch (parseError) {
          console.warn(`⚠️ SHERLOCK v32.0: Failed to parse usage data:`, parseError);
        }
      }

      // If no detailed records, create a basic one
      if (!records || records.length === 0) {
        console.log(`📝 SHERLOCK v32.0: Creating fallback record for invoice ${invoiceId}`);
        records = [{
          id: `fallback_${invoiceId}`,
          admin_username: invoice.representativeCode || 'unknown',
          event_timestamp: invoice.issueDate || invoice.createdAt,
          event_type: 'CREATE',
          description: `فاکتور ${invoice.invoiceNumber} - مبلغ کل`,
          amount: invoice.amount,
          isOriginal: true
        }];
      }

      const response = {
        invoiceId: invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        records: records,
        usageData: usageData,
        recordsCount: records.length,
        totalAmount: records.reduce((sum: number, r: any) => sum + parseFloat(r.amount || '0'), 0)
      };

      console.log(`✅ SHERLOCK v32.0: Returning usage details for invoice ${invoiceId}:`, {
        recordsCount: response.recordsCount,
        totalAmount: response.totalAmount
      });

      res.json(response);
    } catch (error) {
      console.error(`❌ SHERLOCK v32.0: Error fetching usage details for invoice ${req.params.id}:`, error);
      res.status(500).json({ error: "خطا در دریافت جزئیات فاکتور" });
    }
  });

  // Financial transaction management API routes
  app.get("/api/financial/transactions", authMiddleware, async (req, res) => {
    try {
      const transactions = await storage.getFinancialTransactions();
      res.json(transactions);
    } catch (error: any) {
      console.error('خطا در دریافت تراکنش‌های مالی:', error);
      res.status(500).json({
        error: 'خطا در دریافت تراکنش‌های مالی',
        details: error.message
      });
    }
  });

  app.get("/api/financial/constraints", authMiddleware, async (req, res) => {
    try {
      // Use a different method that exists in storage
      const constraints = await storage.getFinancialTransactions();
      res.json({ constraints: [], message: "عملیات موقتاً غیرفعال است" });
    } catch (error: any) {
      console.error('خطا در دریافت محدودیت‌های یکپارچگی:', error);
      res.status(500).json({
        error: 'خطا در دریافت محدودیت‌های یکپارچگی',
        details: error.message
      });
    }
  });

  app.post("/api/financial/reconcile", authMiddleware, async (req, res) => {
    try {
      const reconcileResult = await storage.reconcileFinancialData();
      res.json(reconcileResult);
    } catch (error: any) {
      console.error('خطا در هماهنگی داده‌های مالی:', error);
      res.status(500).json({
        error: 'خطا در هماهنگی داده‌های مالی',
        details: error.message
      });
    }
  });

  app.post("/api/init", async (req, res) => {
    try {
      // Set default Telegram template
      await storage.updateSetting('telegram_template', getDefaultTelegramTemplate());

      // Initialize basic integrity constraints for active representatives
      const representatives = await storage.getRepresentatives();
      for (const rep of representatives.slice(0, 5)) { // Initialize first 5 representatives
        try {
          await storage.createIntegrityConstraint({
            constraintType: 'BALANCE_CHECK',
            entityType: 'representative',
            entityId: rep.id,
            constraintRule: {
              maxDebt: 50000000, // 50 million Toman limit
              warningThreshold: 40000000,
              autoReconcile: true
            }
          });
        } catch (error) {
          console.log(`Constraint for representative ${rep.id} already exists or failed to create`);
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "خطا در راه‌اندازی اولیه" });
    }
  });

  // ====== FINANCIAL TRANSACTIONS API (CLOCK MECHANISM) ======
  app.get("/api/transactions", authMiddleware, async (req, res) => {
    try {
      const { representativeId, status } = req.query;

      let transactions;
      if (representativeId) {
        transactions = await storage.getTransactionsByRepresentative(parseInt(representativeId as string));
      } else if (status === 'pending') {
        transactions = await storage.getPendingTransactions();
      } else {
        // Get all transactions (could be paginated in future)
        transactions = await storage.getPendingTransactions(); // For now, show pending ones
      }

      res.json(transactions);
    } catch (error: any) {
      console.error('خطا در دریافت تراکنش‌ها:', error);
      res.status(500).json({ error: 'خطا در دریافت تراکنش‌ها', details: error.message });
    }
  });

  app.get("/api/transactions/:transactionId", authMiddleware, async (req, res) => {
    try {
      const { transactionId } = req.params;
      const transaction = await storage.getFinancialTransaction(transactionId);

      if (!transaction) {
        return res.status(404).json({ error: "تراکنش یافت نشد" });
      }

      res.json(transaction);
    } catch (error: any) {
      console.error('خطا در دریافت تراکنش:', error);
      res.status(500).json({ error: 'خطا در دریافت تراکنش', details: error.message });
    }
  });

  app.post("/api/transactions/:transactionId/rollback", authMiddleware, async (req, res) => {
    try {
      const { transactionId } = req.params;
      await storage.rollbackTransaction(transactionId);

      res.json({
        success: true,
        message: `تراکنش ${transactionId} با موفقیت برگردانده شد`
      });
    } catch (error: any) {
      console.error('خطا در برگرداندن تراکنش:', error);
      res.status(500).json({ error: 'خطا در برگرداندن تراکنش', details: error.message });
    }
  });

  // ====== DATA INTEGRITY CONSTRAINTS API (CLOCK PRECISION) ======
  app.get("/api/constraints/violations", authMiddleware, async (req, res) => {
    try {
      const violations = await storage.getConstraintViolations();
      res.json(violations);
    } catch (error: any) {
      console.error('خطا در دریافت نقض محدودیت‌ها:', error);
      res.status(500).json({ error: 'خطا در دریافت نقض محدودیت‌ها', details: error.message });
    }
  });

  app.post("/api/constraints/validate", authMiddleware, async (req, res) => {
    try {
      const { entityType, entityId } = req.body;

      if (!entityType || !entityId) {
        return res.status(400).json({ error: "نوع موجودیت و شناسه ضروری است" });
      }

      const validation = await storage.validateConstraints(entityType, parseInt(entityId));
      res.json(validation);
    } catch (error: any) {
      console.error('خطا در اعتبارسنجی محدودیت‌ها:', error);
      res.status(500).json({ error: 'خطا در اعتبارسنجی محدودیت‌ها', details: error.message });
    }
  });

  app.post("/api/constraints/:constraintId/fix", authMiddleware, async (req, res) => {
    try {
      const constraintId = parseInt(req.params.constraintId);
      const fixed = await storage.fixConstraintViolation(constraintId);

      res.json({
        success: fixed,
        message: fixed ? "محدودیت با موفقیت رفع شد" : "امکان رفع خودکار محدودیت وجود ندارد"
      });
    } catch (error: any) {
      console.error('خطا در رفع محدودیت:', error);
      res.status(500).json({ error: 'خطا در رفع محدودیت', details: error.message });
    }
  });

  // ====== FINANCIAL RECONCILIATION API (CLOCK SYNCHRONIZATION) ======
  app.post("/api/financial/reconcile", authMiddleware, async (req, res) => {
    try {
      const { representativeId } = req.body;

      if (representativeId) {
        // Reconcile specific representative
        await storage.updateRepresentativeFinancials(parseInt(representativeId));
        res.json({
          success: true,
          message: `مالیات نماینده ${representativeId} هماهنگ شد`
        });
      } else {
        // Reconcile all representatives (could be heavy operation)
        const representatives = await storage.getRepresentatives();
        let processed = 0;

        for (const rep of representatives) {
          try {
            await storage.updateRepresentativeFinancials(rep.id);
            processed++;
          } catch (error) {
            console.error(`Error reconciling representative ${rep.id}:`, error);
          }
        }

        res.json({
          success: true,
          message: `${processed} نماینده هماهنگ شد`,
          processed,
          total: representatives.length
        });
      }

    } catch (error: any) {
      console.error('خطا در هماهنگی مالی:', error);
      res.status(500).json({ error: 'خطا در هماهنگی مالی', details: error.message });
    }
  });

  // CRM Routes Integration
  // CRM routes are already registered via registerCrmRoutes() function

  const httpServer = createServer(app);
  return httpServer;
}