import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { backupService } from '../services/backup-service.js';
import { db } from '../db.js';
import { backupAuditLog } from '../../shared/schema.js';
import { desc } from 'drizzle-orm';
import { promises as fs } from 'fs';

const router = Router();

const uploadDir = path.resolve(process.cwd(), 'uploads', 'restore');
fs.mkdir(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// POST /api/system/backup - Create a new backup
router.post('/backup', async (req: Request, res: Response) => {
  const username = (req as any).user?.username || 'unknown';
  try {
    const { filePath, fileSize, checksum } = await backupService.createBackup(username);
    res.json({ 
      success: true, 
      message: 'Backup created successfully.',
      fileName: path.basename(filePath),
      fileSize,
      checksum
    });
  } catch (error) {
    console.error('❌ Backup creation failed:', error);
    await db.insert(backupAuditLog).values({
      performedBy: username,
      action: 'backup',
      status: 'failed',
      notes: (error as Error).message
    });
    res.status(500).json({ success: false, error: 'Backup creation failed.' });
  }
});

// POST /api/system/restore - Restore from an uploaded backup file
router.post('/restore', upload.single('backupFile'), async (req: Request, res: Response) => {
  const username = (req as any).user?.username || 'unknown';
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No backup file uploaded.' });
  }

  try {
    // NOTE: Restore logic is not implemented in this phase, this is a placeholder
    await backupService.restoreFromBackup(req.file.path, username);
    
    // Placeholder success response
    await db.insert(backupAuditLog).values({
      performedBy: username,
      action: 'restore',
      status: 'success', // This would be 'failed' if restore logic fails
      notes: `Restore initiated from file: ${req.file.originalname}`
    });

    res.json({ success: true, message: 'Restore process initiated (placeholder).' });
  } catch (error) {
    console.error('❌ Restore failed:', error);
    await db.insert(backupAuditLog).values({
      performedBy: username,
      action: 'restore',
      status: 'failed',
      notes: `Failed to restore from ${req.file?.originalname}: ${(error as Error).message}`
    });
    res.status(500).json({ success: false, error: 'Restore process failed.' });
  } finally {
    // Clean up the uploaded file
    if (req.file) {
      await fs.unlink(req.file.path).catch(err => console.error(`Failed to delete restore file: ${err.message}`));
    }
  }
});

// GET /api/system/backup/history - Get backup history
router.get('/backup/history', async (req: Request, res: Response) => {
  try {
    const history = await db.select().from(backupAuditLog).orderBy(desc(backupAuditLog.timestamp)).limit(50);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('❌ Failed to fetch backup history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch backup history.' });
  }
});

// GET /api/system/backup/download/:fileName - Download a backup file
router.get('/backup/download/:fileName', (req, res) => {
    const { fileName } = req.params;
    const backupDir = path.resolve(process.cwd(), 'backups');
    const filePath = path.join(backupDir, fileName);

    // Basic security check to prevent directory traversal
    if (path.dirname(filePath) !== backupDir) {
        return res.status(400).send('Invalid file path');
    }

    res.download(filePath, (err) => {
        if (err) {
            console.error('❌ File download failed:', err);
            if (!res.headersSent) {
                res.status(404).send('File not found.');
            }
        }
    });
});


export default router;
