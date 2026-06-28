import { execSync } from "node:child_process";
import type { GlobalSetupContext } from "vitest/node";

declare module "vitest" {
  interface ProvidedContext {
    DATABASE_URL: string;
  }
}

/**
 * Integration global setup.
 *
 * The spec calls for `testcontainers`, but it requires a newer Node than this
 * machine runs (Node 20.18 lacks `webidl.util.markAsUncloneable`, which the
 * bundled undici needs). Instead we use a dedicated, freshly-created
 * `videomax_test` database on the docker-compose Postgres that local dev
 * already runs — hermetic enough (separate DB, dropped and recreated each run)
 * without the testcontainers/undici/Node incompatibility.
 */
const CONTAINER = "videomax-postgres";
const TEST_DB = "videomax_test";
const DATABASE_URL = `postgresql://videomax:videomax@localhost:5433/${TEST_DB}`;

export default async function setup({ provide }: GlobalSetupContext) {
  // Make the docker CLI reachable even when the profile isn't sourced.
  const execEnv = {
    ...process.env,
    PATH: `${process.env.HOME}/.docker/bin:/usr/local/bin:/opt/homebrew/bin:${process.env.PATH ?? ""}`,
  };

  const psql = (sql: string) =>
    execSync(
      `docker exec ${CONTAINER} psql -U videomax -d videomax -c "${sql}"`,
      { env: execEnv, stdio: "inherit" },
    );

  psql(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  psql(`CREATE DATABASE ${TEST_DB}`);

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL },
    stdio: "inherit",
  });

  provide("DATABASE_URL", DATABASE_URL);
}
