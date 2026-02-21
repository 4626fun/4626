import type { ReactNode } from 'react'

export function TradeCard(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-vault-card/75 p-4 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.85)] backdrop-blur-xl ${
        props.className ?? ''
      }`}
    >
      {props.children}
    </div>
  )
}
