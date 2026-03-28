import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import type { WorkspaceSettingsResponse } from '@/lib/workspace/types'

export function WorkspaceSettingsTab(props: {
  data: WorkspaceSettingsResponse | undefined
  isLoading: boolean
  isMutating: boolean
  onUpdateNotifications: (payload: {
    telegramEnabled: boolean
    xmtpEnabled: boolean
    emailEnabled: boolean
    minSeverity: string
  }) => void
}) {
  const preference = props.data?.notificationPreferences?.[0]
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(preference?.telegramEnabled ?? true)
  const [xmtpEnabled, setXmtpEnabled] = useState<boolean>(preference?.xmtpEnabled ?? true)
  const [emailEnabled, setEmailEnabled] = useState<boolean>(preference?.emailEnabled ?? false)
  const [minSeverity, setMinSeverity] = useState<string>(preference?.minSeverity ?? 'warn')

  const hasUnsavedChanges = useMemo(() => {
    return (
      telegramEnabled !== (preference?.telegramEnabled ?? true) ||
      xmtpEnabled !== (preference?.xmtpEnabled ?? true) ||
      emailEnabled !== (preference?.emailEnabled ?? false) ||
      minSeverity !== (preference?.minSeverity ?? 'warn')
    )
  }, [emailEnabled, minSeverity, preference?.emailEnabled, preference?.minSeverity, preference?.telegramEnabled, preference?.xmtpEnabled, telegramEnabled, xmtpEnabled])

  if (props.isLoading && !props.data) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full" />
      </div>
    )
  }

  const data = props.data
  if (!data) return null

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-100">Notification preferences</span>
          <Badge variant={hasUnsavedChanges ? 'warning' : 'success'}>
            {hasUnsavedChanges ? 'Unsaved' : 'Saved'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/10 p-3">
            <span className="text-zinc-300">Telegram alerts</span>
            <input type="checkbox" checked={telegramEnabled} onChange={(event) => setTelegramEnabled(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/10 p-3">
            <span className="text-zinc-300">XMTP alerts</span>
            <input type="checkbox" checked={xmtpEnabled} onChange={(event) => setXmtpEnabled(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/10 p-3">
            <span className="text-zinc-300">Email alerts</span>
            <input type="checkbox" checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} />
          </label>
          <label className="rounded-lg border border-white/10 bg-black/10 p-3">
            <div className="text-zinc-300 mb-2">Minimum severity</div>
            <select
              value={minSeverity}
              onChange={(event) => setMinSeverity(event.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-zinc-100"
            >
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="critical">critical</option>
            </select>
          </label>
        </div>

        <Button
          size="sm"
          disabled={props.isMutating || !hasUnsavedChanges}
          onClick={() =>
            props.onUpdateNotifications({
              telegramEnabled,
              xmtpEnabled,
              emailEnabled,
              minSeverity,
            })
          }
        >
          Save preferences
        </Button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-zinc-100 mb-2">Automation scope</div>
        <div className="text-xs text-zinc-400">
          {data.automation.enabled
            ? `Enabled (${data.automation.scope ?? 'vault'})`
            : 'Automation is currently disabled for this vault'}
        </div>
      </div>
    </div>
  )
}
