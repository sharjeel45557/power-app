import { defineConfig } from "drizzle-kit";

// Used by `drizzle-kit generate` to diff schema → SQL during development.
// The runtime applies migrations from ./migrations via a lightweight migrator
// (see src/db/migrate.ts), so this is a development/authoring aid.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://power:power@localhost:5432/power_app",
  },
});
