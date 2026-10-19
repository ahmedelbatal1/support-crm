import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { useTicketsStore } from '@/stores/tickets'
import { getMeta, getAgents } from '@/api/meta'

vi.mock('@/api/meta', () => ({
  getMeta: vi.fn(),
  getAgents: vi.fn(),
}))

vi.mock('@/api/tickets', () => ({
  listTickets: vi.fn(),
  getTicket: vi.fn(),
  createTicket: vi.fn(),
  assignTicket: vi.fn(),
  changeStatus: vi.fn(),
  addNote: vi.fn(),
}))

const META = {
  statuses: [{ value: 'open', label: 'Open' }],
  priorities: [{ value: 'low', label: 'Low' }],
  categories: [{ value: 'billing', label: 'Billing' }],
  transitions: { open: ['in_progress'], in_progress: ['resolved'], resolved: [], closed: [] },
}

const AGENTS = [{ id: 1, name: 'Omar Hassan', email: 'omar@example.com' }]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  getMeta.mockResolvedValue(META)
  getAgents.mockResolvedValue(AGENTS)
})

describe('tickets store: reference data', () => {
  it('starts empty and not loading', () => {
    const store = useTicketsStore()

    expect(store.meta).toBeNull()
    expect(store.agents).toEqual([])
    expect(store.metaLoading).toBe(false)
    expect(store.metaError).toBeNull()
  })

  it('loads meta and agents together', async () => {
    const store = useTicketsStore()

    const pending = store.loadReferenceData()
    expect(store.metaLoading).toBe(true)
    await pending

    expect(getMeta).toHaveBeenCalledTimes(1)
    expect(getAgents).toHaveBeenCalledTimes(1)
    expect(store.meta).toEqual(META)
    expect(store.agents).toEqual(AGENTS)
    expect(store.metaLoading).toBe(false)
    expect(store.metaError).toBeNull()
  })

  it('does not fetch again once loaded', async () => {
    const store = useTicketsStore()

    await store.loadReferenceData()
    await store.loadReferenceData()

    expect(getMeta).toHaveBeenCalledTimes(1)
    expect(getAgents).toHaveBeenCalledTimes(1)
  })

  it('shares one request between calls made while loading', async () => {
    const store = useTicketsStore()

    await Promise.all([store.loadReferenceData(), store.loadReferenceData()])

    expect(getMeta).toHaveBeenCalledTimes(1)
    expect(getAgents).toHaveBeenCalledTimes(1)
  })

  it('sets metaError and keeps data empty when a request fails', async () => {
    getAgents.mockRejectedValue({ status: 0, message: 'Cannot reach the server.', errors: {} })
    const store = useTicketsStore()

    await store.loadReferenceData()

    expect(store.metaError).toBe('Cannot reach the server.')
    expect(store.meta).toBeNull()
    expect(store.agents).toEqual([])
    expect(store.metaLoading).toBe(false)
  })

  it('retries after a failure and clears the error', async () => {
    getMeta.mockRejectedValueOnce({ status: 500, message: 'Server Error', errors: {} })
    const store = useTicketsStore()

    await store.loadReferenceData()
    expect(store.metaError).toBe('Server Error')

    await store.loadReferenceData()

    expect(getMeta).toHaveBeenCalledTimes(2)
    expect(store.metaError).toBeNull()
    expect(store.meta).toEqual(META)
    expect(store.agents).toEqual(AGENTS)
  })
})
