-- Cache table for minute bars used by arena backtests.
-- Server-side SQL clients use DATABASE_URL and bypass RLS, but keep RLS enabled
-- with a deny-all policy for Data API safety.

CREATE TABLE IF NOT EXISTS public.backtest_market_bars_1m (
  symbol text NOT NULL,
  market text NOT NULL,
  interval text NOT NULL DEFAULT '1m',
  bar_time timestamptz NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  volume numeric,
  source text NOT NULL DEFAULT 'hyperliquid',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT backtest_market_bars_1m_pk PRIMARY KEY (symbol, interval, bar_time),
  CONSTRAINT backtest_market_bars_1m_interval_check CHECK (interval = '1m')
);

CREATE INDEX IF NOT EXISTS backtest_market_bars_1m_symbol_time_idx
  ON public.backtest_market_bars_1m (symbol, bar_time DESC);

ALTER TABLE public.backtest_market_bars_1m ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS backtest_market_bars_1m_deny_public_rest ON public.backtest_market_bars_1m;
CREATE POLICY backtest_market_bars_1m_deny_public_rest
  ON public.backtest_market_bars_1m
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);
