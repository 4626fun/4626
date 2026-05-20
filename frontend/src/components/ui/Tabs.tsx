/**
 * Segmented tabs — Tailwind + vault tokens (replaces CDS SegmentedTabs).
 */

import { cn } from '@/lib/shared/utils'

export interface TabItem {
  id: string
  label: string
  disabled?: boolean
}

export interface SegmentedTabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (tabId: string) => void
  disabled?: boolean
  className?: string
}

export function SegmentedTabs({ tabs, activeTab, onChange, disabled, className }: SegmentedTabsProps) {
  return (
    <div
      className={cn(
        'inline-flex w-full max-w-full items-center gap-0.5 rounded-full border border-white/8 bg-vault-card/50 p-0.5',
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        const isDisabled = disabled || tab.disabled
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) onChange(tab.id)
            }}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
              isActive
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-vault-subtext hover:text-vault-text',
              isDisabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
