import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Compass, Rocket, TrendingUp, X } from 'lucide-react'

import { useMiniAppContext } from '@/hooks/useMiniAppContext'
import { trackEvent } from '@/lib/analytics'

const STORAGE_KEY = 'cv:onboarding:v2'

type IntentKey = 'invest' | 'launch' | 'explore'
type IntentOption = {
  key: IntentKey
  title: string
  body: string
  cta: string
  to: string
  icon: typeof TrendingUp
}

const INTENTS: IntentOption[] = [
  {
    key: 'invest',
    title: 'I want to invest',
    body: 'Browse creators and track performance in one feed.',
    cta: 'Open Explore',
    to: '/explore/creators',
    icon: TrendingUp,
  },
  {
    key: 'launch',
    title: 'I want to launch',
    body: 'Create your vault and get deployment-ready quickly.',
    cta: 'Go to Deploy',
    to: '/deploy',
    icon: Rocket,
  },
  {
    key: 'explore',
    title: 'I am exploring',
    body: 'Take a quick look around and decide where to start.',
    cta: 'Start Exploring',
    to: '/',
    icon: Compass,
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
  const [intent, setIntent] = useState<IntentKey>('launch')
  const selected = INTENTS.find((option) => option.key === intent) ?? INTENTS[0]
  const username = mini.username ? `@${mini.username}` : null
  const avatar = (mini.context?.user?.pfpUrl && String(mini.context.user.pfpUrl)) || null

  const subtitle = useMemo(() => {
    if (mini.isMiniApp !== true) return 'Quick tour'
    return username ? `Signed in as ${username}` : 'Quick tour'
  }, [mini.isMiniApp, username])

  useEffect(() => {
    trackEvent('modal_shown', { modal: 'onboarding_intent' })
  }, [])

  function close() {
    setDone()
    trackEvent('modal_dismissed', { modal: 'onboarding_intent', intent })
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
              <div className="text-sm font-medium text-vault-text truncate">How do you want to start?</div>
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

        <div className="px-5 pb-4 space-y-2">
          {INTENTS.map((option) => {
            const Icon = option.icon
            const active = option.key === intent
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setIntent(option.key)}
                className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                  active
                    ? 'border-brand-primary bg-brand-primary/10 text-vault-text'
                    : 'border-vault-border text-vault-subtext hover:text-vault-text hover:bg-vault-bg/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="h-8 w-8 rounded-lg border border-vault-border inline-flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{option.title}</span>
                    <span className="block text-xs mt-1 opacity-80">{option.body}</span>
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="px-5 pb-5 flex items-center justify-end">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                close()
                trackEvent('onboarding_intent_selected', { intent: selected.key, destination: selected.to })
                navigate(selected.to)
              }}
              className="h-11 px-4 rounded-xl bg-brand-primary text-white font-medium inline-flex items-center gap-2"
            >
              {selected.cta}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
