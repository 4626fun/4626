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
import { LOADING_INTENT_CONFIG } from '@/components/layout/appLoadingIntents'

const APP_LOADING_HEADLINE = LOADING_INTENT_CONFIG.page.headline
const APP_LOADING_SR_STATUS = LOADING_INTENT_CONFIG.page.srStatus

type AppLoadingStore = {
  count: number
  listeners: Set<() => void>
}

function createAppLoadingStore(): AppLoadingStore {
  return {
    count: 0,
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

function increment(store: AppLoadingStore) {
  store.count += 1
  for (const listener of store.listeners) listener()
}

function decrement(store: AppLoadingStore) {
  if (store.count <= 0) return
  store.count -= 1
  for (const listener of store.listeners) listener()
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

/** Register a full-screen bootstrap load. Always renders one shared overlay copy. */
export function AppLoadingRegistrar() {
  const store = useAppLoadingStore()

  useLayoutEffect(() => {
    increment(store)
    return () => decrement(store)
  }, [store])

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
          initial={false}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.4, 0, 0.2, 1] }}
        >
          <AppLoadingState
            intent="page"
            labelOverride={APP_LOADING_HEADLINE}
            srStatusOverride={APP_LOADING_SR_STATUS}
            stabilizePattern
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
