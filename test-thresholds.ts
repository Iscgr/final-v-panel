/**
 * Test script برای تست Dynamic Threshold Loading
 */

import { getThresholdForAsync } from './server/services/guard-metrics-thresholds.js';

async function testDynamicThresholds() {
  console.log('🧪 Testing Dynamic Threshold Loading...');
  
  try {
    const outboxFailureThreshold = await getThresholdForAsync('outbox_failure_rate');
    console.log('✅ Outbox failure rate threshold:', outboxFailureThreshold);
    
    const outboxRetryThreshold = await getThresholdForAsync('outbox_avg_retry');
    console.log('✅ Outbox avg retry threshold:', outboxRetryThreshold);
    
    const latencyThreshold = await getThresholdForAsync('outbox_latency_p95');
    console.log('✅ Outbox latency threshold:', latencyThreshold);
    
    const unknownThreshold = await getThresholdForAsync('unknown_metric');
    console.log('✅ Unknown metric fallback:', unknownThreshold);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDynamicThresholds();