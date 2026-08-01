// These tests run against your REAL deployed Supabase project — they sign
// in as three dedicated test accounts (one per role) and assert what each
// one can and can't do. This is the difference between "I wrote RLS
// policies" and "I can prove RLS policies work," verified on every commit.
//
// Requires these env vars (set as GitHub Actions secrets):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
//   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
//   TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD
//   TEST_VIEWER_EMAIL / TEST_VIEWER_PASSWORD
//
// If these aren't set (e.g. running `npm test` locally without them),
// this whole file is skipped rather than failing — see the describe.skipIf below.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const creds = {
  admin: { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD },
  owner: { email: process.env.TEST_OWNER_EMAIL, password: process.env.TEST_OWNER_PASSWORD },
  viewer: { email: process.env.TEST_VIEWER_EMAIL, password: process.env.TEST_VIEWER_PASSWORD },
};

const hasAllCreds = url && anonKey && Object.values(creds).every(c => c.email && c.password);

async function signInAs(role) {
  const client = createClient(url, anonKey);
  const { error } = await client.auth.signInWithPassword(creds[role]);
  if (error) throw new Error(`Could not sign in as ${role}: ${error.message}`);
  return client;
}

const TEST_RISK_ID = "CI-RLS-TEST-RISK";

describe.skipIf(!hasAllCreds)("Row-Level Security (live database)", () => {
  let adminClient, ownerClient, viewerClient, ownerUserId;

  beforeAll(async () => {
    adminClient = await signInAs("admin");
    ownerClient = await signInAs("owner");
    viewerClient = await signInAs("viewer");
    const { data } = await ownerClient.auth.getUser();
    ownerUserId = data.user.id;

    // Clean slate in case a previous run failed mid-way
    await adminClient.from("risks").delete().eq("id", TEST_RISK_ID);
  });

  afterAll(async () => {
    if (!adminClient) return; // beforeAll failed before this was set — nothing to clean up
    await adminClient.from("risks").delete().eq("id", TEST_RISK_ID);
  });

  it("viewer cannot insert a risk", async () => {
    const { error } = await viewerClient.from("risks").insert({
      id: TEST_RISK_ID, title: "RLS test", category: "Operational",
      likelihood: 1, impact: 1, status: "Open",
    });
    expect(error).not.toBeNull();
  });

  it("owner can create a risk they own", async () => {
    const { error } = await ownerClient.from("risks").insert({
      id: TEST_RISK_ID, title: "RLS test", category: "Operational",
      likelihood: 1, impact: 1, status: "Open", owner_id: ownerUserId,
    });
    expect(error).toBeNull();
  });

  it("viewer cannot update a risk they don't own", async () => {
    const { error, data } = await viewerClient
      .from("risks").update({ title: "hacked by viewer" }).eq("id", TEST_RISK_ID).select();
    // RLS blocks this at the row level — either an explicit error, or a
    // silent no-op that updates zero rows, depending on Postgres version.
    expect(error !== null || (data && data.length === 0)).toBe(true);
  });

  it("admin can update any risk regardless of owner", async () => {
    const { error } = await adminClient.from("risks").update({ title: "edited by admin" }).eq("id", TEST_RISK_ID);
    expect(error).toBeNull();
  });

  it("viewer can still read the risk (read access is intentionally open to all signed-in users)", async () => {
    const { data, error } = await viewerClient.from("risks").select("*").eq("id", TEST_RISK_ID);
    expect(error).toBeNull();
    expect(data.length).toBe(1);
  });

  it("admin can delete any risk", async () => {
    const { error } = await adminClient.from("risks").delete().eq("id", TEST_RISK_ID);
    expect(error).toBeNull();
  });
});
