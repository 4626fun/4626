import type { EthosPageTheme } from '@/components/explore/ethosPageTheme'

export function EthosPageAmbience({ theme }: { theme: EthosPageTheme }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={theme.ambientLayerStyle} />
    </div>
  )
}

export function EthosHeroScoreWash({ theme }: { theme: EthosPageTheme }) {
  if (!theme.isActive) return null
  return <div className="pointer-events-none absolute inset-0 z-[1]" style={theme.heroWashStyle} aria-hidden="true" />
}

export function EthosBlurOrbs({
  theme,
  className = '',
}: {
  theme: EthosPageTheme
  className?: string
}) {
  return (
    <>
      <div
        className={`pointer-events-none absolute -top-20 left-1/4 w-72 h-72 rounded-full blur-[120px] ${className}`}
        style={theme.orbTopStyle}
        aria-hidden="true"
      />
      <div
        className={`pointer-events-none absolute -bottom-16 right-1/4 w-80 h-80 rounded-full blur-[130px] ${className}`}
        style={theme.orbBottomStyle}
        aria-hidden="true"
      />
    </>
  )
}
