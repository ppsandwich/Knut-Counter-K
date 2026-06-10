import { getDb } from "../client";
import { usageRecords } from "../schema";
import { like } from "drizzle-orm";

async function cleanup() {
  console.log("Cleaning up dummy claude_pro subscription records...");
  const db = getDb();
  const result = await db.delete(usageRecords).where(like(usageRecords.sourceRef, "claude_pro:subscription:%"));
  console.log("Cleanup complete!");
  process.exit(0);
}

cleanup().catch(console.error);
