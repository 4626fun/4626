import { Link, useParams } from 'react-router-dom'

import { PageMeta } from '@/components/seo/PageMeta'
import { Button } from '@/components/ui/Button'

export function AcpBacktestReportPage() {
  const params = useParams<{ jobId: string }>()
  const jobId = String(params.jobId ?? '').trim()
  const canonicalPath = jobId ? `/acp/backtest/${jobId}` : '/acp/backtest'

  return (
    <div className="relative min-h-0 w-full bg-transparent text-white">
      <PageMeta
        title="ACP Backtest Report"
        description="Backtest report delivery route for ACP job results."
        canonicalPath={canonicalPath}
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">4626</div>
        <div className="card rounded-xl p-8 space-y-4">
          <div className="text-xl font-medium">ACP Backtest Report</div>
          <div className="text-sm text-zinc-400">
            {jobId ? (
              <>
                Report link confirmed for job <span className="font-mono text-zinc-300">{jobId}</span>.
              </>
            ) : (
              'Missing job id in URL.'
            )}
          </div>
          <div className="text-xs text-zinc-500">
            Backtest report hosting is now canonical on <span className="font-mono text-zinc-300">app.4626.fun</span>.
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" asChild>
              <Link to="/arena/backtest">Open Arena Backtest</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
