#!/usr/bin/env ts-node
/**
 * اسکریپت drift-shadow
 * اجرای محاسبه drift و چاپ خروجی JSON.
 * استفاده: npm run drift:shadow
 */
import { ReconciliationService } from '../server/services/reconciliation-service.js';

(async () => {
  try {
    const metrics = await ReconciliationService.runShadowDriftCheck({ record: false });
    // چاپ ساختار JSON تمیز
    console.log(JSON.stringify({ ok: true, metrics }, null, 2));
    process.exit(0);
  } catch (e: any) {
    console.error(JSON.stringify({ ok: false, error: e.message }));
    process.exit(1);
  }
})();
