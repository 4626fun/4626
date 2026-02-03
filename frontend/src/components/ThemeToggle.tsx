import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'

export function ThemeToggle(props: { className?: string }) {
  const { isDark, preference, setPreference, toggle } = useTheme()

  return (
    <button
      type="button"
      onClick={toggle}
      onContextMenu={(e) => {
        // Allow returning to system preference (mobile long-press often triggers context menu).
        e.preventDefault()
        setPreference('system')
      }}
      className={
        props.className ??
        'inline-flex h-11 w-11 items-center justify-center rounded-xl border border-vault-border bg-vault-card/50 text-vault-subtext hover:text-vault-text transition-colors'
      }
      aria-label={
        preference === 'system'
          ? `Theme: system (${isDark ? 'dark' : 'light'})`
          : isDark
            ? 'Switch to light mode'
            : 'Switch to dark mode'
      }
      title={
        preference === 'system'
          ? `System theme (${isDark ? 'dark' : 'light'}) — right click to pin system`
          : isDark
            ? 'Light mode — right click for system'
            : 'Dark mode — right click for system'
      }
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}

