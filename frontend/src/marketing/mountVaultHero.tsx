import { createRoot } from 'react-dom/client'

import { MarketingVaultHero } from './MarketingVaultHero'

function mount() {
  const host = document.getElementById('vault-canvas')
  if (!host) return

  host.replaceChildren()
  const root = createRoot(host)
  root.render(<MarketingVaultHero />)

  requestAnimationFrame(() => {
    host.classList.add('is-ready')
  })
}

function loadLegacyVault() {
  const script = document.createElement('script')
  script.type = 'module'
  script.src = '/immersive/vault.js'
  document.body.appendChild(script)
}

const params = new URLSearchParams(window.location.search)
if (params.get('hero') === 'legacy') {
  loadLegacyVault()
} else {
  try {
    mount()
  } catch {
    loadLegacyVault()
  }
}
