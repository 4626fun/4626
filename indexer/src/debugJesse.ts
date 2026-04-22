import "dotenv/config";

// One-off diagnostic: look up Jesse Pollak's Zora profile + creator coin
// to figure out why we don't see $jesse in our dataset. Prints the
// profile, the creator-coin address, the owner wallet, and checks
// whether that wallet exists in our zora_csw_owners / zora_csw_owner_class.

import { createIndexerSupabase } from "./supabase.js";

const ZORA_API_KEY = (process.env.ZORA_SERVER_API_KEY ?? "").trim();
if (!ZORA_API_KEY) {
  console.error("ZORA_SERVER_API_KEY required");
  process.exit(1);
}

async function main() {
  const sdk: any = await import("@zoralabs/coins-sdk");
  sdk.setApiKey(ZORA_API_KEY);
  const supabase = createIndexerSupabase();

  // Try several identifiers Zora might accept. "jesse" is the handle;
  // "jesse.base.eth" resolves to his Ethereum address.
  const identifiers = [
    "jesse",
    "jessepollak",
    "jesse.base.eth",
    "0x849151d7d0bf1f34b70d5cad5149d28cc2308bf1", // jesse.base.eth resolves here
  ];

  for (const ident of identifiers) {
    console.log(`\n=== trying identifier: ${ident} ===`);
    try {
      const response = await sdk.getProfile({ identifier: ident });
      const profile = response?.data?.profile ?? null;
      if (!profile) {
        console.log("  no profile returned");
        continue;
      }
      console.log("  handle:", profile.handle ?? profile.username ?? null);
      console.log("  displayName:", profile.displayName);
      console.log("  wallet:", profile.publicWallet?.walletAddress ?? profile.walletAddress);
      console.log("  creatorCoin address:", profile.creatorCoin?.address);
      console.log("  creatorCoin symbol:", profile.creatorCoin?.symbol);
      console.log("  linkedWallets:", JSON.stringify(profile.linkedWallets, null, 2));

      const addrs: string[] = [];
      if (profile.publicWallet?.walletAddress) addrs.push(profile.publicWallet.walletAddress);
      if (profile.walletAddress) addrs.push(profile.walletAddress);
      if (Array.isArray(profile.linkedWallets)) {
        for (const lw of profile.linkedWallets) {
          if (typeof lw?.walletAddress === "string") addrs.push(lw.walletAddress);
        }
      }
      const unique = [...new Set(addrs.map((a) => a.toLowerCase()))];

      for (const addr of unique) {
        console.log(`  checking ${addr} in zora_csw_owners…`);
        const { data: asCsw } = await supabase
          .from("zora_csw_owners")
          .select("csw_address, base_owner, creation_block")
          .eq("csw_address", addr)
          .maybeSingle();
        if (asCsw) console.log("    found as csw:", asCsw);
        const { data: asBase } = await supabase
          .from("zora_csw_owners")
          .select("csw_address, base_owner, creation_block")
          .ilike("base_owner", addr)
          .limit(1);
        if (asBase && asBase.length > 0) console.log("    found as base_owner:", asBase[0]);
        const { data: asOwner } = await supabase
          .from("zora_csw_owner_class")
          .select("eoa, wallet_class, zora_handle")
          .eq("eoa", addr)
          .maybeSingle();
        if (asOwner) console.log("    found in owner_class:", asOwner);
      }
    } catch (err) {
      console.warn("  error:", err instanceof Error ? err.message : err);
    }
  }
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
