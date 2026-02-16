import App from './App'
import { Web3Providers } from './web3/Web3Providers'
import { PrivyClientProvider } from '@/lib/privy/client'

export default function ProtectedApp() {
  return (
    <PrivyClientProvider>
      <Web3Providers>
        <App />
      </Web3Providers>
    </PrivyClientProvider>
  )
}
