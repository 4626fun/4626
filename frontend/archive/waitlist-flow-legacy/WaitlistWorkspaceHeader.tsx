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
      ? "We'll notify you when your spot opens. You can keep earning points here."
      : "We'll notify you when your spot opens. Account setup is optional while you wait."

  return (
    <header className="mx-auto max-w-4xl space-y-2 text-center">
      <p className="text-[10px] uppercase tracking-[0.14em] text-brand-200/90">Waitlist Workspace</p>
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">{title}</h1>
      <p className="text-sm leading-relaxed text-zinc-400">{subtitle}</p>
    </header>
  )
}
