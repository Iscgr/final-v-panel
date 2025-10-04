import { db } from '../db.js';
import * as schema from '../../shared/schema.js';
import tar from 'tar-stream';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const BACKUP_TABLES = [
  'representatives', 'salesPartners', 'partnerCommissionPayments', 'invoices', 'payments', 
  'paymentAllocations', 'invoiceBalanceCache', 'announcements', 'appDownloads', 'portalContentBlocks',
  'settings', 'adminUsers', 'sessions'
  // Tables like logs, outbox, etc., are excluded by design
];

class BackupService {
  public async createBackup(username: string): Promise<{ filePath: string; fileSize: number; checksum: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `marfanet-backup-${timestamp}.tar.gz`;
    const backupDir = path.resolve(process.cwd(), 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    const filePath = path.join(backupDir, fileName);

    const pack = tar.pack();
    const gzip = createGzip();
    const dest = createWriteStream(filePath);

    const backupPromise = pipeline(pack, gzip, dest);

    // 1. Add schema version/metadata
    const meta = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      createdBy: username,
      tables: BACKUP_TABLES,
    };
    pack.entry({ name: 'metadata.json' }, JSON.stringify(meta, null, 2));

    // 2. Stream tables to NDJSON
    for (const tableName of BACKUP_TABLES) {
      const table = (schema as any)[tableName];
      if (!table) {
        console.warn(`Table ${tableName} not found in schema, skipping.`);
        continue;
      }
      
      const entry = pack.entry({ name: `${tableName}.ndjson` });
      const queryStream = await db.select().from(table).stream();
      
      for await (const row of queryStream) {
        entry.write(JSON.stringify(row) + '\n');
      }
      entry.end();
    }

    pack.finalize();
    await backupPromise;

    const stats = await fs.stat(filePath);
    const checksum = await this.calculateChecksum(filePath);

    await db.insert(schema.backupAuditLog).values({
      performedBy: username,
      action: 'backup',
      status: 'success',
      fileSize: stats.size,
      checksum: checksum,
      notes: `Backup created successfully: ${fileName}`
    });

    return { filePath, fileSize: stats.size, checksum };
  }

  public async restoreFromBackup(filePath: string, username: string): Promise<void> {
    const pack = tar.extract();
    const gunzip = createGunzip();
    const source = createReadStream(filePath);
    const checksum = await this.calculateChecksum(filePath);

    let metadata: any = null;
    const tableData: { [key: string]: any[] } = {};

    pack.on('entry', (header, stream, next) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf8');
        if (header.name === 'metadata.json') {
          metadata = JSON.parse(content);
        } else if (header.name.endsWith('.ndjson')) {
          const tableName = header.name.replace('.ndjson', '');
          tableData[tableName] = content.split('\n').filter(Boolean).map(line => JSON.parse(line));
        }
        next();
      });
      stream.resume();
    });

    await pipeline(source, gunzip, pack);

    if (!metadata || !this.validateMetadata(metadata)) {
      throw new Error('Invalid or missing metadata in backup file.');
    }

    await db.transaction(async (tx) => {
      for (const tableName of [...BACKUP_TABLES].reverse()) {
        const table = (schema as any)[tableName];
        if (table) {
          await tx.delete(table);
        }
      }

      for (const tableName of BACKUP_TABLES) {
        const table = (schema as any)[tableName];
        const data = tableData[tableName];
        if (table && data && data.length > 0) {
          await tx.insert(table).values(data);
        }
      }
    });

    await db.insert(schema.backupAuditLog).values({
      performedBy: username,
      action: 'restore',
      status: 'success',
      checksum: checksum,
      notes: `Restore completed from: ${path.basename(filePath)}`
    });
  }

  private validateMetadata(metadata: any): boolean {
    return metadata.version === '1.0.0' && Array.isArray(metadata.tables);
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const input = createReadStream(filePath);
      input.on('readable', () => {
        const data = input.read();
        if (data) {
          hash.update(data);
        } else {
          resolve(hash.digest('hex'));
        }
      });
      input.on('error', reject);
    });
  }
}

export const backupService = new BackupService();
