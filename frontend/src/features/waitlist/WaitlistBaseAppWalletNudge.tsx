import { Button } from '@/components/ui/Button'

const BASE_ACCOUNT_LOGO = '/base/base-square-blue.svg'

type WaitlistBaseAppWalletNudgeProps = {
  stepOneComplete: boolean
  showConnectPanel: boolean
  onGoToStepTwo: () => void
}

export function WaitlistBaseAppWalletNudge(props: WaitlistBaseAppWalletNudgeProps) {
  const { stepOneComplete, showConnectPanel, onGoToStepTwo } = props

  const body =
    showConnectPanel && !stepOneComplete
      ? 'Your email is verified. Connect your Base Account wallet in Step 2 now — Zora linking is optional and can wait.'
      : !stepOneComplete
        ? 'Your email is verified. Finish Step 1, then connect your Base Account wallet in Step 2.'
        : showConnectPanel
          ? 'Your email is verified. Connect your Base Account wallet in Step 2 to enable sponsored swaps and group chat.'
          : 'Your email is verified. Step 2 will open when your wallet session is ready.'

  return (
    <div
      className="rounded-2xl border border-brand-primary/25 bg-[linear-gradient(180deg,rgba(37,99,235,0.14),rgba(37,99,235,0.05))] p-4 ring-1 ring-brand-primary/15"
      data-testid="waitlist-base-app-wallet-nudge"
    >
      <div className="flex items-start gap-3">
        <img src={BASE_ACCOUNT_LOGO} alt="" className="mt-0.5 h-8 w-8 shrink-0 object-contain" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-brand-200">Next in Base App</p>
            <h3 className="mt-1 text-sm font-semibold text-white">Connect your Base Account wallet</h3>
            <p className="mt-1 text-xs leading-relaxed text-brand-50/90">{body}</p>
          </div>
          <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={onGoToStepTwo}>
            {showConnectPanel ? 'Open wallet setup' : 'Open Step 2'}
          </Button>
        </div>
      </div>
    </div>
  )
}
