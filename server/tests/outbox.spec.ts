import { strict as assert } from 'assert';
import { OutboxService } from '../services/outbox';
import { featureFlagManager } from '../services/feature-flag-manager';
import { db } from '../db';
import { outbox } from '../../shared/schema';
import { sql, eq } from 'drizzle-orm';

async function resetOutbox() {
  await db.execute(sql`DELETE FROM outbox;`);
}

async function countStatus(status: string) {
  const rows:any = await db.select({c: sql`COUNT(*)`.as('c')}).from(outbox).where(eq(outbox.status, status as any));
  return Number(rows[0].c || 0);
}

(async () => {
  console.log('E-C1 TEST: starting outbox.spec.ts');
  featureFlagManager.updateMultiStageFlag('outbox_enabled','on','test_bootstrap');
  const service = new OutboxService();
  await resetOutbox();

  // 1) Enqueue base message
  const id = await service.enqueueMessage({
    type: 'TELEGRAM_MESSAGE',
    payload: { recipient: 'chat-test', message: 'Hello World (test)' }
  });
  assert.ok(id > 0, 'enqueue should return id');

  // 2) Simulate processing success
  const ready = await service.getReadyMessages(10);
  assert.equal(ready.length, 1, 'one message should be ready');
  await service.markAsProcessing(id);
  await service.markAsSent(id);
  assert.equal(await countStatus('SENT'), 1, 'message should be SENT');

  // 3) Retry escalation logic
  await resetOutbox();
  const failId = await service.enqueueMessage({ type: 'TELEGRAM_MESSAGE', payload: { recipient: 'x', message: 'fail test' } });
  for (let attempt=1; attempt<=6; attempt++) {
    try {
      await service.markAsProcessing(failId);
      // force failure path
      await service.markAsFailed(failId, 'NETWORK_ERROR');
    } catch (e:any) {
      // ignore
    }
  }
  const cancelledCount = await countStatus('CANCELLED');
  assert.equal(cancelledCount, 1, 'after exceeding retries message must be CANCELLED');

  // 4) Metrics window check
  const metrics = await service.getWindowMetrics(60);
  assert.ok(typeof metrics.failureRateWindow === 'number');

  console.log('outbox.spec.ts PASS', { cancelledCount, metrics: { failureRateWindow: metrics.failureRateWindow } });
  process.exit(0);
})().catch(err => {
  console.error('outbox.spec.ts FAIL', err);
  process.exit(1);
});
