import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import '@4626/brand-kit/styles'
import './index.css'

import { AppLoadingState } from '@/components/AppLoadingState'
import { TelegramMiniAppUnavailable } from '@/components/TelegramMiniAppUnavailable'
import { useTelegramMiniAppEntryStatus } from '@/hooks/useTelegramMiniAppEntryStatus'
import { TelegramLinkPrivyProvider } from '@/lib/privy/telegramLinkClient'
import { ThemeProvider } from '@/lib/theme'
import { TelegramLink } from '@/pages/telegram/TelegramLink'

function TelegramLinkStandaloneApp() {
  const search = typeof window === 'undefined' ? '' : window.location.search
  const entryStatus = useTelegramMiniAppEntryStatus(search)

  if (entryStatus === 'ready') {
    return <TelegramLink />
  }

  if (entryStatus === 'checking') {
    return <AppLoadingState />
  }

  return (
    <TelegramMiniAppUnavailable message="This account-link flow only works when Telegram Mini App context is available. Return to the bot and use the latest link button." />
  )
}

function TelegramLinkStandaloneRoot() {
  return (
    <ThemeProvider>
      <TelegramLinkPrivyProvider>
        <BrowserRouter>
          <Routes>
            <Route path="*" element={<TelegramLinkStandaloneApp />} />
          </Routes>
        </BrowserRouter>
      </TelegramLinkPrivyProvider>
    </ThemeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TelegramLinkStandaloneRoot />
  </React.StrictMode>,
)
