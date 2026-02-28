import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const usageLogs = pgTable("usage_logs", {
  id: serial("id").primaryKey(),
  timezone: text("timezone").notNull(),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUsageLogSchema = createInsertSchema(usageLogs).omit({ id: true, createdAt: true });
export type UsageLog = typeof usageLogs.$inferSelect;
export type InsertUsageLog = z.infer<typeof insertUsageLogSchema>;

// Request schema for the API
export const generateSlotsSchema = z.object({
  icsLink: z.string().url("Must be a valid URL"),
  workingDays: z.array(z.number().min(1).max(7)).min(1, "Select at least one working day"),
  workingHours: z.object({
    start: z.number().min(0).max(23), // hour 0-23
    end: z.number().min(0).max(24)    // hour 0-24
  }),
  timezone: z.string(),
  prompt: z.string().min(1, "Prompt is required"),
});

export type GenerateSlotsRequest = z.infer<typeof generateSlotsSchema>;

export const generateSlotsResponseSchema = z.object({
  slots: z.string(),
});

export type GenerateSlotsResponse = z.infer<typeof generateSlotsResponseSchema>;
