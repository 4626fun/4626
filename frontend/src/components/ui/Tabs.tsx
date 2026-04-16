/**
 * CDS SegmentedTabs wrapper.
 *
 * Provides a simplified API that maps an array of `{ id, label }` objects plus
 * an `activeTab` string id to the CDS SegmentedTabs component, which uses
 * `TabValue` objects internally.
 *
 * This lets callers keep their existing `string`-based tab state while
 * delegating rendering to CDS.
 */

import { useMemo } from 'react'
import { SegmentedTabs as CdsSegmentedTabs } from '@coinbase/cds-web/tabs'

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
  const cdsTabs = useMemo(
    () => tabs.map((t) => ({ id: t.id, label: t.label, disabled: t.disabled })),
    [tabs],
  )

  const activeCdsTab = useMemo(
    () => cdsTabs.find((t) => t.id === activeTab) ?? null,
    [cdsTabs, activeTab],
  )

  return (
    <div className={className}>
      <CdsSegmentedTabs
        tabs={cdsTabs}
        activeTab={activeCdsTab}
        onChange={(tab) => {
          if (tab) onChange(tab.id)
        }}
        disabled={disabled}
        borderRadius={1000}
        gap={0.5}
      />
    </div>
  )
}
