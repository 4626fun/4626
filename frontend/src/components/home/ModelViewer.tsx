/// <reference types="react" />

// Typed shim for the <model-viewer> web component so TSX doesn't complain
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string
          alt?: string
          'auto-rotate'?: boolean | string
          'rotation-per-second'?: string
          'auto-rotate-delay'?: string | number
          'camera-controls'?: boolean | string
          'shadow-intensity'?: string | number
          'environment-image'?: string
          exposure?: string | number
          'interaction-prompt'?: string
          loading?: 'auto' | 'lazy' | 'eager'
          reveal?: 'auto' | 'manual'
          style?: React.CSSProperties
          className?: string
        },
        HTMLElement
      >
    }
  }
}

// ---------------------------------------------------------------------------
// ZorbViewer — Zora Zorb spinning in place, no controls, transparent bg
// ---------------------------------------------------------------------------
export function ZorbViewer({ size }: { size: number }) {
  const dim = size * 2.6
  return (
    <div style={{ width: dim, height: dim, pointerEvents: 'none' }}>
      {/* @ts-expect-error — custom element, typed above */}
      <model-viewer
        src="/models/zorb.glb"
        alt="Zora Zorb"
        auto-rotate
        rotation-per-second="16deg"
        auto-rotate-delay="0"
        shadow-intensity="0"
        environment-image="neutral"
        exposure="1.1"
        interaction-prompt="none"
        loading="lazy"
        reveal="auto"
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
          pointerEvents: 'none',
          '--poster-color': 'transparent',
        } as React.CSSProperties}
      />
    </div>
  )
}
