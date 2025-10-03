// تست‌های پایه سرویس portal-content و محاسبه پیشرفت Job
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { calculateProgress, ImportJob } from '@/services/import-jobs';
import { PortalContentService } from '@/services/portal-content';

// Mock fetch
const g: any = global;

describe('import-jobs calculateProgress', () => {
  it('returns 0 for null job', () => {
    expect(calculateProgress(null)).toBe(0);
  });
  it('returns 100 when completed', () => {
    const job: ImportJob = { id:1, jobCode:'x', sourceFileName:null, status:'completed', totalRecords:10, processedRecords:10, errorCount:0, startedAt:new Date().toISOString(), finishedAt:new Date().toISOString(), lastError:null };
    expect(calculateProgress(job)).toBe(100);
  });
  it('monotonic increase across stages', () => {
    const base: Omit<ImportJob,'status'> = { id:1, jobCode:'x', sourceFileName:null, totalRecords:100, processedRecords:50, errorCount:0, startedAt:new Date().toISOString(), finishedAt:null, lastError:null };
    const pending = calculateProgress({ ...base, status:'pending' });
    const validating = calculateProgress({ ...base, status:'validating' });
    const ingesting = calculateProgress({ ...base, status:'ingesting' });
    const enriching = calculateProgress({ ...base, status:'enriching' });
    expect(pending).toBeLessThan(validating);
    expect(validating).toBeLessThan(ingesting);
    expect(ingesting).toBeLessThan(enriching);
  });
});

describe('PortalContentService API wrappers', () => {
  beforeAll(() => {
    g.fetch = vi.fn(async (url: string, options?: any) => {
      if(url.includes('/portal-content-blocks/full')){
        return { ok:true, json: async () => ({ success:true, data:{ blocks:[], announcements:[], downloads:[] } }) };
      }
      if(url.includes('/portal-content-blocks') && (!options || options.method==='GET')){
        return { ok:true, json: async () => ({ success:true, data:[{ id:1, blockKey:'guidance', title:'راهنما', body:'متن', updatedAt:null, updatedBy:null }] }) };
      }
      return { ok:true, json: async () => ({ success:true }) };
    });
  });

  it('lists blocks', async () => {
    const res = await PortalContentService.blocks.list();
    expect(res.success).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('gets full content', async () => {
    const res = await PortalContentService.blocks.full();
    expect(res.success).toBe(true);
    expect(res.data.blocks).toBeDefined();
  });
});
