import { createElement, useMemo, type CSSProperties, type HTMLAttributes } from 'react'

type ModelViewerElementProps = HTMLAttributes<HTMLElement> & {
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
  style?: CSSProperties
  className?: string
}

// ---------------------------------------------------------------------------
// ZorbViewer — Zora Zorb spinning in place, no controls, transparent bg
// ---------------------------------------------------------------------------
export function ZorbViewer({ size }: { size: number }) {
  const dim = size * 2.6
  const style: CSSProperties & { '--poster-color': string } = {
    width: '100%',
    height: '100%',
    background: 'transparent',
    pointerEvents: 'none',
    '--poster-color': 'transparent',
  }
  const canRenderModelViewer = useMemo(() => {
    if (typeof document === 'undefined') return false
    try {
      const canvas = document.createElement('canvas')
      const gl =
        canvas.getContext('webgl2') ??
        canvas.getContext('webgl') ??
        canvas.getContext('experimental-webgl')
      return Boolean(gl)
    } catch {
      return false
    }
  }, [])

  return (
    <div style={{ width: dim, height: dim, pointerEvents: 'none' }}>
      {canRenderModelViewer ? (
        createElement('model-viewer', {
          src: '/models/ZORB3D.glb',
          alt: 'Zora Zorb',
          'auto-rotate': true,
          'rotation-per-second': '16deg',
          'auto-rotate-delay': '0',
          'shadow-intensity': '0',
          'environment-image': 'neutral',
          exposure: '1.1',
          'interaction-prompt': 'none',
          loading: 'lazy',
          reveal: 'auto',
          style,
        } satisfies ModelViewerElementProps)
      ) : (
        <div
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 50% 38%, rgba(175,215,255,0.9) 0%, rgba(0,82,255,0.55) 35%, rgba(0,22,90,0.75) 70%, rgba(0,0,14,0.12) 100%)',
            boxShadow:
              'inset 0 -12px 24px rgba(0,0,0,0.5), 0 0 28px rgba(0,82,255,0.35)',
          }}
        />
      )}
    </div>
  )
}
