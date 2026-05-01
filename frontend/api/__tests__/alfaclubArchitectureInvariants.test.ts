import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { getCommandFamily } from '../../server/commands/registry'
import { collectAlfaClubCommandMessages } from '../../server/_lib/alfaclub/chatBridge'

/**
 * Architecture invariants for the AlfaClub control plane / Hermit creative
 * lane split. These are a tripwire: if the deployment topology drifts
 * (e.g. someone adds a token writer to the Hermit module, or moves the
 * Privy refresh out of Vercel cron) one of these will fail.
 *
 * Topology summary:
 *   - Vercel: AlfaClub control plane + chat-bridge-run + chat-token-refresh
 *   - Supabase: alfaclub_runtime_secret (chat_jwt + privy access/refresh)
 *   - Railway: Eliza/XMTP/Telegram/Twitter/Discord (NOT AlfaClub auth)
 *   - Pinata: /hermit, /meme, /gmeow creative agent (no auth writes)
 */
describe('alfaclub architecture invariants', () => {
  describe('hermit slash commands route through the hermit family', () => {
    it('/hermit, /meme, /gmeow all resolve to family=hermit', () => {
      expect(getCommandFamily('/hermit')).toBe('hermit')
      expect(getCommandFamily('/hermit announce drop')).toBe('hermit')
      expect(getCommandFamily('/meme akita')).toBe('hermit')
      expect(getCommandFamily('/gmeow')).toBe('hermit')
      expect(getCommandFamily('/gmeow gm')).toBe('hermit')
    })
  })

  describe('AlfaClub bridge collects only /alfaclub and /hermit-family commands', () => {
    const SELF = '0xab6d5c10b03300326cd7fab7267ae192842967b5'
    const SENDER = '0x2222222222222222222222222222222222222222'
    const MANITO = '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5'

    it('public /hermit, /meme, /gmeow slash commands from room users are collected', () => {
      const commands = collectAlfaClubCommandMessages({
        seenMessageIds: new Set<string>(),
        selfAddress: SELF,
        messages: [
          { id: 'm1', date: 100, sender: SENDER, text: '/hermit announce drop' },
          { id: 'm2', date: 101, sender: SENDER, text: '/meme akita black cat' },
          { id: 'm3', date: 102, sender: SENDER, text: '/gmeow' },
        ],
      })
      expect(commands.map((c) => c.text)).toEqual([
        '/hermit announce drop',
        '/meme akita black cat',
        '/gmeow',
      ])
    })

    it('bare gmeow is trusted-only — Manito9v9 routes it as /gmeow, others do not', () => {
      const trusted = collectAlfaClubCommandMessages({
        seenMessageIds: new Set<string>(),
        selfAddress: SELF,
        messages: [{ id: 'm1', date: 100, sender: MANITO, text: 'gmeow' }],
      })
      expect(trusted).toEqual([{ id: 'm1', date: 100, sender: MANITO, text: '/gmeow' }])

      const stranger = collectAlfaClubCommandMessages({
        seenMessageIds: new Set<string>(),
        selfAddress: SELF,
        messages: [{ id: 'm1', date: 100, sender: SENDER, text: 'gmeow' }],
      })
      expect(stranger).toHaveLength(0)
    })

    it('does not collect unrelated chat or non-hermit non-alfaclub slash commands', () => {
      const commands = collectAlfaClubCommandMessages({
        seenMessageIds: new Set<string>(),
        selfAddress: SELF,
        messages: [
          { id: 'm1', date: 100, sender: SENDER, text: '/keepr status' },
          { id: 'm2', date: 101, sender: SENDER, text: 'just chatting about gmeow' },
          { id: 'm3', date: 102, sender: SENDER, text: 'meme time!' },
          { id: 'm4', date: 103, sender: SENDER, text: '/twitter post hi' },
        ],
      })
      expect(commands).toHaveLength(0)
    })
  })

  describe('source-level lane separation', () => {
    const repoRoot = resolve(__dirname, '..', '..')

    function stripComments(src: string): string {
      const withoutBlocks = src.replace(/\/\*[\s\S]*?\*\//g, '')
      return withoutBlocks
        .split('\n')
        .filter((line) => !/^\s*\/\//.test(line))
        .join('\n')
    }

    const skillRouterSrc = stripComments(
      readFileSync(resolve(repoRoot, 'server/_lib/hermit/skillRouter.ts'), 'utf8'),
    )
    const chatBridgeSrc = stripComments(
      readFileSync(resolve(repoRoot, 'server/_lib/alfaclub/chatBridge.ts'), 'utf8'),
    )

    it('hermit/skillRouter.ts does not import from alfaclub/chatTokenStore or privyTokenRefresher', () => {
      expect(skillRouterSrc).not.toMatch(/from\s+['"][^'"]*alfaclub\/chatTokenStore/)
      expect(skillRouterSrc).not.toMatch(/from\s+['"][^'"]*alfaclub\/privyTokenRefresher/)
      expect(skillRouterSrc).not.toContain('alfaclub_runtime_secret')
    })

    it('alfaclub/chatBridge.ts only reads (does not write) chatTokenStore', () => {
      const importLine = chatBridgeSrc
        .split('\n')
        .find((l) => /from\s+['"][^'"]*chatTokenStore/.test(l))
      expect(importLine).toBeDefined()
      // Bridge reads the rotated jwt; never writes.
      expect(importLine).not.toMatch(/upsertAlfaClubChatToken/)
      expect(importLine).not.toMatch(/upsertAlfaClubPrivy/)
      // Module body must not call any writer either.
      expect(chatBridgeSrc).not.toMatch(/\bupsertAlfaClubChatToken\s*\(/)
      expect(chatBridgeSrc).not.toMatch(/\bupsertAlfaClubPrivyAccessToken\s*\(/)
      expect(chatBridgeSrc).not.toMatch(/\bupsertAlfaClubPrivyRefreshToken\s*\(/)
    })

    it('alfaclub/chatBridge.ts does not start the in-process Privy refresher', () => {
      expect(chatBridgeSrc).not.toMatch(/\bstartAlfaClubPrivyTokenRefresher\b/)
    })
  })
})
