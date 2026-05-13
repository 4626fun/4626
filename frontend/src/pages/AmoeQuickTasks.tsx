import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageMeta } from '@/components/seo/PageMeta'

type TaskItem = {
  id: string
  title: string
  description: string
  href?: string
  external?: boolean
}

const STORAGE_KEY = 'amoe_quick_tasks_v1'

const TASKS: TaskItem[] = [
  {
    id: 'open-app',
    title: 'Open the app shell',
    description: 'Go to app.4626.fun and make sure your account session is active.',
    href: 'https://app.4626.fun',
    external: true,
  },
  {
    id: 'earn-points',
    title: 'Complete one easy points action',
    description: 'Use one waitlist/social action to earn AMOE-eligible points.',
    href: '/waitlist',
  },
  {
    id: 'burn-credits',
    title: 'Burn points into AMOE credits',
    description: 'Convert points to credits in the AMOE flow until credits are non-zero.',
  },
  {
    id: 'submit-zk',
    title: 'Submit one AMOE ZK entry',
    description: 'Submit one real canary entry using a small amount.',
  },
  {
    id: 'retry-cron',
    title: 'Run retry cron smoke check',
    description: 'Call /api/v1/lottery/amoe/retry-cron with cron auth and confirm ok:true.',
  },
  {
    id: 'publish-cron',
    title: 'Run publish cron smoke check',
    description:
      'Call /api/v1/lottery/amoe/publish-cron and confirm no publisher_disabled or salt-misconfigured errors.',
  },
  {
    id: 'refund-cron',
    title: 'Run burn-refund cron smoke check',
    description: 'Call /api/v1/lottery/amoe/burn-refund-cron and confirm ok:true.',
  },
]

function readCheckedMap(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, boolean> = {}
    for (const task of TASKS) {
      out[task.id] = parsed[task.id] === true
    }
    return out
  } catch {
    return {}
  }
}

function writeCheckedMap(value: Record<string, boolean>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Ignore storage write failures (private mode / blocked storage).
  }
}

export function AmoeQuickTasks() {
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(() =>
    readCheckedMap(),
  )

  const completed = useMemo(
    () => TASKS.reduce((acc, task) => (checkedMap[task.id] ? acc + 1 : acc), 0),
    [checkedMap],
  )
  const total = TASKS.length
  const done = completed === total

  const toggleTask = (taskId: string) => {
    setCheckedMap((prev) => {
      const next = { ...prev, [taskId]: !prev[taskId] }
      writeCheckedMap(next)
      return next
    })
  }

  const resetAll = () => {
    const next: Record<string, boolean> = {}
    writeCheckedMap(next)
    setCheckedMap(next)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageMeta
        title="AMOE Quick Tasks"
        description="Easy production AMOE checklist for earning points and validating the end-to-end path."
      />

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">AMOE Quick Tasks</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Complete these steps in order to validate the production AMOE flow.
            </p>
          </div>
          <button
            type="button"
            onClick={resetAll}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/30 hover:text-white"
          >
            Reset
          </button>
        </div>

        <div className="mt-4 text-sm text-zinc-300">
          Progress: <span className="font-medium text-white">{completed}</span> / {total}
          {done ? <span className="ml-2 text-emerald-300">Done</span> : null}
        </div>

        <div className="mt-5 space-y-3">
          {TASKS.map((task, index) => {
            const checked = checkedMap[task.id] === true
            return (
              <div
                key={task.id}
                className={`rounded-xl border p-4 ${
                  checked ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTask(task.id)}
                    className="mt-1 h-4 w-4 rounded border-white/25 bg-transparent text-blue-500 focus:ring-blue-500/40"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-100">
                      {index + 1}. {task.title}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">{task.description}</div>
                    {task.href ? (
                      <div className="mt-2">
                        {task.external ? (
                          <a
                            href={task.href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-300 underline underline-offset-2 hover:text-blue-200"
                          >
                            Open link
                          </a>
                        ) : (
                          <Link
                            to={task.href}
                            className="text-xs text-blue-300 underline underline-offset-2 hover:text-blue-200"
                          >
                            Open page
                          </Link>
                        )}
                      </div>
                    ) : null}
                  </div>
                </label>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

