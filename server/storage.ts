import { db } from "./db.js";
import { usageLogs, type InsertUsageLog, type UsageLog } from "../shared/schema.js";

export interface IStorage {
  logUsage(log: InsertUsageLog): Promise<UsageLog>;
}

export class DatabaseStorage implements IStorage {
  async logUsage(log: InsertUsageLog): Promise<UsageLog> {
    const [result] = await db.insert(usageLogs).values(log).returning();
    return result;
  }
}

export const storage = new DatabaseStorage();
