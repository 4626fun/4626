import { DeployStrategies } from '@/components/deploy/DeployStrategies'
import { AKITA } from '@/config/contracts'

export function AdminDeployStrategies() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Deploy Strategies (Admin)</h1>
        <p className="text-sm text-gray-400">
          Manual Charm + Ajna helper for the AKITA vault. The canonical `/deploy` flow is the production path for
          greenfield launches (Charm + Ajna + ShareOFT Pipe A at finalize).
        </p>
      </div>

      <DeployStrategies vaultAddress={AKITA.vault} tokenAddress={AKITA.token} />
    </div>
  )
}

