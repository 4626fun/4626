import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface RefreshResult {
  success: boolean;
  message: string;
  timestamp: string;
}

interface HealthRow {
  table_name: string;
  row_count: number | string;
  last_refresh: string | null;
  retention_note: string | null;
}

interface RefreshRow {
  job: string;
  last_run: string | null;
}

interface HealthData {
  health: HealthRow[];
  lastRefreshes: RefreshRow[];
  indexUsage?: any[];
  unusedIndexes?: any[];
  slowChartQueries?: any[];
  recommendedIndexes?: Array<{
    name: string;
    definition: string;
    rationale: string;
    target: string;
    derived?: boolean;
    observedIn?: string;
    migrationFilename?: string;
    migrationContent?: string;
  }>;
  indexRecommendationsSummary?: {
    total: number;
    withLiveEvidence: number;
  };
  checkedAt: string;
  checkedBy: string;
}

export default function EthosChartRefresh() {
  const [loading, setLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(true);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);

  // Executable index drop state (safety: requires exact name re-type)
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  // Expandable slow query rows (indices into the slowChartQueries array)
  const [expandedSlow, setExpandedSlow] = useState<Set<number>>(new Set());

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/admin/ethos/health');
      if (!res.ok) throw new Error('Failed to load health');
      const data = await res.json();
      if (data.success) {
        setHealth(data.data);
      }
    } catch (e) {
      console.warn('Failed to load Ethos chart health', e);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const triggerRefresh = async (type: 'all' | 'distribution' | 'daily' | 'hourly' | '15min' | 'views') => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/ethos/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setResult({
        success: true,
        message: data.message || `Triggered ${type} refresh successfully`,
        timestamp: new Date().toISOString(),
      });

      // Refresh health after successful action
      setTimeout(fetchHealth, 1500);
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Failed to trigger refresh. Check admin logs.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const executeDrop = async (indexName: string) => {
    if (!indexName || confirmText !== indexName) {
      setResult({
        success: false,
        message: 'Confirmation text must exactly match the index name.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/ethos/indexes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'drop', indexName }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResult({
        success: true,
        message: data.message || `Dropped ${indexName} concurrently`,
        timestamp: new Date().toISOString(),
      });

      // Clear confirmation UI
      setDropTarget(null);
      setConfirmText('');

      // Refresh health so the dropped index disappears from the unused list
      setTimeout(fetchHealth, 1200);
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Failed to drop index. Check admin logs and verify the index is still in the unused list.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const startDropConfirmation = (indexName: string) => {
    setDropTarget(indexName);
    setConfirmText('');
    setResult(null);
  };

  const cancelDropConfirmation = () => {
    setDropTarget(null);
    setConfirmText('');
  };

  const toggleSlowQuery = (idx: number) => {
    setExpandedSlow(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Ethos Chart Data Refresh</h1>
        <p className="text-muted-foreground">
          Manage refreshes for the interconnected Ethos chart system (projection, snapshots, materialized views).
        </p>
      </div>

      {/* Health Section */}
      <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">System Health</h2>
          <Button variant="ghost" size="sm" onClick={fetchHealth} disabled={healthLoading}>
            {healthLoading ? 'Refreshing...' : 'Refresh Health'}
          </Button>
        </div>

        {healthLoading && !health ? (
          <div className="text-sm text-muted-foreground">Loading health...</div>
        ) : health ? (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-2 text-sm text-muted-foreground">Table Sizes &amp; Freshness</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Table / View</th>
                      <th className="py-2 pr-4">Rows</th>
                      <th className="py-2 pr-4">Last Refresh</th>
                      <th className="py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.health.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{row.table_name}</td>
                        <td className="py-2 pr-4">{Number(row.row_count).toLocaleString()}</td>
                        <td className="py-2 pr-4 text-xs">
                          {row.last_refresh ? new Date(row.last_refresh).toLocaleString() : '—'}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{row.retention_note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2 text-sm text-muted-foreground">Last Background Refreshes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {health.lastRefreshes.map((r, i) => (
                  <div key={i} className="flex justify-between border rounded px-3 py-1.5 text-xs">
                    <span className="font-mono">{r.job}</span>
                    <span className="text-muted-foreground">
                      {r.last_run ? new Date(r.last_run).toLocaleString() : 'never'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {health.indexUsage && health.indexUsage.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 text-sm text-muted-foreground">Top Index Usage (Ethos Tables)</h3>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-1 pr-2">Index</th>
                        <th className="py-1 pr-2">Scans</th>
                        <th className="py-1 pr-2">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.indexUsage.slice(0, 8).map((row: any, i: number) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 pr-2 font-mono truncate max-w-[280px]">{row.index}</td>
                          <td className="py-1 pr-2">{Number(row.idx_scan).toLocaleString()}</td>
                          <td className="py-1 pr-2 text-muted-foreground">{row.index_size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Shows how much the many composite indexes on the unified Ethos tables are actually being used.
                </div>
              </div>
            )}

            {health.unusedIndexes && health.unusedIndexes.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 text-sm text-red-600">Potentially Unused Indexes (Cleanup Candidates)</h3>
                <p className="text-[10px] text-muted-foreground mb-2">
                  These have very low scan counts. Use the <strong>Drop</strong> button for a safe in-app <code>DROP INDEX CONCURRENTLY</code> (backend validates against the live unused list). Copy-paste SQL is provided as fallback for psql.
                </p>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-1 pr-2">Index</th>
                        <th className="py-1 pr-2">Scans</th>
                        <th className="py-1 pr-2">Size</th>
                        <th className="py-1 pr-2">Action</th>
                        <th className="py-1 pr-2 font-mono text-[10px]">Manual SQL (fallback)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.unusedIndexes.map((row: any, i: number) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 pr-2 font-mono truncate max-w-[240px]">{row.index}</td>
                          <td className="py-1 pr-2 text-red-600">{Number(row.idx_scan).toLocaleString()}</td>
                          <td className="py-1 pr-2 text-muted-foreground">{row.index_size}</td>
                          <td className="py-1 pr-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 border-red-600/50 hover:bg-red-950/30"
                              disabled={loading || dropTarget === row.index}
                              onClick={() => startDropConfirmation(row.index)}
                            >
                              Drop...
                            </Button>
                          </td>
                          <td className="py-1 pr-2 font-mono text-[10px] text-red-600">
                            DROP INDEX CONCURRENTLY IF EXISTS {row.index};
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Confirmation panel for executable drop (requires exact name match) */}
                {dropTarget && (
                  <div className="mt-3 rounded border border-red-600/40 bg-red-950/10 p-3 text-xs">
                    <div className="font-medium text-red-500 mb-1">Confirm destructive action</div>
                    <p className="text-muted-foreground mb-2">
                      This will run <code>DROP INDEX CONCURRENTLY</code> on the production Supabase instance for the unified Ethos chart tables.
                      The backend will refuse if the index is no longer in <code>ethos_unused_indexes</code>.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="flex-1">
                        <div className="text-[10px] mb-1 text-muted-foreground">Type the exact index name to enable the drop button:</div>
                        <input
                          type="text"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          placeholder={dropTarget}
                          className="w-full rounded bg-background border border-red-600/40 px-2 py-1 font-mono text-xs focus:outline-none focus:border-red-600"
                          disabled={loading}
                        />
                      </div>
                      <div className="flex gap-2 pt-1 sm:pt-5">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={loading || confirmText !== dropTarget}
                          onClick={() => executeDrop(dropTarget)}
                        >
                          {loading ? 'Dropping...' : 'EXECUTE DROP CONCURRENTLY'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelDropConfirmation} disabled={loading}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] text-red-500/80">
                      After success the health table will refresh and the row will disappear. This action is irreversible without a schema migration.
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-red-600 mt-2">
                  These indexes have very low usage (&lt;50 scans) and are &gt;5MB. Only drop after reviewing for 7+ days and confirming they are not used by any important query on the single interconnected Ethos source (creator_ethos_projection / v_explore_creators). Always prefer the in-app button over raw psql.
                </div>
              </div>
            )}

            {/* Slow / expensive chart queries observed via pg_stat_statements + our tagging */}
            {health.slowChartQueries && health.slowChartQueries.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 text-sm text-amber-600">Recent Expensive Chart Queries (Tagged)</h3>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Pulled from <code>ethos_expensive_chart_queries</code> (statements carrying <code>supabase-chart:*</code> tags or touching the unified Ethos tables). Use to validate that new composite indexes on the single source are helping the real 137+ chart workload.
                </p>
                <div className="overflow-x-auto text-[10px] font-mono bg-black/30 p-2 rounded max-h-[220px] overflow-y-auto">
                  {health.slowChartQueries.slice(0, 8).map((q: any, i: number) => {
                    const isExpanded = expandedSlow.has(i);
                    const full = String(q.query_sample || '');
                    const display = isExpanded ? full : (full.length > 160 ? full.slice(0, 160) + '...' : full);
                    return (
                      <div
                        key={i}
                        role="button"
                        tabIndex={0}
                        className="mb-1 border-b border-white/10 pb-1 last:border-0 cursor-pointer hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                        onClick={() => toggleSlowQuery(i)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleSlowQuery(i);
                          }
                        }}
                        title="Click or press Enter/Space to expand/collapse full query"
                      >
                        <span className="text-amber-400">[{q.chart_tag}]</span> mean {q.mean_ms}ms / total {q.total_ms}ms / {q.calls} calls
                        <div className="text-zinc-400 whitespace-pre-wrap break-all">{display}</div>
                        <div className="text-[9px] text-zinc-500 mt-0.5">
                          {isExpanded ? 'click to collapse' : 'click to expand full query text'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Suggested New Indexes — now with live derivation from slow query patterns */}
            {health.recommendedIndexes && health.recommendedIndexes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-sm text-emerald-600">Suggested New Indexes (from access patterns + live slow queries)</h3>
                  {health.indexRecommendationsSummary && (
                    <span className="text-[10px] rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400">
                      {health.indexRecommendationsSummary.withLiveEvidence} / {health.indexRecommendationsSummary.total} have live evidence
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">
                  High-value <code>CREATE INDEX CONCURRENTLY</code> candidates for the single interconnected source (<code>creator_ethos_projection</code> + <code>v_explore_creators</code> + snapshots). 
                  All Explore sorts (market cap, ethos, volume, recency, quality filters) remain pure <strong>ORDER BY</strong> on the same rows. Items with the amber badge were reinforced or added because they appeared in recent expensive chart-tagged queries.
                </p>
                <div className="space-y-2 text-xs">
                  {health.recommendedIndexes.map((rec, i) => (
                    <div key={i} className={`rounded p-2 ${rec.derived ? 'border border-amber-500/40 bg-amber-950/10' : 'border border-emerald-600/30 bg-emerald-950/10'}`}>
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-emerald-400">{rec.name}</div>
                        {rec.derived && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                            derived from live slow queries
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{rec.rationale}</div>
                      <div className="font-mono text-[10px] mt-1 bg-black/40 p-1.5 rounded break-all">
                        {rec.definition}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => navigator.clipboard?.writeText(rec.definition)}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 underline"
                        >
                          Copy CREATE statement
                        </button>
                        {rec.migrationContent && (
                          <button
                            onClick={() => {
                              const text = `-- Suggested filename: ${rec.migrationFilename}\n\n${rec.migrationContent}`;
                              navigator.clipboard?.writeText(text);
                            }}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 underline"
                          >
                            Copy full migration file
                          </button>
                        )}
                        <span className="text-[10px] text-muted-foreground">Target: {rec.target}</span>
                        {rec.observedIn && (
                          <span className="text-[9px] text-amber-400/80">observed in: {rec.observedIn}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-emerald-600/80 mt-1">
                  Advisory only. All proposals target the single source of truth. Apply via migration. No CREATEs are executed from the UI.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-red-500">Failed to load health data.</div>
        )}
      </div>

      {/* Refresh Controls */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Manual Refresh Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
            <h3 className="font-medium mb-3">Full Refresh (Recommended)</h3>
            <Button onClick={() => triggerRefresh('all')} disabled={loading} className="w-full">
              {loading ? 'Running...' : 'Refresh All (Distribution + Snapshots + Views)'}
            </Button>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
            <h3 className="font-medium mb-3">Granular Options</h3>
            <div className="flex flex-col gap-2">
              <Button variant="ghost" onClick={() => triggerRefresh('distribution')} disabled={loading}>
                Refresh Distribution Only
              </Button>
              <Button variant="ghost" onClick={() => triggerRefresh('daily')} disabled={loading}>
                Snapshot Daily
              </Button>
              <Button variant="ghost" onClick={() => triggerRefresh('hourly')} disabled={loading}>
                Snapshot Hourly
              </Button>
              <Button variant="ghost" onClick={() => triggerRefresh('15min')} disabled={loading}>
                Snapshot 15min (High Resolution)
              </Button>
              <Button variant="ghost" onClick={() => triggerRefresh('views')} disabled={loading}>
                Refresh Unified Materialized Views
              </Button>
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className={`rounded-2xl border border-white/5 bg-white/3 p-4 ${result.success ? 'border-green-500' : 'border-red-500'}`}>
          <div className="font-mono text-sm">
            <div className={result.success ? 'text-green-600' : 'text-red-600'}>
              {result.success ? 'SUCCESS' : 'ERROR'}
            </div>
            <div className="mt-1">{result.message}</div>
            <div className="text-xs text-muted-foreground mt-2">{result.timestamp}</div>
          </div>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        <p>
          These actions call the corresponding <code>refresh_*</code> / <code>snapshot_*</code> functions.
          Scheduled <code>pg_cron</code> jobs continue independently.
        </p>
        <p className="mt-1">
          Health data comes from <code>ethos_chart_system_health</code> and <code>ethos_last_refreshes</code> views.
        </p>
      </div>
    </div>
  );
}
