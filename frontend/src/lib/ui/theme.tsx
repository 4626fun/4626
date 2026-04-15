import React, { createContext, useContext, useEffect, useMemo } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

type ThemeState = {
  preference: ThemePreference
  isDark: boolean
  setPreference: (p: ThemePreference) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)

function applyDarkTheme() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.add('dark')
  document.documentElement.style.colorScheme = 'dark'
}

export function ThemeProvider(props: { children: React.ReactNode }) {
  const preference: ThemePreference = 'dark'
  const isDark = true

  useEffect(() => {
    applyDarkTheme()
  }, [])

  const setPreference = (_p: ThemePreference) => {
    // Dark mode is enforced globally.
  }
  const toggle = () => {
    // Dark mode is enforced globally.
  }

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
