# Run & Debug

This repo has a small shared `Run & Debug` setup in `.vscode/launch.json` plus `.vscode/tasks.json` for Vite readiness.

The shared profiles cover the entrypoints that are stable for everyone on the team:

- `Frontend: Dev Server` runs `pnpm dev` in `frontend/`.
- `Frontend: Dev + Chrome` runs Vite in a **background task**, waits until the dev server URL with port **5173** appears in task output (`localhost` or `127.0.0.1`), then launches Chrome with the debugger attached (avoids opening the browser before the server is ready).
- `Frontend: Chrome only (Vite already running)` opens the debuggable Chrome session when you already have `pnpm dev` running elsewhere.
- **`Frontend: Dev + Chrome (WSL → Windows Chrome)`** and **`Frontend: Chrome only (WSL → Windows Chrome)`** use the same flow as above but set `runtimeExecutable` to Windows Chrome under `/mnt/c/Program Files/Google/Chrome/Application/chrome.exe`. Use these when Cursor runs on **WSL** and the default `pwa-chrome` profile cannot find a Linux Chrome binary. Adjust the path in `.vscode/launch.json` if Chrome is installed elsewhere (for example Edge or a different drive).
- `Vitest: Current File` runs `pnpm exec vitest run "${file}"` in `frontend/`.

## What This Setup Wraps

The debugger-friendly entrypoints in this repo live in `frontend/package.json`:

- `pnpm -C frontend dev`
- `pnpm -C frontend test`
- `pnpm -C frontend test:watch`
- `pnpm -C frontend capture:app-screens`
- `pnpm -C frontend generate:brand-icons`

For one-off scripts under `frontend/scripts/`, keep the shared config small and use one of the personal snippets below when you need them.

## Shared Profiles

### `Frontend: Dev + Chrome`

Use this when you want the `Run & Debug` tab to launch the full frontend loop for you. It depends on the `frontend: vite dev (background)` task in `.vscode/tasks.json`, which gates Chrome on Vite printing a `localhost:5173` / `127.0.0.1:5173` URL.

Best for:

- first run of the day
- stepping through UI state changes in `frontend/src/pages/Home.tsx`
- logpoints inside `frontend/src/components/home/VaultFlowScroll.tsx`

### `Frontend: Chrome only (Vite already running)`

Use this when you already have `pnpm dev` running in a terminal and only want the debugger-attached browser.

Best for:

- fast breakpoint iteration
- avoiding duplicate dev servers
- keeping your existing terminal history and HMR loop

### WSL → Windows Chrome variants

If you develop inside **WSL** and **Linux Chrome is not installed**, the JavaScript debugger may fail to launch a browser. Pick **`Frontend: Dev + Chrome (WSL → Windows Chrome)`** or **`Frontend: Chrome only (WSL → Windows Chrome)`** so the debug session starts **Windows Chrome** via the standard WSL mount path. Edit `runtimeExecutable` in `.vscode/launch.json` if your install path differs.

### `Vitest: Current File`

Use this when the active editor tab is a test file under `frontend/src` or `frontend/api`.

Best for:

- stepping through `frontend/src/pages/Home.test.ts`
- inspecting mock setup and DOM assertions
- pausing on failing assertions without running the whole suite

## Cursor: “Error loading webview” / Service Worker

You may see:

`Error loading webview: Error: Could not register service worker: InvalidStateError: Failed to register a ServiceWorker: The document is in an invalid state.`

### Confirm whether it is the editor or the app

1. Open `http://localhost:5173` in a normal browser tab, or launch **`Frontend: Dev + Chrome`** from Run & Debug (see above).
2. If the app loads there, the problem is **Cursor’s embedded webview** (e.g. Markdown preview, Simple Browser, or an extension panel), not the Vite frontend. Application code in this repo does not register a service worker.

### Mitigations

1. Command Palette → **Developer: Reload Window**.
2. If it still happens: Command Palette → **Help: Start Extension Bisect** to find an extension whose webview triggers service worker registration in an invalid document state.
3. Prefer **`Frontend: Dev + Chrome`** for day-to-day frontend debugging instead of in-editor browser or preview webviews when those panels misbehave.

## Optional Personal Profiles

These are useful, but they are intentionally **not** checked in because they are either machine-specific or too niche for the default shared surface.

Add them locally through `Run & Debug` if you want them.

### Browser With App Debug Flags

The app already recognizes `?debug=1` and `localStorage['cv:debug'] = 'true'` in `frontend/src/main.tsx`.

```jsonc
{
  "name": "Frontend: Chrome (?debug=1)",
  "type": "pwa-chrome",
  "request": "launch",
  "url": "http://localhost:5173/?debug=1",
  "webRoot": "${workspaceFolder}/frontend"
}
```

### Current Node Script (`.mjs` / `.js`)

```jsonc
{
  "name": "Frontend Script: Current Node file",
  "type": "node-terminal",
  "request": "launch",
  "cwd": "${workspaceFolder}/frontend",
  "command": "node \"${file}\""
}
```

### Current TypeScript Script (`.ts`)

```jsonc
{
  "name": "Frontend Script: Current TS file",
  "type": "node-terminal",
  "request": "launch",
  "cwd": "${workspaceFolder}/frontend",
  "command": "pnpm exec tsx \"${file}\""
}
```

## 10-Minute Onboarding Exercise

This walkthrough is designed to teach the five debugger moves that matter most here: breakpoint, step, watch, logpoint, and exception pause.

### 1. Make sure the homepage stays on the marketing shell

By default, localhost can behave like the app host and redirect away from the marketing homepage.

If you want to debug the waitlist homepage flow locally, set the following in `frontend/.env` first:

```dotenv
VITE_HOST_MODE_OVERRIDE=marketing
VITE_MARKETING_ORIGIN=http://localhost:5173
```

### 2. Debug the homepage CTA flow

Open `frontend/src/pages/Home.tsx`.

Set a breakpoint inside `openWaitlistDirectAuth()`:

```ts
const openWaitlistDirectAuth = useCallback(() => {
  armWaitlistProviders()
  clearStoredWaitlistAuthState()
  clearStoredWaitlistReferralCode()
  setWaitlistInlineOpen(true)
}, [armWaitlistProviders])
```

Launch `Frontend: Dev + Chrome`.

When the page loads:

1. Click `Join waitlist`.
2. When the breakpoint hits, add these watch expressions:
   - `waitlistProvidersArmed`
   - `waitlistInlineOpen`
   - `waitlistAutoStart`
3. Use `Step Over` through the function body.
4. Notice that the watched state values still reflect the pre-click render while you are inside the callback.
5. Hit `Continue`, then confirm the UI re-renders with the embedded waitlist flow visible.

Good `Debug Console` probes while paused:

- `window.location.pathname`
- `window.sessionStorage.getItem('cv:waitlist:auth_armed')`
- `window.sessionStorage.getItem('cv:waitlist:referral_code')`

### 3. Practice logpoints on the scroll animation

Open `frontend/src/components/home/VaultFlowScroll.tsx`.

Inside the `useMotionValueEvent(scroll, 'change', (v) => { ... })` callback, add a logpoint on the stage-transition block:

```ts
const nextStage = v < 0.30 ? 0 : v < 0.52 ? 1 : v < 0.74 ? 2 : 3
if (nextStage !== activeStageRef.current) {
  activeStageRef.current = nextStage
  setActiveStageIdx(nextStage)
}
```

Suggested logpoint message:

```text
v={v.toFixed(3)} nextStage={nextStage} activeStage={activeStageRef.current}
```

Then:

1. Keep the browser session running.
2. Scroll through the homepage.
3. Watch the stage transitions arrive in the debug console without pausing the app.

For this file, logpoints are usually more useful than stacking lots of breakpoints because the callback can fire frequently while scrolling.

### 4. Practice test debugging with `Home.test.ts`

Open `frontend/src/pages/Home.test.ts`.

Set a breakpoint in the interaction test:

```ts
await user.click(screen.getByRole('button', { name: /join waitlist/i }))
```

Launch `Vitest: Current File`.

While paused:

1. Inspect `window.location.pathname`.
2. Evaluate `screen.queryByTestId('waitlist-flow')`.
3. Step over the click and watch the embedded waitlist flow appear.

This is the fastest way to learn the difference between browser debugging and Node-based test debugging in this repo.

### 5. Practice exception pause without editing app code

Turn on `Pause on Uncaught Exceptions`.

While paused at any breakpoint, run this in the `Debug Console`:

```js
queueMicrotask(() => {
  throw new Error('Run & Debug exercise')
})
```

Hit `Continue`.

The debugger should stop on the synthetic uncaught exception, which is a safe way to learn the exception workflow without committing a fake error into the app.

## Repo-Specific Gotchas

- `frontend/src/main.tsx` renders under `React.StrictMode`, so render-time breakpoints can appear to fire twice in development.
- `Frontend: Chrome only (Vite already running)` assumes the Vite server is already listening. If it is not, use `Frontend: Dev + Chrome` instead (or start `Frontend: Dev Server` first).
- `Vitest: Current File` runs in Node, not in the browser. Browser globals, DOM state, and network tools behave differently there.
- The homepage exercise depends on local marketing-host mode. If the app redirects to `/swap` immediately, check your `frontend/.env`.
- Keep personal debug experiments out of the shared config unless they solve a repeated team problem.
