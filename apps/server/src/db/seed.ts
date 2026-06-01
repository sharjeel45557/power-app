import { loadConfig } from "@power-app/core";
import { createDb } from "./client.js";
import { requests, type NewRequest } from "./schema.js";

// Sample Service Requests across the workflow states, so the dashboard and
// list views have realistic data out of the box. Run with `pnpm db:seed`.
const sample: NewRequest[] = [
  { title: "Replace label printer in Pharmacy", category: "facilities", priority: "high", status: "approved", createdBy: "seed@example.com" },
  { title: "New laptop for onboarding nurse", category: "it", priority: "normal", status: "in_review", createdBy: "seed@example.com" },
  { title: "Recalibrate Ward 3 infusion pumps", category: "clinical", priority: "urgent", status: "submitted", createdBy: "seed@example.com" },
  { title: "Update HR policy intranet page", category: "hr", priority: "low", status: "completed", createdBy: "seed@example.com" },
  { title: "Additional monitor for triage desk", category: "it", priority: "normal", status: "rejected", createdBy: "seed@example.com" },
  { title: "Quarterly fire-safety inspection", category: "facilities", priority: "high", status: "submitted", createdBy: "seed@example.com" },
];

async function main() {
  const config = loadConfig();
  const { db, close } = createDb(config);
  try {
    await db.insert(requests).values(sample);
    console.log(`[seed] inserted ${sample.length} sample requests`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
