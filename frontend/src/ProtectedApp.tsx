import App from './App'
import { AppQueryProvider } from './web3/Web3Providers'

export default function ProtectedApp() {
  return (
    <AppQueryProvider>
        <App />
    </AppQueryProvider>
  )
}
