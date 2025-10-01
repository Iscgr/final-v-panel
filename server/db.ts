/**
 * 🏗️ MARFANET DATABASE CONNECTION LAYER
 * 
 * این فایل به عنوان پل ارتباطی بین سیستم قدیمی و جدید عمل می‌کند
 * و تمام قابلیت‌های قبلی را با بهبود‌های جدید ارائه می‌دهد
 * 
 * ✅ Backward Compatibility Maintained
 * ✅ Enhanced Error Handling & Monitoring
 * ✅ Automatic Environment Detection
 * ✅ Intelligent Connection Management
 */

// Import from the new intelligent database manager
import { 
  db, 
  pool, 
  checkDatabaseHealth, 
  closeDatabaseConnection, 
  executeWithRetry,
  getDatabaseStatus,
  logSlowQuery 
} from './database-manager.js';

// Re-export everything for backward compatibility
export { 
  db, 
  pool, 
  checkDatabaseHealth, 
  closeDatabaseConnection,
  logSlowQuery 
};

// Enhanced database operations with retry mechanism
export const withDatabaseRetry = executeWithRetry;

// Additional utilities for monitoring and debugging
export async function getDatabaseInfo() {
  const status = getDatabaseStatus();
  console.log('📊 Database Status:', {
    environment: status.environment,
    healthy: status.isHealthy,
    attempts: status.connectionAttempts,
    lastCheck: status.lastHealthCheck,
    uptime: `${Math.round(status.uptime / 1000)}s`
  });
  return status;
}

// Graceful shutdown handler with improved logging
export async function gracefulShutdown() {
  console.log('🛑 Initiating graceful database shutdown...');
  try {
    await closeDatabaseConnection();
    console.log('✅ Database shutdown completed successfully');
  } catch (error) {
    console.error('❌ Error during database shutdown:', error);
    throw error;
  }
}