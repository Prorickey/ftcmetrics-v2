/**
 * Integration test setup — provisions test data directly in PostgreSQL.
 *
 * Creates:
 *  - 1 test User
 *  - 4 API keys: full-scope, limited-scope, revoked, expired
 *
 * Exports pre-configured FTCMetrics client instances and raw key strings.
 */

import { randomUUID, createHash } from "crypto";
import pg from "pg";
import { FTCMetrics } from "../../client";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://ftcmetrics:ftcmetrics@localhost:5432/ftcmetrics";

export const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:3001/api";

// ---------------------------------------------------------------------------
// Key helpers (mirrors packages/api/src/middleware/auth.ts:hashApiKey)
// ---------------------------------------------------------------------------

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function generateRawKey(): string {
  return `ftcm_${randomUUID().replace(/-/g, "")}`;
}

// ---------------------------------------------------------------------------
// State – populated in provision(), cleaned up in teardown()
// ---------------------------------------------------------------------------

let pool: pg.Pool;

// Test user
const TEST_USER_ID = `test_integ_${randomUUID().slice(0, 8)}`;
const TEST_USER_EMAIL = `integration-test-${TEST_USER_ID}@test.local`;

// Raw API keys (the bearer tokens sent to the API)
export const fullScopeKey = generateRawKey();
export const limitedScopeKey = generateRawKey();
export const revokedKey = generateRawKey();
export const expiredKey = generateRawKey();

// Key IDs for cleanup
const keyIds: string[] = [];

// All scopes the API recognises
const ALL_SCOPES = ["events:read", "teams:read", "analytics:read", "rankings:read"];

// ---------------------------------------------------------------------------
// Pre-configured SDK clients
// ---------------------------------------------------------------------------

export const fullClient = new FTCMetrics({
  ftcmApiKey: fullScopeKey,
  baseUrl: API_BASE_URL,
});

export const limitedClient = new FTCMetrics({
  ftcmApiKey: limitedScopeKey,
  baseUrl: API_BASE_URL,
});

export const revokedClient = new FTCMetrics({
  ftcmApiKey: revokedKey,
  baseUrl: API_BASE_URL,
});

export const expiredClient = new FTCMetrics({
  ftcmApiKey: expiredKey,
  baseUrl: API_BASE_URL,
});

// ---------------------------------------------------------------------------
// Provision
// ---------------------------------------------------------------------------

export async function provision() {
  pool = new pg.Pool({ connectionString: DATABASE_URL });

  // 1. Create test user
  await pool.query(
    `INSERT INTO users (id, name, email, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name`,
    [TEST_USER_ID, "Integration Test User", TEST_USER_EMAIL]
  );

  // 2. Insert API keys
  const keys: Array<{
    raw: string;
    scopes: string[];
    revokedAt: Date | null;
    expiresAt: Date | null;
  }> = [
    { raw: fullScopeKey, scopes: ALL_SCOPES, revokedAt: null, expiresAt: null },
    { raw: limitedScopeKey, scopes: ["events:read"], revokedAt: null, expiresAt: null },
    { raw: revokedKey, scopes: ALL_SCOPES, revokedAt: new Date(), expiresAt: null },
    {
      raw: expiredKey,
      scopes: ALL_SCOPES,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 86_400_000), // 1 day ago
    },
  ];

  for (const k of keys) {
    const id = randomUUID();
    keyIds.push(id);

    await pool.query(
      `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, scopes, revoked_at, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        id,
        TEST_USER_ID,
        `test-${id.slice(0, 8)}`,
        hashApiKey(k.raw),
        k.raw.slice(0, 12),
        k.scopes,
        k.revokedAt,
        k.expiresAt,
      ]
    );
  }
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

export async function teardown() {
  if (!pool) return;

  // Delete API keys first (FK constraint)
  if (keyIds.length > 0) {
    await pool.query(
      `DELETE FROM api_keys WHERE id = ANY($1::text[])`,
      [keyIds]
    );
  }

  // Delete test user
  await pool.query(`DELETE FROM users WHERE id = $1`, [TEST_USER_ID]);

  await pool.end();
}
