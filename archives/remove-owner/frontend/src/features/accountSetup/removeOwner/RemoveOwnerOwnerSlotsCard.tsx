import { formatEther } from 'viem'

import type { LiveDiagnostics } from '@/lib/removeOwner/removeOwnerHelpers'

type RemoveOwnerOwnerSlotsCardProps = {
  canonicalCswAddress: `0x${string}`
  ownerSignerAddress: `0x${string}` | null
  isSelfAuthSession: boolean
  diagnostics: LiveDiagnostics
  selectedIndex: number | null
  onSelectIndex: (index: number) => void
}

export function RemoveOwnerOwnerSlotsCard(props: RemoveOwnerOwnerSlotsCardProps) {
  const { canonicalCswAddress, ownerSignerAddress, isSelfAuthSession, diagnostics, selectedIndex, onSelectIndex } =
    props

  return (
    <>
      <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
        <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Canonical CSW</dt>
            <dd className="mt-1 break-all font-mono text-zinc-300">{canonicalCswAddress}</dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Connected signer</dt>
            <dd className="mt-1 break-all font-mono text-zinc-300">
              {ownerSignerAddress ?? 'not connected'}
              {isSelfAuthSession ? <span className="ml-2 text-[10px] text-emerald-300">self-auth</span> : null}
            </dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">CSW ETH balance</dt>
            <dd className="mt-1 font-mono text-zinc-300">
              {diagnostics.cswEthBalance == null ? '—' : `${formatEther(diagnostics.cswEthBalance)} ETH`}
            </dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Relay depository (aggregate)</dt>
            <dd className="mt-1 font-mono text-zinc-300">
              {diagnostics.relayDepositoryEthBalance == null
                ? '—'
                : `${formatEther(diagnostics.relayDepositoryEthBalance)} ETH`}
            </dd>
          </div>
        </dl>
      </div>

      <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">On-chain owner slots</div>
          {diagnostics.status === 'loading' ? (
            <div className="text-[10px] text-zinc-500">loading…</div>
          ) : diagnostics.status === 'error' ? (
            <div className="text-[10px] text-rose-300">error</div>
          ) : (
            <div className="text-[10px] text-zinc-500">
              count={diagnostics.ownerCount ?? '—'} · next=
              {diagnostics.nextOwnerIndex ?? '—'}
            </div>
          )}
        </div>

        {diagnostics.status === 'error' ? (
          <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-100">
            {diagnostics.error}
          </div>
        ) : null}

        {diagnostics.owners.length > 0 ? (
          <ul className="space-y-1">
            {diagnostics.owners.map((owner) => {
              const isSelected = selectedIndex === owner.index
              const isEmpty = owner.type === 'empty'
              const isUnreadable = owner.type === 'unreadable'
              const label =
                owner.ownerAddress ??
                (owner.type === 'passkey'
                  ? `passkey ${owner.ownerBytes.slice(0, 30)}…`
                  : isEmpty
                    ? '(empty slot)'
                    : isUnreadable
                      ? '(read failed — RPC error, slot may still be populated)'
                      : owner.ownerBytes.slice(0, 36) + '…')
              return (
                <li key={owner.index}>
                  <button
                    type="button"
                    disabled={isEmpty}
                    onClick={() => !isEmpty && onSelectIndex(owner.index)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-mono ${
                      isEmpty
                        ? 'border-white/5 bg-black/20 text-zinc-600 cursor-not-allowed'
                        : isUnreadable
                          ? isSelected
                            ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                            : 'border-amber-400/25 bg-amber-500/5 text-amber-100/80 hover:border-amber-300/60'
                          : isSelected
                            ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                            : 'border-white/10 bg-black/30 text-zinc-300 hover:border-white/25'
                    }`}
                    title={owner.readError ?? undefined}
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-[10px] mr-2">[{owner.index}]</span>
                      <span>{label}</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 shrink-0">{owner.type}</span>
                  </button>
                  {isUnreadable && owner.readError ? (
                    <div className="mt-1 text-[10px] text-amber-200/70 px-1">
                      read error: {owner.readError.slice(0, 120)}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : diagnostics.status === 'ready' ? (
          <div className="text-xs text-zinc-500">No owner slots found.</div>
        ) : null}

        <p className="text-[11px] leading-relaxed text-zinc-500">
          Coinbase Wallet&apos;s self-auth <code className="font-mono">personal_sign</code> returns a signature
          wrapped at a specific owner index based on its client-side session state. If that index points at an empty
          slot above, the UserOp will fail on-chain validation regardless of which lane submits it.
        </p>
      </div>
    </>
  )
}
