type WaitlistWorkspaceHeaderProps = {
  canEnterApp: boolean
  setupComplete: boolean
  showSetupHeading: boolean
}

export function WaitlistWorkspaceHeader(props: WaitlistWorkspaceHeaderProps) {
  const { canEnterApp, setupComplete, showSetupHeading } = props

  if (!showSetupHeading) return null

  const title = canEnterApp
    ? "You're approved"
    : "You're on the waitlist"

  const subtitle = canEnterApp
    ? "Your spot is open — enter the app when you're ready. Points and chat stay here on the waitlist page."
    : setupComplete
      ? "We'll notify you when your spot opens. Optional setup below unlocks swaps and chat sooner."
      : 'Finish setup below to link your creator identity and wallet.'

  return (
    <header className="mx-auto max-w-3xl space-y-1.5 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">{title}</h1>
      <p className="text-sm leading-relaxed text-zinc-400">{subtitle}</p>
    </header>
  )
}
