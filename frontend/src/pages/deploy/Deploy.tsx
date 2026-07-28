import { Suspense, lazy } from 'react'

import { PageMeta } from '@/components/seo/PageMeta'
import { useScreenshotReady } from '@/lib/ui/screenshotMode'

const DeployChoiceCards = lazy(() => import('./DeployChoiceCards'))

const FALLBACK_CARD =
  'vault-surface vault-hover-lift rounded-2xl p-6 sm:p-8 border border-[rgb(var(--vault-border-strong)/0.6)] min-h-[320px]'

function ChoiceFallback() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-hidden>
      <div className={FALLBACK_CARD} />
      <div className={FALLBACK_CARD} />
    </div>
  )
}

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

            <Suspense fallback={<ChoiceFallback />}>
              <DeployChoiceCards />
            </Suspense>
          </div>
        </div>
      </section>
    </div>
  )
}
