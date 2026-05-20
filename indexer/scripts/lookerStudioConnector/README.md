# 4626 Outreach — Looker Studio Community Connector

Live-queries Supabase from Looker Studio for high-volume Zora analytics.
This connector now defaults to `v_looker_zora_profiles_ethos`, a flattened
view that joins `zora_profiles` with cached Ethos scores from
`zora_csw_owner_class`.

## Files

- `Code.gs.js` - Apps Script connector logic
- `appsscript.json` - Apps Script manifest with Data Studio metadata

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
   - In connector config, pick source:
     - **`v_looker_zora_profiles_ethos`** (recommended default)
     - `zora_profiles`
     - `zora_csw_owner_class`
   - Optional: set **Row limit per query** (recommended 2000-10000).
   - Click **Connect** → schema appears → **Create report**.

5. **Build the dashboard**
   - See `docs/operations/looker-studio-widget-recipe.md` in the repo
     for the exact widget + field config. Six widgets; ~5 minutes.

## Refresh behavior

- **Database freshness:** production uses `/api/v1/zora-profiles/refresh-cron`
  (every 6 hours) to upsert explore metrics into `zora_profiles`. Enable with
  `ZORA_PROFILES_REFRESH_ENABLED=1` on Vercel. Ops view:
  `SELECT * FROM v_zora_profiles_refresh_freshness;` — see
  `docs/operations/zora-profiles-refresh-runbook.md`.
- Looker Studio caches query results for 12 hours by default. To force
  a fresh pull, click the refresh icon (circular arrow) in the report
  toolbar. This re-invokes `getData()` and hits Supabase.
- Set the cache TTL per data source in Looker Studio: **Data source →
  Edit → Data freshness** → choose 15 min / 1 hour / 4 hours / 12 hours.

## Data model for 1.5M+ rows

Use the migration-backed view:

- `frontend/db/migrations/041_v_looker_zora_profiles_ethos.sql`

It resolves a single score wallet per profile:

1. `signing_eoa`
2. `primary_wallet`
3. `payout_recipient`

Then left-joins Ethos cache fields:

- `ethos_userkey`
- `ethos_score`
- `ethos_level`
- `ethos_score_updated_at`

## Development

- To iterate on the connector without re-deploying: use
  **Deploy → Test deployments → Application: Looker Studio** →
  **Install** (once). Subsequent edits in the Apps Script editor are
  reflected immediately in the test deployment.
- All HTTP calls route through `UrlFetchApp`; Apps Script logs are
  visible under **Executions** in the left sidebar.

## Security notes

- The service-role key is stored in the user's Looker Studio credential
  store (via `USER_TOKEN` auth), not in connector source code.
- Report viewers with no authorisation to Supabase can still view the
  dashboard because cached data is served from Looker Studio — they
  never hit Supabase directly.
- If the service-role key leaks, rotate it in Supabase immediately and
  update the data source in Looker Studio (Data source → Edit
  credentials).
