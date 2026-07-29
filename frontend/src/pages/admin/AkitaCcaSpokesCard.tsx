import { useCallback, useMemo, useState } from 'react'

import {
  CCA_LAUNCH_CHAINS,
  CCA_LAUNCH_CHAIN_KEYS,
  type CcaLaunchChainKey,
} from '@/config/ccaLaunchChains'
import { AKITA, getAkitaChainStack } from '@/config/contracts'

type SpokeRow = {
  key: CcaLaunchChainKey
  label: string
  chainId: number
  eid: number
  factoryVersion: string
  factoryBootstrapNeeded: boolean
  shareOFTPinned: boolean
  ccaPinned: boolean
}

function buildSpokeRows(): SpokeRow[] {
  return CCA_LAUNCH_CHAIN_KEYS.filter((key) => key !== 'base').map((key) => {
    const chain = CCA_LAUNCH_CHAINS[key]
    const stack = getAkitaChainStack(chain.chainId)
    return {
      key,
      label: chain.label,
      chainId: chain.chainId,
      eid: chain.eid,
      factoryVersion: chain.targetCcaFactoryVersion,
      factoryBootstrapNeeded: chain.ccaFactoryV210ExpectedEmptyPreBootstrap,
      // Spoke-minimal: remote ShareOFT + CCA arm only. Vault/wrapper/gauge/token stay on Base.
      shareOFTPinned: !!stack.shareOFT,
      ccaPinned: !!stack.ccaLaunchArm,
    }
  })
}

function pinBadge(ok: boolean): string {
  return ok
    ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
    : 'text-amber-200 border-amber-500/30 bg-amber-500/10'
}

/**
 * Operator surface for the AKITA-only CCA spoke fan-out from Base.
 * Status + copy-paste ops commands — mutate deploys stay in Foundry/ops scripts
 * (not deploy-session; per-chain keys / CREATE2 infra).
 */
export function AkitaCcaSpokesCard() {
  const [rows, setRows] = useState<SpokeRow[]>(() => buildSpokeRows())
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(() => {
    setRows(buildSpokeRows())
  }, [])

  const allPinned = useMemo(
    () => rows.every((row) => row.shareOFTPinned && row.ccaPinned),
    [rows],
  )

  const planCommands = useMemo(() => {
    const lines = [
      '# Read-only preflight (all chains)',
      'pnpm -C frontend ops:verify-cca-multichain',
      '',
      '# Plan spoke fan-out (no broadcast)',
      'pnpm -C frontend ops:plan-akita-cca-spokes',
      '',
      '# After infra + keys are ready, broadcast per runbook:',
      '# docs/operations/cca-multichain-mainnet-runbook.md',
      'pnpm -C frontend ops:deploy-akita-cca-spokes --dry-run',
      'pnpm -C frontend ops:deploy-akita-cca-spokes --print-commands',
      '# First automated stage (registry CREATE2 + LZ/hub seed):',
      'pnpm -C frontend ops:deploy-akita-cca-spokes --broadcast --stage ensure-registry',
      '',
      `# Hub Base ■AKITA ShareOFT: ${AKITA.shareOFT}`,
      `# Hub Base CCA arm: ${AKITA.ccaLaunchArm}`,
      `# Hub Base oracle: ${AKITA.oracle}`,
    ]
    for (const row of rows) {
      lines.push('')
      lines.push(`# --- ${row.label} (chainId ${row.chainId}, eid ${row.eid}) ---`)
      lines.push(`pnpm -C frontend ops:verify-cca-multichain --chain ${row.key}`)
      if (row.factoryBootstrapNeeded) {
        lines.push('# BOOTSTRAP: deploy CCA factory v2.1.0 with protocolFeeController=address(0)')
      }
      lines.push('# 1) EnsureSpokeRegistry (registry + LZ/hub seed)')
      lines.push('# 2) DeployRemoteShareOft (EXPECTED_CHAIN_ID=' + row.chainId + ')')
      lines.push('# 3) Wire Base↔spoke ShareOFT peers (3-of-5 DVN, confirmations [15,15])')
      lines.push('# 4) DeployRemoteCreatorOracle + WireCreatorOracleHubSpokePeers')
      lines.push('# 5) Deploy CCALaunchArm only + ConfigureSpokeCcaOracle — no vault stack on spoke')
      lines.push('# 6) BroadcastCreatorOracleAssetPrice from Base hub oracle')
      lines.push(`# 7) Pin VITE_AKITA_SHARE_OFT_${row.key.toUpperCase()} + VITE_AKITA_CCA_STRATEGY_${row.key.toUpperCase()}`)
    }
    return lines.join('\n')
  }, [rows])

  const copyPlan = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(planCommands)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [planCommands])

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-100">■AKITA CCA spokes</div>
          <div className="text-xs text-zinc-500 mt-1 max-w-prose">
            Fan-out remote ShareOFT + thin CreatorOracle + CCA arms (Ethereum / Arbitrum / Unichain /
            Robinhood). Vault, wrapper, gauge, and Zora token stay on Base. Oracle is onchain-wired
            (Base broadcast); no VITE_AKITA_ORACLE_* pin required. Deploy via ops scripts (not
            deploy-session).
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/20"
        >
          Refresh pins
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const ready = row.shareOFTPinned && row.ccaPinned
          return (
            <div
              key={row.key}
              className="rounded-lg border border-white/5 bg-white/3 px-3 py-3 text-xs space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-zinc-100">
                  {row.label}{' '}
                  <span className="text-zinc-500">
                    · {row.chainId} · eid {row.eid} · factory {row.factoryVersion}
                  </span>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 ${
                    ready
                      ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                      : 'text-zinc-400 border-white/10'
                  }`}
                >
                  {ready ? 'Pinned' : 'Pending'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded border px-2 py-0.5 ${pinBadge(row.shareOFTPinned)}`}>
                  ShareOFT {row.shareOFTPinned ? 'yes' : 'no'}
                </span>
                <span className={`rounded border px-2 py-0.5 ${pinBadge(row.ccaPinned)}`}>
                  CCA arm {row.ccaPinned ? 'yes' : 'no'}
                </span>
                {row.factoryBootstrapNeeded ? (
                  <span className="rounded border px-2 py-0.5 text-rose-200 border-rose-500/30 bg-rose-500/10">
                    Factory bootstrap required
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copyPlan}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 hover:border-white/20"
        >
          {copied ? 'Copied' : 'Copy ops plan'}
        </button>
        <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-500">
          Runbook: docs/operations/cca-multichain-mainnet-runbook.md
        </span>
        <span className="text-[11px] text-zinc-600">
          {allPinned
            ? 'All spokes pinned (ShareOFT + CCA) — verify mesh before launch.'
            : 'After each spoke: pin VITE_AKITA_SHARE_OFT_<CHAIN> + VITE_AKITA_CCA_STRATEGY_<CHAIN>.'}
        </span>
      </div>

      <pre className="overflow-x-auto rounded-lg border border-white/5 bg-black/40 p-3 text-[11px] text-zinc-400 whitespace-pre-wrap">
        {planCommands}
      </pre>
    </div>
  )
}
