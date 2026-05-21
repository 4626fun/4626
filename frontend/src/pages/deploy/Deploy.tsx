import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { PageMeta } from '@/components/seo/PageMeta'
import { useScreenshotReady } from '@/lib/ui/screenshotMode'

const CARD_BASE =
  'vault-surface vault-hover-lift rounded-2xl p-6 sm:p-8 border border-[rgb(var(--vault-border-strong)/0.6)]'

export function Deploy() {
  useScreenshotReady(true)

  return (
    <div className="vault-shell relative">
      <PageMeta
        title="Deploy"
        description="Choose between launching your Creator Coin or deploying your Vault."
        canonicalPath="/deploy"
      />

      <section className="cinematic-section">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="space-y-8">
            <div className="space-y-2">
              <span className="label">Deploy</span>
              <h1 className="headline text-4xl sm:text-6xl">Choose Flow</h1>
              <p className="text-zinc-600 text-sm font-light">
                Start with Coin to launch your Zora Creator Coin, then move to Vault to deploy the 4626 vault.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <article className={CARD_BASE}>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-brand-primary/80">1. Coin</div>
                  <h2 className="text-2xl font-medium text-white">Launch Creator Coin</h2>
                  <p className="text-sm text-zinc-400">
                    Launch your Zora Creator Coin on Base with sponsored gas and metadata tooling.
                  </p>
                </div>
                <div className="mt-5">
                  <Button variant="primary" asChild>
                    <Link to="/deploy/coin">Go To Coin</Link>
                  </Button>
                </div>
              </article>

              <article className={CARD_BASE}>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-brand-primary/80">2. Vault</div>
                  <h2 className="text-2xl font-medium text-white">Deploy Vault</h2>
                  <p className="text-sm text-zinc-400">
                    Use your Creator Coin to deploy the full vault stack and continue launch operations.
                  </p>
                </div>
                <div className="mt-5">
                  <Button variant="primary" asChild>
                    <Link to="/deploy/vault">Go To Vault</Link>
                  </Button>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
