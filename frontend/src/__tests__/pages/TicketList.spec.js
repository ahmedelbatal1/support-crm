import { describe, it, expect, beforeEach, vi } from 'vitest'
import { h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

import TicketList from '@/pages/TicketList.vue'
import TicketFilters from '@/components/TicketFilters.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import { listTickets } from '@/api/tickets'
import { getMeta, getAgents } from '@/api/meta'
import { formatDateTime } from '@/utils/format'

vi.mock('@/api/tickets', () => ({
  listTickets: vi.fn(),
  getTicket: vi.fn(),
  createTicket: vi.fn(),
  assignTicket: vi.fn(),
  changeStatus: vi.fn(),
  addNote: vi.fn(),
}))

vi.mock('@/api/meta', () => ({
  getMeta: vi.fn(),
  getAgents: vi.fn(),
}))

const META = {
  statuses: [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
  ],
  priorities: [{ value: 'high', label: 'High' }],
  categories: [{ value: 'billing', label: 'Billing' }],
  transitions: {},
}

const AGENTS = [{ id: 2, name: 'Omar Hassan', email: 'omar@example.com' }]

const EMPTY = { status: '', priority: '', category: '', agent_id: '', search: '' }

function ticket(overrides = {}) {
  return {
    id: 12,
    number: 'TCK-0012',
    subject: 'Refund not received',
    status: { value: 'open', label: 'Open' },
    priority: { value: 'high', label: 'High' },
    category: { value: 'billing', label: 'Billing' },
    customer: { id: 3, name: 'Sara Ali', email: 'sara@example.com', phone: null },
    agent: { id: 2, name: 'Omar Hassan', email: 'omar@example.com' },
    created_at: '2026-10-07T06:00:00.000000Z',
    ...overrides,
  }
}

function listBody(data, meta = {}) {
  return {
    data,
    links: {},
    meta: { current_page: 1, last_page: 1, per_page: 15, total: data.length, ...meta },
  }
}

async function mountAt(url) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tickets', name: 'tickets', component: TicketList },
      { path: '/tickets/:id', component: { render: () => h('p', 'Detail page') } },
    ],
  })
  router.push(url)
  await router.isReady()

  const wrapper = mount(TicketList, { global: { plugins: [router] } })
  await flushPromises()

  return { wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  getMeta.mockResolvedValue(META)
  getAgents.mockResolvedValue(AGENTS)
  listTickets.mockResolvedValue(listBody([ticket()]))
})

describe('TicketList page', () => {
  it('loads the reference data and the page of tickets from the URL query', async () => {
    const { wrapper } = await mountAt('/tickets?status=open&agent_id=none&search=refund&page=2')

    expect(getMeta).toHaveBeenCalledTimes(1)
    expect(getAgents).toHaveBeenCalledTimes(1)
    expect(listTickets).toHaveBeenCalledWith({
      status: 'open',
      agent_id: 'none',
      search: 'refund',
      page: 2,
    })
    expect(wrapper.findComponent(TicketFilters).props('filters')).toEqual({
      ...EMPTY,
      status: 'open',
      agent_id: 'none',
      search: 'refund',
    })
  })

  it('ignores a page that is not a positive number', async () => {
    await mountAt('/tickets?page=abc')

    expect(listTickets).toHaveBeenCalledWith({ page: 1 })
  })

  it('shows each ticket with its columns', async () => {
    listTickets.mockResolvedValue(
      listBody([ticket(), ticket({ id: 13, number: 'TCK-0013', agent: null })]),
    )
    const { wrapper } = await mountAt('/tickets')

    const headers = wrapper.findAll('thead th').map((th) => th.text())
    expect(headers).toEqual([
      'Number',
      'Subject',
      'Customer',
      'Status',
      'Priority',
      'Category',
      'Agent',
      'Created',
    ])

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)

    const cells = rows[0].findAll('td').map((td) => td.text())
    expect(cells).toEqual([
      'TCK-0012',
      'Refund not received',
      'Sara Ali',
      'Open',
      'High',
      'Billing',
      'Omar Hassan',
      formatDateTime('2026-10-07T06:00:00.000000Z'),
    ])
    expect(rows[0].get('a').attributes('href')).toBe('/tickets/12')
    expect(rows[0].find('.badge--open').exists()).toBe(true)
    expect(rows[1].findAll('td')[6].text()).toBe('Unassigned')
  })

  it('renders ticket text as text, not HTML', async () => {
    listTickets.mockResolvedValue(listBody([ticket({ subject: '<img src=x onerror=alert(1)>' })]))
    const { wrapper } = await mountAt('/tickets')

    expect(wrapper.find('tbody img').exists()).toBe(false)
    expect(wrapper.find('tbody').text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('shows the loading state while the first page loads', async () => {
    listTickets.mockReturnValue(new Promise(() => {}))
    const { wrapper } = await mountAt('/tickets')

    expect(wrapper.find('.state--loading').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('shows the empty state instead of an empty table (US2-AS7)', async () => {
    listTickets.mockResolvedValue(listBody([]))
    const { wrapper } = await mountAt('/tickets?status=closed')

    expect(wrapper.find('.state--empty').text()).toBe('No tickets match these filters.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('shows the list error and retries the same request', async () => {
    listTickets.mockRejectedValueOnce({
      status: 0,
      message: 'Cannot reach the server.',
      errors: {},
    })
    const { wrapper } = await mountAt('/tickets?priority=high&page=2')

    const error = wrapper.get('.state--error')
    expect(error.text()).toContain('Cannot reach the server.')

    await error.get('button').trigger('click')
    await flushPromises()

    expect(listTickets).toHaveBeenCalledTimes(2)
    expect(listTickets).toHaveBeenLastCalledWith({ priority: 'high', page: 2 })
    expect(wrapper.find('.state--error').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })

  it('puts new filters in the URL, back on page 1, and fetches them (US2-AS4)', async () => {
    const { wrapper, router } = await mountAt('/tickets?page=3')

    wrapper.findComponent(TicketFilters).vm.$emit('change', {
      ...EMPTY,
      status: 'in_progress',
      priority: 'high',
      search: 'refund',
    })
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({
      status: 'in_progress',
      priority: 'high',
      search: 'refund',
    })
    expect(listTickets).toHaveBeenLastCalledWith({
      status: 'in_progress',
      priority: 'high',
      search: 'refund',
      page: 1,
    })
  })

  it('keeps the filters in the URL when changing page', async () => {
    listTickets.mockResolvedValue(listBody([ticket()], { last_page: 2, total: 20 }))
    const { wrapper, router } = await mountAt('/tickets?status=open')

    wrapper.findComponent(PaginationBar).vm.$emit('page', 2)
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ status: 'open', page: '2' })
    expect(listTickets).toHaveBeenLastCalledWith({ status: 'open', page: 2 })
  })

  it('restores the previous filters on back navigation', async () => {
    const { wrapper, router } = await mountAt('/tickets?status=open')

    wrapper.findComponent(TicketFilters).vm.$emit('change', { ...EMPTY, status: 'in_progress' })
    await flushPromises()

    router.back()
    await flushPromises()
    // Memory history resolves back() asynchronously.
    await new Promise((resolve) => setTimeout(resolve))
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ status: 'open' })
    expect(listTickets).toHaveBeenLastCalledWith({ status: 'open', page: 1 })
    expect(wrapper.findComponent(TicketFilters).props('filters').status).toBe('open')
  })

  it('shows pagination when there are tickets', async () => {
    listTickets.mockResolvedValue(listBody([ticket()], { last_page: 2, total: 20 }))
    const { wrapper } = await mountAt('/tickets')

    expect(wrapper.findComponent(PaginationBar).text()).toContain('Page 1 of 2 (20 tickets)')
  })

  it('shows an inline error above the filters when reference data fails, and still loads tickets', async () => {
    getMeta.mockRejectedValueOnce({ status: 500, message: 'Server Error', errors: {} })
    const { wrapper } = await mountAt('/tickets')

    const error = wrapper.get('.state--error')
    expect(error.text()).toContain('Could not load the filter options: Server Error')
    expect(wrapper.html().indexOf('state--error')).toBeLessThan(wrapper.html().indexOf('filters'))
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)

    await error.get('button').trigger('click')
    await flushPromises()

    expect(getMeta).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.state--error').exists()).toBe(false)
    expect(wrapper.findComponent(TicketFilters).props('meta')).toEqual(META)
  })
})
