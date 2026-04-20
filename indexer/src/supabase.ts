import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. This indexer writes to a protected
 * table; the anon key cannot. The service-role key must live only in
 * this service's environment and never ship to a browser.
 */
export function createIndexerSupabase(): SupabaseClient {
  const url = (process.env.SUPABASE_URL ?? "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url) throw new Error("SUPABASE_URL is required");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
}

export type ZoraCswRow = {
  csw_address: string;
  base_owner: string | null;
  initial_owners: string[];
  current_owners: string[] | null;
  creation_nonce: string | null;
  creation_block: number | null;
  creation_tx_hash: string | null;
  source: string;
  metadata: Record<string, unknown>;
  last_owner_sync_at: string | null;
};
