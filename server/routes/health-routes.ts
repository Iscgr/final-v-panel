/**
 * 🏥 HEALTH CHECK API ROUTES
 * Ubuntu Server Health Monitoring Endpoints
 */

import type { Express } from "express";
import healthChecker from '../health-checker.js';
import errorManager from '../unified-error-manager.js';

export function registerHealthRoutes(app: Express): void {
  console.log('💗 Registering health check routes...');

  /**
   * GET /api/health - Quick health check
   */
  app.get('/api/health', async (req, res) => {
    try {
      const report = await healthChecker.getHealthStatus();
      
      const statusCode = report.overall === 'healthy' ? 200 :
                        report.overall === 'degraded' ? 200 :
                        report.overall === 'unhealthy' ? 503 : 500;
      
      res.status(statusCode).json({
        status: report.overall,
        timestamp: report.timestamp,
        uptime: report.uptime,
        services: {
          database: report.services.database.status,
          redis: report.services.redis.status,
          system: report.services.system.status,
          externalServices: report.services.externalServices.status
        },
        alerts: report.alerts
      });
    } catch (error) {
      await errorManager.logSystemError('Health check API failed', error as Error);
      res.status(500).json({
        status: 'critical',
        message: 'Health check failed',
        error: (error as Error).message
      });
    }
  });

  /**
   * GET /api/health/detailed - Detailed health report
   */
  app.get('/api/health/detailed', async (req, res) => {
    try {
      const report = await healthChecker.getHealthStatus();
      res.json(report);
    } catch (error) {
      await errorManager.logSystemError('Detailed health check failed', error as Error);
      res.status(500).json({
        error: 'Failed to generate health report',
        message: (error as Error).message
      });
    }
  });

  /**
   * GET /api/health/dashboard - Human-readable dashboard
   */
  app.get('/api/health/dashboard', async (req, res) => {
    try {
      const dashboard = await healthChecker.generateHealthDashboard();
      res.type('text/plain').send(dashboard);
    } catch (error) {
      await errorManager.logSystemError('Health dashboard failed', error as Error);
      res.status(500).type('text/plain').send(`
💗 MarFaNet Health Dashboard - ERROR
خطا در تولید داشبورد سلامت

Error: ${(error as Error).message}
      `);
    }
  });

  /**
   * GET /api/health/history - Health history
   */
  app.get('/api/health/history', async (req, res) => {
    try {
      const count = parseInt(req.query.count as string) || 10;
      const history = healthChecker.getHealthHistory(count);
      res.json(history);
    } catch (error) {
      await errorManager.logSystemError('Health history failed', error as Error);
      res.status(500).json({
        error: 'Failed to get health history',
        message: (error as Error).message
      });
    }
  });

  /**
   * GET /api/health/errors - Error statistics
   */
  app.get('/api/health/errors', async (req, res) => {
    try {
      const stats = errorManager.getErrorStats();
      const recentErrors = errorManager.getRecentErrors(20);
      const report = await errorManager.generateErrorReport();
      
      res.json({
        stats,
        recentErrors: recentErrors.map(err => ({
          timestamp: err.timestamp,
          severity: err.severity,
          category: err.category,
          message: err.persianMessage || err.message,
          metadata: err.metadata
        })),
        report
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get error statistics',
        message: (error as Error).message
      });
    }
  });

  console.log('✅ Health check routes registered successfully');
}