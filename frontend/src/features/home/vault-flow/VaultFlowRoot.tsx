// VaultFlowRoot.tsx
// Public entry point. Replaces VaultFlowScroll.
// Owns profile resolution and raw scroll progress.
// Delegates rendering to the appropriate profile orchestrator.

import { useRef } from 'react'
import { useScroll } from 'framer-motion'
import type { MotionValue } from 'framer-motion'

import { useVaultFlowProfile } from './model/flowProfile'
import { STORY_CONTENT } from './model/storyContent'
import { VaultFlowDesktop } from './orchestrators/VaultFlowDesktop'
import { VaultFlowMobile } from './orchestrators/VaultFlowMobile'
import { VaultFlowReduced } from './orchestrators/VaultFlowReduced'

type Props = {
  depositTokens: string
  shareTokens: string
}

export function VaultFlowRoot({ depositTokens, shareTokens }: Props) {
  const profile = useVaultFlowProfile()
  const containerRef = useRef<HTMLDivElement>(null)

  // Raw scroll progress across the full sticky container
  const { scrollYProgress } = useScroll({ target: containerRef })

  const commonProps = {
    depositTokens,
    shareTokens,
    content: STORY_CONTENT,
    scrollProgress: scrollYProgress,
  }

  return (
    <div ref={containerRef} className="relative">
      {profile === 'desktop' && (
        <VaultFlowDesktop {...commonProps} profile={profile} />
      )}
      {profile === 'mobile' && (
        <VaultFlowMobile {...commonProps} profile={profile} />
      )}
      {profile === 'reduced' && (
        <VaultFlowReduced {...commonProps} profile={profile} />
      )}
    </div>
  )
}

// Re-export types renderers need
export type { StoryState } from './model/storyClock'
export type { StoryContent } from './model/storyContent'
export type { FlowProfile } from './model/flowProfile'

// Shared renderer props contract
export type StoryRendererProps = {
  depositTokens: string
  shareTokens: string
  content: typeof STORY_CONTENT
  scrollProgress: MotionValue<number>
  profile: ReturnType<typeof useVaultFlowProfile>
}
