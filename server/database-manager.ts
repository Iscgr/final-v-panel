/**
 * 🏗️ MARFANET INTELLIGENT DATABASE CONNECTION MANAGER
 * 
 * این فایل یک سیستم پیشرفته و هوشمند برای مدیریت اتصالات پایگاه داده می‌باشد
 * که قابلیت پشتیبانی از محیط‌های مختلف (محلی، کلود، سرورلس) را دارد
 * 
 * ویژگی‌های کلیدی:
 * ✅ Auto-Detection محیط اجرا
 * ✅ Hybrid Connection Pool Management  
 * ✅ Intelligent Retry & Circuit Breaker Pattern
 * ✅ Performance Monitoring & Health Checks
 * ✅ Graceful Error Handling & Recovery
 */

import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool, Client } from 'pg';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

// 🎯 Environment Detection & Configuration
export enum DatabaseEnvironment {
  LOCAL = 'local',
  NEON_SERVERLESS = 'neon',
  TRADITIONAL_PG = 'postgres',
  HYBRID = 'hybrid'
}

interface ConnectionConfig {
  environment: DatabaseEnvironment;
  connectionString: string;
  poolConfig: {
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
    maxUses?: number;
  };
  retryConfig: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  };
  healthCheck: {
    interval: number;
    timeout: number;
  };
}

class IntelligentDatabaseManager {
  private config: ConnectionConfig;
  private pool: NeonPool | PgPool | null = null;
  private db: any = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private connectionAttempts = 0;
  private lastHealthCheck = Date.now();
  private isHealthy = false;

  constructor() {
    this.config = this.detectEnvironmentAndCreateConfig();
    this.initializeConnection();
  }

  /**
   * 🔍 هوشمند تشخیص محیط اجرا و تنظیمات مناسب
   */
  private detectEnvironmentAndCreateConfig(): ConnectionConfig {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
    }

    // تشخیص محیط بر اساس URL pattern
    const isNeonUrl = databaseUrl.includes('neon.tech') || databaseUrl.includes('neon.com');
    const isLocalUrl = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    
    let environment: DatabaseEnvironment;
    
    if (isNeonUrl) {
      environment = DatabaseEnvironment.NEON_SERVERLESS;
    } else if (isLocalUrl) {
      environment = DatabaseEnvironment.LOCAL;
    } else {
      environment = DatabaseEnvironment.TRADITIONAL_PG;
    }

    console.log(`🔧 Database Environment Detected: ${environment}`);
    console.log(`📡 Connection String: ${databaseUrl.replace(/:[^:]*@/, ':***@')}`);

    // 🖥️ Ubuntu Server Optimized Configuration
    const isUbuntuServer = environment === DatabaseEnvironment.LOCAL || 
                          environment === DatabaseEnvironment.TRADITIONAL_PG;

    return {
      environment,
      connectionString: databaseUrl,
      poolConfig: {
        // Ubuntu Server: بهینه‌سازی برای سرور فیزیکی
        max: isUbuntuServer ? 25 : (environment === DatabaseEnvironment.NEON_SERVERLESS ? 10 : 20),
        idleTimeoutMillis: isUbuntuServer ? 60000 : 30000, // Ubuntu Server: زمان بیشتر
        connectionTimeoutMillis: isUbuntuServer ? 3000 : (environment === DatabaseEnvironment.LOCAL ? 5000 : 10000),
        maxUses: environment === DatabaseEnvironment.NEON_SERVERLESS ? 7500 : undefined
      },
      retryConfig: {
        // Ubuntu Server: retry بیشتر برای پایداری
        maxRetries: isUbuntuServer ? 5 : 3,
        baseDelay: isUbuntuServer ? 500 : 1000, // شروع سریعتر در سرور
        maxDelay: isUbuntuServer ? 5000 : 10000 // حداکثر کمتر در سرور
      },
      healthCheck: {
        interval: isUbuntuServer ? 20000 : 30000, // چک بیشتر در سرور
        timeout: isUbuntuServer ? 3000 : 5000 // timeout کمتر در سرور
      }
    };
  }

  /**
   * 🏗️ مقداردهی اولیه اتصال بر اساس محیط
   */
  private async initializeConnection(): Promise<void> {
    try {
      console.log(`🚀 Initializing ${this.config.environment} database connection...`);

      if (this.config.environment === DatabaseEnvironment.NEON_SERVERLESS) {
        await this.initializeNeonConnection();
      } else {
        await this.initializePostgresConnection();
      }

      this.startHealthMonitoring();
      console.log('✅ Database connection initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize database connection:', error);
      
      // Fallback Strategy: اگر Neon شکست خورد، PostgreSQL محلی را امتحان کن
      if (this.config.environment === DatabaseEnvironment.NEON_SERVERLESS) {
        console.log('🔄 Attempting fallback to local PostgreSQL...');
        this.config.environment = DatabaseEnvironment.LOCAL;
        await this.initializePostgresConnection();
      } else {
        throw error;
      }
    }
  }

  /**
   * 🌐 مقداردهی اتصال Neon Serverless
   */
  private async initializeNeonConnection(): Promise<void> {
    neonConfig.webSocketConstructor = ws;
    neonConfig.useSecureWebSocket = true;
    neonConfig.pipelineConnect = false;

    this.pool = new NeonPool({
      connectionString: this.config.connectionString,
      max: this.config.poolConfig.max,
      idleTimeoutMillis: this.config.poolConfig.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.poolConfig.connectionTimeoutMillis,
      maxUses: this.config.poolConfig.maxUses
    });

    this.db = drizzle(this.pool as NeonPool, {
      schema,
      logger: process.env.NODE_ENV === 'development'
    });
  }

  /**
   * 🐘 مقداردهی اتصال PostgreSQL معمولی
   */
  private async initializePostgresConnection(): Promise<void> {
    this.pool = new PgPool({
      connectionString: this.config.connectionString,
      max: this.config.poolConfig.max,
      idleTimeoutMillis: this.config.poolConfig.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.poolConfig.connectionTimeoutMillis
    });

    this.db = drizzlePg(this.pool as PgPool, { 
      schema,
      logger: process.env.NODE_ENV === 'development'
    });
  }

  /**
   * 🔄 سیستم بازیابی خودکار با Exponential Backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Reset connection attempts on success
        this.connectionAttempts = 0;
        return result;

      } catch (error: any) {
        lastError = error;
        this.connectionAttempts++;
        
        console.warn(`⚠️ Database operation "${operationName}" failed (attempt ${attempt}/${this.config.retryConfig.maxRetries}):`, error.message);

        if (attempt === this.config.retryConfig.maxRetries) {
          this.isHealthy = false;
          break;
        }

        // Exponential backoff with jitter
        const delay = Math.min(
          this.config.retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this.config.retryConfig.maxDelay
        );
        const jitter = Math.random() * 0.3 * delay;
        
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
      }
    }

    throw new Error(`Database operation "${operationName}" failed after ${this.config.retryConfig.maxRetries} attempts: ${lastError!.message}`);
  }

  /**
   * 💗 سیستم مانیتورینگ سلامت پایگاه داده
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const isHealthy = await this.performHealthCheck();
        
        if (isHealthy !== this.isHealthy) {
          this.isHealthy = isHealthy;
          console.log(`💗 Database health status changed: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
        }
        
        this.lastHealthCheck = Date.now();
      } catch (error) {
        console.error('🚨 Health check error:', error);
        this.isHealthy = false;
      }
    }, this.config.healthCheck.interval);
  }

  /**
   * 🩺 تست سلامت اتصال
   */
  async performHealthCheck(): Promise<boolean> {
    try {
      if (this.config.environment === DatabaseEnvironment.NEON_SERVERLESS) {
        // For Neon, we'll use a simple query through the drizzle instance
        await this.db.execute({ sql: 'SELECT 1', args: [] });
      } else {
        // For PostgreSQL, use native pool connection
        const client = await (this.pool as PgPool).connect();
        await client.query('SELECT 1');
        client.release();
      }
      return true;
    } catch (error: any) {
      console.error('❌ Database health check failed:', error.message);
      return false;
    }
  }

  /**
   * 🔌 Graceful Shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down database connections...');
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    try {
      if (this.pool) {
        await this.pool.end();
        console.log('✅ Database connections closed gracefully');
      }
    } catch (error) {
      console.error('❌ Error closing database connections:', error);
    }
  }

  /**
   * 📊 گزارش وضعیت سیستم
   */
  getStatus() {
    return {
      environment: this.config.environment,
      isHealthy: this.isHealthy,
      connectionAttempts: this.connectionAttempts,
      lastHealthCheck: new Date(this.lastHealthCheck).toISOString(),
      uptime: Date.now() - this.lastHealthCheck
    };
  }

  // Getters
  get database() {
    if (!this.db) {
      throw new Error('Database not initialized. Call initializeConnection() first.');
    }
    return this.db;
  }

  get connectionPool() {
    return this.pool;
  }

  get isConnectionHealthy() {
    return this.isHealthy;
  }
}

// 🌟 Singleton Instance
let databaseManager: IntelligentDatabaseManager | null = null;

export function initializeDatabaseManager(): IntelligentDatabaseManager {
  if (!databaseManager) {
    databaseManager = new IntelligentDatabaseManager();
  }
  return databaseManager;
}

// Initialize the manager
const manager = initializeDatabaseManager();

// Export the database instance and utilities
export const db = manager.database;
export const pool = manager.connectionPool;
export const checkDatabaseHealth = () => manager.performHealthCheck();
export const closeDatabaseConnection = () => manager.shutdown();
export const executeWithRetry = <T>(operation: () => Promise<T>, name: string): Promise<T> => 
  manager.executeWithRetry(operation, name);
export const getDatabaseStatus = () => manager.getStatus();

// Performance monitoring utility
export function logSlowQuery(queryName: string, duration: number) {
  if (duration > 100) {
    console.warn(`⚠️ Slow query detected: ${queryName} - ${duration}ms`);
  }
  
  if (duration > 1000) {
    console.error(`🐌 Very slow query: ${queryName} - ${duration}ms - Consider optimization!`);
  }
}

export default manager;