export interface ImportJobLite {
  jobCode: string;
  status: string; // pending | validating | ingesting | enriching | completed | failed
  totalRecords: number;
  processedRecords: number;
  errorCount: number;
  lastError?: string | null;
  sourceFileName?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface ProcessingEvent {
  id: string;            // unique (client side uuid)
  ts: number;            // epoch ms
  label: string;         // human readable
  meta?: Record<string, any>;
  kind: 'stage' | 'record' | 'engine' | 'error' | 'summary';
}

export interface EngineInfo {
  name: string;          // e.g. Node.js Pipeline / Python Worker
  version?: string;
  runtime: 'node' | 'python' | 'unknown';
  latencyMsAvg?: number;
}
