# Base Build App URL And Verification

This repo uses two production web origins:

- `https://4626.fun` is the marketing and waitlist origin.
- `https://app.4626.fun` is the product and Base Build app origin.

For Base Build registration and ownership verification, always use:

- **App URL:** `https://app.4626.fun`

Do not register `https://4626.fun` as the Base Build app URL. The marketing host is intentionally separate from the authenticated app host.

## Verification model

Base Build verification is tied to the homepage HTML returned by the app URL. The app homepage must expose the app ID in the document head:

```html
<meta name="base:app_id" content="695a49dc4d3a403912ed8ca5" />
```

The same homepage should also identify itself as the app origin:

- `canonical` should resolve to `https://app.4626.fun/`
- `og:url` should resolve to `https://app.4626.fun/`

Do not rely on `/.well-known/farcaster.json` for Base Build ownership or indexing.

## Implementation in this repo

The app host uses a dedicated SPA shell:

- `frontend/app.html`
- `frontend/vite.config.ts`
- `frontend/vercel.json`

`app.4626.fun` should serve `app.html`, while `4626.fun` continues serving the marketing shell from `index.html`.

## Verify production output

Check the live app URL directly:

```bash
curl -sL https://app.4626.fun | sed -n '1,30p'
```

Expected head markers:

```html
<link rel="canonical" href="https://app.4626.fun/" />
<meta property="og:url" content="https://app.4626.fun/" />
<meta name="base:app_id" content="695a49dc4d3a403912ed8ca5" />
```

## Troubleshooting

If the `base:app_id` tag is present but the page still identifies itself as `https://4626.fun/`, the app host is still serving the marketing shell. In that case:

1. Deploy the latest frontend changes.
2. Confirm `app.4626.fun` points at the latest production deployment.
3. Retry the Base Build verification flow after the app homepage returns the correct canonical and Open Graph URLs.

Console noise from ad blockers, Datadog, Sentry, OneTrust, or Coinbase telemetry on `base.dev` is not a reliable signal for app ownership failures.

## GitHub Deployments environment naming (Vercel)

GitHub Deployments can show both generic and project-scoped environment names for the same repo, for example:

- `Production` + `Preview`
- `Production - 4626` + `Preview - 4626`

This usually happens when Vercel integration mode changed over time (single-project naming vs project-scoped naming in a monorepo). Existing GitHub Deployment environment rows are historical metadata and can remain visible after naming changes.

For this repo, `Production - 4626` / `Preview - 4626` are the explicit project-scoped names for the web app project, and `Production - 4626-docs` / `Preview - 4626-docs` are for docs. If unsuffixed `Production` / `Preview` are no longer receiving new deployments, they are legacy and can be removed from **GitHub → Settings → Environments**.

Important: if any integration is still publishing to unsuffixed names, GitHub can recreate them on the next deployment. Verify recent deployment activity first, then delete only inactive legacy rows.
