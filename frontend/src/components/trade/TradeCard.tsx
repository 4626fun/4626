import type { ReactNode } from 'react'

export function TradeCard(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/8 bg-vault-card/60 p-4 shadow-[0_4px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-sm ${
        props.className ?? ''
      }`}
    >
      {props.children}
    </div>
  )
}
