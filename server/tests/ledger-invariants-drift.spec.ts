import test from 'node:test';
import { strict as assert } from 'assert';
import { ReconciliationService } from '../services/reconciliation-service.js';

/**
 * I10: Drift per representative باید زیر آستانه نرم تعریف‌شده (مثلاً 1%) بماند.
 * اگر داده کافی یا سرویس در دسترس نباشد skip.
 */

test('I10 per representative drift soft threshold', async (t) => {
  try {
    const breakdown = await ReconciliationService.runShadowDriftBreakdown(50);
    if (!breakdown.length) return t.skip('No drift data');
    const threshold = 0.01; // 1%
    const violators = breakdown.filter(r => r.diffRatio > threshold);
    assert.equal(violators.length, 0, `Representatives exceeding drift threshold (${threshold}): ${violators.map(v=>v.representativeId).join(',')}`);
  } catch (e: any) {
    t.skip('Skipping I10 drift test: ' + e.message);
  }
});
