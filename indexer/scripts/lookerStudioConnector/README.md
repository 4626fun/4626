# 4626 Outreach — Looker Studio Community Connector

Live-queries the Supabase outreach tables (`zora_profiles`, optionally
`zora_csw_owner_class`) from Looker Studio. Eliminates the CSV
export → Google Sheets import step — the dashboard refreshes on demand
against the current database state.

## Files

- `Code.gs.js` — connector logic. Drop this into the Apps Script editor
  as `Code.gs` (the editor auto-renames `.gs.js` to `.gs`).
- `appsscript.json` — manifest. Declares the data-source name, OAuth
  scope, and Looker Studio integration metadata.

## Deploy (one-time, ~5 minutes)

1. **Create the Apps Script project**
   - Go to [script.google.com](https://script.google.com/) → **New project**.
   - Rename it `4626 Outreach Connector`.
   - In the left sidebar, click the gear (**Project Settings**) →
     enable **"Show `appsscript.json` manifest file in editor"**.

2. **Paste the two files**
   - Back in the editor, open `appsscript.json` → replace its contents
     with the manifest from this folder.
   - Rename the default `Code.gs` file if you like → paste the contents
     of `Code.gs.js` into it.
   - **Save all** (disk icon).

3. **Deploy as a Looker Studio Connector**
   - Top-right: **Deploy → New deployment**.
   - "Select type" gear icon → **Looker Studio Connector**.
   - Description: `4626 Outreach v1` (or bump on future versions).
   - Click **Deploy**.
   - Copy the **Deployment ID** that appears — you need it in step 4.

4. **Add as a data source in Looker Studio**
   - Open [lookerstudio.google.com](https://lookerstudio.google.com/) →
     **Create → Data source**.
   - Search for "community connector" in the connector gallery, then
     click **Build your own** → paste the Deployment ID → **Validate**
     → **Next**.
   - First-time use will prompt for OAuth authorisation:
     - *Supabase URL (username field)*: e.g. `https://abcdxyz.supabase.co`
     - *Service-role key (token field)*: your Supabase service-role
       API key. Use service-role (not anon) because RLS rules on
       `zora_profiles` may block anon reads.
   - Pick the data source: **`zora_profiles`** (default) or
     **`zora_csw_owner_class`**.
   - Click **Connect** → schema appears → **Create report**.

5. **Build the dashboard**
   - See `docs/operations/looker-studio-widget-recipe.md` in the repo
     for the exact widget + field config. Six widgets; ~5 minutes.

## Refresh behaviour

- Looker Studio caches query results for 12 hours by default. To force
  a fresh pull, click the refresh icon (circular arrow) in the report
  toolbar. This re-invokes `getData()` and hits Supabase.
- Set the cache TTL per data source in Looker Studio: **Data source →
  Edit → Data freshness** → choose 15 min / 1 hour / 4 hours / 12 hours.

## What about the XMTP reachability data?

V1 of this connector exposes only columns that live in `zora_profiles`.
The XMTP reach probe output currently lives in
`indexer/exports/xmtp-reach-*.json` — not queryable from Looker Studio.

To surface XMTP reachability in the dashboard, you need to:

1. Create a `zora_profile_xmtp_reach` table in Supabase (migration TBD).
2. Update `indexer/src/probeXmtpReachability.ts` to upsert its results
   into that table (in addition to writing the JSON export).
3. Add fields to `zoraProfilesSchema()` in `Code.gs.js` that read from
   a Supabase view joining the two tables (recommended) or add a new
   `source` option in `getConfig()`.

Until that work lands, the CSV-backed Google Sheets dashboard remains
the source of truth for XMTP dimensions. Looker Studio gives you
everything else — live.

## Development

- To iterate on the connector without re-deploying: use
  **Deploy → Test deployments → Application: Looker Studio** →
  **Install** (once). Subsequent edits in the Apps Script editor are
  reflected immediately in the test deployment.
- All HTTP calls route through `UrlFetchApp`; Apps Script logs are
  visible under **Executions** in the left sidebar.

## Security notes

- The service-role key is stored in the user's Looker Studio credential
  store (via `USER_TOKEN` auth), not in the connector code. A user who
  deploys this connector for their own workspace never exposes the
  key to other viewers.
- Report viewers with no authorisation to Supabase can still view the
  dashboard because cached data is served from Looker Studio — they
  never hit Supabase directly.
- If the service-role key leaks, rotate it in Supabase immediately and
  update the data source in Looker Studio (Data source → Edit
  credentials).
