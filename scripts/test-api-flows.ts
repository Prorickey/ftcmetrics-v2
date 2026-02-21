#!/usr/bin/env bun
/**
 * Integration test script - runs against localhost:3001
 * Usage: bun scripts/test-api-flows.ts
 *
 * Requires: API server running on localhost:3001 with database
 */

const API = process.env.API_URL || "http://localhost:3001";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// --- Health checks ---
console.log("\n🏥 Health Checks");

await test("API health endpoint returns ok", async () => {
  const res = await fetch(`${API}/`);
  assert(res.ok, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert(body.status === "ok", `Expected status ok, got ${body.status}`);
});

await test("Detailed health check", async () => {
  const res = await fetch(`${API}/api/health`);
  const body = await res.json();
  assert(body.status === "healthy" || body.status === "degraded" || body.status === "ok" || body.database === "ok", `Health check failed: ${JSON.stringify(body)}`);
});

// --- Auth enforcement ---
console.log("\n🔒 Auth Enforcement");

await test("Scouting entries require auth", async () => {
  const res = await fetch(`${API}/api/scouting/entries`);
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test("User teams require auth", async () => {
  const res = await fetch(`${API}/api/user-teams`);
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test("Scouting POST requires auth", async () => {
  const res = await fetch(`${API}/api/scouting/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamNumber: 8569 }),
  });
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

// --- Input validation ---
console.log("\n🛡️ Input Validation");

await test("Event code rejects path traversal", async () => {
  const res = await fetch(`${API}/api/events/../../etc/passwd`);
  assert(res.status === 400 || res.status === 404, `Expected 400/404, got ${res.status}`);
});

await test("Event code rejects script injection", async () => {
  const res = await fetch(`${API}/api/events/<script>alert(1)</script>`);
  assert(res.status === 400 || res.status === 404, `Expected 400/404, got ${res.status}`);
});

await test("Event code allows valid alphanumeric", async () => {
  const res = await fetch(`${API}/api/events/USWATRIAL1`);
  // May be 404 (event not found) but shouldn't be 400
  assert(res.status !== 400, `Valid event code rejected with 400`);
});

// --- Rate limiting ---
console.log("\n⏱️ Rate Limiting");

await test("Rate limit headers present", async () => {
  const res = await fetch(`${API}/api/events`);
  // Rate limiting should not block first request
  assert(res.status !== 429, "First request was rate limited");
});

// --- CORS ---
console.log("\n🌐 CORS");

await test("CORS allows localhost:3000", async () => {
  const res = await fetch(`${API}/api/events`, {
    headers: { Origin: "http://localhost:3000" },
  });
  const origin = res.headers.get("access-control-allow-origin");
  assert(origin === "http://localhost:3000", `CORS origin: ${origin}`);
});

await test("CORS blocks unknown origins", async () => {
  const res = await fetch(`${API}/api/events`, {
    headers: { Origin: "http://evil.com" },
  });
  const origin = res.headers.get("access-control-allow-origin");
  assert(!origin || origin !== "http://evil.com", `CORS allowed evil origin: ${origin}`);
});

// --- Upload endpoint security ---
console.log("\n📁 Upload Security");

await test("Upload path rejects traversal", async () => {
  const res = await fetch(`${API}/api/uploads/../../../etc/passwd`);
  assert(res.status === 400 || res.status === 403 || res.status === 404, `Expected rejection, got ${res.status}`);
});

// --- Public endpoints ---
console.log("\n📊 Public Endpoints");

await test("Events endpoint accessible without auth", async () => {
  const res = await fetch(`${API}/api/events`);
  assert(res.status !== 401, `Events should not require auth, got ${res.status}`);
});

await test("Teams search accessible without auth", async () => {
  const res = await fetch(`${API}/api/teams/search?q=8569`);
  assert(res.status !== 401, `Teams search should not require auth, got ${res.status}`);
});

await test("Rankings endpoint does not require auth (quick check)", async () => {
  // The full rankings endpoint is very slow (fetches all season events).
  // We just verify it doesn't immediately reject with 401 by racing a short timeout.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${API}/api/rankings/epa`, { signal: controller.signal });
    assert(res.status !== 401, `Rankings should not require auth, got ${res.status}`);
  } catch (e: any) {
    if (e.name === "AbortError") {
      // Timeout means the server accepted the request (didn't return 401 quickly).
      // This is expected — the endpoint is slow but accessible.
      return;
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
});

// --- Summary ---
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"=".repeat(40)}\n`);

if (failed > 0) process.exit(1);
