import { type ReactNode, useMemo } from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/shared/utils'

export interface AccordionItemData {
  key: string
  title: string
  children: ReactNode
}

function AccordionChevron({ className }: { className?: string }) {
  return (
    <ChevronDown
      className={cn('size-4 shrink-0 text-zinc-500 transition-transform duration-200', className)}
      aria-hidden
    />
  )
}

interface AccordionProps {
  items: AccordionItemData[]
  openKeys: Set<string> | Record<string, boolean>
  onToggle: (key: string) => void
  className?: string
}

export function FaqAccordion({ items, openKeys, onToggle, className }: AccordionProps) {
  const value = useMemo(() => {
    if (openKeys instanceof Set) return Array.from(openKeys)
    return Object.entries(openKeys)
      .filter(([, open]) => open)
      .map(([key]) => key)
  }, [openKeys])

  return (
    <AccordionPrimitive.Root
      type="multiple"
      value={value}
      onValueChange={(next) => {
        const nextSet = new Set(next)
        for (const item of items) {
          const wasOpen = value.includes(item.key)
          const isOpen = nextSet.has(item.key)
          if (wasOpen !== isOpen) onToggle(item.key)
        }
      }}
      className={cn('divide-y divide-white/10', className)}
    >
      {items.map((item) => (
        <AccordionPrimitive.Item key={item.key} value={item.key} className="border-0">
          <AccordionPrimitive.Header>
            <AccordionPrimitive.Trigger className="group flex w-full items-center justify-between gap-3 px-6 py-4 text-left text-sm font-medium text-zinc-100 transition hover:bg-white/[0.03]">
              {item.title}
              <AccordionChevron className="group-data-[state=open]:rotate-180" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="overflow-hidden">
            <div className="px-6 pb-4 text-sm leading-relaxed text-zinc-400">{item.children}</div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  )
}

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
    <AccordionPrimitive.Root
      type="single"
      collapsible
      value={activeKey ?? ''}
      onValueChange={(value) => onChange(value || null)}
      className={cn('divide-y divide-white/10', className)}
    >
      {items.map((item) => (
        <AccordionPrimitive.Item key={item.key} value={item.key}>
          <AccordionPrimitive.Header>
            <AccordionPrimitive.Trigger className="group flex w-full items-center justify-between gap-3 px-6 py-4 text-left text-sm font-medium text-zinc-100 transition hover:bg-white/[0.03]">
              {item.title}
              <AccordionChevron className="group-data-[state=open]:rotate-180" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="overflow-hidden">
            <div className="px-6 pb-4">{item.children}</div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  )
}
