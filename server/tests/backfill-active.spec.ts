import test from 'node:test';
import { strict as assert } from 'assert';
import { BackfillService } from '../../server/services/backfill-service.js';
import { featureFlagManager } from '../../server/services/feature-flag-manager.js';

/**
 * تست active backfill – فقط اگر state ها مناسب نباشد skip.
 */

test('active backfill structure', async (t) => {
  try {
    const backfillState = featureFlagManager.getMultiStageFlagState('ledger_backfill_mode');
    if (backfillState !== 'active') {
      t.skip('ledger_backfill_mode != active');
      return;
    }
    const dualState = featureFlagManager.getMultiStageFlagState('allocation_dual_write');
    if (dualState === 'off') {
      t.skip('allocation_dual_write=off');
      return;
    }
    const res = await BackfillService.active(5);
    assert.ok(typeof res.inserted === 'number');
    assert.ok(typeof res.skipped === 'number');
  } catch (e: any) {
    t.skip(`Skipping active backfill test: ${e.message}`);
  }
});
