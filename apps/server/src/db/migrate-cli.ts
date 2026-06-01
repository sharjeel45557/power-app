import { loadConfig } from "@power-app/core";
import { createDb } from "./client.js";
import { runMigrations } from "./migrate.js";

// Standalone migration runner: `pnpm db:migrate`
async function main() {
  const config = loadConfig();
  const { sql, close } = createDb(config);
  try {
    await runMigrations(sql, (msg) => console.log(`[migrate] ${msg}`));
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
