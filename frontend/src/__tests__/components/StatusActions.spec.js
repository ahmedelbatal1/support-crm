import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import StatusActions from '@/components/StatusActions.vue'
import { useTicketsStore } from '@/stores/tickets'
import { changeStatus, getTicket } from '@/api/tickets'

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

const OPEN = {
  id: 12,
  status: { value: 'open', label: 'Open' },
  is_closed: false,
  allowed_transitions: [
    { value: 'in_progress', label: 'In Progress', action_label: 'In Progress' },
  ],
}

const IN_PROGRESS = {
  id: 12,
  status: { value: 'in_progress', label: 'In Progress' },
  is_closed: false,
  allowed_transitions: [{ value: 'resolved', label: 'Resolved', action_label: 'Resolved' }],
}

const RESOLVED = {
  id: 12,
  status: { value: 'resolved', label: 'Resolved' },
  is_closed: false,
  allowed_transitions: [
    { value: 'closed', label: 'Closed', action_label: 'Closed' },
    { value: 'in_progress', label: 'In Progress', action_label: 'Reopen' },
  ],
}

const CLOSED = {
  id: 12,
  status: { value: 'closed', label: 'Closed' },
  is_closed: true,
  allowed_transitions: [],
}

function mountActions(ticket) {
  return mount(StatusActions, { props: { ticket } })
}

function labels(wrapper) {
  return wrapper.findAll('button').map((b) => b.text())
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('StatusActions', () => {
  it('shows only "In Progress" for an open ticket', () => {
    expect(labels(mountActions(OPEN))).toEqual(['In Progress'])
  })

  it('shows only "Resolved" for an in-progress ticket', () => {
    expect(labels(mountActions(IN_PROGRESS))).toEqual(['Resolved'])
  })

  it('shows two buttons labelled from action_label for a resolved ticket', () => {
    expect(labels(mountActions(RESOLVED))).toEqual(['Closed', 'Reopen'])
  })

  it('shows no buttons for a closed ticket', () => {
    const wrapper = mountActions(CLOSED)

    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).toContain('No further status changes.')
  })

  it('sends the transition value, not the label (US5-AS5)', async () => {
    changeStatus.mockResolvedValue({ ...IN_PROGRESS })
    const wrapper = mountActions(RESOLVED)
    const store = useTicketsStore()

    await wrapper.findAll('button')[1].trigger('click')
    await flushPromises()

    expect(changeStatus).toHaveBeenCalledWith(12, 'in_progress')
    expect(store.currentTicket).toEqual(IN_PROGRESS)
  })

  it('moves an open ticket to In Progress through the store (US5-AS1)', async () => {
    changeStatus.mockResolvedValue(IN_PROGRESS)
    const wrapper = mountActions(OPEN)

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(changeStatus).toHaveBeenCalledWith(12, 'in_progress')
    expect(wrapper.find('.field-error').exists()).toBe(false)
  })

  it('disables every button while saving', async () => {
    let resolve
    changeStatus.mockReturnValue(new Promise((r) => (resolve = r)))
    const wrapper = mountActions(RESOLVED)

    await wrapper.findAll('button')[0].trigger('click')

    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined()
    }
    await wrapper.findAll('button')[1].trigger('click')
    expect(changeStatus).toHaveBeenCalledTimes(1)

    resolve(CLOSED)
    await flushPromises()
  })

  it('on a 422, shows errors.status and silently re-fetches the ticket (US5-AS2)', async () => {
    changeStatus.mockRejectedValue({
      status: 422,
      message: 'Assign an agent before moving the ticket to In Progress.',
      errors: { status: ['Assign an agent before moving the ticket to In Progress.'] },
    })
    getTicket.mockResolvedValue(OPEN)
    const wrapper = mountActions(OPEN)
    const store = useTicketsStore()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.field-error').text()).toBe(
      'Assign an agent before moving the ticket to In Progress.',
    )
    expect(getTicket).toHaveBeenCalledWith(12)
    expect(store.ticketLoading).toBe(false)
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  })

  it('keeps the 422 message when the re-fetch shows the ticket was closed elsewhere', async () => {
    changeStatus.mockRejectedValue({
      status: 422,
      message: 'Closed tickets cannot be changed.',
      errors: { status: ['Closed tickets cannot be changed.'] },
    })
    getTicket.mockResolvedValue(CLOSED)
    const wrapper = mountActions(RESOLVED)

    await wrapper.findAll('button')[0].trigger('click')
    await flushPromises()
    await wrapper.setProps({ ticket: useTicketsStore().currentTicket })

    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.get('.field-error').text()).toBe('Closed tickets cannot be changed.')
  })

  it('shows other failures without re-fetching', async () => {
    changeStatus.mockRejectedValue({ status: 0, message: 'Cannot reach the server.', errors: {} })
    const wrapper = mountActions(OPEN)

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.field-error').text()).toBe('Cannot reach the server.')
    expect(getTicket).not.toHaveBeenCalled()
  })

  it('clears the error on the next attempt and when another ticket is shown', async () => {
    changeStatus
      .mockRejectedValueOnce({ status: 0, message: 'Cannot reach the server.', errors: {} })
      .mockReturnValueOnce(new Promise(() => {}))
    const wrapper = mountActions(OPEN)

    await wrapper.get('button').trigger('click')
    await flushPromises()
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('.field-error').exists()).toBe(false)

    changeStatus.mockRejectedValueOnce({
      status: 0,
      message: 'Cannot reach the server.',
      errors: {},
    })
    const other = mountActions(OPEN)
    await other.get('button').trigger('click')
    await flushPromises()
    await other.setProps({ ticket: { ...OPEN, id: 13 } })
    expect(other.find('.field-error').exists()).toBe(false)
  })
})
