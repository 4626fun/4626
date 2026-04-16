/**
 * CDS Accordion wrapper.
 *
 * Wraps CDS Accordion + AccordionItem to support both single-open and
 * multi-open modes, since the FAQ page needs multi-open for search results.
 *
 * Usage:
 * ```tsx
 * <FaqAccordion items={items} openKeys={openKeys} onToggle={onToggle} />
 * ```
 */

import { type ReactNode, useCallback } from 'react'
import { Accordion as CdsAccordion, AccordionItem as CdsAccordionItem } from '@coinbase/cds-web/accordion'

export interface AccordionItemData {
  key: string
  title: string
  children: ReactNode
}

interface AccordionProps {
  items: AccordionItemData[]
  /** Set of currently open item keys. Supports multi-open. */
  openKeys: Set<string> | Record<string, boolean>
  /** Toggle callback for a single item key. */
  onToggle: (key: string) => void
  className?: string
}

/**
 * Multi-open accordion backed by CDS AccordionItem.
 *
 * Each item is wrapped in its own CDS Accordion so multiple items can be
 * independently expanded — CDS Accordion's native mode only supports
 * single-open.
 */
export function FaqAccordion({ items, openKeys, onToggle, className }: AccordionProps) {
  const isOpen = useCallback(
    (key: string) => {
      if (openKeys instanceof Set) return openKeys.has(key)
      return Boolean((openKeys as Record<string, boolean>)[key])
    },
    [openKeys],
  )

  return (
    <div className={className}>
      {items.map((item) => {
        const open = isOpen(item.key)
        return (
          <CdsAccordion
            key={item.key}
            activeKey={open ? item.key : null}
            onChange={() => onToggle(item.key)}
          >
            <CdsAccordionItem itemKey={item.key} title={item.title}>
              {item.children}
            </CdsAccordionItem>
          </CdsAccordion>
        )
      })}
    </div>
  )
}

/**
 * Single-open accordion backed by CDS Accordion (standard mode).
 */
export function SingleAccordion({
  items,
  activeKey,
  onChange,
  className,
}: {
  items: AccordionItemData[]
  activeKey: string | null
  onChange: (key: string | null) => void
  className?: string
}) {
  return (
    <div className={className}>
      <CdsAccordion activeKey={activeKey} onChange={onChange}>
        {items.map((item) => (
          <CdsAccordionItem key={item.key} itemKey={item.key} title={item.title}>
            {item.children}
          </CdsAccordionItem>
        ))}
      </CdsAccordion>
    </div>
  )
}
