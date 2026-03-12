import { PageMeta } from '@/components/seo/PageMeta'

export function AgentUriService() {
  const origin = typeof window === 'undefined' ? 'https://4626.fun' : window.location.origin
  const endpoint = `${origin}/api/lens/agent-registration`

  const curlExample = `curl -s "${endpoint}" \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"store":true}'`

  const fetchExample = `fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ store: true }),
}).then((res) => res.json())`

  const responseExample = `{
  "success": true,
  "data": {
    "registration": { "...": "..." },
    "grove": {
      "lensUri": "lens://...",
      "gatewayUrl": "https://api.grove.storage/...",
      "storageKey": "...",
      "statusUrl": "https://..."
    }
  }
}`

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <PageMeta
        title="Agent URI Service"
        description="Publish the 4626 ERC-8004 registration to Lens Grove and generate strict content-addressed agentURI outputs."
        canonicalPath="/agents/uri-service"
      />

      <header className="space-y-2">
        <div className="label">Agents</div>
        <h1 className="text-2xl sm:text-3xl text-zinc-100 font-semibold tracking-tight">Agent URI service</h1>
        <p className="text-sm text-zinc-500 max-w-prose">
          This service builds the 4626 ERC-8004 registration from the deployed config and publishes it to Lens
          Grove. Prefer a strict content-addressed <span className="font-mono text-zinc-300">agentURI</span>{" "}
          (<span className="font-mono text-zinc-300">data:</span>,{" "}
          <span className="font-mono text-zinc-300">ipfs://</span>,{" "}
          <span className="font-mono text-zinc-300">ar://</span>) for clean 8004scan validation. The returned{" "}
          <span className="font-mono text-zinc-300">gatewayUrl</span> is an optional compatibility fallback.
        </p>
      </header>

      <section className="rounded-2xl border border-white/5 bg-white/2 p-6 space-y-4">
        <div>
          <div className="text-sm text-zinc-200">Endpoint</div>
          <div className="text-xs text-zinc-500 mt-1">
            <span className="font-mono text-zinc-300">{endpoint}</span>
          </div>
        </div>

        <div className="text-xs text-zinc-600 space-y-1">
          <div>
            Method: <span className="font-mono text-zinc-300">POST</span> or{" "}
            <span className="font-mono text-zinc-300">GET</span>
          </div>
          <div>
            Body: <span className="font-mono text-zinc-300">{'{"store": true | false}'}</span> (default true)
          </div>
          <div>
            Response: <span className="font-mono text-zinc-300">registration</span> plus optional{" "}
            <span className="font-mono text-zinc-300">grove</span> details.
          </div>
          <div className="mt-2 text-amber-500/80">
            Authentication required when <span className="font-mono text-zinc-300">store=true</span>.
            Use a SIWE session cookie or SIWA receipt. Set{" "}
            <span className="font-mono text-zinc-300">store=false</span> (or use{" "}
            <span className="font-mono text-zinc-300">GET</span>) to read registration without Grove upload.
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/2 p-6 space-y-4">
        <div className="text-sm text-zinc-200">Example: curl</div>
        <pre className="text-[11px] leading-relaxed text-zinc-300 bg-black/40 border border-white/5 rounded-lg p-4 overflow-auto">
{curlExample}
        </pre>

        <div className="text-sm text-zinc-200">Example: fetch</div>
        <pre className="text-[11px] leading-relaxed text-zinc-300 bg-black/40 border border-white/5 rounded-lg p-4 overflow-auto">
{fetchExample}
        </pre>
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/2 p-6 space-y-4">
        <div className="text-sm text-zinc-200">Response</div>
        <pre className="text-[11px] leading-relaxed text-zinc-300 bg-black/40 border border-white/5 rounded-lg p-4 overflow-auto">
{responseExample}
        </pre>
        <div className="text-xs text-zinc-600">
          For strict mode, use <span className="font-mono text-zinc-300">data:</span>,{" "}
          <span className="font-mono text-zinc-300">ipfs://</span>, or{" "}
          <span className="font-mono text-zinc-300">ar://</span> as on-chain{" "}
          <span className="font-mono text-zinc-300">agentURI</span>. If needed, use{" "}
          <span className="font-mono text-zinc-300">gatewayUrl</span> instead of{" "}
          <span className="font-mono text-zinc-300">lens://</span>.
        </div>
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/2 p-6 space-y-3">
        <div className="text-sm text-zinc-200">Notes</div>
        <ul className="text-xs text-zinc-600 space-y-2 list-disc list-inside">
          <li>This service is scoped to 4626 registration metadata; it does not accept arbitrary payloads.</li>
          <li>If Lens Grove is unavailable, you can still use a data: or ipfs:// URI.</li>
          <li>Registration data is sourced from <span className="font-mono text-zinc-400">/.well-known/agent-registration.json</span> and env overrides.</li>
        </ul>
      </section>
    </div>
  )
}
