import React from 'react'
import ReactDOM from 'react-dom/client'

import '@4626/brand-kit/styles'
import './index.css'

import { AppLoadingState } from '@/components/AppLoadingState'
import { TelegramMiniAppUnavailable } from '@/components/TelegramMiniAppUnavailable'
import { useTelegramMiniAppEntryStatus } from '@/hooks/useTelegramMiniAppEntryStatus'
import { TelegramMenu } from '@/pages/TelegramMenu'

function TelegramMenuStandaloneApp() {
  const search = typeof window === 'undefined' ? '' : window.location.search
  const entryStatus = useTelegramMiniAppEntryStatus(search)

  if (entryStatus === 'ready') {
    return <TelegramMenu />
  }

  if (entryStatus === 'checking') {
    return <AppLoadingState />
  }

  return (
    <TelegramMiniAppUnavailable message="This launcher only works when Telegram Mini App context is available. Return to the bot and use the latest menu or direct button." />
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TelegramMenuStandaloneApp />
  </React.StrictMode>,
)
