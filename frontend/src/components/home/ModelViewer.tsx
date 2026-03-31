import { createElement, type CSSProperties, type HTMLAttributes } from 'react'

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

  return (
    <div style={{ width: dim, height: dim, pointerEvents: 'none' }}>
      {createElement('model-viewer', {
        src: '/models/zorb.glb',
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
      } satisfies ModelViewerElementProps)}
    </div>
  )
}
