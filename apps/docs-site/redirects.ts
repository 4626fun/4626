export type ClientRedirect = {
  from: string | string[];
  to: string;
};

/**
 * Legacy route redirects for docs.4626.fun.
 *
 * We intentionally keep this as an explicit map (vs pattern-based) so changes
 * are reviewable and predictable.
 *
 * Redirect targets should be canonical narrative-first routes.
 */
export const redirects: ClientRedirect[] = [
  // Docs reorg redirects (v1.7.1 epoch cleanup)
  { from: '/account-context', to: '/reference/account-context' },
  { from: '/chains', to: '/reference/chains' },
  { from: '/coins-metadata', to: '/reference/coins-metadata' },
  { from: '/current-contract-inventory', to: '/reference/current-contract-inventory' },
  { from: '/token-image', to: '/reference/token-image' },

  {
    from: '/telegram-canonical-link-preservation',
    to: '/operations/telegram-canonical-link-preservation',
  },

  {
    from: '/creator-workspace',
    to: '/frontend/creator-workspace',
  },
  {
    from: '/creator-workspace-implementation-plan',
    to: '/frontend/creator-workspace',
  },
  { from: '/frontend/creator-workspace-implementation-plan', to: '/frontend/creator-workspace' },
  { from: '/agent-skills', to: '/operators' },
  { from: '/agent-workflow', to: '/operators' },
  { from: '/operations/deployment/base-build', to: '/operations/deployment' },
  { from: '/operations/erc8004-agent-2205-discoverability', to: '/operations' },
  {
    from: '/superpowers/specs/2026-04-06-waitlist-allowlist-separation-design',
    to: '/developers',
  },
  { from: '/audits/github-supply-chain-setup', to: '/audits' },
  { from: '/audits/internal-monorepo-audit-2026-03-30', to: '/audits' },
  { from: '/audits/npm-advisories-triage', to: '/audits' },
  { from: '/audits/production-parity-checklist', to: '/audits' },
  { from: '/compressions/reading-order', to: '/compressions' },
  {
    from: '/primitives/game-loop/lottery-amoe-test-matrix',
    to: '/primitives/game-loop/lottery',
  },
  { from: ['/zora/MONOREPO_ARCHITECTURE', '/zora/monorepo_architecture'], to: '/protocols' },
  { from: ['/zora/PROTOCOL_KNOWLEDGE', '/zora/protocol_knowledge'], to: '/protocols' },

  { from: '/lens', to: '/integrations/lens' },
  { from: '/lens-grove', to: '/integrations/lens-grove' },
  {
    from: '/farcaster-close-gap-phases',
    to: '/integrations',
  },
  { from: '/solana-spoke-article', to: '/integrations/solana-spoke-article' },

  { from: '/security-scan-overview', to: '/security' },

  { from: '/ajna-erc4626-cre-adversarial-audit', to: '/audits/ajna/adversarial-audit' },
  { from: '/ajna-erc4626-cre-executive-brief', to: '/audits/ajna/executive-brief' },
  { from: '/ajna-erc4626-cre-master-qna', to: '/audits/ajna/master-qna' },
  {
    from: '/charm-alpha-vaults-v2-4626fun-adversarial-audit',
    to: '/audits/charm/adversarial-audit',
  },
  {
    from: '/charm-alpha-vaults-v2-4626fun-executive-brief',
    to: '/audits/charm/executive-brief',
  },
  { from: '/charm-alpha-vaults-v2-4626fun-master-qa', to: '/audits/charm/master-qa' },
  { from: '/codex-security-findings', to: '/audits/codex/security-second-pass-review' },
  {
    from: '/codex-security-second-pass-review',
    to: '/audits/codex/security-second-pass-review',
  },
  { from: '/breakout-report', to: '/audits/token-image' },
  {
    from: '/deep-research-report',
    to: '/audits/token-image',
  },
  {
    from: ['/deep-research-report-1', '/deep-research-report-(1)'],
    to: '/audits/token-image',
  },
  {
    from: ['/deep-research-report-2', '/deep-research-report-(2)'],
    to: '/audits/token-image',
  },
];
