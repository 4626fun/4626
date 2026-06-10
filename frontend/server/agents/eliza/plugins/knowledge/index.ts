import fs from 'node:fs'
import path from 'node:path'
import type { Action, Content, HandlerCallback, IAgentRuntime, Memory, Plugin, State } from '@elizaos/core'

type KnowledgeDoc = {
  title: string
  body: string
}

const DOC_PATHS = [
  { title: 'Frontend README', filePath: 'README.md' },
  { title: 'Onchain Reputation', filePath: 'docs/onchain-reputation-system.md' },
]

function getConfiguredDocPaths(): Array<{ title: string; filePath: string }> {
  const raw = String(process.env.ELIZA_KNOWLEDGE_DOC_PATHS ?? '').trim()
  if (!raw) return DOC_PATHS
  const extras = raw
    .split(/[,\n]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((filePath) => ({
      title: `Doc: ${filePath}`,
      filePath,
    }))
  return [...DOC_PATHS, ...extras]
}

let cachedDocs: KnowledgeDoc[] | null = null
let lastLoadAtMs = 0

function sanitizeText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/`{3}[\s\S]*?`{3}/g, '')
    .replace(/[#>*-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readKnowledgeDocs(): KnowledgeDoc[] {
  const now = Date.now()
  if (cachedDocs && now - lastLoadAtMs < 60_000) return cachedDocs

  const root = process.cwd()
  const docs: KnowledgeDoc[] = []
  for (const entry of getConfiguredDocPaths()) {
    try {
      const absolute = path.join(root, entry.filePath)
      if (!fs.existsSync(absolute)) continue
      const raw = fs.readFileSync(absolute, 'utf8')
      const body = sanitizeText(raw)
      if (!body) continue
      docs.push({ title: entry.title, body })
    } catch {
      // Non-critical: skip unreadable docs.
    }
  }

  if (docs.length === 0) {
    docs.push({
      title: '4626 Basics',
      body:
        '4626 uses ERC-4626 vaults on Base. Keepr supports /keepr status, /keepr operational commands, wallet intelligence, and reputation tools.',
    })
  }

  cachedDocs = docs
  lastLoadAtMs = now
  return docs
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)
}

function scoreDoc(doc: KnowledgeDoc, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0
  const body = doc.body.toLowerCase()
  let score = 0
  for (const token of queryTokens) {
    if (body.includes(token)) score += 1
  }
  return score / queryTokens.length
}

function buildSnippet(body: string, queryTokens: string[]): string {
  if (queryTokens.length === 0) return body.slice(0, 320).trim()
  const bodyLc = body.toLowerCase()
  let firstMatch = -1
  for (const token of queryTokens) {
    const idx = bodyLc.indexOf(token)
    if (idx >= 0 && (firstMatch === -1 || idx < firstMatch)) firstMatch = idx
  }
  if (firstMatch < 0) return body.slice(0, 320).trim()
  const start = Math.max(0, firstMatch - 120)
  const end = Math.min(body.length, firstMatch + 220)
  return body.slice(start, end).trim()
}

function topKnowledgeSnippets(query: string, limit = 3): Array<{ title: string; snippet: string; score: number }> {
  const docs = readKnowledgeDocs()
  const tokens = tokenize(query)
  const scored = docs
    .map((doc) => {
      const score = scoreDoc(doc, tokens)
      const snippet = buildSnippet(doc.body, tokens)
      return { title: doc.title, snippet, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

const knowledgeAction: Action = {
  name: 'KNOWLEDGE_QUERY',
  description: 'Query indexed 4626 docs and return concise snippets.',
  similes: ['kb', 'knowledge', 'docs'],
  examples: [
    [
      { name: 'user', content: { text: '/knowledge how does onchain reputation work' } },
      { name: 'agent', content: { text: 'Knowledge matches\n1) Onchain Reputation: ...' } },
    ],
  ],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = String(message.content?.text ?? '')
    const lc = text.toLowerCase().trim()
    return lc.startsWith('/knowledge') || lc.startsWith('/kb')
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown> | undefined,
    callback?: HandlerCallback,
  ) => {
    const text = String(message.content?.text ?? '').trim()
    const query = text.replace(/^\/(knowledge|kb)\s*/i, '').trim()
    if (!query) {
      await callback?.({
        text: 'Usage: /knowledge <query> or /kb <query>',
      } as Content)
      return
    }

    const matches = topKnowledgeSnippets(query, 3)
    if (matches.length === 0) {
      await callback?.({
        text: 'No high-confidence knowledge match found. Try a narrower query.',
      } as Content)
      return
    }

    const lines = ['Knowledge matches']
    matches.forEach((entry, index) => {
      lines.push(`${index + 1}) ${entry.title}: ${entry.snippet}`)
    })
    await callback?.({ text: lines.join('\n') } as Content)
  },
}

export const knowledgePlugin: Plugin = {
  name: '@4626/plugin-knowledge',
  description: 'Lightweight knowledge retrieval over local 4626 docs',
  actions: [knowledgeAction],
  providers: [
    {
      name: 'knowledge-context',
      description: 'Provides short knowledge context snippets for LLM grounding.',
      get: async (_runtime: IAgentRuntime, message: Memory) => {
        const text = String(message.content?.text ?? '').trim()
        if (!text) return { text: '' }
        const matches = topKnowledgeSnippets(text, 2)
        if (matches.length === 0) return { text: '' }
        return {
          text: matches
            .map((entry) => `${entry.title}: ${entry.snippet}`)
            .join('\n'),
        }
      },
    },
  ],
}

export default knowledgePlugin

