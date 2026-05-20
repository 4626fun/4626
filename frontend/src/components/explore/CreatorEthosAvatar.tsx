import { useMemo } from 'react'

import {
  EthosAvatarScoreBadge,
  EthosAvatarScoreForUserkey,
  getEthosScoreAccentHex,
  getEthosScorePalette,
  type EthosScoreValue,
} from '@/components/chat/EthosScorePill'
import { useZoraProfile } from '@/lib/zora/hooks'
import { buildEthosSocialUserkeyFromZoraProfile, getZoraCreatorProfileIdentifier } from '@/lib/ethos/zoraSocial'
import type { ZoraCoin } from '@/lib/zora/types'
import { cn } from '@/lib/shared/utils'

export type CreatorEthosAvatarSize = 'sm' | 'lg'

function walletEthosUserkeyForCoin(coin: ZoraCoin): string | null {
  const creator = typeof coin.creatorAddress === 'string' ? coin.creatorAddress.trim().toLowerCase() : ''
  if (/^0x[a-f0-9]{40}$/.test(creator)) return `address:${creator}`
  return null
}

export function CreatorSocialEthosBadge({
  coin,
  ethosUserkey,
  ethosScore,
  size = 'sm',
}: {
  coin: ZoraCoin
  ethosUserkey?: string | null
  ethosScore?: EthosScoreValue | null
  size?: CreatorEthosAvatarSize
}) {
  const profileIdentifier = getZoraCreatorProfileIdentifier(coin)
  const hasServerScore = Boolean(ethosScore)
  const shouldResolveProfile = ethosUserkey === undefined && !hasServerScore
  const profileQuery = useZoraProfile(shouldResolveProfile ? profileIdentifier ?? undefined : undefined)
  const resolvedEthosUserkey = useMemo(() => {
    if (ethosUserkey) return ethosUserkey
    const social = buildEthosSocialUserkeyFromZoraProfile(profileQuery.data)
    if (social) return social
    if (hasServerScore) return walletEthosUserkeyForCoin(coin)
    return null
  }, [coin, ethosUserkey, hasServerScore, profileQuery.data])

  if (!resolvedEthosUserkey) return null

  const badgeClassName =
    size === 'lg'
      ? 'absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 scale-[1.12] origin-bottom'
      : 'absolute bottom-1 left-1/2 z-10 -translate-x-1/2'

  if (ethosScore) {
    return (
      <EthosAvatarScoreBadge
        score={ethosScore.score}
        level={ethosScore.level}
        profileQuery={resolvedEthosUserkey}
        profileQueryKind="userkey"
        className={badgeClassName}
      />
    )
  }

  return (
    <EthosAvatarScoreForUserkey
      userkey={resolvedEthosUserkey}
      className={badgeClassName}
    />
  )
}

type CreatorEthosAvatarProps = {
  coin: ZoraCoin
  imageUrl?: string | null
  fallbackLabel?: string
  ethosUserkey?: string | null
  ethosScore?: EthosScoreValue | null
  size?: CreatorEthosAvatarSize
  className?: string
}

export function CreatorEthosAvatar({
  coin,
  imageUrl,
  fallbackLabel,
  ethosUserkey,
  ethosScore,
  size = 'sm',
  className,
}: CreatorEthosAvatarProps) {
  const palette = getEthosScorePalette(ethosScore?.score ?? null, ethosScore?.level ?? null)
  const scoreValue = typeof ethosScore?.score === 'number' ? ethosScore.score : null
  const hasPositiveScore = scoreValue != null && scoreValue > 0
  const accentHex = getEthosScoreAccentHex(ethosScore?.score ?? null, ethosScore?.level ?? null)
  const ringClass = hasPositiveScore
    ? cn('border-2', palette.borderClass, 'shadow-[0_0_0_1px_rgba(0,0,0,0.85)]')
    : 'border-2 border-white/10'

  const isLarge = size === 'lg'
  const wrapperClass = isLarge
    ? 'relative h-12 w-12 shrink-0 sm:h-16 sm:w-16'
    : 'relative h-10 w-10 shrink-0 sm:h-11 sm:w-11'
  const imageClass = isLarge
    ? cn('h-full w-full rounded-full object-cover', ringClass)
    : cn('mx-auto h-7 w-7 rounded-full object-cover sm:h-8 sm:w-8', ringClass)
  const placeholderClass = isLarge
    ? cn('flex h-full w-full items-center justify-center rounded-full bg-linear-to-br from-zinc-700 to-zinc-800', ringClass)
    : cn('mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-zinc-700 to-zinc-800 sm:h-8 sm:w-8', ringClass)

  const label = fallbackLabel ?? coin.symbol ?? coin.name ?? '?'
  const initials = label.slice(0, 2).toUpperCase()

  return (
    <div className={cn(wrapperClass, className)}>
      {hasPositiveScore ? (
        <span
          className="pointer-events-none absolute inset-[-18%] rounded-full opacity-70 blur-xl"
          style={{
            background: `radial-gradient(circle, ${accentHex}55 0%, ${accentHex}22 45%, transparent 72%)`,
          }}
          aria-hidden="true"
        />
      ) : null}
      {imageUrl ? (
        <img src={imageUrl} alt={label} className={imageClass} />
      ) : (
        <div className={placeholderClass}>
          <span className={cn('font-medium text-zinc-400', isLarge ? 'text-sm sm:text-base' : 'text-[11px]')}>
            {initials}
          </span>
        </div>
      )}
      <CreatorSocialEthosBadge coin={coin} ethosUserkey={ethosUserkey} ethosScore={ethosScore} size={size} />
    </div>
  )
}
