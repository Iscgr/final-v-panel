/**
 * Portal Content Management Routes
 * مدیریت محتوای پرتال - اپلیکیشن‌ها و اعلانات
 */
import type { Express } from "express";
import { db } from "../db.js";
import { portalApps, portalAnnouncements } from "@shared/schema";
import { eq, desc, asc } from "drizzle-orm";
import { z } from "zod";

// Validation schemas
const portalAppSchema = z.object({
  title: z.string().min(1, "عنوان الزامی است"),
  description: z.string().optional(),
  downloadLink: z.string().url("لینک دانلود معتبر نیست").min(1, "لینک دانلود الزامی است"),
  qrCode: z.string().optional(),
  videoUrl: z.string().url("لینک ویدیو معتبر نیست").optional().or(z.literal("")),
  iconUrl: z.string().url("لینک آیکون معتبر نیست").optional().or(z.literal("")),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

const portalAnnouncementSchema = z.object({
  title: z.string().min(1, "عنوان الزامی است"),
  content: z.string().min(1, "محتوا الزامی است"),
  type: z.enum(["info", "warning", "success", "error"]).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).optional()
});

export function registerPortalContentRoutes(app: Express) {
  
  // ==================== Portal Apps Routes ====================
  
  /**
   * Get all portal apps (admin)
   * GET /api/portal-apps
   */
  app.get("/api/portal-apps", async (req, res) => {
    try {
      const apps = await db
        .select()
        .from(portalApps)
        .orderBy(asc(portalApps.order), desc(portalApps.createdAt));
      
      res.json(apps);
    } catch (error: any) {
      console.error("Error fetching portal apps:", error);
      res.status(500).json({ 
        error: "خطا در دریافت لیست اپلیکیشن‌ها",
        details: error.message 
      });
    }
  });

  /**
   * Get active portal apps (public)
   * GET /api/public/portal-apps
   */
  app.get("/api/public/portal-apps", async (req, res) => {
    try {
      const apps = await db
        .select()
        .from(portalApps)
        .where(eq(portalApps.isActive, true))
        .orderBy(asc(portalApps.order), desc(portalApps.createdAt));
      
      res.json(apps);
    } catch (error: any) {
      console.error("Error fetching active portal apps:", error);
      res.status(500).json({ 
        error: "خطا در دریافت اپلیکیشن‌ها",
        details: error.message 
      });
    }
  });

  /**
   * Get single portal app
   * GET /api/portal-apps/:id
   */
  app.get("/api/portal-apps/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const app = await db
        .select()
        .from(portalApps)
        .where(eq(portalApps.id, id))
        .limit(1);
      
      if (!app.length) {
        return res.status(404).json({ error: "اپلیکیشن یافت نشد" });
      }
      
      res.json(app[0]);
    } catch (error: any) {
      console.error("Error fetching portal app:", error);
      res.status(500).json({ 
        error: "خطا در دریافت اطلاعات اپلیکیشن",
        details: error.message 
      });
    }
  });

  /**
   * Create new portal app
   * POST /api/portal-apps
   */
  app.post("/api/portal-apps", async (req, res) => {
    try {
      const validatedData = portalAppSchema.parse(req.body);
      
      const newApp = await db
        .insert(portalApps)
        .values({
          ...validatedData,
          updatedAt: new Date()
        })
        .returning();
      
      res.status(201).json(newApp[0]);
    } catch (error: any) {
      console.error("Error creating portal app:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "داده‌های ورودی نامعتبر",
          details: error.errors 
        });
      }
      
      res.status(500).json({ 
        error: "خطا در ایجاد اپلیکیشن",
        details: error.message 
      });
    }
  });

  /**
   * Update portal app
   * PUT /api/portal-apps/:id
   */
  app.put("/api/portal-apps/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = portalAppSchema.partial().parse(req.body);
      
      const updatedApp = await db
        .update(portalApps)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(portalApps.id, id))
        .returning();
      
      if (!updatedApp.length) {
        return res.status(404).json({ error: "اپلیکیشن یافت نشد" });
      }
      
      res.json(updatedApp[0]);
    } catch (error: any) {
      console.error("Error updating portal app:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "داده‌های ورودی نامعتبر",
          details: error.errors 
        });
      }
      
      res.status(500).json({ 
        error: "خطا در بروزرسانی اپلیکیشن",
        details: error.message 
      });
    }
  });

  /**
   * Delete portal app
   * DELETE /api/portal-apps/:id
   */
  app.delete("/api/portal-apps/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const deletedApp = await db
        .delete(portalApps)
        .where(eq(portalApps.id, id))
        .returning();
      
      if (!deletedApp.length) {
        return res.status(404).json({ error: "اپلیکیشن یافت نشد" });
      }
      
      res.json({ message: "اپلیکیشن با موفقیت حذف شد", app: deletedApp[0] });
    } catch (error: any) {
      console.error("Error deleting portal app:", error);
      res.status(500).json({ 
        error: "خطا در حذف اپلیکیشن",
        details: error.message 
      });
    }
  });

  // ==================== Portal Announcements Routes ====================
  
  /**
   * Get all announcements (admin)
   * GET /api/portal-announcements
   */
  app.get("/api/portal-announcements", async (req, res) => {
    try {
      const announcements = await db
        .select()
        .from(portalAnnouncements)
        .orderBy(desc(portalAnnouncements.priority), desc(portalAnnouncements.createdAt));
      
      res.json(announcements);
    } catch (error: any) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ 
        error: "خطا در دریافت اعلانات",
        details: error.message 
      });
    }
  });

  /**
   * Get active announcements (public)
   * GET /api/public/portal-announcements
   */
  app.get("/api/public/portal-announcements", async (req, res) => {
    try {
      const announcements = await db
        .select()
        .from(portalAnnouncements)
        .where(eq(portalAnnouncements.isActive, true))
        .orderBy(desc(portalAnnouncements.priority), desc(portalAnnouncements.createdAt));
      
      res.json(announcements);
    } catch (error: any) {
      console.error("Error fetching active announcements:", error);
      res.status(500).json({ 
        error: "خطا در دریافت اعلانات",
        details: error.message 
      });
    }
  });

  /**
   * Get single announcement
   * GET /api/portal-announcements/:id
   */
  app.get("/api/portal-announcements/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const announcement = await db
        .select()
        .from(portalAnnouncements)
        .where(eq(portalAnnouncements.id, id))
        .limit(1);
      
      if (!announcement.length) {
        return res.status(404).json({ error: "اعلان یافت نشد" });
      }
      
      res.json(announcement[0]);
    } catch (error: any) {
      console.error("Error fetching announcement:", error);
      res.status(500).json({ 
        error: "خطا در دریافت اعلان",
        details: error.message 
      });
    }
  });

  /**
   * Create new announcement
   * POST /api/portal-announcements
   */
  app.post("/api/portal-announcements", async (req, res) => {
    try {
      const validatedData = portalAnnouncementSchema.parse(req.body);
      
      const newAnnouncement = await db
        .insert(portalAnnouncements)
        .values({
          ...validatedData,
          updatedAt: new Date()
        })
        .returning();
      
      res.status(201).json(newAnnouncement[0]);
    } catch (error: any) {
      console.error("Error creating announcement:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "داده‌های ورودی نامعتبر",
          details: error.errors 
        });
      }
      
      res.status(500).json({ 
        error: "خطا در ایجاد اعلان",
        details: error.message 
      });
    }
  });

  /**
   * Update announcement
   * PUT /api/portal-announcements/:id
   */
  app.put("/api/portal-announcements/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = portalAnnouncementSchema.partial().parse(req.body);
      
      const updatedAnnouncement = await db
        .update(portalAnnouncements)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(portalAnnouncements.id, id))
        .returning();
      
      if (!updatedAnnouncement.length) {
        return res.status(404).json({ error: "اعلان یافت نشد" });
      }
      
      res.json(updatedAnnouncement[0]);
    } catch (error: any) {
      console.error("Error updating announcement:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "داده‌های ورودی نامعتبر",
          details: error.errors 
        });
      }
      
      res.status(500).json({ 
        error: "خطا در بروزرسانی اعلان",
        details: error.message 
      });
    }
  });

  /**
   * Delete announcement
   * DELETE /api/portal-announcements/:id
   */
  app.delete("/api/portal-announcements/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const deletedAnnouncement = await db
        .delete(portalAnnouncements)
        .where(eq(portalAnnouncements.id, id))
        .returning();
      
      if (!deletedAnnouncement.length) {
        return res.status(404).json({ error: "اعلان یافت نشد" });
      }
      
      res.json({ message: "اعلان با موفقیت حذف شد", announcement: deletedAnnouncement[0] });
    } catch (error: any) {
      console.error("Error deleting announcement:", error);
      res.status(500).json({ 
        error: "خطا در حذف اعلان",
        details: error.message 
      });
    }
  });

  console.log("✅ Portal Content Routes registered successfully");
}
