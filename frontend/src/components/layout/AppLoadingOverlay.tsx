import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import { useReducedMotion, motion } from 'framer-motion'

import { AppLoadingState } from '@/components/layout/AppLoadingState'
import { LOADING_INTENT_CONFIG } from '@/components/layout/appLoadingIntents'
import { BASE_EASE, DURATION } from '@/components/brand/motion'
import { cn } from '@/lib/shared/utils'

const APP_LOADING_HEADLINE = LOADING_INTENT_CONFIG.page.headline
const APP_LOADING_SR_STATUS = LOADING_INTENT_CONFIG.page.srStatus
const APP_LOADING_SCROLL_LOCK_CLASS = 'app-loading-scroll-lock'
/** Bridge brief gaps when sequential bootstrap registrars hand off. */
const APP_LOADING_HIDE_DELAY_MS = 280
/** After this long, log which registrars are still holding the overlay so stuck loads are diagnosable.
 * Keep this close to auth/bootstrap timeout windows to avoid noisy false alarms during transient dev reconnects.
 */
const APP_LOADING_STUCK_WARN_MS = 20_000

type AppLoadingStore = {
  count: number
  labels: Map<string, number>
  listeners: Set<() => void>
}

function createAppLoadingStore(): AppLoadingStore {
  return {
    count: 0,
    labels: new Map(),
    listeners: new Set(),
  }
}

const AppLoadingStoreContext = createContext<AppLoadingStore | null>(null)

function subscribe(store: AppLoadingStore, listener: () => void) {
  store.listeners.add(listener)
  return () => {
    store.listeners.delete(listener)
  }
}

function increment(store: AppLoadingStore, label: string) {
  store.count += 1
  store.labels.set(label, (store.labels.get(label) ?? 0) + 1)
  for (const listener of store.listeners) listener()
}

function decrement(store: AppLoadingStore, label: string) {
  if (store.count <= 0) return
  store.count -= 1
  const labelCount = store.labels.get(label) ?? 0
  if (labelCount <= 1) store.labels.delete(label)
  else store.labels.set(label, labelCount - 1)
  for (const listener of store.listeners) listener()
}

function describeHolders(store: AppLoadingStore): string {
  if (store.labels.size === 0) return '(none)'
  return [...store.labels.entries()].map(([label, count]) => (count > 1 ? `${label} x${count}` : label)).join(', ')
}

function getSnapshot(store: AppLoadingStore): boolean {
  return store.count > 0
}

export function AppLoadingProvider(props: { children: ReactNode }) {
  const store = useMemo(() => createAppLoadingStore(), [])
  return <AppLoadingStoreContext.Provider value={store}>{props.children}</AppLoadingStoreContext.Provider>
}

function useAppLoadingStore() {
  const store = useContext(AppLoadingStoreContext)
  if (!store) {
    throw new Error('AppLoadingRegistrar must be used within AppLoadingProvider')
  }
  return store
}

export function useOptionalAppLoadingActive(): boolean {
  const store = useContext(AppLoadingStoreContext)
  return useSyncExternalStore(
    store ? (listener) => subscribe(store, listener) : () => () => {},
    () => (store ? getSnapshot(store) : false),
    () => false,
  )
}

function useStableLoadingVisibility(rawActive: boolean): boolean {
  const [lingerVisible, setLingerVisible] = useState(rawActive)

  useLayoutEffect(() => {
    if (!rawActive) {
      const hideId = window.setTimeout(() => setLingerVisible(false), APP_LOADING_HIDE_DELAY_MS)
      return () => window.clearTimeout(hideId)
    }

    const showId = window.setTimeout(() => setLingerVisible(true), 0)
    return () => window.clearTimeout(showId)
  }, [rawActive])

  if (rawActive) return true
  return lingerVisible
}

function useAppLoadingScrollLock(locked: boolean) {
  useLayoutEffect(() => {
    if (typeof document === 'undefined' || !locked) return

    const { documentElement, body } = document
    documentElement.classList.add(APP_LOADING_SCROLL_LOCK_CLASS)
    body.classList.add(APP_LOADING_SCROLL_LOCK_CLASS)

    return () => {
      documentElement.classList.remove(APP_LOADING_SCROLL_LOCK_CLASS)
      body.classList.remove(APP_LOADING_SCROLL_LOCK_CLASS)
    }
  }, [locked])
}

/** True while bootstrap registrars are active or the overlay is finishing its hide delay. */
export function useAppLoadingShellActive(): boolean {
  const active = useOptionalAppLoadingActive()
  const visible = useStableLoadingVisibility(active)
  return active || visible
}

/**
 * Full-screen bootstrap handoff: register the shared overlay and keep route
 * content out of the document until the gate closes.
 */
export function AppLoadingBootstrapGate(props: { active: boolean; children: ReactNode; label?: string }) {
  const reduceMotion = useReducedMotion()

  if (props.active) {
    return <AppLoadingRegistrar label={props.label} />
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: DURATION.standard, ease: BASE_EASE }
      }
    >
      {props.children}
    </motion.div>
  )
}

/** Register a full-screen bootstrap load. Always renders one shared overlay copy. */
export function AppLoadingRegistrar(props: { label?: string } = {}) {
  const store = useAppLoadingStore()
  const label = props.label ?? 'unlabeled'

  useLayoutEffect(() => {
    increment(store, label)
    return () => decrement(store, label)
  }, [store, label])

  return null
}

/** Warn (with holder labels) when the bootstrap overlay stays up suspiciously long. */
function useStuckLoadingWatchdog(active: boolean, store: AppLoadingStore | null) {
  useEffect(() => {
    if (!active || !store) return
    const startedAt = Date.now()
    const id = window.setInterval(() => {
      const heldForS = Math.round((Date.now() - startedAt) / 1000)
      console.warn(`[app-loading] overlay still active after ${heldForS}s — held by: ${describeHolders(store)}`)
    }, APP_LOADING_STUCK_WARN_MS)
    return () => window.clearInterval(id)
  }, [active, store])
}

export function AppLoadingOverlay() {
  const store = useContext(AppLoadingStoreContext)
  const active = useOptionalAppLoadingActive()
  const visible = useStableLoadingVisibility(active)
  const reduceMotion = useReducedMotion()
  useAppLoadingScrollLock(active || visible)
  useStuckLoadingWatchdog(active, store)

  if (!visible && !active) return null

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'fixed inset-0 z-[120] h-[100dvh] max-h-[100dvh] w-full overflow-hidden transition-opacity',
        visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
      style={{
        transitionDuration: reduceMotion ? '0ms' : '180ms',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <AppLoadingState
        intent="page"
        labelOverride={APP_LOADING_HEADLINE}
        srStatusOverride={APP_LOADING_SR_STATUS}
        stabilizePattern
        fillContainer
      />
    </div>
  )
}
