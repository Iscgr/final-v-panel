import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { unifiedAuthMiddleware } from "../middleware/unified-auth.js";
import { type ImportJob } from "@shared/schema";

const router = Router();

// تمام مسیرها نیاز به احراز هویت دارند
router.use(unifiedAuthMiddleware);

const statusEnum = z.enum(["pending", "validating", "ingesting", "enriching", "completed", "failed"]);

const createImportJobSchema = z.object({
  jobCode: z.string().trim().min(3, "کد job باید حداقل ۳ کاراکتر باشد"),
  sourceFileName: z.string().trim().max(512).nullable().optional(),
  totalRecords: z.number().int().min(0).optional(),
  metadata: z.record(z.any()).optional()
});

const updateImportJobSchema = z.object({
  status: statusEnum.optional(),
  processedRecords: z.number().int().min(0).optional(),
  processedRecordsIncrement: z.number().int().min(1).optional(),
  totalRecords: z.number().int().min(0).optional(),
  errorCount: z.number().int().min(0).optional(),
  errorIncrement: z.number().int().min(1).optional(),
  lastError: z.string().trim().nullable().optional(),
  metadata: z.record(z.any()).optional()
});

router.get("/", async (_req: Request, res: Response) => {
  try {
    const jobs = await storage.getImportJobs();
    res.json({
      success: true,
      data: jobs,
      count: jobs.length
    });
  } catch (error) {
    console.error("❌ Error fetching import jobs:", error);
    res.status(500).json({
      success: false,
      error: "خطا در دریافت وضعیت import jobs"
    });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const payload = createImportJobSchema.parse(req.body);

    const job = await storage.upsertImportJob({
      jobCode: payload.jobCode,
      sourceFileName: payload.sourceFileName ?? null,
      status: "pending",
      totalRecords: payload.totalRecords ?? 0,
      processedRecords: 0,
      errorCount: 0,
      metadata: payload.metadata ?? {}
    });

    res.status(201).json({
      success: true,
      data: job
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "داده نامعتبر است",
        details: error.flatten()
      });
    }

    console.error("❌ Error creating import job:", error);
    res.status(500).json({
      success: false,
      error: "خطا در ایجاد import job"
    });
  }
});

router.patch("/:jobCode", async (req: Request, res: Response) => {
  try {
    const { jobCode } = req.params;
    const updates = updateImportJobSchema.parse(req.body);

    const updatePayload: {
      status?: ImportJob["status"];
      processedRecords?: number;
      processedRecordsIncrement?: number;
      totalRecords?: number;
      errorCount?: number;
      errorIncrement?: number;
      lastError?: string | null;
      metadata?: ImportJob["metadata"];
      finishedAt?: Date | null;
    } = {};

    if (updates.status !== undefined) {
      updatePayload.status = updates.status;
      if (updates.status === "completed" || updates.status === "failed") {
        updatePayload.finishedAt = new Date();
      } else {
        updatePayload.finishedAt = null;
      }
    }

    if (updates.processedRecords !== undefined) {
      updatePayload.processedRecords = updates.processedRecords;
    }
    if (updates.processedRecordsIncrement !== undefined) {
      updatePayload.processedRecordsIncrement = updates.processedRecordsIncrement;
    }
    if (updates.totalRecords !== undefined) {
      updatePayload.totalRecords = updates.totalRecords;
    }
    if (updates.errorCount !== undefined) {
      updatePayload.errorCount = updates.errorCount;
    }
    if (updates.errorIncrement !== undefined) {
      updatePayload.errorIncrement = updates.errorIncrement;
    }
    if (updates.lastError !== undefined) {
      updatePayload.lastError = updates.lastError;
    }
    if (updates.metadata !== undefined) {
      updatePayload.metadata = updates.metadata;
    }

    const job = await storage.updateImportJob(jobCode, updatePayload);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "import job یافت نشد"
      });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "داده نامعتبر است",
        details: error.flatten()
      });
    }

    console.error("❌ Error updating import job:", error);
    res.status(500).json({
      success: false,
      error: "خطا در بروزرسانی import job"
    });
  }
});

router.post("/:jobCode/start", async (req: Request, res: Response) => {
  try {
    const { jobCode } = req.params;

    const existing = await storage.getImportJobByCode(jobCode);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "import job یافت نشد"
      });
    }

    const updated = await storage.updateImportJob(jobCode, {
      status: "validating",
      processedRecords: 0,
      errorCount: 0,
      startedAt: new Date(),
      finishedAt: null,
      lastError: null
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error("❌ Error starting import job:", error);
    res.status(500).json({
      success: false,
      error: "خطا در شروع import job"
    });
  }
});

export default router;
