export function TelegramMiniAppUnavailable(props: { message: string }) {
  return (
    <div className="min-h-screen bg-black px-5 py-8 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-[#0d1821] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Telegram Required</div>
        <h1 className="mt-3 text-xl font-semibold text-white">Open this from @akitai_bot inside Telegram.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{props.message}</p>
      </div>
    </div>
  )
}
