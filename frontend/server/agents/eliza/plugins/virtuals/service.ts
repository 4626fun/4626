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
 * - Only wait/sendMessage execute by default; mutating tools require the typed
 *   env allowlist and unknown tools deny.
 * - Invalid spend amounts are blocked; valid amounts are capped.
 * - Global and per-job execution quotas are consumed before dispatch.
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
import { parseBacktestRequestFromText, parseSignalRequestFromText, runRealBacktestJob, runCounterTradeSignal } from './backtestJobs.js'
import { evaluateBacktestPaymentGate } from './paymentGate.js'
import {
  buildStructuredToolProposal,
  buildToolSystemPrompt,
  evaluateToolExecutionPolicy,
  executeToolUnderPolicy,
  filterToolsByPolicy,
  parseToolDecision,
  validateToolArguments,
  validateAndClampSpendArgs,
  type AcpToolLike,
} from './toolLoop.js'
import { ToolExecutionQuota } from './toolQuota.js'

export type VirtualsAcpServiceStatus = {
  running: boolean
  ready: boolean
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

const TERMINAL_SESSION_STATUSES = new Set(['completed', 'rejected', 'expired'])
const MAX_STATUS_SESSIONS = 100

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
  private transportReady = false
  private readonly inFlightSessions = new Set<string>()
  private toolQuota: ToolExecutionQuota | null = null

  get running(): boolean {
    return this.agent !== null
  }

  get ready(): boolean {
    return this.agent !== null && this.transportReady
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

    let candidate: AcpAgent | null = null
    try {
      this.transportReady = false
      const provider = await PrivyAlchemyEvmProviderAdapter.create({
        walletAddress: config.walletAddress!,
        walletId: config.walletId!,
        signerPrivateKey: config.signerPrivateKey!,
        chains: [chain],
      })
      candidate = await AcpAgent.create({ provider })
      candidate.on('entry', (session, entry) => {
        void this.handleEntry(session, entry)
      })
      await candidate.start(() => {
        this.transportReady = true
        logger.info('[virtuals-acp] connected — listening for ACP jobs')
      })

      const agentAddress = await candidate.getAddress()
      const toolQuota = new ToolExecutionQuota(
        config.globalToolExecutionQuota,
        config.perJobToolExecutionQuota,
      )

      this.agent = candidate
      this.config = config
      this.toolQuota = toolQuota
      this.startedAt = new Date()
      this.agentAddress = agentAddress
      this.lastError = null
      logger.info('[virtuals-acp] started', {
        agentAddress: this.agentAddress,
        chainId: config.chainId,
        autoLlm: config.autoLlmEnabled,
        autoFund: config.autoFundEnabled,
        maxBudgetUsdc: config.maxBudgetUsdc,
        activeSessions: candidate.sessions.length,
      })
      return { started: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (candidate) {
        try {
          await candidate.stop()
        } catch (stopError) {
          logger.warn('[virtuals-acp] failed candidate cleanup error', {
            error: stopError instanceof Error ? stopError.message : String(stopError),
          })
        }
      }
      this.lastError = message
      logger.error('[virtuals-acp] start failed', { error: message })
      this.agent = null
      this.transportReady = false
      this.config = null
      this.toolQuota = null
      this.startedAt = null
      this.agentAddress = null
      this.inFlightSessions.clear()
      return { started: false, reason: message }
    }
  }

  async stop(): Promise<void> {
    const agent = this.agent
    this.agent = null
    this.transportReady = false
    this.config = null
    this.toolQuota = null
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
      ready: this.ready,
      startedAt: this.startedAt?.toISOString() ?? null,
      agentAddress: this.agentAddress,
      chainId: this.config?.chainId ?? null,
      autoLlmEnabled: this.config?.autoLlmEnabled ?? false,
      autoFundEnabled: this.config?.autoFundEnabled ?? false,
      maxBudgetUsdc: this.config?.maxBudgetUsdc ?? null,
      sessions: (this.agent?.sessions ?? [])
        .filter((session) => !TERMINAL_SESSION_STATUSES.has(session.status))
        .slice(-MAX_STATUS_SESSIONS)
        .map((session) => ({
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

  private async executeSessionTool(
    session: JobSession,
    name: string,
    args: Record<string, unknown>,
  ): Promise<boolean> {
    const config = this.config
    if (!config) return false
    const tool = session.availableTools().find((candidate) => candidate.name === name)
    if (!tool) {
      logger.warn('[virtuals-acp] tool no longer available at dispatch boundary', { tool: name })
      return false
    }
    const jobKey = `${session.chainId}:${session.jobId}`
    const result = await executeToolUnderPolicy({
      tool,
      args,
      maxBudgetUsdc: config.maxBudgetUsdc,
      executableHighRiskTools: config.executableHighRiskTools,
      dispatch: async (safeArgs) => {
        const quota = this.toolQuota?.reserve(jobKey)
        if (!quota?.allowed) {
          logger.warn('[virtuals-acp] tool execution blocked by quota', {
            tool: name,
            reason: quota && !quota.allowed ? quota.reason : 'quota_unavailable',
          })
          return false
        }
        await session.executeTool(name, safeArgs)
        this.toolsExecuted += 1
        return true
      },
    })
    if (!result.executed && result.reason !== 'dispatch_denied') {
      logger.info('[virtuals-acp] tool execution denied by deterministic policy', {
        tool: name,
        reason: result.reason,
      })
    }
    return result.executed
  }

  private async sendSessionMessage(
    session: JobSession,
    content: string,
    contentType: 'text' | 'proposal' | 'structured' = 'text',
  ): Promise<boolean> {
    const jobKey = `${session.chainId}:${session.jobId}`
    const quota = this.toolQuota?.reserve(jobKey)
    if (!quota?.allowed) {
      logger.warn('[virtuals-acp] message blocked by quota', {
        contentType,
        reason: quota && !quota.allowed ? quota.reason : 'quota_unavailable',
      })
      return false
    }
    await session.sendMessage(content, contentType)
    this.toolsExecuted += 1
    return true
  }

  private async sendToolProposal(
    session: JobSession,
    tool: AcpToolLike,
    args: Record<string, unknown>,
  ): Promise<boolean> {
    return this.sendSessionMessage(
      session,
      buildStructuredToolProposal(tool.name, args),
      'proposal',
    )
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

    if (
      entry.kind === 'system' &&
      ['job.completed', 'job.rejected', 'job.expired'].includes(entry.event.type)
    ) {
      this.toolQuota?.forgetJob(`${session.chainId}:${session.jobId}`)
    }

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
    const latestUserMessage = [...history]
      .reverse()
      .find((message) => message.role === 'user')?.content
    const backtestRequest =
      typeof latestUserMessage === 'string' ? parseBacktestRequestFromText(latestUserMessage) : null
    if (backtestRequest) {
      if (!session.job) await session.fetchJob()
      const paymentGate = evaluateBacktestPaymentGate(session as unknown)
      if (!paymentGate.allowed) {
        await this.sendSessionMessage(
          session,
          'Backtest requires a funded paid job before execution. ' +
            `Current payment signal: ${paymentGate.reason}. ` +
            'Please fund the job in ACP, then resend your backtest request.',
        )
        logger.info('[virtuals-acp] blocked unpaid backtest request', {
          jobId: session.jobId,
          status: session.status,
          reason: paymentGate.reason,
          amountUsdc: paymentGate.amountUsdc,
        })
        return
      }
      try {
        const backtest = await runRealBacktestJob(backtestRequest)
        await this.sendSessionMessage(session, backtest.responseText)
        // Formally submit the deliverable so the ACP job transitions to
        // "submitted" and the client can complete it. Without this, the job
        // stays in "funded" forever — the result is visible in the job room
        // but the protocol never records a deliverable, so success rate
        // stays 0% and revenue never settles.
        try {
          await session.submit(backtest.responseText)
          logger.info('[virtuals-acp] submitted backtest deliverable', {
            jobId: session.jobId,
            symbol: backtestRequest.symbol,
            windowHours: backtestRequest.windowHours,
          })
        } catch (submitError) {
          const submitMsg = submitError instanceof Error ? submitError.message : String(submitError)
          logger.warn('[virtuals-acp] deliverable submit failed (message already sent)', {
            jobId: session.jobId,
            error: submitMsg,
          })
        }
        logger.info('[virtuals-acp] executed backtest job', {
          jobId: session.jobId,
          symbol: backtestRequest.symbol,
          leveragePercent: backtestRequest.leveragePercent,
          rebalanceHealthPercent: backtestRequest.rebalanceHealthPercent,
          rebalanceSizePercent: backtestRequest.rebalanceSizePercent,
          windowHours: backtestRequest.windowHours,
          resolvedInterval: backtest.resolvedInterval,
        })
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Backtest failed due to an unknown runtime error'
        await this.sendSessionMessage(
          session,
          `Backtest request failed: ${message}. ` +
            'Please retry with shorter window (for example 24h/72h) or BTC/ETH if data coverage is missing.',
        )
        logger.warn('[virtuals-acp] backtest job failed', {
          jobId: session.jobId,
          symbol: backtestRequest.symbol,
          message,
        })
      }
      return
    }
    // Counter-trade signal handler — lightweight directional read for the
    // `counterTradeSignal` offering. Runs a 7-day backtest and derives
    // long-bias / short-bias / neutral + conviction. Formally submits the
    // deliverable so the job completes in the ACP protocol.
    const signalSymbol =
      typeof latestUserMessage === 'string' ? parseSignalRequestFromText(latestUserMessage) : null
    if (signalSymbol) {
      if (!session.job) await session.fetchJob()
      const paymentGate = evaluateBacktestPaymentGate(session as unknown)
      if (!paymentGate.allowed) {
        await this.sendSessionMessage(
          session,
          'Signal request requires a funded paid job before execution. ' +
            `Current payment signal: ${paymentGate.reason}. ` +
            'Please fund the job in ACP, then resend your signal request.',
        )
        logger.info('[virtuals-acp] blocked unpaid signal request', {
          jobId: session.jobId,
          status: session.status,
          reason: paymentGate.reason,
        })
        return
      }
      try {
        const signal = await runCounterTradeSignal(signalSymbol)
        await this.sendSessionMessage(session, signal.responseText)
        try {
          await session.submit(signal.responseText)
          logger.info('[virtuals-acp] submitted counter-trade signal deliverable', {
            jobId: session.jobId,
            symbol: signalSymbol,
            signal: signal.signal,
            conviction: signal.conviction,
          })
        } catch (submitError) {
          const submitMsg = submitError instanceof Error ? submitError.message : String(submitError)
          logger.warn('[virtuals-acp] signal submit failed (message already sent)', {
            jobId: session.jobId,
            error: submitMsg,
          })
        }
        logger.info('[virtuals-acp] executed counter-trade signal', {
          jobId: session.jobId,
          symbol: signalSymbol,
          signal: signal.signal,
          conviction: signal.conviction,
          resolvedInterval: signal.resolvedInterval,
        })
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Signal computation failed due to an unknown runtime error'
        await this.sendSessionMessage(
          session,
          `Signal request failed: ${message}. Please retry with a different symbol (BTC, ETH, SOL, HYPE).`,
        )
        logger.warn('[virtuals-acp] counter-trade signal failed', {
          jobId: session.jobId,
          symbol: signalSymbol,
          message,
        })
      }
      return
    }
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

    const selectedTool = tools.find((tool) => tool.name === decision.name)
    if (!selectedTool) {
      this.llmDecisionLatencyTotalMs += Date.now() - decisionStartedAt
      return
    }
    const spend = validateAndClampSpendArgs(decision.name, decision.args, config.maxBudgetUsdc)
    if (!spend.valid || !validateToolArguments(selectedTool, spend.args)) {
      this.llmDecisionLatencyTotalMs += Date.now() - decisionStartedAt
      logger.warn('[virtuals-acp] invalid tool args blocked', {
        tool: decision.name,
        reason: spend.valid ? 'invalid_tool_arguments' : spend.reason,
      })
      return
    }
    const args = spend.args
    const executionPolicy = evaluateToolExecutionPolicy(
      decision.name,
      config.executableHighRiskTools,
    )
    if (!executionPolicy.allowed) {
      this.llmDecisionLatencyTotalMs += Date.now() - decisionStartedAt
      if (executionPolicy.reason === 'mutating_tool_proposal_only') {
        await this.sendToolProposal(session, selectedTool, args)
      }
      logger.info('[virtuals-acp] tool blocked by execution policy', {
        tool: decision.name,
        reason: executionPolicy.reason,
      })
      return
    }
    logger.info('[virtuals-acp] executing tool', {
      jobId: session.jobId,
      tool: decision.name,
      argumentNames: Object.keys(args),
      provider: result.provider,
    })
    const executed = await this.executeSessionTool(session, decision.name, args)
    if (executed) this.llmExecuted += 1
    this.llmDecisionLatencyTotalMs += Date.now() - decisionStartedAt
  }
}

let singleton: VirtualsAcpService | null = null

export function getVirtualsAcpService(): VirtualsAcpService {
  if (!singleton) singleton = new VirtualsAcpService()
  return singleton
}
