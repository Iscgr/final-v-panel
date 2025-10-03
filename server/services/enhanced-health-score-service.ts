/**
 * 💗 Enhanced Health Score Service
 * Advanced health scoring with configurable thresholds, trend analysis, and historical tracking
 * 
 * فلسفه: 
 * - Health Score نباید ثابت باشد، باید قابل تنظیم و پویا باشد
 * - باید روند (بهتر شدن/بدتر شدن) را ردیابی کند
 * - باید historical data را برای تحلیل نگه دارد
 */

import { db } from '../database-manager.js';
import { sql } from 'drizzle-orm';

export interface HealthScoreThresholds {
  debt: {
    excellent: number;  // < این مقدار = 100 امتیاز
    good: number;       // < این مقدار = 90 امتیاز
    fair: number;       // < این مقدار = 75 امتیاز
    poor: number;       // >= این مقدار = 60 امتیاز
  };
  criticalEvents: {
    perEventPenalty: number;  // هر event چقدر کم می‌کند
    maxPenalty: number;       // حداکثر کاهش امتیاز
  };
  warnEvents: {
    perEventPenalty: number;
    maxPenalty: number;
  };
  timeWindow: {
    eventsLookbackHours: number;  // چند ساعت عقب برای events
    trendLookbackDays: number;    // چند روز عقب برای trend
  };
}

export interface HealthScoreResult {
  currentScore: number;
  debtScore: number;
  eventsPenalty: number;
  breakdown: {
    baseDebtScore: number;
    criticalEventsPenalty: number;
    warnEventsPenalty: number;
    finalScore: number;
  };
  trend: {
    direction: 'improving' | 'stable' | 'declining';
    changePercentage: number;
    previousScore: number | null;
    daysCompared: number;
  };
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  recommendations: string[];
}

export class EnhancedHealthScoreService {
  private static defaultThresholds: HealthScoreThresholds = {
    debt: {
      excellent: 0,           // بدون بدهی
      good: 1_000_000,       // کمتر از 1 میلیون
      fair: 5_000_000,       // کمتر از 5 میلیون
      poor: 10_000_000       // بیشتر از 10 میلیون
    },
    criticalEvents: {
      perEventPenalty: 5,
      maxPenalty: 25
    },
    warnEvents: {
      perEventPenalty: 2,
      maxPenalty: 10
    },
    timeWindow: {
      eventsLookbackHours: 1,
      trendLookbackDays: 7
    }
  };

  /**
   * محاسبه Health Score با تنظیمات قابل تغییر
   */
  static async calculateHealthScore(
    totalDebt: number,
    customThresholds?: Partial<HealthScoreThresholds>
  ): Promise<HealthScoreResult> {
    const thresholds = { ...this.defaultThresholds, ...customThresholds };

    // 1. محاسبه Debt Score
    const debtScore = this.calculateDebtScore(totalDebt, thresholds.debt);

    // 2. دریافت Guard Metrics Events
    const { criticalCount, warnCount } = await this.getRecentEvents(
      thresholds.timeWindow.eventsLookbackHours
    );

    // 3. محاسبه Penalties
    const criticalPenalty = Math.min(
      criticalCount * thresholds.criticalEvents.perEventPenalty,
      thresholds.criticalEvents.maxPenalty
    );

    const warnPenalty = Math.min(
      warnCount * thresholds.warnEvents.perEventPenalty,
      thresholds.warnEvents.maxPenalty
    );

    const totalPenalty = criticalPenalty + warnPenalty;

    // 4. محاسبه Final Score
    const finalScore = Math.max(0, Math.min(100, debtScore - totalPenalty));

    // 5. محاسبه Trend
    const trend = await this.calculateTrend(
      finalScore,
      thresholds.timeWindow.trendLookbackDays
    );

    // 6. تعیین Level
    const level = this.determineHealthLevel(finalScore);

    // 7. تولید Recommendations
    const recommendations = this.generateRecommendations(
      totalDebt,
      criticalCount,
      warnCount,
      trend
    );

    return {
      currentScore: finalScore,
      debtScore,
      eventsPenalty: totalPenalty,
      breakdown: {
        baseDebtScore: debtScore,
        criticalEventsPenalty: criticalPenalty,
        warnEventsPenalty: warnPenalty,
        finalScore
      },
      trend,
      level,
      recommendations
    };
  }

  /**
   * محاسبه Debt Score بر اساس thresholds
   */
  private static calculateDebtScore(
    totalDebt: number,
    thresholds: HealthScoreThresholds['debt']
  ): number {
    if (totalDebt <= thresholds.excellent) return 100;
    if (totalDebt < thresholds.good) return 90;
    if (totalDebt < thresholds.fair) return 75;
    if (totalDebt < thresholds.poor) return 60;
    return 50; // بدهی بالا
  }

  /**
   * دریافت تعداد events اخیر
   */
  private static async getRecentEvents(
    lookbackHours: number
  ): Promise<{ criticalCount: number; warnCount: number }> {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE level = 'critical') as critical_count,
        COUNT(*) FILTER (WHERE level = 'warn') as warn_count
      FROM guard_metrics_events
      WHERE created_at >= NOW() - INTERVAL '${sql.raw(lookbackHours.toString())} hours'
    `);

    const row = result.rows[0] as any;
    return {
      criticalCount: Number(row?.critical_count || 0),
      warnCount: Number(row?.warn_count || 0)
    };
  }

  /**
   * محاسبه Trend - مقایسه با گذشته
   */
  private static async calculateTrend(
    currentScore: number,
    lookbackDays: number
  ): Promise<HealthScoreResult['trend']> {
    // در اینجا باید از historical data استفاده کنیم
    // فعلاً از guard_metrics_events استفاده می‌کنیم برای تخمین

    const result = await db.execute(sql`
      WITH historical_scores AS (
        SELECT 
          DATE(created_at) as score_date,
          -- تخمین score بر اساس event count
          100 - (COUNT(*) FILTER (WHERE level = 'critical') * 5) - (COUNT(*) FILTER (WHERE level = 'warn') * 2) as estimated_score
        FROM guard_metrics_events
        WHERE created_at >= NOW() - INTERVAL '${sql.raw(lookbackDays.toString())} days'
          AND created_at < NOW() - INTERVAL '1 day'
        GROUP BY DATE(created_at)
        ORDER BY score_date DESC
        LIMIT 1
      )
      SELECT 
        COALESCE(AVG(estimated_score), ${sql.raw(currentScore.toString())}) as previous_score
      FROM historical_scores
    `);

    const row = result.rows[0] as any;
    const previousScore = Number(row?.previous_score || currentScore);
    const change = currentScore - previousScore;
    const changePercentage = previousScore > 0 ? (change / previousScore) * 100 : 0;

    let direction: 'improving' | 'stable' | 'declining' = 'stable';
    if (changePercentage > 5) direction = 'improving';
    else if (changePercentage < -5) direction = 'declining';

    return {
      direction,
      changePercentage: Math.round(changePercentage * 100) / 100,
      previousScore: previousScore !== currentScore ? previousScore : null,
      daysCompared: lookbackDays
    };
  }

  /**
   * تعیین سطح سلامت
   */
  private static determineHealthLevel(
    score: number
  ): HealthScoreResult['level'] {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }

  /**
   * تولید توصیه‌های خودکار
   */
  private static generateRecommendations(
    totalDebt: number,
    criticalCount: number,
    warnCount: number,
    trend: HealthScoreResult['trend']
  ): string[] {
    const recommendations: string[] = [];

    // Debt recommendations
    if (totalDebt > 10_000_000) {
      recommendations.push('🔴 بدهی بالا: اولویت اصلی کاهش بدهی است');
      recommendations.push('💡 پیشنهاد: تماس با نمایندگان بدهکار برای تسویه حساب');
    } else if (totalDebt > 5_000_000) {
      recommendations.push('🟡 بدهی متوسط: نظارت بر روند بدهی‌ها');
    } else if (totalDebt === 0) {
      recommendations.push('✅ عالی: بدون بدهی!');
    }

    // Events recommendations
    if (criticalCount > 0) {
      recommendations.push(`⚠️ ${criticalCount} رویداد بحرانی: بررسی فوری مشکلات سیستم`);
    }
    if (warnCount > 3) {
      recommendations.push(`⚡ ${warnCount} هشدار: پیگیری مسائل برای جلوگیری از بحران`);
    }

    // Trend recommendations
    if (trend.direction === 'declining') {
      recommendations.push('📉 روند نزولی: اقدامات اصلاحی فوری لازم است');
    } else if (trend.direction === 'improving') {
      recommendations.push('📈 روند صعودی: عملکرد رو به بهبود است، ادامه دهید!');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ وضعیت مطلوب: همه چیز در حد نرمال است');
    }

    return recommendations;
  }

  /**
   * دریافت تنظیمات فعلی
   */
  static getDefaultThresholds(): HealthScoreThresholds {
    return { ...this.defaultThresholds };
  }

  /**
   * ذخیره Historical Score برای تحلیل روند
   */
  static async saveHistoricalScore(score: number): Promise<void> {
    // می‌توانیم در آینده یک جدول health_score_history بسازیم
    // فعلاً در guard_metrics_events ثبت می‌کنیم
    await db.execute(sql`
      INSERT INTO guard_metrics_events (event_type, level, context, created_at)
      VALUES (
        'HEALTH_SCORE_SNAPSHOT',
        CASE 
          WHEN ${score} >= 90 THEN 'info'
          WHEN ${score} >= 75 THEN 'info'
          WHEN ${score} >= 60 THEN 'warn'
          ELSE 'critical'
        END,
        json_build_object('score', ${score}, 'timestamp', NOW()),
        NOW()
      )
    `);
  }
}

export default EnhancedHealthScoreService;
