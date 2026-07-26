export const EXPLORE_FEE_VERSION_HEADER_HINT =
  '24h trading fees: indexed from CoinTradeRewards when available (Creator/Platform/Zora on-chain; LP/Doppler derived). Otherwise estimated as volume × fee rate (v4 1% / legacy 3%). Expand a row for the payout split.'

export function ExploreFeeInfoHint(props: { title: string; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center text-[10px] leading-none text-zinc-500 cursor-help select-none ${props.className ?? ''}`}
      title={props.title}
      aria-label={props.title}
    >
      ℹ
    </span>
  )
}
