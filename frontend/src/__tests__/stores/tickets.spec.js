import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { useTicketsStore } from '@/stores/tickets'
import { getMeta, getAgents } from '@/api/meta'
import { listTickets } from '@/api/tickets'

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

const TICKET = { id: 12, number: 'TCK-0012', subject: 'Refund not received' }

function listBody(data, meta = {}) {
  return {
    data,
    links: { first: null, last: null, prev: null, next: null },
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 15,
      total: data.length,
      from: 1,
      to: 1,
      ...meta,
    },
  }
}

describe('tickets store: list', () => {
  beforeEach(() => {
    listTickets.mockResolvedValue(listBody([TICKET]))
  })

  it('starts with an empty list, empty filters and page 1', () => {
    const store = useTicketsStore()

    expect(store.tickets).toEqual([])
    expect(store.pagination).toEqual({ current_page: 1, last_page: 1, per_page: 15, total: 0 })
    expect(store.filters).toEqual({
      status: '',
      priority: '',
      category: '',
      agent_id: '',
      search: '',
    })
    expect(store.listLoading).toBe(false)
    expect(store.listError).toBeNull()
  })

  it('fetches page 1 with no filters by default', async () => {
    const store = useTicketsStore()

    const pending = store.fetchTickets()
    expect(store.listLoading).toBe(true)
    await pending

    expect(listTickets).toHaveBeenCalledWith({ page: 1 })
    expect(store.tickets).toEqual([TICKET])
    expect(store.pagination).toEqual({ current_page: 1, last_page: 1, per_page: 15, total: 1 })
    expect(store.listLoading).toBe(false)
  })

  it('sends only the filters that are set, with the page', async () => {
    listTickets.mockResolvedValue(listBody([TICKET], { current_page: 2, last_page: 3, total: 31 }))
    const store = useTicketsStore()

    await store.fetchTickets(
      { status: 'open', priority: '', category: null, agent_id: 'none', search: '  refund ' },
      2,
    )

    expect(listTickets).toHaveBeenCalledWith({
      status: 'open',
      agent_id: 'none',
      search: 'refund',
      page: 2,
    })
    expect(store.filters).toEqual({
      status: 'open',
      priority: '',
      category: '',
      agent_id: 'none',
      search: '  refund ',
    })
    expect(store.pagination).toEqual({ current_page: 2, last_page: 3, per_page: 15, total: 31 })
  })

  it('keeps agent ids as given and drops a blank search', async () => {
    const store = useTicketsStore()

    await store.fetchTickets({ agent_id: 3, search: '   ' })

    expect(listTickets).toHaveBeenCalledWith({ agent_id: 3, page: 1 })
  })

  it('sets listError on failure and clears it on the next success', async () => {
    listTickets.mockRejectedValueOnce({
      status: 422,
      message: 'The selected status is invalid.',
      errors: { status: ['The selected status is invalid.'] },
    })
    const store = useTicketsStore()

    await store.fetchTickets({ status: 'pending' })

    expect(store.listError).toBe('The selected status is invalid.')
    expect(store.listLoading).toBe(false)

    await store.fetchTickets()

    expect(store.listError).toBeNull()
    expect(store.tickets).toEqual([TICKET])
  })

  it('keeps only the latest response when requests overlap', async () => {
    let resolveFirst
    listTickets
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(listBody([TICKET]))
    const store = useTicketsStore()

    const first = store.fetchTickets({ search: 'ref' })
    await store.fetchTickets({ search: 'refund' })
    resolveFirst(listBody([{ id: 1, number: 'TCK-0001', subject: 'Old' }]))
    await first

    expect(store.tickets).toEqual([TICKET])
    expect(store.filters.search).toBe('refund')
    expect(store.listLoading).toBe(false)
  })
})
