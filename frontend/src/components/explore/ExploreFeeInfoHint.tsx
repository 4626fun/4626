export const EXPLORE_FEE_VERSION_HEADER_HINT =
  'Total fees (volume × fee %). 1% on V4 coins (after June 2025); 3% on legacy coins.'

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
