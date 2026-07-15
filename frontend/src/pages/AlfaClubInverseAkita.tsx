import {
  Activity,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { CounterTradeStatusPanel } from '@/components/alfaclub/CounterTradeStatusPanel'
import { PageMeta } from '@/components/seo/PageMeta'
import { cn } from '@/lib/shared/utils'

const INVERSE_ROOM_PATH = '/rooms?roomId=1659&tab=inverse'
const VIRTUALS_AGENT_URL = 'https://degen.virtuals.io/agents/1213'
const CABALS_URL = 'https://cabals.com/cabal/inverseakita'
const INVERSE_AKITA_ART_URL =
  'https://acpcdn-prod.s3.ap-southeast-1.amazonaws.com/agents/0a4b228c-3e11-46f3-a092-cc5bcce0fc19.webp'

const STRATEGY_STEPS = [
  {
    number: '01',
    title: 'A market opinion appears',
    description:
      'A qualified creator or FriendKey staker shares a directional market take in an enabled AlfaClub room.',
  },
  {
    number: '02',
    title: 'Hermit checks the context',
    description:
      'Hermit4626 identifies the market and direction, then applies access, pair, sizing, cooldown, and risk gates.',
  },
  {
    number: '03',
    title: 'InverseAKITA takes the other side',
    description:
      'The strategy expresses the opposite view on its own wallet. Existing exposure may be added to, trimmed, or left alone instead of blindly stacking risk.',
  },
  {
    number: '04',
    title: 'The trade becomes auditable',
    description:
      'Virtuals Arena carries the agent identity, Hyperliquid supplies fills and PnL, and room 1659 records the strategy narrative.',
  },
] as const

const SURFACES = [
  {
    name: 'AlfaClub',
    identity: 'Hermit4626',
    role: 'Opinion and room context',
    detail: 'Hermit reads the room, explains the inverse thesis, and reports activity in room 1659.',
    logo: '/protocols/alfaclub.svg',
    href: INVERSE_ROOM_PATH,
    internal: true,
    action: 'Open room 1659',
    logoClassName: 'p-2.5',
  },
  {
    name: 'Virtuals Arena',
    identity: 'InverseAKITA · $ATIKA',
    role: 'Agent identity and execution rail',
    detail: 'Arena agent 1213 is the public agent surface connected to the strategy wallet.',
    logo: '/protocols/virtuals.svg',
    href: VIRTUALS_AGENT_URL,
    internal: false,
    action: 'View Arena agent',
    logoClassName: 'p-1',
  },
  {
    name: 'Hyperliquid',
    identity: 'InverseAKITA wallet',
    role: 'Venue and performance truth',
    detail: 'Perpetual orders, fills, open positions, and realized or unrealized PnL resolve here.',
    logo: 'https://assets.coingecko.com/coins/images/50882/small/hyperliquid.jpg',
    href: VIRTUALS_AGENT_URL,
    internal: false,
    action: 'View trading profile',
    logoClassName: 'p-0',
  },
  {
    name: 'Cabals',
    identity: 'InverseAKITA',
    role: 'Community and wallet attribution',
    detail: 'The public Cabal groups the community around the same strategy without owning its decision history.',
    logo: '/protocols/cabals.svg',
    href: CABALS_URL,
    internal: false,
    action: 'Open the Cabal',
    logoClassName: 'p-2',
  },
] as const

export function AlfaClubInverseAkita() {
  return (
    <div className="relative isolate overflow-hidden pb-20">
      <PageMeta
        title="InverseAKITA"
        description="Meet InverseAKITA, the autonomous AlfaClub counter-positioning strategy operated through Hermit4626, Virtuals Arena, Hyperliquid, and Cabals."
        canonicalPath="/inverseakita"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem] bg-[radial-gradient(circle_at_20%_8%,rgba(56,189,248,0.16),transparent_32%),radial-gradient(circle_at_78%_20%,rgba(139,92,246,0.13),transparent_30%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem] opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:52px_52px]"
      />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="grid min-h-[34rem] items-center gap-10 border-b border-white/[0.08] py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] lg:py-24">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-sky-300">
              Autonomous counter-positioning
            </p>
            <h1 className="headline mt-5 max-w-4xl text-5xl leading-[0.92] text-white sm:text-7xl lg:text-8xl">
              InverseAKITA
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300 sm:text-xl">
              A trading agent that listens to qualified market opinions, checks the risk,
              and expresses the other side on its own Hyperliquid wallet.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-500">
              One strategy, several public identities: Hermit4626 inside AlfaClub,
              InverseAKITA and $ATIKA on Virtuals, and InverseAKITA on Cabals.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={INVERSE_ROOM_PATH}
                className="inline-flex items-center gap-2 rounded-full bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
              >
                Enter room 1659
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a
                href={VIRTUALS_AGENT_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-zinc-100 ring-1 ring-white/[0.1] transition hover:bg-white/[0.1]"
              >
                View the agent
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-sky-400/10 blur-3xl" aria-hidden />
            <div className="overflow-hidden rounded-[2rem] bg-zinc-950/80 ring-1 ring-white/[0.1]">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)]" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                    Strategy identity
                  </span>
                </div>
                <span className="font-mono text-[10px] text-zinc-600">ROOM 1659</span>
              </div>
              <div className="space-y-6 p-6 sm:p-7">
                <div className="flex items-center gap-5">
                  <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-sky-950 ring-1 ring-sky-300/25 shadow-[0_0_32px_rgba(56,189,248,0.16)] sm:size-28">
                    <img
                      src={INVERSE_AKITA_ART_URL}
                      alt="InverseAKITA holographic Akita"
                      className="h-full w-full object-cover object-center"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.08]"
                    />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-white">InverseAKITA</p>
                    <p className="mt-1 font-mono text-xs text-violet-300">$ATIKA · ARENA 1213</p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/[0.08] ring-1 ring-white/[0.08]">
                  <IdentityFact label="Strategy" value="Counter-position" />
                  <IdentityFact label="Venue" value="Hyperliquid" />
                  <IdentityFact label="Operator" value="Hermit4626" />
                  <IdentityFact label="Home room" value="#1659" />
                </dl>
                <div className="flex items-start gap-3 rounded-xl bg-amber-400/[0.06] p-4 ring-1 ring-amber-300/10">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
                  <p className="text-xs leading-relaxed text-zinc-400">
                    InverseAKITA is not a price oracle or a promise of profit. Every trade remains
                    subject to access, market, sizing, execution, and risk controls.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.08] py-16 sm:py-20" aria-labelledby="how-it-works">
          <SectionHeading
            eyebrow="The mechanism"
            title="How the inverse loop works"
            description="The bot does more than flip a word from long to short. It preserves who expressed the view, checks whether the action is allowed, and keeps execution separate from explanation."
            id="how-it-works"
          />
          <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl bg-white/[0.08] ring-1 ring-white/[0.08] md:grid-cols-2 xl:grid-cols-4">
            {STRATEGY_STEPS.map((step) => (
              <li key={step.number} className="bg-zinc-950/95 p-6 sm:p-7">
                <span className="font-mono text-xs text-sky-300">{step.number}</span>
                <h3 className="mt-6 text-base font-semibold text-zinc-100">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-b border-white/[0.08] py-16 sm:py-20" aria-labelledby="where-it-lives">
          <SectionHeading
            eyebrow="One system, multiple surfaces"
            title="Where InverseAKITA lives"
            description="The names change because each platform exposes a different part of the same operating system. These roles should not be collapsed into one another."
            id="where-it-lives"
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {SURFACES.map((surface) => {
              const content = (
                <div className="relative z-[1]">
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={cn(
                        'grid size-12 place-items-center overflow-hidden rounded-xl bg-white/[0.06] ring-1 ring-white/[0.1]',
                        surface.logoClassName,
                      )}
                    >
                      <img
                        src={surface.logo}
                        alt={`${surface.name} logo`}
                        className="h-full w-full object-contain"
                      />
                    </span>
                    {surface.internal ? (
                      <ArrowRight className="size-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" aria-hidden />
                    ) : (
                      <ExternalLink className="size-4 text-zinc-600 transition group-hover:text-zinc-300" aria-hidden />
                    )}
                  </div>
                  <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    {surface.name} · {surface.role}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-zinc-100">{surface.identity}</h3>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">{surface.detail}</p>
                  <p className="mt-5 text-xs font-medium text-zinc-300">{surface.action}</p>
                </div>
              )

              const backgroundLogo = (
                <img
                  src={surface.logo}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute -bottom-12 -right-10 size-52 select-none object-contain opacity-[0.055] grayscale"
                  loading="lazy"
                />
              )

              return surface.internal ? (
                <Link
                  key={surface.name}
                  to={surface.href}
                  className="group relative overflow-hidden rounded-2xl bg-white/[0.025] p-6 ring-1 ring-white/[0.08] transition hover:bg-white/[0.05] hover:ring-white/[0.14] sm:p-7"
                >
                  {backgroundLogo}
                  {content}
                </Link>
              ) : (
                <a
                  key={surface.name}
                  href={surface.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative overflow-hidden rounded-2xl bg-white/[0.025] p-6 ring-1 ring-white/[0.08] transition hover:bg-white/[0.05] hover:ring-white/[0.14] sm:p-7"
                >
                  {backgroundLogo}
                  {content}
                </a>
              )
            })}
          </div>
        </section>

        <section className="grid gap-8 border-b border-white/[0.08] py-16 sm:py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(28rem,1.15fr)] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Live proof"
              title="What the engine is doing now"
              description="This is the existing AlfaClub strategy status—not a second trading interface. It exposes engine state and recent recorded actions while execution stays on the agent wallet."
              id="live-proof"
            />
            <div className="mt-7 space-y-4 text-sm leading-relaxed text-zinc-500">
              <p>
                In room 1659, use <span className="font-mono text-zinc-300">/h status</span> for
                the current strategy state and <span className="font-mono text-zinc-300">/h pos</span> for
                the live book.
              </p>
              <p>
                The daily trade journal ties qualified opinions to inverse decisions, execution
                evidence, open-position state, and closed outcomes without letting the journal mutate trades.
              </p>
            </div>
          </div>
          <CounterTradeStatusPanel />
        </section>

        <section className="py-16 sm:py-20" aria-labelledby="boundaries">
          <div className="grid gap-8 rounded-3xl bg-gradient-to-br from-white/[0.05] to-transparent p-6 ring-1 ring-white/[0.08] sm:p-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">Boundaries</p>
              <h2 id="boundaries" className="headline mt-3 text-3xl text-zinc-100 sm:text-4xl">
                What it is—and what it is not
              </h2>
            </div>
            <div className="grid gap-5 text-sm leading-relaxed text-zinc-400 sm:grid-cols-2">
              <Boundary icon={Wallet} title="Its own wallet">
                InverseAKITA trades strategy capital. Reading the page or holding $ATIKA does not place a trade from your wallet.
              </Boundary>
              <Boundary icon={ShieldCheck} title="Risk-gated, not guaranteed">
                An inverse thesis can still lose. Access checks, sizing limits, cooldowns, and execution controls reduce risk; they do not remove it.
              </Boundary>
              <Boundary icon={MessageSquare} title="AlfaClub owns opinion context">
                Cabals and Virtuals show public identity and activity, but AlfaClub retains the source-room and opinion lineage.
              </Boundary>
              <Boundary icon={Activity} title="Hyperliquid owns PnL truth">
                Performance claims resolve against actual fills, positions, fees, funding, and realized outcomes from the venue.
              </Boundary>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function IdentityFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/70 px-4 py-3">
      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-600">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-zinc-200">{value}</dd>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string
  title: string
  description: string
  id: string
}) {
  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-300">{eyebrow}</p>
      <h2 id={id} className="headline mt-3 text-3xl text-zinc-100 sm:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-500 sm:text-base">{description}</p>
    </div>
  )
}

function Boundary({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Wallet
  title: string
  children: string
}) {
  return (
    <div>
      <Icon className="size-5 text-zinc-300" aria-hidden />
      <h3 className="mt-3 font-semibold text-zinc-100">{title}</h3>
      <p className="mt-2">{children}</p>
    </div>
  )
}
