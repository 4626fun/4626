import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getWorkspaceActivity,
  getWorkspaceMonitoring,
  getWorkspaceRooms,
  getWorkspaceSettings,
  getWorkspaceStrategies,
  getWorkspaceSummary,
  getWorkspaceTasks,
  postWorkspaceAction,
} from '@/lib/workspace/api'
import type { WorkspaceTabId } from '@/lib/workspace/types'

type UseCreatorWorkspaceOptions = {
  vaultAddress: `0x${string}` | null
  tab: WorkspaceTabId
}

function workspaceKey(vaultAddress: `0x${string}`, tab: WorkspaceTabId) {
  return ['workspace', vaultAddress, tab] as const
}

export function useCreatorWorkspace(options: UseCreatorWorkspaceOptions) {
  const queryClient = useQueryClient()
  const enabled = Boolean(options.vaultAddress)
  const vaultAddress = options.vaultAddress

  const summary = useQuery({
    queryKey: vaultAddress ? workspaceKey(vaultAddress, 'overview') : ['workspace', 'disabled', 'overview'],
    queryFn: () => getWorkspaceSummary(vaultAddress as `0x${string}`),
    enabled,
    staleTime: 15_000,
  })

  const strategies = useQuery({
    queryKey: vaultAddress ? workspaceKey(vaultAddress, 'strategies') : ['workspace', 'disabled', 'strategies'],
    queryFn: () => getWorkspaceStrategies(vaultAddress as `0x${string}`),
    enabled: enabled && (options.tab === 'strategies' || options.tab === 'overview'),
    staleTime: 15_000,
  })

  const monitoring = useQuery({
    queryKey: vaultAddress ? workspaceKey(vaultAddress, 'monitoring') : ['workspace', 'disabled', 'monitoring'],
    queryFn: () => getWorkspaceMonitoring(vaultAddress as `0x${string}`),
    enabled: enabled && (options.tab === 'monitoring' || options.tab === 'overview'),
    staleTime: 20_000,
  })

  const activity = useQuery({
    queryKey: vaultAddress ? workspaceKey(vaultAddress, 'activity') : ['workspace', 'disabled', 'activity'],
    queryFn: () => getWorkspaceActivity({ vault: vaultAddress as `0x${string}`, includeSystem: true, limit: 200 }),
    enabled: enabled && (options.tab === 'activity' || options.tab === 'overview'),
    staleTime: 15_000,
  })

  const rooms = useQuery({
    queryKey: vaultAddress ? workspaceKey(vaultAddress, 'rooms') : ['workspace', 'disabled', 'rooms'],
    queryFn: () => getWorkspaceRooms(vaultAddress as `0x${string}`),
    enabled: enabled && (options.tab === 'rooms' || options.tab === 'overview'),
    staleTime: 20_000,
  })

  const tasks = useQuery({
    queryKey: vaultAddress ? workspaceKey(vaultAddress, 'tasks') : ['workspace', 'disabled', 'tasks'],
    queryFn: () => getWorkspaceTasks({ vault: vaultAddress as `0x${string}` }),
    enabled: enabled && (options.tab === 'tasks' || options.tab === 'overview'),
    staleTime: 10_000,
  })

  const settings = useQuery({
    queryKey: vaultAddress ? workspaceKey(vaultAddress, 'settings') : ['workspace', 'disabled', 'settings'],
    queryFn: () => getWorkspaceSettings(vaultAddress as `0x${string}`),
    enabled: enabled && (options.tab === 'settings' || options.tab === 'overview'),
    staleTime: 20_000,
  })

  const actionMutation = useMutation({
    mutationFn: async (params: { action: string; payload?: Record<string, unknown> }) => {
      if (!vaultAddress) throw new Error('vault address is required')
      return postWorkspaceAction({
        vault: vaultAddress,
        action: params.action,
        payload: params.payload ?? {},
      })
    },
    onSuccess: async () => {
      if (!vaultAddress) return
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace', vaultAddress] }),
      ])
    },
  })

  const isAnyLoading = useMemo(() => {
    return (
      summary.isLoading ||
      strategies.isLoading ||
      monitoring.isLoading ||
      activity.isLoading ||
      rooms.isLoading ||
      tasks.isLoading ||
      settings.isLoading
    )
  }, [
    activity.isLoading,
    monitoring.isLoading,
    rooms.isLoading,
    settings.isLoading,
    strategies.isLoading,
    summary.isLoading,
    tasks.isLoading,
  ])

  return {
    summary,
    strategies,
    monitoring,
    activity,
    rooms,
    tasks,
    settings,
    actionMutation,
    isAnyLoading,
  }
}
