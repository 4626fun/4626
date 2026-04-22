import "dotenv/config";

const ZORA_API_KEY = (process.env.ZORA_SERVER_API_KEY ?? "").trim();
if (!ZORA_API_KEY) { console.error("ZORA_SERVER_API_KEY required"); process.exit(1); }

async function main() {
  const sdk: any = await import("@zoralabs/coins-sdk");
  sdk.setApiKey(ZORA_API_KEY);

  console.log("=== getCoinHolders for $jesse (top 3 holders, RAW payload) ===");
  const holdersRes = await sdk.getCoinHolders({
    address: "0x50f88fe97f72cd3e75b9eb4f747f59bceba80d59",
    chainId: 8453,
    first: 3,
  });
  if (holdersRes?.data) {
    console.log(JSON.stringify(holdersRes.data, null, 2).slice(0, 3000));
  } else {
    console.log("ERR:", JSON.stringify(holdersRes, null, 2).slice(0, 1000));
  }

  console.log("\n=== getProfileBalances for @jessepollak (first 2 entries, RAW) ===");
  const balsRes = await sdk.getProfileBalances({
    identifier: "jessepollak",
    first: 2,
  });
  if (balsRes?.data) {
    console.log(JSON.stringify(balsRes.data, null, 2).slice(0, 3000));
  } else {
    console.log("ERR:", JSON.stringify(balsRes, null, 2).slice(0, 1000));
  }
}

main().catch((err) => { console.error("fatal:", err); process.exit(1); });
