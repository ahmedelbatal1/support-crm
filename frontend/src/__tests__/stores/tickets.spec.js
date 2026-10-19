import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { useTicketsStore } from '@/stores/tickets'
import { getMeta, getAgents } from '@/api/meta'
import { listTickets, getTicket } from '@/api/tickets'

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

describe('tickets store: current ticket', () => {
  const DETAIL = {
    id: 12,
    number: 'TCK-0012',
    subject: 'Refund not received',
    notes: [],
    history: [],
  }
  const NOT_FOUND = { status: 404, message: 'Ticket not found.', errors: {} }

  beforeEach(() => {
    getTicket.mockResolvedValue(DETAIL)
  })

  it('starts with no ticket and no flags', () => {
    const store = useTicketsStore()

    expect(store.currentTicket).toBeNull()
    expect(store.ticketLoading).toBe(false)
    expect(store.ticketError).toBeNull()
    expect(store.ticketNotFound).toBe(false)
  })

  it('loads a ticket by id (US3-AS1)', async () => {
    const store = useTicketsStore()

    const pending = store.fetchTicket('12')
    expect(store.ticketLoading).toBe(true)
    await pending

    expect(getTicket).toHaveBeenCalledWith('12')
    expect(store.currentTicket).toEqual(DETAIL)
    expect(store.ticketLoading).toBe(false)
  })

  it('sets ticketNotFound on a 404 (US3-AS3)', async () => {
    getTicket.mockRejectedValue(NOT_FOUND)
    const store = useTicketsStore()

    await store.fetchTicket(999999)

    expect(store.ticketNotFound).toBe(true)
    expect(store.ticketError).toBeNull()
    expect(store.currentTicket).toBeNull()
    expect(store.ticketLoading).toBe(false)
  })

  it('sets ticketError on other failures and clears it on the next load', async () => {
    getTicket.mockRejectedValueOnce({ status: 0, message: 'Cannot reach the server.', errors: {} })
    const store = useTicketsStore()

    await store.fetchTicket(12)
    expect(store.ticketError).toBe('Cannot reach the server.')
    expect(store.ticketNotFound).toBe(false)

    await store.fetchTicket(12)
    expect(store.ticketError).toBeNull()
    expect(store.currentTicket).toEqual(DETAIL)
  })

  it('clears a 404 when another ticket loads', async () => {
    getTicket.mockRejectedValueOnce(NOT_FOUND)
    const store = useTicketsStore()

    await store.fetchTicket(999999)
    await store.fetchTicket(12)

    expect(store.ticketNotFound).toBe(false)
    expect(store.currentTicket).toEqual(DETAIL)
  })

  it('does not show the previous ticket while a different one loads', async () => {
    const store = useTicketsStore()
    await store.fetchTicket(12)

    getTicket.mockReturnValue(new Promise(() => {}))
    store.fetchTicket(13)

    expect(store.currentTicket).toBeNull()
    expect(store.ticketLoading).toBe(true)
  })

  it('keeps the same ticket on screen while it reloads', async () => {
    const store = useTicketsStore()
    await store.fetchTicket(12)

    getTicket.mockReturnValue(new Promise(() => {}))
    store.fetchTicket('12')

    expect(store.currentTicket).toEqual(DETAIL)
  })

  describe('silent mode', () => {
    it('replaces the ticket without touching ticketLoading', async () => {
      const store = useTicketsStore()
      await store.fetchTicket(12)

      const updated = { ...DETAIL, notes: [{ id: 1, body: 'Called customer.' }] }
      getTicket.mockResolvedValue(updated)

      const pending = store.fetchTicket(12, { silent: true })
      expect(store.ticketLoading).toBe(false)
      await pending

      expect(store.currentTicket).toEqual(updated)
      expect(store.ticketLoading).toBe(false)
    })

    it('keeps the ticket and sets no error when the silent request fails', async () => {
      const store = useTicketsStore()
      await store.fetchTicket(12)

      getTicket.mockRejectedValue({ status: 0, message: 'Cannot reach the server.', errors: {} })
      await store.fetchTicket(12, { silent: true })

      expect(store.currentTicket).toEqual(DETAIL)
      expect(store.ticketError).toBeNull()
      expect(store.ticketNotFound).toBe(false)
    })

    it('acts as a normal load when it starts while a normal load is in flight', async () => {
      let resolveFirst
      getTicket
        .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
        .mockResolvedValueOnce(DETAIL)
      const store = useTicketsStore()

      const first = store.fetchTicket(12)
      await store.fetchTicket(12, { silent: true })
      resolveFirst({ ...DETAIL, subject: 'Old' })
      await first

      expect(store.currentTicket).toEqual(DETAIL)
      expect(store.ticketLoading).toBe(false)
    })
  })

  it('keeps only the latest response when requests overlap', async () => {
    let resolveFirst
    getTicket
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ ...DETAIL, id: 13, number: 'TCK-0013' })
    const store = useTicketsStore()

    const first = store.fetchTicket(12)
    await store.fetchTicket(13)
    resolveFirst(DETAIL)
    await first

    expect(store.currentTicket.id).toBe(13)
    expect(store.ticketLoading).toBe(false)
  })
})
