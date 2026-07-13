// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AlfaClubRoomDirectoryItem } from '@/lib/alfaclub/roomDirectory'

import {
  DEFAULT_FILTERS,
  RoomDiscoveryTray,
  createRoomDiscoveryEntries,
  type RoomDiscoveryFilters,
} from './RoomDiscoveryTray'

function room(
  roomId: string,
  roomType: 'trading' | 'social',
  tier: 'casual' | 'club' | 'exclusive',
  featured = false,
): AlfaClubRoomDirectoryItem {
  return {
    roomId,
    roomName: `Room ${roomId}`,
    displayLabel: `Room ${roomId}`,
    creatorHandle: `creator${roomId}`,
    roomType,
    tier,
    keySupply: Number(roomId),
    roomPoints: Number(roomId) * 100,
    imageUrl: null,
    description: null,
    featured,
    uniqueHolders: Number(roomId) * 10,
    ingestedAt: '2026-07-12T00:00:00.000Z',
  }
}

const filters: RoomDiscoveryFilters = {
  search: '',
  roomType: 'all',
  tier: 'all',
  sort: 'points',
}

describe('RoomDiscoveryTray grouping', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('orders My Rooms, Recent, Featured, Trading, and Social without duplicates', () => {
    const entries = createRoomDiscoveryEntries({
      rooms: [
        room('1', 'trading', 'club', true),
        room('2', 'social', 'casual', true),
        room('3', 'social', 'exclusive'),
      ],
      filters,
      myRoomIds: ['1'],
      recentRoomIds: ['1', '2'],
    })

    expect(
      entries
        .filter((entry) => entry.kind === 'section')
        .map((entry) => entry.label),
    ).toEqual(['My Rooms', 'Recent', 'Social Rooms'])
    expect(
      entries
        .filter((entry) => entry.kind === 'room')
        .map((entry) => entry.room.roomId),
    ).toEqual(['1', '2', '3'])
  })

  it('applies room type, curve tier, and search filters together', () => {
    const entries = createRoomDiscoveryEntries({
      rooms: [
        room('1', 'trading', 'club'),
        room('2', 'social', 'casual'),
        room('3', 'social', 'exclusive'),
      ],
      filters: {
        search: 'creator3',
        roomType: 'social',
        tier: 'exclusive',
        sort: 'keys',
      },
      myRoomIds: [],
      recentRoomIds: [],
    })

    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ kind: 'section', label: 'Matches' })
    expect(entries[1]).toMatchObject({ kind: 'room', room: { roomId: '3' } })
  })

  it('uses one roving tab stop and arrow-key room navigation', async () => {
    const onSelect = vi.fn()
    render(
      createElement(RoomDiscoveryTray, {
        rooms: [
          room('1', 'trading', 'club'),
          room('2', 'trading', 'casual'),
          room('3', 'social', 'exclusive'),
        ],
        filters: DEFAULT_FILTERS,
        onFiltersChange: vi.fn(),
        recentRoomIds: [],
        myRoomIds: [],
        selectedRoomId: '',
        loading: false,
        error: null,
        onRetry: vi.fn(),
        onSelect,
      }),
    )

    const listbox = await screen.findByRole('listbox', { name: 'AlfaClub rooms' })
    const options = await screen.findAllByRole('option')
    expect(listbox.tabIndex).toBe(0)
    expect(options.every((option) => option.tabIndex === -1)).toBe(true)
    const initialActiveId = listbox.getAttribute('aria-activedescendant')
    listbox.focus()
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    await waitFor(() => {
      expect(document.activeElement).toBe(listbox)
      expect(listbox.getAttribute('aria-activedescendant')).not.toBe(initialActiveId)
    })
    fireEvent.keyDown(listbox, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('1')
    fireEvent.keyDown(listbox, { key: 'Home' })
    fireEvent.keyDown(listbox, { key: ' ' })
    expect(onSelect).toHaveBeenLastCalledWith('2')
  })

  it('shows truthful result counts, compact metadata, and clears active filters', async () => {
    const onFiltersChange = vi.fn()
    render(
      createElement(RoomDiscoveryTray, {
        rooms: [
          room('1', 'trading', 'club'),
          room('2', 'social', 'casual'),
          room('3', 'social', 'exclusive'),
        ],
        filters: { ...DEFAULT_FILTERS, roomType: 'social' },
        onFiltersChange,
        recentRoomIds: [],
        myRoomIds: [],
        selectedRoomId: '',
        loading: false,
        error: null,
        onRetry: vi.fn(),
        onSelect: vi.fn(),
      }),
    )

    expect(await screen.findByText('2 / 3')).toBeTruthy()
    expect(screen.getByText('social')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    expect((screen.getByRole('combobox', { name: 'Sort by' }) as HTMLSelectElement).value).toBe(
      'points',
    )
    expect((screen.getByRole('combobox', { name: 'Room type' }) as HTMLSelectElement).value).toBe(
      'social',
    )

    const roomThree = screen.getByRole('option', { name: /Room 3/ })
    expect(roomThree.getAttribute('data-room-type')).toBe('social')
    expect(roomThree.textContent).not.toContain('SOC')
    expect(roomThree.textContent).toContain('K 3')
    expect(roomThree.textContent).toContain('H 30')

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onFiltersChange).toHaveBeenCalledWith(DEFAULT_FILTERS)
  })

  it('uses one Results section for a narrowed room type', () => {
    const entries = createRoomDiscoveryEntries({
      rooms: [
        room('1', 'trading', 'club'),
        room('2', 'social', 'casual'),
      ],
      filters: { ...DEFAULT_FILTERS, roomType: 'social' },
      myRoomIds: [],
      recentRoomIds: [],
    })

    expect(entries[0]).toMatchObject({ kind: 'section', label: 'Results' })
  })

  it('uses row color for room type and the trading avatar ring for curve tier', async () => {
    render(
      createElement(RoomDiscoveryTray, {
        rooms: [
          room('1', 'trading', 'club'),
          room('2', 'social', 'exclusive'),
        ],
        filters: DEFAULT_FILTERS,
        onFiltersChange: vi.fn(),
        recentRoomIds: [],
        myRoomIds: [],
        selectedRoomId: '',
        loading: false,
        error: null,
        onRetry: vi.fn(),
        onSelect: vi.fn(),
      }),
    )

    const tradingRoom = await screen.findByRole('option', { name: /Room 1/ })
    const socialRoom = screen.getByRole('option', { name: /Room 2/ })

    expect(tradingRoom.className).toContain('bg-cyan')
    expect(socialRoom.className).toContain('bg-fuchsia')
    expect(tradingRoom.querySelector('[data-curve-tier="club"]')?.className).toContain(
      'ring-sky-400',
    )
    expect(socialRoom.querySelector('[data-curve-tier]')).toBeNull()
    expect(tradingRoom.textContent).not.toContain('TRD')
    expect(socialRoom.textContent).not.toContain('SOC')
  })
})
