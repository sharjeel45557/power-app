import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { AppConfig } from "@power-app/core";
import * as schema from "./schema.js";

export type Db = PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  /** Underlying postgres-js client; call to run raw SQL or close the pool. */
  sql: postgres.Sql;
  close: () => Promise<void>;
}

/**
 * Creates the Drizzle client. SSL is enabled in production (managed Postgres
 * services often present self-signed certs, so verification is relaxed unless
 * DATABASE_SSL_STRICT=true).
 */
export function createDb(config: AppConfig): DbHandle {
  if (!config.databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set (and no Postgres binding was found in VCAP_SERVICES).",
    );
  }

  const strict = process.env.DATABASE_SSL_STRICT === "true";
  const ssl = config.isProduction
    ? strict
      ? "require"
      : { rejectUnauthorized: false }
    : false;

  const sql = postgres(config.databaseUrl, {
    max: 10,
    prepare: false,
    ssl,
    onnotice: () => {},
  });

  const db = drizzle(sql, { schema });
  return {
    db,
    sql,
    close: () => sql.end({ timeout: 5 }),
  };
}
