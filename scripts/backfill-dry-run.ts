#!/usr/bin/env ts-node
/**
 * اجرای backfill dry-run
 * نیاز: ledger_backfill_mode=read_only
 */
import { BackfillService } from '../server/services/backfill-service.js';

(async () => {
  try {
    const res = await BackfillService.dryRun();
    console.log(JSON.stringify({ ok: true, ...res }, null, 2));
    process.exit(0);
  } catch (e: any) {
    console.error(JSON.stringify({ ok: false, error: e.message }));
    process.exit(1);
  }
})();
