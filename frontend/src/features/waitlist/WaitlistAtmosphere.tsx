/** Ambient wire-grid + bottom fade for waitlist landing / game HQ. */
export function WaitlistAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0 bg-wire-grid opacity-[0.035]" />
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgb(var(--brand-gold) / 0.08), transparent 70%)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-32"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgb(var(--vault-bg) / 0.9))',
        }}
      />
    </div>
  )
}
