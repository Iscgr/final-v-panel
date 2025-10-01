/**
 * تست State Management Service (E-C6)
 * هدف: validation عملکرد resumable processes
 */

import { stateManager } from './server/services/state-manager.js';

async function testStateManagement() {
  console.log('🧪 Testing State Management Service (E-C6)...\n');

  try {
    // 1. ایجاد فرایند جدید
    console.log('📋 Creating new process...');
    const definition = {
      batchId: `test-batch-${Date.now()}`,
      totalRecords: 1000,
      steps: [
        { stepNumber: 1, stepName: 'Data Validation', stepType: 'VALIDATION', config: { strict: true } },
        { stepNumber: 2, stepName: 'Data Processing', stepType: 'TRANSFORM', config: { batchSize: 100 } },
        { stepNumber: 3, stepName: 'Data Storage', stepType: 'PERSIST', config: { table: 'invoices' } },
        { stepNumber: 4, stepName: 'Notification', stepType: 'NOTIFY', config: { channels: ['telegram'] } }
      ]
    };

    const process = await stateManager.createProcess(definition);
    console.log(`✅ Process created: ${process.batchId}`);

    // 2. شروع فرایند
    console.log('\n🚀 Starting process...');
    await stateManager.startProcess(definition.batchId);

    // 3. شبیه‌سازی پیشرفت step به step
    console.log('\n📈 Simulating step progression...');
    
    // Step 1: Validation
    await stateManager.updateStepStatus(definition.batchId, 1, 'PROCESSING');
    await new Promise(resolve => setTimeout(resolve, 100)); // شبیه‌سازی کار
    await stateManager.updateCheckpoint(definition.batchId, { currentTable: 'validation', processed_count: 250 }, 250);
    await stateManager.updateStepStatus(definition.batchId, 1, 'COMPLETED');

    // Step 2: Processing with pause/resume
    await stateManager.updateStepStatus(definition.batchId, 2, 'PROCESSING');
    await stateManager.updateCheckpoint(definition.batchId, { currentTable: 'processing', processed_count: 500 }, 500);
    
    // شبیه‌سازی pause
    console.log('\n⏸️ Simulating pause...');
    await stateManager.pauseProcess(definition.batchId, 'System maintenance');
    
    // Resume
    console.log('▶️ Resuming process...');
    await stateManager.resumeProcess(definition.batchId);
    
    // ادامه step 2
    await stateManager.updateCheckpoint(definition.batchId, { currentTable: 'processing', processed_count: 1000 }, 1000);
    await stateManager.updateStepStatus(definition.batchId, 2, 'COMPLETED');

    // Step 3: Storage
    await stateManager.updateStepStatus(definition.batchId, 3, 'PROCESSING');
    await stateManager.updateStepStatus(definition.batchId, 3, 'COMPLETED');

    // Step 4: Notification
    await stateManager.updateStepStatus(definition.batchId, 4, 'PROCESSING');
    await stateManager.updateStepStatus(definition.batchId, 4, 'COMPLETED');

    // 4. تکمیل فرایند
    console.log('\n✅ Completing process...');
    await stateManager.completeProcess(definition.batchId);

    // 5. بررسی وضعیت نهایی
    console.log('\n📊 Final state check...');
    const finalState = await stateManager.getProcessState(definition.batchId);
    if (finalState) {
      console.log(`Process State: ${finalState.process.state}`);
      console.log(`Completed Steps: ${finalState.process.currentStep}/${finalState.process.totalSteps}`);
      console.log(`Processed Records: ${finalState.process.processedRecords}/${finalState.process.totalRecords}`);
      console.log(`Error Count: ${finalState.process.errorCount}`);
      
      console.log('\nStep Details:');
      finalState.steps.forEach(step => {
        console.log(`  ${step.stepNumber}. ${step.stepName}: ${step.status}`);
      });
    }

    // 6. آمار کلی
    console.log('\n📈 State Management Stats:');
    const stats = await stateManager.getStats();
    console.log(`Total Processes: ${stats.total}`);
    console.log(`By State:`, stats.byState);
    console.log(`Avg Completion Time: ${stats.avgCompletionTime.toFixed(2)}s`);
    console.log(`Error Rate: ${(stats.errorRate * 100).toFixed(2)}%`);

    // 7. فرایندهای فعال
    console.log('\n🔄 Active Processes:');
    const activeProcesses = await stateManager.getActiveProcesses();
    console.log(`Found ${activeProcesses.length} active processes`);

    console.log('\n🎉 State Management test completed successfully!');
    
  } catch (error) {
    console.error('❌ State Management test failed:', error);
    process.exit(1);
  }
}

// اجرای تست
testStateManagement();