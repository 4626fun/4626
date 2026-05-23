import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { AppLoadingState } from '@/components/layout/AppLoadingState'
import {
  getLoadingIntentConfig,
  resolveOverlayHeadline,
  type LoadingIntent,
} from '@/components/layout/appLoadingIntents'

type LoadingRegistration = {
  intent: LoadingIntent
  labelOverride?: string
  srStatusOverride?: string
}

type RegistryEntry = LoadingRegistration & {
  id: symbol
}

const INTENT_PRIORITY: Record<LoadingIntent, number> = {
  redirect: 100,
  deploy: 90,
  session: 70,
  page: 50,
  processing: 30,
}

type AppLoadingStore = {
  entries: Map<symbol, RegistryEntry>
  listeners: Set<() => void>
}

function createAppLoadingStore(): AppLoadingStore {
  return {
    entries: new Map(),
    listeners: new Set(),
  }
}

const AppLoadingStoreContext = createContext<AppLoadingStore | null>(null)

function pickActiveEntry(entries: Iterable<RegistryEntry>): RegistryEntry | null {
  let winner: RegistryEntry | null = null
  for (const entry of entries) {
    if (!winner || INTENT_PRIORITY[entry.intent] > INTENT_PRIORITY[winner.intent]) {
      winner = entry
    }
  }
  return winner
}

function subscribe(store: AppLoadingStore, listener: () => void) {
  store.listeners.add(listener)
  return () => {
    store.listeners.delete(listener)
  }
}

function getSnapshot(store: AppLoadingStore): RegistryEntry | null {
  return pickActiveEntry(store.entries.values())
}

function registerEntry(store: AppLoadingStore, entry: RegistryEntry) {
  store.entries.set(entry.id, entry)
  for (const listener of store.listeners) listener()
}

function unregisterEntry(store: AppLoadingStore, id: symbol) {
  if (!store.entries.delete(id)) return
  for (const listener of store.listeners) listener()
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

export function useOptionalAppLoadingActive(): RegistryEntry | null {
  const store = useContext(AppLoadingStoreContext)
  return useSyncExternalStore(
    store ? (listener) => subscribe(store, listener) : () => () => {},
    () => (store ? getSnapshot(store) : null),
    () => null,
  )
}

export function AppLoadingRegistrar(props: LoadingRegistration) {
  const store = useAppLoadingStore()
  const { intent, labelOverride, srStatusOverride } = props

  useLayoutEffect(() => {
    const id = Symbol('app-loading')
    registerEntry(store, { id, intent, labelOverride, srStatusOverride })
    return () => unregisterEntry(store, id)
  }, [store, intent, labelOverride, srStatusOverride])

  return null
}

export function AppLoadingOverlay() {
  const active = useOptionalAppLoadingActive()
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key="app-loading-overlay"
          className="fixed inset-0 z-[120]"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.4, 0, 0.2, 1] }}
        >
          <AppLoadingState
            intent={active.intent}
            labelOverride={active.labelOverride ?? resolveOverlayHeadline(active.intent)}
            srStatusOverride={active.srStatusOverride ?? getLoadingIntentConfig(active.intent).srStatus}
            stabilizePattern
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function useRegisterAppLoading(active: boolean, registration: LoadingRegistration) {
  const store = useAppLoadingStore()
  const { intent, labelOverride, srStatusOverride } = registration

  useLayoutEffect(() => {
    if (!active) return
    const id = Symbol('app-loading-hook')
    registerEntry(store, { id, intent, labelOverride, srStatusOverride })
    return () => unregisterEntry(store, id)
  }, [active, store, intent, labelOverride, srStatusOverride])
}
