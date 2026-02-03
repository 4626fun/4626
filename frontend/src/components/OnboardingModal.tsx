import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, X } from 'lucide-react'

import { useMiniAppContext } from '@/hooks/useMiniAppContext'

const STORAGE_KEY = 'cv:onboarding:v1'

type Step = { title: string; body: string; cta?: string; to?: string }

const STEPS: Step[] = [
  {
    title: 'Welcome to Creator Vaults',
    body: 'Deposit creator coins into vaults to earn from trading fees together.',
    cta: 'Explore vaults',
    to: '/explore/creators',
  },
  {
    title: 'Track markets',
    body: 'See price, volume, and activity for creator coins—optimized for mobile.',
    cta: 'Open Explore',
    to: '/explore/creators',
  },
  {
    title: 'Launch a vault (creators)',
    body: 'Deploy a vault for your creator coin and manage launch + strategies in-app.',
    cta: 'Go to Deploy',
    to: '/deploy',
  },
]

function setDone() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}

export function hasCompletedOnboarding(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function OnboardingModal(props: { onClose: () => void }) {
  const navigate = useNavigate()
  const mini = useMiniAppContext()
  const [i, setI] = useState(0)

  const step = STEPS[i] ?? STEPS[0]
  const total = STEPS.length
  const username = mini.username ? `@${mini.username}` : null
  const avatar = (mini.context?.user?.pfpUrl && String(mini.context.user.pfpUrl)) || null

  const subtitle = useMemo(() => {
    if (mini.isMiniApp !== true) return 'Quick tour'
    return username ? `Signed in as ${username}` : 'Quick tour'
  }, [mini.isMiniApp, username])

  const isLast = i === total - 1

  function close() {
    setDone()
    props.onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-vault-border bg-vault-card shadow-void overflow-hidden">
        <div className="p-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {avatar ? (
              <img src={avatar} alt={username ?? 'User'} className="h-11 w-11 rounded-xl object-cover" />
            ) : (
              <div className="h-11 w-11 rounded-xl bg-vault-bg border border-vault-border" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-vault-text truncate">{step.title}</div>
              <div className="text-xs text-vault-subtext truncate">{subtitle}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="h-11 w-11 inline-flex items-center justify-center rounded-xl border border-vault-border text-vault-subtext hover:text-vault-text"
            aria-label="Close onboarding"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-5 text-sm text-vault-subtext leading-relaxed">{step.body}</div>

        <div className="px-5 pb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2" aria-label="Onboarding progress">
            {Array.from({ length: total }).map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 w-6 rounded-full transition-colors ${idx === i ? 'bg-brand-primary' : 'bg-vault-border'}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {i > 0 ? (
              <button
                type="button"
                onClick={() => setI((v) => Math.max(0, v - 1))}
                className="h-11 px-4 rounded-xl border border-vault-border text-vault-text hover:bg-vault-bg/60"
              >
                Back
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                if (!isLast) {
                  setI((v) => Math.min(total - 1, v + 1))
                  return
                }
                close()
                if (step.to) navigate(step.to)
              }}
              className="h-11 px-4 rounded-xl bg-brand-primary text-white font-medium inline-flex items-center gap-2"
            >
              {isLast ? step.cta ?? 'Get started' : 'Next'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

