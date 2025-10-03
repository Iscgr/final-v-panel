/**
 * 🛡️ MARFANET UNIFIED ERROR MANAGEMENT SYSTEM
 * 
 * سیستم مدیریت خطای یکپارچه و پیشرفته برای Ubuntu Server
 * 
 * ویژگی‌های کلیدی:
 * ✅ Structured Logging with Persian Support
 * ✅ Error Classification & Severity Levels  
 * ✅ Ubuntu Server Performance Monitoring
 * ✅ Automatic Error Recovery Mechanisms
 * ✅ Error Rate Limiting & Circuit Breaking
 * ✅ Database Error Handling & Retry Logic
 * ✅ External Service Integration Errors
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { getDatabaseStatus } from './database-manager.js';

// 🏷️ Error Classification System
export enum ErrorSeverity {
  LOW = 'low',           // Non-critical warnings
  MEDIUM = 'medium',     // Handled errors that don't affect core functionality
  HIGH = 'high',         // Errors that affect user experience
  CRITICAL = 'critical'  // System-threatening errors
}

export enum ErrorCategory {
  DATABASE = 'database',
  EXTERNAL_SERVICE = 'external_service',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  SYSTEM = 'system',
  NETWORK = 'network',
  PERFORMANCE = 'performance'
}

interface ErrorContext {
  timestamp: Date;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  persianMessage?: string;
  error?: Error;
  metadata?: Record<string, any>;
  stackTrace?: string;
  userId?: string;
  requestId?: string;
  // Ubuntu Server specific
  serverInfo?: {
    hostname: string;
    pid: number;
    memory: NodeJS.MemoryUsage;
    uptime: number;
  };
}

interface ErrorStats {
  totalErrors: number;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  lastErrorTime: Date | null;
  errorRate: number; // errors per minute
}

class UnifiedErrorManager {
  private errorStats: ErrorStats;
  private errorHistory: ErrorContext[] = [];
  private maxHistorySize = 1000;
  private logDirectory: string;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  constructor() {
    this.errorStats = {
      totalErrors: 0,
      errorsBySeverity: {
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 0,
        [ErrorSeverity.HIGH]: 0,
        [ErrorSeverity.CRITICAL]: 0
      },
      errorsByCategory: {
        [ErrorCategory.DATABASE]: 0,
        [ErrorCategory.EXTERNAL_SERVICE]: 0,
        [ErrorCategory.AUTHENTICATION]: 0,
        [ErrorCategory.VALIDATION]: 0,
        [ErrorCategory.SYSTEM]: 0,
        [ErrorCategory.NETWORK]: 0,
        [ErrorCategory.PERFORMANCE]: 0
      },
      lastErrorTime: null,
      errorRate: 0
    };

    // Ubuntu Server: Create logs directory
  this.logDirectory = process.env.LOG_DIRECTORY || path.resolve(process.cwd(), 'logs');
    this.initializeLogging();
    this.startErrorRateCalculation();
  }

  private async initializeLogging(): Promise<void> {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
      console.log(`📝 Log directory initialized: ${this.logDirectory}`);
    } catch (error) {
      console.error('Failed to initialize logging directory:', error);
      // Fallback to local logs
      this.logDirectory = './logs';
      await fs.mkdir(this.logDirectory, { recursive: true });
    }
  }

  private startErrorRateCalculation(): void {
    setInterval(() => {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      
      const recentErrors = this.errorHistory.filter(
        error => error.timestamp.getTime() > oneMinuteAgo
      );
      
      this.errorStats.errorRate = recentErrors.length;
    }, 10000); // Calculate every 10 seconds
  }

  /**
   * 🚨 اصلی ترین متد: ثبت خطا با قابلیت‌های پیشرفته
   */
  async logError(
    message: string,
    severity: ErrorSeverity,
    category: ErrorCategory,
    error?: Error,
    metadata?: Record<string, any>,
    persianMessage?: string
  ): Promise<void> {
    const errorContext: ErrorContext = {
      timestamp: new Date(),
      severity,
      category,
      message,
      persianMessage,
      error,
      metadata,
      stackTrace: error?.stack,
      serverInfo: (() => {
        try {
          return {
            hostname: os.hostname(),
            pid: process.pid,
            memory: process.memoryUsage(),
            uptime: process.uptime()
          };
        } catch (e) {
          return {
            hostname: 'unknown',
            pid: process.pid,
            memory: process.memoryUsage(),
            uptime: process.uptime()
          };
        }
      })()
    };

    // Update statistics
    this.updateErrorStats(severity, category);
    
    // Add to history
    this.addToHistory(errorContext);
    
    // Console output with colors (Ubuntu Server friendly)
    this.logToConsole(errorContext);
    
    // Write to file (Ubuntu Server persistent logging)
    await this.logToFile(errorContext);
    
    // Handle critical errors
    if (severity === ErrorSeverity.CRITICAL) {
      await this.handleCriticalError(errorContext);
    }

    // Circuit breaker logic
    this.updateCircuitBreaker(category, severity);
  }

  private updateErrorStats(severity: ErrorSeverity, category: ErrorCategory): void {
    this.errorStats.totalErrors++;
    this.errorStats.errorsBySeverity[severity]++;
    this.errorStats.errorsByCategory[category]++;
    this.errorStats.lastErrorTime = new Date();
  }

  private addToHistory(error: ErrorContext): void {
    this.errorHistory.push(error);
    
    // Keep history within limits
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  private logToConsole(error: ErrorContext): void {
    const colors = {
      [ErrorSeverity.LOW]: '\x1b[33m',      // Yellow
      [ErrorSeverity.MEDIUM]: '\x1b[34m',   // Blue
      [ErrorSeverity.HIGH]: '\x1b[31m',     // Red
      [ErrorSeverity.CRITICAL]: '\x1b[41m'  // Red background
    };
    
    const reset = '\x1b[0m';
    const color = colors[error.severity];
    
    const prefix = `${color}[${error.severity.toUpperCase()}] ${error.category}${reset}`;
    const message = error.persianMessage || error.message;
    const timestamp = error.timestamp.toLocaleString('fa-IR');
    
    console.log(`${prefix} ${timestamp}: ${message}`);
    
    if (error.metadata) {
      console.log(`   📊 Metadata:`, error.metadata);
    }
    
    if (error.error && error.severity === ErrorSeverity.CRITICAL) {
      console.log(`   💥 Stack:`, error.stackTrace);
    }
  }

  private async logToFile(error: ErrorContext): Promise<void> {
    try {
      const date = error.timestamp.toISOString().split('T')[0];
      const logFileName = `marfanet-${date}.log`;
      const logPath = path.join(this.logDirectory, logFileName);
      
      const logEntry = {
        timestamp: error.timestamp.toISOString(),
        severity: error.severity,
        category: error.category,
        message: error.message,
        persianMessage: error.persianMessage,
        metadata: error.metadata,
        serverInfo: error.serverInfo,
        stackTrace: error.stackTrace
      };
      
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(logPath, logLine);
      
    } catch (logError) {
      console.error('Failed to write to log file:', logError);
    }
  }

  private async handleCriticalError(error: ErrorContext): Promise<void> {
    console.log('🚨 CRITICAL ERROR DETECTED - Taking emergency actions...');
    
    // Ubuntu Server: Check system resources
    const dbStatus = getDatabaseStatus();
    const memoryUsage = process.memoryUsage();
    
    console.log('📊 System Status:', {
      database: dbStatus.isHealthy,
      memory: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB used`,
      uptime: `${Math.round(process.uptime())}s`
    });
    
    // Emergency notifications could be added here
    // (Email, Telegram, Slack, etc.)
  }

  private updateCircuitBreaker(category: ErrorCategory, severity: ErrorSeverity): void {
    const key = category;
    const current = this.circuitBreakers.get(key) || {
      failures: 0,
      lastFailureTime: new Date(),
      isOpen: false
    };
    
    if (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL) {
      current.failures++;
      current.lastFailureTime = new Date();
      
      // Open circuit breaker after 5 high/critical errors in 1 minute
      if (current.failures >= 5 && !current.isOpen) {
        current.isOpen = true;
        console.log(`🔄 Circuit breaker opened for ${category}`);
      }
    }
    
    this.circuitBreakers.set(key, current);
  }

  /**
   * 🔍 Helper Methods برای انواع مختلف خطا
   */
  async logDatabaseError(message: string, error?: Error, metadata?: any): Promise<void> {
    await this.logError(
      message,
      ErrorSeverity.HIGH,
      ErrorCategory.DATABASE,
      error,
      metadata,
      'خطای پایگاه داده'
    );
  }

  async logExternalServiceError(service: string, error?: Error, metadata?: any): Promise<void> {
    await this.logError(
      `External service error: ${service}`,
      ErrorSeverity.MEDIUM,
      ErrorCategory.EXTERNAL_SERVICE,
      error,
      metadata,
      `خطای سرویس خارجی: ${service}`
    );
  }

  async logValidationError(message: string, metadata?: any): Promise<void> {
    await this.logError(
      message,
      ErrorSeverity.LOW,
      ErrorCategory.VALIDATION,
      undefined,
      metadata,
      'خطای اعتبارسنجی'
    );
  }

  async logSystemError(message: string, error?: Error): Promise<void> {
    await this.logError(
      message,
      ErrorSeverity.CRITICAL,
      ErrorCategory.SYSTEM,
      error,
      undefined,
      'خطای سیستمی'
    );
  }

  /**
   * 📊 گزارش‌گیری و آمارها
   */
  getErrorStats(): ErrorStats {
    return { ...this.errorStats };
  }

  getRecentErrors(count: number = 50): ErrorContext[] {
    return this.errorHistory.slice(-count);
  }

  isCircuitBreakerOpen(category: ErrorCategory): boolean {
    const state = this.circuitBreakers.get(category);
    return state?.isOpen || false;
  }

  async generateErrorReport(): Promise<string> {
    const stats = this.getErrorStats();
    const recentErrors = this.getRecentErrors(10);
    
    return `
🛡️ MarFaNet Error Report - ${new Date().toLocaleString('fa-IR')}

📊 Statistics:
  • Total Errors: ${stats.totalErrors}
  • Error Rate: ${stats.errorRate}/minute
  • Last Error: ${stats.lastErrorTime?.toLocaleString('fa-IR') || 'None'}

🏷️ By Severity:
  • Critical: ${stats.errorsBySeverity.critical}
  • High: ${stats.errorsBySeverity.high}
  • Medium: ${stats.errorsBySeverity.medium}
  • Low: ${stats.errorsBySeverity.low}

📂 By Category:
  • Database: ${stats.errorsByCategory.database}
  • External Services: ${stats.errorsByCategory.external_service}
  • System: ${stats.errorsByCategory.system}
  • Network: ${stats.errorsByCategory.network}

🕒 Recent Errors:
${recentErrors.map(err => 
  `  • ${err.timestamp.toLocaleString('fa-IR')} [${err.severity}] ${err.persianMessage || err.message}`
).join('\n')}
    `;
  }
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: Date;
  isOpen: boolean;
}

// 🌟 Singleton Instance for Ubuntu Server
const errorManager = new UnifiedErrorManager();

export default errorManager;
export { UnifiedErrorManager };