/**
 * VirtualsAcpService — connects the ElizaOS runtime to a Virtuals ACP v2 agent.
 *
 * Lifecycle: `start()` builds the Privy-managed wallet provider, creates the
 * `AcpAgent`, and subscribes to job-room entries. Each entry that the SDK says
 * we should respond to is driven through the shared Eliza LLM service: the
 * session's role/status-scoped tools are offered to the model as a strict JSON
 * decision, parsed, policy-clamped, and executed via `session.executeTool`.
 *
 * Safety posture:
 * - `fund` (spending USDC as a job client) is withheld from the LLM unless
 *   VIRTUALS_ACP_AUTO_FUND=1.
 * - All USDC amounts are clamped to VIRTUALS_ACP_MAX_BUDGET_USDC.
 * - VIRTUALS_ACP_AUTO_LLM=0 turns the service into a pure observer (events are
 *   logged; nothing is executed).
 */

import { randomUUID } from 'node:crypto'

import {
  AcpAgent,
  PrivyAlchemyEvmProviderAdapter,
  getEvmChainByChainId,
} from '@virtuals-protocol/acp-node-v2'
import type { JobSession, JobRoomEntry, AcpAgentDetail } from '@virtuals-protocol/acp-node-v2'

import { logger } from '../../../../_lib/infra/logger.js'
import { getElizaLlmService } from '../../llm.js'
import { readVirtualsAcpConfig, checkVirtualsAcpConfig, type VirtualsAcpConfig } from './config.js'
import {
  buildToolSystemPrompt,
  clampSpendArgs,
  filterToolsByPolicy,
  parseToolDecision,
} from './toolLoop.js'

export type VirtualsAcpServiceStatus = {
  running: boolean
  startedAt: string | null
  agentAddress: string | null
  chainId: number | null
  autoLlmEnabled: boolean
  autoFundEnabled: boolean
  maxBudgetUsdc: number | null
  sessions: Array<{ jobId: string; chainId: number; roles: string[]; status: string }>
  entriesHandled: number
  toolsExecuted: number
  llmDecisions: {
    attempted: number
    unparseable: number
    wait: number
    executed: number
    avgLatencyMs: number
  }
  lastError: string | null
}

export class VirtualsAcpService {
  private agent: AcpAgent | null = null
  private config: VirtualsAcpConfig | null = null
  private startedAt: Date | null = null
  private agentAddress: string | null = null
  private entriesHandled = 0
  private toolsExecuted = 0
  private llmAttempted = 0
  private llmUnparseable = 0
  private llmWait = 0
  private llmExecuted = 0
  private llmDecisionLatencyTotalMs = 0
  private lastError: string | null = null
  private readonly inFlightSessions = new Set<string>()

  get running(): boolean {
    return this.agent !== null
  }

  async start(): Promise<{ started: boolean; reason?: string }> {
    if (this.agent) return { started: true }

    const check = checkVirtualsAcpConfig(readVirtualsAcpConfig())
    if (!check.ok) return { started: false, reason: check.reason }
    const config = check.config

    const chain = getEvmChainByChainId(config.chainId)
    if (!chain) {
      return { started: false, reason: `unsupported VIRTUALS_ACP_CHAIN_ID ${config.chainId}` }
    }

    try {
      const provider = await PrivyAlchemyEvmProviderAdapter.create({
        walletAddress: config.walletAddress!,
        walletId: config.walletId!,
        signerPrivateKey: config.signerPrivateKey!,
        chains: [chain],
      })
      const agent = await AcpAgent.create({ provider })
      agent.on('entry', (session, entry) => {
        void this.handleEntry(session, entry)
      })
      await agent.start(() => {
        logger.info('[virtuals-acp] connected — listening for ACP jobs')
      })

      this.agent = agent
      this.config = config
      this.startedAt = new Date()
      this.agentAddress = await agent.getAddress()
      this.lastError = null
      logger.info('[virtuals-acp] started', {
        agentAddress: this.agentAddress,
        chainId: config.chainId,
        autoLlm: config.autoLlmEnabled,
        autoFund: config.autoFundEnabled,
        maxBudgetUsdc: config.maxBudgetUsdc,
        activeSessions: agent.sessions.length,
      })
      return { started: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.lastError = message
      logger.error('[virtuals-acp] start failed', { error: message })
      this.agent = null
      return { started: false, reason: message }
    }
  }

  async stop(): Promise<void> {
    const agent = this.agent
    this.agent = null
    this.config = null
    if (!agent) return
    try {
      await agent.stop()
      logger.info('[virtuals-acp] stopped')
    } catch (error) {
      logger.warn('[virtuals-acp] stop error', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  getStatus(): VirtualsAcpServiceStatus {
    return {
      running: this.running,
      startedAt: this.startedAt?.toISOString() ?? null,
      agentAddress: this.agentAddress,
      chainId: this.config?.chainId ?? null,
      autoLlmEnabled: this.config?.autoLlmEnabled ?? false,
      autoFundEnabled: this.config?.autoFundEnabled ?? false,
      maxBudgetUsdc: this.config?.maxBudgetUsdc ?? null,
      sessions: (this.agent?.sessions ?? []).map((session) => ({
        jobId: session.jobId,
        chainId: session.chainId,
        roles: [...session.roles],
        status: session.status,
      })),
      entriesHandled: this.entriesHandled,
      toolsExecuted: this.toolsExecuted,
      llmDecisions: {
        attempted: this.llmAttempted,
        unparseable: this.llmUnparseable,
        wait: this.llmWait,
        executed: this.llmExecuted,
        avgLatencyMs:
          this.llmAttempted > 0 ? Math.round(this.llmDecisionLatencyTotalMs / this.llmAttempted) : 0,
      },
      lastError: this.lastError,
    }
  }

  async browseAgents(keyword: string, topK = 5): Promise<AcpAgentDetail[]> {
    if (!this.agent) throw new Error('Virtuals ACP service is not running.')
    return this.agent.browseAgents(keyword, { topK })
  }

  private async handleEntry(session: JobSession, entry: JobRoomEntry): Promise<void> {
    const config = this.config
    if (!config) return
    this.entriesHandled += 1

    const entryLabel = entry.kind === 'system' ? `system:${entry.event.type}` : `message:${entry.contentType ?? 'text'}`
    logger.info('[virtuals-acp] entry', {
      jobId: session.jobId,
      chainId: session.chainId,
      roles: session.roles,
      status: session.status,
      entry: entryLabel,
    })

    if (!config.autoLlmEnabled) return
    if (!session.shouldRespond(entry)) return

    const sessionKey = `${session.chainId}:${session.jobId}`
    if (this.inFlightSessions.has(sessionKey)) return
    this.inFlightSessions.add(sessionKey)
    try {
      await this.runLlmDecision(session, config)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.lastError = message
      logger.warn('[virtuals-acp] entry handling failed', {
        jobId: session.jobId,
        error: message,
      })
    } finally {
      this.inFlightSessions.delete(sessionKey)
    }
  }

  private async runLlmDecision(session: JobSession, config: VirtualsAcpConfig): Promise<void> {
    const tools = filterToolsByPolicy(session.availableTools(), {
      autoFundEnabled: config.autoFundEnabled,
    })
    if (tools.length === 0) return

    const history = await session.toMessages()
    if (history.length === 0) return
    const decisionStartedAt = Date.now()
    this.llmAttempted += 1

    const systemPrompt = buildToolSystemPrompt({
      persona: config.persona,
      tools,
      roles: [...session.roles],
      status: session.status,
      maxBudgetUsdc: config.maxBudgetUsdc,
    })
    const transcript = history
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n')
      .slice(-6_000)

    const result = await getElizaLlmService().generateResponse({
      agentKey: 'virtuals-acp',
      userMessage: `Job conversation so far:\n${transcript}\n\nDecide the next action.`,
      systemPrompt,
      vaultContext: '',
      correlationId: `acp-${session.jobId}-${randomUUID().slice(0, 8)}`,
    })

    const decision = parseToolDecision(result.text, tools)
    if (decision.kind === 'none') {
      this.llmUnparseable += 1
      this.llmDecisionLatencyTotalMs += Date.now() - decisionStartedAt
      logger.warn('[virtuals-acp] no usable tool decision from LLM', {
        jobId: session.jobId,
        provider: result.provider,
        preview: (result.text ?? '').slice(0, 200),
      })
      return
    }
    if (decision.name === 'wait') {
      this.llmWait += 1
      this.llmDecisionLatencyTotalMs += Date.now() - decisionStartedAt
      return
    }

    const args = clampSpendArgs(decision.name, decision.args, config.maxBudgetUsdc)
    logger.info('[virtuals-acp] executing tool', {
      jobId: session.jobId,
      tool: decision.name,
      args,
      provider: result.provider,
    })
    await session.executeTool(decision.name, args)
    this.toolsExecuted += 1
    this.llmExecuted += 1
    this.llmDecisionLatencyTotalMs += Date.now() - decisionStartedAt
  }
}

let singleton: VirtualsAcpService | null = null

export function getVirtualsAcpService(): VirtualsAcpService {
  if (!singleton) singleton = new VirtualsAcpService()
  return singleton
}
