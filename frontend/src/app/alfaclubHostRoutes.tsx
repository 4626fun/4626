import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AppLoadingRegistrar } from '@/components/layout/AppLoadingOverlay'
import { Layout } from '@/components/layout/Layout'
import {
  ALFACLUB_INVERSE_AKITA_PATH,
  ALFACLUB_POOLS_PATH,
  ALFACLUB_ROOMS_PATH,
  ALFACLUB_SAFETY_PATH,
  buildAlfaClubAbsoluteUrl,
  buildAlfaClubRedirectLocation,
  resolveAlfaClubCanonicalPath,
} from '@/lib/alfaclub/hostPaths'
import { isCurrentWindowUrl } from '@/lib/env/host'
import { AccountContextProvider } from '@/wallet/accountContext'

import {
  AlfaClubInverseAkita,
  AlfaClubTradingRooms,
  LazyAccessBoundary,
  LazyGuardedOutlet,
  LazyPrivyBoundary,
} from './lazyRoutes'

/** Preserve query/hash while redirecting to a same-host canonical path. */
export function RedirectPreserve(props: { to: string }) {
  const location = useLocation()
  return <Navigate to={`${props.to}${location.search}${location.hash}`} replace />
}

/** Merge query/hash while forcing legacy safety/liquidity aliases into the room hub tab. */
export function AlfaClubHubRedirect() {
  const location = useLocation()
  return (
    <Navigate
      to={buildAlfaClubRedirectLocation({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      })}
      replace
    />
  )
}

/** Hard cross-origin redirect to the AlfaClub product host. */
export function AlfaClubHostRedirect(props: { pathname: string }) {
  const location = useLocation()
  const target = buildAlfaClubAbsoluteUrl({
    pathname: props.pathname,
    search: location.search,
    hash: location.hash,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isCurrentWindowUrl(target)) return
    window.location.replace(target)
  }, [target])

  return <AppLoadingRegistrar label="alfaclub-host-redirect" />
}

/**
 * Legacy AlfaClub paths on app/marketing hosts → alfaclub.4626.fun canonical
 * short paths. Prefer vercel.json 308s; this covers in-SPA navigations.
 */
export function LegacyAlfaClubRedirect() {
  const location = useLocation()
  const canonical = resolveAlfaClubCanonicalPath(location.pathname)
  if (!canonical) return <Navigate to={ALFACLUB_ROOMS_PATH} replace />
  return <AlfaClubHostRedirect pathname={location.pathname} />
}

export function AlfaClubLayout() {
  return (
    <AccountContextProvider>
      <Layout interactive chatEnabled={false} />
    </AccountContextProvider>
  )
}

/** Dedicated AlfaClub product shell mounted only on alfaclub.4626.fun. */
export function AlfaClubHostApp() {
  return (
    <Routes>
      <Route element={<LazyGuardedOutlet guard={LazyAccessBoundary} />}>
        <Route element={<LazyGuardedOutlet guard={LazyPrivyBoundary} />}>
          <Route element={<AlfaClubLayout />}>
            <Route index element={<RedirectPreserve to={ALFACLUB_ROOMS_PATH} />} />
            <Route path={ALFACLUB_ROOMS_PATH} element={<AlfaClubTradingRooms />} />
            <Route path={ALFACLUB_INVERSE_AKITA_PATH} element={<AlfaClubInverseAkita />} />
            <Route path={ALFACLUB_SAFETY_PATH} element={<AlfaClubHubRedirect />} />
            <Route path={ALFACLUB_POOLS_PATH} element={<AlfaClubHubRedirect />} />

            <Route path="/trading-rooms" element={<RedirectPreserve to={ALFACLUB_ROOMS_PATH} />} />
            <Route path="/key-safety" element={<AlfaClubHubRedirect />} />
            <Route path="/liquidity" element={<AlfaClubHubRedirect />} />
            <Route path="/liquidity-pools" element={<AlfaClubHubRedirect />} />
            <Route path="/alfaclub" element={<RedirectPreserve to={ALFACLUB_ROOMS_PATH} />} />
            <Route
              path="/alfaclub/trading-rooms"
              element={<RedirectPreserve to={ALFACLUB_ROOMS_PATH} />}
            />
            <Route
              path="/alfaclub/key-safety"
              element={<AlfaClubHubRedirect />}
            />
            <Route
              path="/alfaclub/liquidity"
              element={<AlfaClubHubRedirect />}
            />
            <Route
              path="/alfaclub/liquidity-pools"
              element={<AlfaClubHubRedirect />}
            />

            <Route path="*" element={<RedirectPreserve to={ALFACLUB_ROOMS_PATH} />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
