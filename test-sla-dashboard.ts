/**
 * تست SLA Dashboard APIs (E-C5)
 * هدف: validation عملکرد monitoring dashboard
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/sla';

async function testSLADashboard() {
  console.log('🧪 Testing SLA Dashboard APIs (E-C5)...\n');

  try {
    // 1. SLA Overview Test
    console.log('📊 Testing SLA Overview...');
    const overviewResponse = await fetch(`${BASE_URL}/overview?window=24`);
    
    if (!overviewResponse.ok) {
      console.log(`❌ Overview API returned ${overviewResponse.status}`);
      const errorText = await overviewResponse.text();
      console.log('Error details:', errorText);
    } else {
      const overviewData = await overviewResponse.json();
      console.log('✅ SLA Overview Response:');
      console.log(`   SLA Status: ${overviewData.data?.sla_status || 'Unknown'}`);
      console.log(`   Window: ${overviewData.data?.window || 'Unknown'}`);
      console.log(`   Total Messages: ${overviewData.data?.metrics?.outbox?.total_messages || 0}`);
      console.log(`   Success Rate: ${overviewData.data?.metrics?.outbox?.success_rate || 0}%`);
      console.log(`   P95 Latency: ${overviewData.data?.metrics?.latency?.p95_ms || 0}ms`);
      console.log(`   Violations: ${overviewData.data?.violations?.length || 0}`);
    }

    // 2. Historical Trends Test
    console.log('\n📈 Testing Historical Trends...');
    const trendsResponse = await fetch(`${BASE_URL}/trends?window=24&interval=60`);
    
    if (!trendsResponse.ok) {
      console.log(`❌ Trends API returned ${trendsResponse.status}`);
    } else {
      const trendsData = await trendsResponse.json();
      console.log('✅ Historical Trends Response:');
      console.log(`   Success Rate Trends: ${trendsData.data?.success_rate_trend?.length || 0} points`);
      console.log(`   Latency Trends: ${trendsData.data?.latency_trend?.length || 0} points`);
      
      if (trendsData.data?.success_rate_trend?.length > 0) {
        const latest = trendsData.data.success_rate_trend[trendsData.data.success_rate_trend.length - 1];
        console.log(`   Latest Success Rate: ${latest.success_rate?.toFixed(2) || 0}%`);
      }
    }

    // 3. Violations History Test
    console.log('\n⚠️ Testing Violations History...');
    const violationsResponse = await fetch(`${BASE_URL}/violations?window=168`);
    
    if (!violationsResponse.ok) {
      console.log(`❌ Violations API returned ${violationsResponse.status}`);
    } else {
      const violationsData = await violationsResponse.json();
      console.log('✅ Violations History Response:');
      console.log(`   Violations Found: ${violationsData.data?.violations?.length || 0}`);
      
      if (violationsData.data?.violations?.length > 0) {
        console.log('   Recent violations:');
        violationsData.data.violations.slice(0, 3).forEach((v: any, i: number) => {
          console.log(`     ${i + 1}. ${v.metric} - ${v.level} at ${v.timestamp}`);
        });
      }
    }

    // 4. Live Feed Test
    console.log('\n🔴 Testing Live Feed...');
    const liveResponse = await fetch(`${BASE_URL}/live`);
    
    if (!liveResponse.ok) {
      console.log(`❌ Live Feed API returned ${liveResponse.status}`);
    } else {
      const liveData = await liveResponse.json();
      console.log('✅ Live Feed Response:');
      console.log(`   Recent Events: ${liveData.data?.recent_events?.length || 0}`);
      console.log(`   Recent Outbox: ${liveData.data?.recent_outbox?.length || 0}`);
      console.log(`   Timestamp: ${liveData.data?.timestamp || 'Unknown'}`);
    }

    // 5. Configuration Test
    console.log('\n⚙️ Testing SLA Configuration...');
    const configResponse = await fetch(`${BASE_URL}/config`);
    
    if (!configResponse.ok) {
      console.log(`❌ Config API returned ${configResponse.status}`);
    } else {
      const configData = await configResponse.json();
      console.log('✅ SLA Configuration Response:');
      console.log(`   Thresholds Configured: ${configData.data?.thresholds?.length || 0}`);
      
      if (configData.data?.thresholds?.length > 0) {
        console.log('   Threshold Details:');
        configData.data.thresholds.forEach((t: any) => {
          console.log(`     ${t.metric}: warn=${t.warn_threshold}, critical=${t.critical_threshold} (${t.enabled ? 'enabled' : 'disabled'})`);
        });
      }
    }

    console.log('\n🎉 SLA Dashboard test completed successfully!');
    
  } catch (error) {
    console.error('❌ SLA Dashboard test failed:', error);
    process.exit(1);
  }
}

// اجرای تست
testSLADashboard();