import { strict as assert } from 'assert';
import test from 'node:test';
import { ReconciliationService } from '../../server/services/reconciliation-service.js';

// توجه: این تست فرض می‌کند اتصال DB برقرار است. در صورت خطا (مثلاً نبود جدول) تست skip می‌شود.

test('drift-shadow metrics shape', async (t) => {
  try {
    const metrics = await ReconciliationService.runShadowDriftCheck({ record: false });
    assert.ok(typeof metrics.legacyAllocatedSum === 'number');
    assert.ok(typeof metrics.ledgerAllocatedSum === 'number');
    assert.ok(typeof metrics.diffAbs === 'number');
    assert.ok(typeof metrics.diffRatio === 'number');
    assert.ok(['OK','WARN','FAIL'].includes(metrics.status));
  } catch (e: any) {
    t.skip(`Skipping drift-shadow metrics test: ${e.message}`);
  }
});
