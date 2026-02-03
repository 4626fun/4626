import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

type ThemeState = {
  preference: ThemePreference
  isDark: boolean
  setPreference: (p: ThemePreference) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)

const STORAGE_KEY = 'cv:theme'

function getSystemDark(): boolean {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true
  } catch {
    return true
  }
}

function computeIsDark(pref: ThemePreference): boolean {
  if (pref === 'dark') return true
  if (pref === 'light') return false
  return getSystemDark()
}

function applyTheme(pref: ThemePreference) {
  if (typeof document === 'undefined') return
  const isDark = computeIsDark(pref)
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
}

function readStoredPreference(): ThemePreference {
  try {
    const raw = String(window.localStorage.getItem(STORAGE_KEY) || '').trim()
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
    return 'system'
  } catch {
    return 'system'
  }
}

function writeStoredPreference(pref: ThemePreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // ignore
  }
}

export function ThemeProvider(props: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'system'
    return readStoredPreference()
  })

  const isDark = useMemo(() => computeIsDark(preference), [preference])

  useEffect(() => {
    applyTheme(preference)
    writeStoredPreference(preference)
  }, [preference])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (preference !== 'system') return

    const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mql) return

    const onChange = () => applyTheme('system')
    try {
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    } catch {
      // Safari fallback
      mql.addListener(onChange)
      return () => mql.removeListener(onChange)
    }
  }, [preference])

  const setPreference = (p: ThemePreference) => setPreferenceState(p)
  const toggle = () => setPreferenceState((prev) => (computeIsDark(prev) ? 'light' : 'dark'))

  const value: ThemeState = useMemo(
    () => ({
      preference,
      isDark,
      setPreference,
      toggle,
    }),
    [preference, isDark],
  )

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

