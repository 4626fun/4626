export type HedgePosition = {
  asset: string
  side: 'LONG' | 'SHORT'
  notionalUsd: number
  entryPrice?: number
  leverage?: number
  liquidationPrice?: number
}

export type HedgeRecommendation = {
  before: {
    grossExposureUsd: number
    netExposureUsd: number
  }
  after: {
    grossExposureUsd: number
    netExposureUsd: number
  }
  candidateHedge: {
    asset: string
    side: 'LONG' | 'SHORT'
    notionalUsdMin: number
    notionalUsdMax: number
  } | null
  modeledRiskReductionPctBand: [number, number]
  estimatedCostIncreaseBps: number
  removalConditions: string[]
  residualRisks: string[]
  shadow_only: true
  methodology_version: string
  generated_at: string
}

export function recommendPortfolioHedge(params: {
  positions: HedgePosition[]
  collateralUsd: number
  maximumAdditionalMarginUsd?: number
  riskObjective: 'reduce_8h_drawdown' | 'reduce_beta' | 'reduce_liquidation_proximity'
}): HedgeRecommendation {
  const gross = params.positions.reduce((sum, pos) => sum + Math.abs(pos.notionalUsd), 0)
  const net = params.positions.reduce(
    (sum, pos) => sum + (pos.side === 'LONG' ? pos.notionalUsd : -pos.notionalUsd),
    0,
  )

  const dominant = [...params.positions].sort(
    (a, b) => Math.abs(b.notionalUsd) - Math.abs(a.notionalUsd),
  )[0]

  if (!dominant || !(params.collateralUsd > 0) || gross <= 0) {
    return {
      before: { grossExposureUsd: gross, netExposureUsd: net },
      after: { grossExposureUsd: gross, netExposureUsd: net },
      candidateHedge: null,
      modeledRiskReductionPctBand: [0, 0],
      estimatedCostIncreaseBps: 0,
      removalConditions: ['no_valid_positions'],
      residualRisks: ['Unable to model hedge without valid positions/collateral'],
      shadow_only: true,
      methodology_version: 'portfolio-hedge-v1.0.0',
      generated_at: new Date().toISOString(),
    }
  }

  const hedgeSide: 'LONG' | 'SHORT' = dominant.side === 'LONG' ? 'SHORT' : 'LONG'
  const maxMargin = params.maximumAdditionalMarginUsd ?? params.collateralUsd * 0.1
  const notionalMax = Math.min(Math.abs(dominant.notionalUsd) * 0.35, maxMargin * 5)
  const notionalMin = notionalMax * 0.7
  const afterNet =
    net + (hedgeSide === 'LONG' ? notionalMax : -notionalMax)
  const afterGross = gross + notionalMax

  const reductionLow =
    params.riskObjective === 'reduce_liquidation_proximity'
      ? 12
      : params.riskObjective === 'reduce_beta'
        ? 15
        : 18
  const reductionHigh = reductionLow + 8

  return {
    before: {
      grossExposureUsd: Number(gross.toFixed(2)),
      netExposureUsd: Number(net.toFixed(2)),
    },
    after: {
      grossExposureUsd: Number(afterGross.toFixed(2)),
      netExposureUsd: Number(afterNet.toFixed(2)),
    },
    candidateHedge: {
      asset: dominant.asset.toUpperCase() === 'HYPE' ? 'BTC' : dominant.asset.toUpperCase(),
      side: hedgeSide,
      notionalUsdMin: Number(notionalMin.toFixed(2)),
      notionalUsdMax: Number(notionalMax.toFixed(2)),
    },
    modeledRiskReductionPctBand: [reductionLow, reductionHigh],
    estimatedCostIncreaseBps: 9,
    removalConditions: [
      'Remove hedge if portfolio net exposure returns inside risk budget',
      'Remove if funding drag exceeds modeled risk reduction',
    ],
    residualRisks: [
      'Hedge does not eliminate risk',
      'Correlation can break during liquidation cascades',
      'Modeled drawdown reduction is a band, not a guarantee',
    ],
    shadow_only: true,
    methodology_version: 'portfolio-hedge-v1.0.0',
    generated_at: new Date().toISOString(),
  }
}
