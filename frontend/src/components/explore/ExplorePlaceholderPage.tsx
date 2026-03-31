import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { PageMeta } from '@/components/seo/PageMeta'

type ExplorePlaceholderAction = {
  to: string
  label: string
  tone?: 'primary' | 'accent'
}

type ExplorePlaceholderPageProps = {
  sectionLabel: string
  heading: string
  headerNote?: ReactNode
  identifier?: string
  subnavSearchPlaceholder: string
  cardLabel: string
  cardDescription: ReactNode
  actions: ExplorePlaceholderAction[]
  meta?: {
    title: string
    description: string
    canonicalPath?: string
  }
}

const ACTION_CLASS_BY_TONE: Record<'primary' | 'accent', string> = {
  primary: 'btn-primary',
  accent: 'btn-accent',
}

export function ExplorePlaceholderPage(props: ExplorePlaceholderPageProps) {
  return (
    <div className="relative pb-24 md:pb-0">
      {props.meta ? (
        <PageMeta
          title={props.meta.title}
          description={props.meta.description}
          canonicalPath={props.meta.canonicalPath}
        />
      ) : null}

      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <span className="label">{props.sectionLabel}</span>
            <h1 className="headline text-3xl sm:text-5xl mt-4">{props.heading}</h1>
            {props.headerNote ? <div className="mt-3 text-zinc-600 text-sm font-light">{props.headerNote}</div> : null}
            {props.identifier ? <div className="mt-3 text-[11px] font-mono text-zinc-600 break-all">{props.identifier}</div> : null}
          </motion.div>

          <ExploreSubnav searchPlaceholder={props.subnavSearchPlaceholder} />

          <div className="mt-10 rounded-2xl border border-white/5 bg-white/[0.03] p-6 sm:p-8">
            <div className="label">{props.cardLabel}</div>
            <div className="mt-4 text-sm text-zinc-600 font-light">{props.cardDescription}</div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              {props.actions.map((action) => {
                const tone = action.tone ?? 'primary'
                const toneClass = ACTION_CLASS_BY_TONE[tone]
                return (
                  <Link
                    key={`${action.to}:${action.label}`}
                    to={action.to}
                    className={`${toneClass} btn-compact inline-flex items-center justify-center rounded-full text-xs`}
                  >
                    {action.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
