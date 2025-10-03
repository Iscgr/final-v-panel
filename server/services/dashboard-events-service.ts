/**
 * 🔄 Dashboard Real-time Events Service
 * SSE (Server-Sent Events) Implementation for Live Dashboard Updates
 * 
 * فلسفه: بجای polling هر 10 دقیقه، داشبورد بلافاصله بعد از تغییرات مالی بروز می‌شود
 * 
 * Event Types:
 * - dashboard:updated → بعد از payment/invoice/allocation تغییر
 * - widget:revenue → فقط ویجت کل دریافت
 * - widget:debt → فقط ویجت بدهی
 * - widget:overdue → فقط ویجت معوق
 * - widget:representatives → فقط ویجت نمایندگان
 * - widget:health → فقط ویجت سلامت
 */

import { Response } from 'express';
import { EventEmitter } from 'events';

export interface DashboardEventPayload {
  type: 'full' | 'revenue' | 'debt' | 'overdue' | 'representatives' | 'health';
  timestamp: string;
  data: {
    totalRevenue?: number;
    totalDebt?: number;
    overdueInvoices?: number;
    activeRepresentatives?: number;
    systemIntegrityScore?: number;
    // Full update
    fullData?: any;
  };
  trigger: 'payment' | 'invoice' | 'allocation' | 'representative' | 'guard_event' | 'manual';
  metadata?: {
    representativeId?: number;
    invoiceId?: number;
    paymentId?: number;
  };
}

class DashboardEventsService extends EventEmitter {
  private clients: Set<Response> = new Set();
  private lastUpdate: string = new Date().toISOString();

  constructor() {
    super();
    this.setMaxListeners(100); // افزایش حد مجاز listeners
  }

  /**
   * اضافه کردن client جدید به SSE stream
   */
  addClient(res: Response): void {
    // تنظیمات SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // برای Nginx
    });

    // ارسال heartbeat اولیه
    this.sendEvent(res, 'connected', {
      message: 'Dashboard SSE connected',
      timestamp: new Date().toISOString(),
      lastUpdate: this.lastUpdate
    });

    this.clients.add(res);
    console.log(`✅ SSE Client connected. Total clients: ${this.clients.size}`);

    // مدیریت disconnect
    res.on('close', () => {
      this.clients.delete(res);
      console.log(`❌ SSE Client disconnected. Remaining: ${this.clients.size}`);
    });
  }

  /**
   * ارسال event به یک client خاص
   */
  private sendEvent(res: Response, event: string, data: any): void {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('❌ SSE send error:', error);
      this.clients.delete(res);
    }
  }

  /**
   * Broadcast event به تمام clients
   */
  broadcastDashboardUpdate(payload: DashboardEventPayload): void {
    this.lastUpdate = payload.timestamp;
    
    console.log(`📡 Broadcasting dashboard update: ${payload.type} (trigger: ${payload.trigger})`);
    
    const eventName = payload.type === 'full' ? 'dashboard:updated' : `widget:${payload.type}`;
    
    this.clients.forEach(client => {
      this.sendEvent(client, eventName, payload);
    });

    // Emit برای internal listeners (logging, monitoring)
    this.emit('broadcast', payload);
  }

  /**
   * Helper: بعد از تغییر Payment
   */
  notifyPaymentChange(paymentId: number, totalRevenue: number): void {
    this.broadcastDashboardUpdate({
      type: 'revenue',
      timestamp: new Date().toISOString(),
      data: { totalRevenue },
      trigger: 'payment',
      metadata: { paymentId }
    });
  }

  /**
   * Helper: بعد از تغییر Invoice
   */
  notifyInvoiceChange(invoiceId: number, totalDebt: number, overdueCount: number): void {
    this.broadcastDashboardUpdate({
      type: 'full', // Invoice affect می‌کند هم debt هم overdue
      timestamp: new Date().toISOString(),
      data: { totalDebt, overdueInvoices: overdueCount },
      trigger: 'invoice',
      metadata: { invoiceId }
    });
  }

  /**
   * Helper: بعد از تخصیص Payment به Invoice
   */
  notifyAllocationChange(paymentId: number, invoiceId: number, fullData: any): void {
    this.broadcastDashboardUpdate({
      type: 'full', // Allocation affect می‌کند revenue, debt, overdue
      timestamp: new Date().toISOString(),
      data: { fullData },
      trigger: 'allocation',
      metadata: { paymentId, invoiceId }
    });
  }

  /**
   * Helper: بعد از تغییر Representative status
   */
  notifyRepresentativeChange(representativeId: number, activeCount: number): void {
    this.broadcastDashboardUpdate({
      type: 'representatives',
      timestamp: new Date().toISOString(),
      data: { activeRepresentatives: activeCount },
      trigger: 'representative',
      metadata: { representativeId }
    });
  }

  /**
   * Helper: بعد از Guard Metrics Event
   */
  notifyHealthScoreChange(score: number): void {
    this.broadcastDashboardUpdate({
      type: 'health',
      timestamp: new Date().toISOString(),
      data: { systemIntegrityScore: score },
      trigger: 'guard_event'
    });
  }

  /**
   * Heartbeat برای نگه داشتن connection
   * هر 30 ثانیه یکبار
   */
  startHeartbeat(): void {
    setInterval(() => {
      this.clients.forEach(client => {
        this.sendEvent(client, 'heartbeat', {
          timestamp: new Date().toISOString(),
          clients: this.clients.size
        });
      });
    }, 30000); // 30 seconds
  }

  /**
   * آمار و وضعیت
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      lastUpdate: this.lastUpdate,
      uptime: process.uptime()
    };
  }
}

// Singleton instance
export const dashboardEventsService = new DashboardEventsService();

// شروع heartbeat
dashboardEventsService.startHeartbeat();

export default dashboardEventsService;
