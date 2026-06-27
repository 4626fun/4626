import { Button } from '@/components/ui/Button'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'

type WaitlistTwitterLinkPanelProps = {
  linked: boolean
  busy: boolean
  onConnect: () => void
}

export function WaitlistTwitterLinkPanel(props: WaitlistTwitterLinkPanelProps) {
  const { linked, busy, onConnect } = props

  if (linked) return null

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      className="mt-6 w-full"
      onClick={onConnect}
      disabled={busy}
    >
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <PixelWaveLoader name="wave-lr" size={14} color="rgba(255,255,255,0.9)" />
          Linking…
        </span>
      ) : (
        'Link Twitter'
      )}
    </Button>
  )
}
