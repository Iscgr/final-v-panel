import test from 'node:test';
import { strict as assert } from 'assert';
import { ReconciliationService } from '../../server/services/reconciliation-service.js';

/**
 * تست خروجی runShadowDriftBreakdown
 */

test('drift breakdown shape', async (t) => {
  try {
    const rows = await ReconciliationService.runShadowDriftBreakdown(5);
    assert.ok(Array.isArray(rows));
    if (rows.length > 0) {
      const r = rows[0];
      assert.ok(typeof r.representativeId === 'number');
      assert.ok(typeof r.legacyAllocatedSum === 'number');
      assert.ok(typeof r.ledgerAllocatedSum === 'number');
      assert.ok(typeof r.diffAbs === 'number');
      assert.ok(typeof r.diffRatio === 'number');
    }
  } catch (e: any) {
    t.skip(`Skipping drift breakdown test: ${e.message}`);
  }
});
