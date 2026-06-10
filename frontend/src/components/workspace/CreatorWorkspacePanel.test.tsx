import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CreatorWorkspacePanel } from './CreatorWorkspacePanel'

const mocks = vi.hoisted(() => ({
  useCreatorWorkspace: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: any) => React.createElement('button', props, children),
}))

vi.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: any) => React.createElement('div', null, children),
}))

vi.mock('@/hooks/useCreatorWorkspace', () => ({
  useCreatorWorkspace: mocks.useCreatorWorkspace,
}))

vi.mock('./WorkspaceOverviewTab', () => ({
  WorkspaceOverviewTab: () => React.createElement('div', null, 'Overview Tab Content'),
}))
vi.mock('./WorkspaceStrategiesTab', () => ({
  WorkspaceStrategiesTab: () => React.createElement('div', null, 'Strategies Tab Content'),
}))
vi.mock('./WorkspaceMonitoringTab', () => ({
  WorkspaceMonitoringTab: () => React.createElement('div', null, 'Monitoring Tab Content'),
}))
vi.mock('./WorkspaceActivityTab', () => ({
  WorkspaceActivityTab: () => React.createElement('div', null, 'Activity Tab Content'),
}))
vi.mock('./WorkspaceRoomsTab', () => ({
  WorkspaceRoomsTab: () => React.createElement('div', null, 'Rooms Tab Content'),
}))
vi.mock('./WorkspaceTasksTab', () => ({
  WorkspaceTasksTab: () => React.createElement('div', null, 'Tasks Tab Content'),
}))
vi.mock('./WorkspaceSettingsTab', () => ({
  WorkspaceSettingsTab: () => React.createElement('div', null, 'Settings Tab Content'),
}))

describe('CreatorWorkspacePanel', () => {
  it('renders role and default overview tab', () => {
    mocks.useCreatorWorkspace.mockReturnValue({
      summary: {
        data: {
          actorRole: 'OWNER',
          metrics: {
            pendingTasks: 2,
            pendingApprovals: 1,
          },
        },
        isLoading: false,
        refetch: vi.fn(),
      },
      strategies: { isLoading: false, data: undefined, refetch: vi.fn() },
      monitoring: { isLoading: false, data: undefined, refetch: vi.fn() },
      activity: { isLoading: false, data: undefined, refetch: vi.fn() },
      rooms: { isLoading: false, data: undefined, refetch: vi.fn() },
      tasks: { isLoading: false, data: undefined, refetch: vi.fn() },
      settings: { isLoading: false, data: undefined, refetch: vi.fn() },
      actionMutation: {
        isPending: false,
        mutateAsync: vi.fn(),
      },
      isAnyLoading: false,
    })

    const html = renderToStaticMarkup(
      React.createElement(CreatorWorkspacePanel, {
        vaultAddress: '0x1111111111111111111111111111111111111111',
        initialTab: 'overview',
      }),
    )

    expect(html).toContain('Creator Workspace')
    expect(html).toContain('Role:')
    expect(html).toContain('OWNER')
    expect(html).toContain('3 pending')
    expect(html).toContain('Overview Tab Content')
  })
})
