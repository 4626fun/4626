import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('private chat metadata guards', () => {
  it('does not hydrate Ethos scores for private conversation peers', () => {
    for (const path of [
      'src/components/chat/ChatBar.tsx',
      'src/components/chat/ChatWindow.tsx',
    ]) {
      expect(source(path)).not.toContain('EthosAvatarScoreForAddress')
    }

    const rail = source('src/components/chat/ChatAvailabilityRail.tsx')
    const recentConversationSection = rail.slice(
      rail.indexOf('function ConversationUserRow'),
      rail.indexOf('function PresenceUserRow'),
    )
    expect(recentConversationSection).toContain('function ConversationUserRow')
    expect(recentConversationSection).not.toContain('EthosAvatarScoreForAddress')
    expect(recentConversationSection).not.toContain('ethosAddress')
  })

  it('does not resolve untrusted fallback labels as Basenames', () => {
    const identity = source('src/components/chat/useChatIdentity.ts')
    expect(identity).not.toContain('getBasenameProfileByName')
    expect(identity).not.toContain('chatIdentityBasenameProfileByName')
  })
})
