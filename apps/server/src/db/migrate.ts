import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type postgres from "postgres";

/**
 * A tiny, dependency-free forward-only migrator. Applies every `*.sql` file in
 * the migrations directory (in lexical order) exactly once, tracking applied
 * files in a `_migrations` table. Files should contain idempotent DDL so a
 * partially-applied migration can be safely re-run.
 *
 * This is intentionally simpler than drizzle-kit's journal-based migrator: it
 * needs no build-time snapshot, runs cleanly on `cf push`, and is easy to audit.
 */
export async function runMigrations(
  sql: postgres.Sql,
  log: (msg: string) => void = () => {},
): Promise<void> {
  const dir = migrationsDir();

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    (await sql<{ id: string }[]>`SELECT id FROM _migrations`).map((r) => r.id),
  );

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const ddl = await readFile(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);
      await tx`INSERT INTO _migrations (id) VALUES (${file})`;
    });
    log(`applied migration ${file}`);
    count += 1;
  }

  if (count === 0) log("no pending migrations");
}

/** Resolves the migrations directory relative to this module (dev and dist). */
function migrationsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fallback = path.resolve(here, "../../migrations"); // dev: src/db
  const candidates = [
    fallback,
    path.resolve(here, "../migrations"), // bundled: dist
    path.resolve(process.cwd(), "migrations"),
  ];
  return candidates.find((dir) => existsSync(dir)) ?? fallback;
}
