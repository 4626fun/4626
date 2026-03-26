import { useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import type { WorkspaceRoomsResponse } from '@/lib/workspace/types'

export function WorkspaceRoomsTab(props: {
  data: WorkspaceRoomsResponse | undefined
  isLoading: boolean
  isMutating: boolean
  onTelegramLink: (payload: {
    chatId: string
    roomChatId: string
    minSharesRaw: string
    graceHours: number
  }) => void
  onTelegramUnlink: (payload: { chatId: string; roomChatId: string }) => void
  onXmtpPing: () => void
}) {
  const [chatId, setChatId] = useState('')
  const [roomChatId, setRoomChatId] = useState('')
  const [minSharesRaw, setMinSharesRaw] = useState('1')
  const [graceHours, setGraceHours] = useState('24')

  if (props.isLoading && !props.data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Skeleton className="h-4 w-32 mb-3" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    )
  }

  const data = props.data
  if (!data) return null

  const linkedChatId = data.telegram.chatId ?? ''
  const linkedRoomChatId = data.telegram.roomChatId ?? ''

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-100">Telegram room</div>
          <Badge variant={data.telegram.linked && data.telegram.enabled ? 'success' : 'warning'}>
            {data.telegram.linked && data.telegram.enabled ? 'Linked' : 'Unlinked'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-2 text-xs">
          <label className="space-y-1">
            <span className="text-zinc-500">Source chat ID</span>
            <input
              value={chatId}
              onChange={(event) => setChatId(event.target.value)}
              placeholder={linkedChatId || '-100...'}
              className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-zinc-100"
            />
          </label>
          <label className="space-y-1">
            <span className="text-zinc-500">Room chat ID</span>
            <input
              value={roomChatId}
              onChange={(event) => setRoomChatId(event.target.value)}
              placeholder={linkedRoomChatId || '-100...'}
              className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-zinc-100"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-zinc-500">Min shares</span>
              <input
                value={minSharesRaw}
                onChange={(event) => setMinSharesRaw(event.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-zinc-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-zinc-500">Grace hours</span>
              <input
                value={graceHours}
                onChange={(event) => setGraceHours(event.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-zinc-100"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={props.isMutating}
            onClick={() =>
              props.onTelegramLink({
                chatId: chatId || linkedChatId,
                roomChatId: roomChatId || linkedRoomChatId,
                minSharesRaw: minSharesRaw || '1',
                graceHours: Number(graceHours) || 24,
              })
            }
          >
            Link room
          </Button>
          <Button
            size="sm"
            disabled={props.isMutating || !(linkedChatId || chatId) || !(linkedRoomChatId || roomChatId)}
            onClick={() =>
              props.onTelegramUnlink({
                chatId: linkedChatId || chatId,
                roomChatId: linkedRoomChatId || roomChatId,
              })
            }
          >
            Unlink room
          </Button>
        </div>

        <div className="text-xs text-zinc-500">
          Members currently eligible: <span className="text-zinc-300">{data.telegram.memberCount}</span>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-100">XMTP agent room</div>
          <Badge variant={data.xmtp.linked ? 'success' : 'warning'}>{data.xmtp.linked ? 'Linked' : 'Unlinked'}</Badge>
        </div>
        <div className="rounded-lg border border-white/10 p-3 text-xs space-y-1">
          <div className="text-zinc-500">Agent address</div>
          <div className="text-zinc-100 break-all">{data.xmtp.agentAddress ?? 'Not configured'}</div>
        </div>
        <div className="rounded-lg border border-white/10 p-3 text-xs space-y-1">
          <div className="text-zinc-500">Conversation ID</div>
          <div className="text-zinc-100 break-all">{data.xmtp.conversationId ?? 'Not available'}</div>
        </div>
        <Button size="sm" disabled={props.isMutating || !data.xmtp.linked} onClick={props.onXmtpPing}>
          Send test summary
        </Button>
      </div>
    </div>
  )
}
