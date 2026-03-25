import { Layout } from '@/components/Layout'
import { AccountContextProvider } from '@/wallet/accountContext'

export default function LayoutWithAccountContext() {
  return (
    <AccountContextProvider>
      <Layout />
    </AccountContextProvider>
  )
}
