import { describe, it, expect, beforeEach, vi } from 'vitest'
import { h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

import TicketDetail from '@/pages/TicketDetail.vue'
import HistoryList from '@/components/HistoryList.vue'
import { getTicket } from '@/api/tickets'
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

const CREATED = '2026-10-07T06:00:00.000000Z'

const HISTORY = [
  { id: 40, event: 'created', description: 'Ticket TCK-0012 created', created_at: CREATED },
  {
    id: 41,
    event: 'assigned',
    description: 'Assigned to Omar Hassan',
    created_at: '2026-10-07T06:05:00.000000Z',
  },
  {
    id: 42,
    event: 'status_changed',
    description: 'Status changed from Open to In Progress',
    created_at: '2026-10-07T06:10:00.000000Z',
  },
  {
    id: 43,
    event: 'note_added',
    description: 'Note added',
    created_at: '2026-10-07T06:15:00.000000Z',
  },
]

function ticket(overrides = {}) {
  return {
    id: 12,
    number: 'TCK-0012',
    subject: 'Refund not received',
    description: 'Paid twice in September.',
    status: { value: 'in_progress', label: 'In Progress' },
    priority: { value: 'high', label: 'High' },
    category: { value: 'billing', label: 'Billing' },
    is_closed: false,
    allowed_transitions: [],
    customer: { id: 3, name: 'Sara Ali', email: 'sara@example.com', phone: '+966500000000' },
    agent: { id: 2, name: 'Omar Hassan', email: 'omar@example.com' },
    notes: [
      { id: 5, body: 'Called customer.', created_at: '2026-10-07T06:15:00.000000Z' },
      { id: 6, body: 'Refund requested.', created_at: '2026-10-07T07:00:00.000000Z' },
    ],
    history: HISTORY,
    created_at: CREATED,
    updated_at: '2026-10-07T07:00:00.000000Z',
    ...overrides,
  }
}

async function mountAt(url) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tickets', name: 'tickets', component: { render: () => h('p', 'List page') } },
      { path: '/tickets/:id', name: 'ticket-detail', component: TicketDetail },
    ],
  })
  router.push(url)
  await router.isReady()

  const wrapper = mount(TicketDetail, { global: { plugins: [router] } })
  await flushPromises()

  return { wrapper, router }
}

function field(wrapper, label) {
  const term = wrapper.findAll('dt').find((dt) => dt.text() === label)
  return term?.element.nextElementSibling.textContent.trim()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  getTicket.mockResolvedValue(ticket())
})

describe('TicketDetail page', () => {
  it('loads the ticket from the route id', async () => {
    await mountAt('/tickets/12')

    expect(getTicket).toHaveBeenCalledWith('12')
  })

  it('shows the ticket details (US3-AS1)', async () => {
    const { wrapper } = await mountAt('/tickets/12')

    expect(wrapper.get('h1').text()).toBe('TCK-0012 Refund not received')
    expect(wrapper.find('.badge--in_progress').text()).toBe('In Progress')
    expect(wrapper.get('.ticket-description').text()).toBe('Paid twice in September.')
    expect(field(wrapper, 'Priority')).toBe('High')
    expect(field(wrapper, 'Category')).toBe('Billing')
    expect(field(wrapper, 'Created')).toBe(formatDateTime(CREATED))
    expect(field(wrapper, 'Agent')).toBe('Omar Hassan')
  })

  it('shows the customer block', async () => {
    const { wrapper } = await mountAt('/tickets/12')

    const customer = wrapper.get('.ticket-customer')
    expect(field(customer, 'Name')).toBe('Sara Ali')
    expect(field(customer, 'Email')).toBe('sara@example.com')
    expect(field(customer, 'Phone')).toBe('+966500000000')
  })

  it('shows placeholders for a missing phone and description', async () => {
    getTicket.mockResolvedValue(
      ticket({
        description: null,
        customer: { id: 3, name: 'Sara Ali', email: 'sara@example.com', phone: null },
      }),
    )
    const { wrapper } = await mountAt('/tickets/12')

    expect(field(wrapper.get('.ticket-customer'), 'Phone')).toBe('—')
    expect(wrapper.get('.ticket-description').text()).toBe('No description.')
  })

  it('shows "Unassigned" when there is no agent (US3-AS2)', async () => {
    getTicket.mockResolvedValue(ticket({ agent: null }))
    const { wrapper } = await mountAt('/tickets/12')

    expect(field(wrapper, 'Agent')).toBe('Unassigned')
  })

  it('shows the notes oldest first with their times', async () => {
    const { wrapper } = await mountAt('/tickets/12')

    const notes = wrapper.findAll('.ticket-notes li')
    expect(notes).toHaveLength(2)
    expect(notes[0].text()).toContain('Called customer.')
    expect(notes[0].get('time').text()).toBe(formatDateTime('2026-10-07T06:15:00.000000Z'))
    expect(notes[0].get('time').attributes('datetime')).toBe('2026-10-07T06:15:00.000000Z')
    expect(notes[1].text()).toContain('Refund requested.')
  })

  it('shows "No notes yet." when there are no notes', async () => {
    getTicket.mockResolvedValue(ticket({ notes: [] }))
    const { wrapper } = await mountAt('/tickets/12')

    expect(wrapper.get('.ticket-notes').text()).toContain('No notes yet.')
    expect(wrapper.findAll('.ticket-notes li')).toHaveLength(0)
  })

  it('shows the history oldest first with times', async () => {
    const { wrapper } = await mountAt('/tickets/12')

    const entries = wrapper.findComponent(HistoryList).findAll('li')
    expect(entries.map((li) => li.get('.history-description').text())).toEqual([
      'Ticket TCK-0012 created',
      'Assigned to Omar Hassan',
      'Status changed from Open to In Progress',
      'Note added',
    ])
    expect(entries[0].get('time').text()).toBe(formatDateTime(CREATED))
  })

  it('renders user text as text, not HTML', async () => {
    getTicket.mockResolvedValue(
      ticket({
        subject: '<script>alert(1)</script>',
        description: '<b>bold</b>',
        notes: [{ id: 5, body: '<img src=x onerror=alert(1)>', created_at: CREATED }],
      }),
    )
    const { wrapper } = await mountAt('/tickets/12')

    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toContain('<script>alert(1)</script>')
    expect(wrapper.get('.ticket-description').text()).toBe('<b>bold</b>')
    expect(wrapper.get('.ticket-notes').text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('has a link back to the list', async () => {
    const { wrapper } = await mountAt('/tickets/12')

    expect(wrapper.get('a.back-link').attributes('href')).toBe('/tickets')
  })

  it('shows the loading state while the ticket loads', async () => {
    getTicket.mockReturnValue(new Promise(() => {}))
    const { wrapper } = await mountAt('/tickets/12')

    expect(wrapper.find('.state--loading').exists()).toBe(true)
    expect(wrapper.find('h1').exists()).toBe(false)
  })

  it('shows "Ticket not found." with a link back on a 404 (US3-AS3)', async () => {
    getTicket.mockRejectedValue({ status: 404, message: 'Ticket not found.', errors: {} })
    const { wrapper } = await mountAt('/tickets/999999')

    const state = wrapper.get('.state--notfound')
    expect(state.text()).toContain('Ticket not found.')
    expect(state.get('a').text()).toBe('Back to tickets')
    expect(state.get('a').attributes('href')).toBe('/tickets')
    expect(wrapper.find('h1').exists()).toBe(false)
  })

  it('shows the error with a retry that loads the ticket again', async () => {
    getTicket.mockRejectedValueOnce({ status: 0, message: 'Cannot reach the server.', errors: {} })
    const { wrapper } = await mountAt('/tickets/12')

    const error = wrapper.get('.state--error')
    expect(error.text()).toContain('Cannot reach the server.')

    await error.get('button').trigger('click')
    await flushPromises()

    expect(getTicket).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.state--error').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toContain('TCK-0012')
  })

  it('loads the new ticket when the route id changes', async () => {
    const { wrapper, router } = await mountAt('/tickets/12')
    getTicket.mockResolvedValue(ticket({ id: 13, number: 'TCK-0013', subject: 'Login fails' }))

    await router.push('/tickets/13')
    await flushPromises()

    expect(getTicket).toHaveBeenLastCalledWith('13')
    expect(wrapper.get('h1').text()).toBe('TCK-0013 Login fails')
  })
})

describe('HistoryList', () => {
  it('shows a message when there is no history', () => {
    const wrapper = mount(HistoryList, { props: { entries: [] } })

    expect(wrapper.text()).toBe('No history yet.')
  })
})
