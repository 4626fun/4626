export function TelegramMiniAppUnavailable(props: { message: string }) {
  const configuredBot = String(import.meta.env.VITE_TELEGRAM_LINK_BOT_USERNAME ?? '')
    .trim()
    .replace(/^@+/, '')
  const botUsername = configuredBot || 'akitai_bot'

  return (
    <div className="relative min-h-0 w-full bg-transparent px-5 py-8 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-[#0d1821] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Telegram Required</div>
        <h1 className="mt-3 text-xl font-semibold text-white">Open this from @{botUsername} inside Telegram.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{props.message}</p>
      </div>
    </div>
  )
}
