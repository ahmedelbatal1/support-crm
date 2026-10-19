import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import AssignAgentForm from '@/components/AssignAgentForm.vue'
import { useTicketsStore } from '@/stores/tickets'
import { assignTicket, getTicket } from '@/api/tickets'

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

const OMAR = { id: 2, name: 'Omar Hassan', email: 'omar@example.com' }
const LINA = { id: 5, name: 'Lina Saad', email: 'lina@example.com' }
const AGENTS = [LINA, OMAR]

function ticket(overrides = {}) {
  return { id: 12, number: 'TCK-0012', agent: null, is_closed: false, history: [], ...overrides }
}

function mountForm(props = {}) {
  return mount(AssignAgentForm, { props: { ticket: ticket(), agents: AGENTS, ...props } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('AssignAgentForm', () => {
  it('lists the agents after a placeholder', () => {
    const wrapper = mountForm()

    expect(wrapper.findAll('option').map((o) => o.text())).toEqual([
      'Select an agent',
      'Lina Saad',
      'Omar Hassan',
    ])
    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('select').attributes('id'))
  })

  it('shows "Assign" for an unassigned ticket, with nothing selected', () => {
    const wrapper = mountForm()

    expect(wrapper.get('button').text()).toBe('Assign')
    expect(wrapper.get('select').element.value).toBe('')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })

  it('shows "Reassign" with the current agent selected', () => {
    const wrapper = mountForm({ ticket: ticket({ agent: OMAR }) })

    expect(wrapper.get('button').text()).toBe('Reassign')
    expect(wrapper.get('select').element.value).toBe('2')
  })

  it('assigns the chosen agent through the store (US4-AS1)', async () => {
    const assigned = ticket({ agent: LINA })
    assignTicket.mockResolvedValue(assigned)
    const wrapper = mountForm()
    const store = useTicketsStore()

    await wrapper.get('select').setValue('5')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(assignTicket).toHaveBeenCalledWith(12, 5)
    expect(store.currentTicket).toEqual(assigned)
    expect(wrapper.find('.field-error').exists()).toBe(false)
  })

  it('reassigns to another agent (US4-AS2)', async () => {
    assignTicket.mockResolvedValue(ticket({ agent: LINA }))
    const wrapper = mountForm({ ticket: ticket({ agent: OMAR }) })

    await wrapper.get('select').setValue('5')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(assignTicket).toHaveBeenCalledWith(12, 5)
  })

  it('disables the button while saving', async () => {
    let resolve
    assignTicket.mockReturnValue(new Promise((r) => (resolve = r)))
    const wrapper = mountForm()

    await wrapper.get('select').setValue('2')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('select').attributes('disabled')).toBeDefined()

    resolve(ticket({ agent: OMAR }))
    await flushPromises()
    expect(wrapper.get('select').attributes('disabled')).toBeUndefined()
  })

  it('selects the new agent when the ticket changes', async () => {
    const wrapper = mountForm()

    await wrapper.setProps({ ticket: ticket({ agent: LINA }) })

    expect(wrapper.get('select').element.value).toBe('5')
    expect(wrapper.get('button').text()).toBe('Reassign')
  })

  it('on a 422, shows the message and silently re-fetches the ticket (US4-AS3)', async () => {
    assignTicket.mockRejectedValue({
      status: 422,
      message: 'Ticket is already assigned to Omar Hassan.',
      errors: { agent_id: ['Ticket is already assigned to Omar Hassan.'] },
    })
    getTicket.mockResolvedValue(ticket({ agent: OMAR }))
    const wrapper = mountForm({ ticket: ticket({ agent: OMAR }) })
    const store = useTicketsStore()

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.field-error').text()).toBe('Ticket is already assigned to Omar Hassan.')
    expect(getTicket).toHaveBeenCalledWith(12)
    expect(store.ticketLoading).toBe(false)
    expect(store.currentTicket).toEqual(ticket({ agent: OMAR }))
  })

  it('keeps the 422 message on screen after the re-fetch updates the ticket', async () => {
    assignTicket.mockRejectedValue({
      status: 422,
      message: 'Closed tickets cannot be changed.',
      errors: { agent_id: ['Closed tickets cannot be changed.'] },
    })
    getTicket.mockResolvedValue(ticket({ agent: OMAR, is_closed: true }))
    const wrapper = mountForm({ ticket: ticket({ agent: OMAR }) })

    await wrapper.get('select').setValue('5')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.setProps({ ticket: useTicketsStore().currentTicket })

    // Closed elsewhere: the controls go away but the rule's message stays.
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.get('.field-error').text()).toBe('Closed tickets cannot be changed.')
  })

  it('shows no controls for a closed ticket', () => {
    const wrapper = mountForm({ ticket: ticket({ agent: OMAR, is_closed: true }) })

    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('.field-error').exists()).toBe(false)
  })

  it('clears the error when a different ticket is shown', async () => {
    assignTicket.mockRejectedValue({ status: 0, message: 'Cannot reach the server.', errors: {} })
    const wrapper = mountForm()
    await wrapper.get('select').setValue('2')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    await wrapper.setProps({ ticket: ticket({ id: 13, number: 'TCK-0013' }) })

    expect(wrapper.find('.field-error').exists()).toBe(false)
  })

  it('shows other failures without re-fetching', async () => {
    assignTicket.mockRejectedValue({ status: 0, message: 'Cannot reach the server.', errors: {} })
    const wrapper = mountForm()

    await wrapper.get('select').setValue('2')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.field-error').text()).toBe('Cannot reach the server.')
    expect(getTicket).not.toHaveBeenCalled()
  })

  it('clears the error on the next attempt', async () => {
    assignTicket
      .mockRejectedValueOnce({ status: 0, message: 'Cannot reach the server.', errors: {} })
      .mockReturnValueOnce(new Promise(() => {}))
    const wrapper = mountForm()

    await wrapper.get('select').setValue('2')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('form').trigger('submit')

    expect(wrapper.find('.field-error').exists()).toBe(false)
  })

  it('renders agent names as text', () => {
    const wrapper = mountForm({ agents: [{ id: 9, name: '<b>Bold</b>', email: 'b@example.com' }] })

    expect(wrapper.find('option b').exists()).toBe(false)
    expect(wrapper.findAll('option')[1].text()).toBe('<b>Bold</b>')
  })
})
