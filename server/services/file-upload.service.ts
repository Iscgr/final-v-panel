import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import type { Request } from "express";

// مسیر اصلی ذخیره‌سازی فایل‌ها
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const QR_CODES_DIR = path.join(UPLOAD_DIR, "qr-codes");
const VIDEOS_DIR = path.join(UPLOAD_DIR, "videos");

// ایجاد پوشه‌ها در صورت عدم وجود
[UPLOAD_DIR, QR_CODES_DIR, VIDEOS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// تنظیمات ذخیره‌سازی برای QR Codes
const qrCodeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, QR_CODES_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// تنظیمات ذخیره‌سازی برای Videos
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, VIDEOS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// فیلتر فایل‌های تصویری (QR Code)
const imageFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('فقط فایل‌های تصویری (JPG, PNG, GIF, WEBP) مجاز هستند'));
  }
};

// فیلتر فایل‌های ویدئویی
const videoFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('فقط فایل‌های ویدئویی (MP4, WEBM, OGG, MOV) مجاز هستند'));
  }
};

// Multer middleware برای QR Codes
export const uploadQRCode = multer({
  storage: qrCodeStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  }
});

// Multer middleware برای Videos
export const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  }
});

// توابع کمکی برای مدیریت فایل‌ها
export const fileService = {
  /**
   * حذف فایل از سرور
   */
  deleteFile: (filePath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!filePath || !fs.existsSync(filePath)) {
        resolve();
        return;
      }

      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Error deleting file ${filePath}:`, err);
          reject(err);
        } else {
          console.log(`✅ File deleted: ${filePath}`);
          resolve();
        }
      });
    });
  },

  /**
   * دریافت URL عمومی فایل
   */
  getFileUrl: (filePath: string): string => {
    if (!filePath) return '';
    
    // تبدیل مسیر فایل به URL قابل دسترس
    const relativePath = filePath.replace(UPLOAD_DIR, '').replace(/\\/g, '/');
    return `/uploads${relativePath}`;
  },

  /**
   * بررسی وجود فایل
   */
  fileExists: (filePath: string): boolean => {
    return fs.existsSync(filePath);
  },

  /**
   * دریافت اطلاعات فایل
   */
  getFileInfo: (filePath: string) => {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      extension: path.extname(filePath),
      filename: path.basename(filePath)
    };
  },

  /**
   * دریافت مسیر کامل فایل از نام فایل
   */
  getFullPath: (filename: string, type: 'qr-code' | 'video'): string => {
    const dir = type === 'qr-code' ? QR_CODES_DIR : VIDEOS_DIR;
    return path.join(dir, filename);
  }
};

// Export directories برای استفاده در جاهای دیگر
export const PATHS = {
  UPLOAD_DIR,
  QR_CODES_DIR,
  VIDEOS_DIR
};
