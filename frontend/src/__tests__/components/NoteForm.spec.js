import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

import NoteForm from '@/components/NoteForm.vue'
import TicketDetail from '@/pages/TicketDetail.vue'
import { useTicketsStore } from '@/stores/tickets'
import { addNote, getTicket } from '@/api/tickets'
import { getMeta, getAgents } from '@/api/meta'

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

const CREATED_AT = '2026-10-07T06:15:00.000000Z'

function ticket(overrides = {}) {
  return { id: 12, is_closed: false, notes: [], history: [], ...overrides }
}

function mountForm(props = {}) {
  return mount(NoteForm, { props: { ticket: ticket(), ...props } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  getTicket.mockResolvedValue(ticket())
})

describe('NoteForm', () => {
  it('has a labelled textarea, a counter and an "Add note" button', () => {
    const wrapper = mountForm()
    const textarea = wrapper.get('textarea')

    expect(wrapper.get('label').attributes('for')).toBe(textarea.attributes('id'))
    expect(textarea.attributes('maxlength')).toBe('2000')
    expect(wrapper.get('.char-counter').text()).toBe('0 / 2000')
    expect(wrapper.get('button').text()).toBe('Add note')
  })

  it('counts the characters as they are typed', async () => {
    const wrapper = mountForm()

    await wrapper.get('textarea').setValue('Called customer.')

    expect(wrapper.get('.char-counter').text()).toBe('16 / 2000')
  })

  it('marks the counter when the limit is reached', async () => {
    const wrapper = mountForm()

    await wrapper.get('textarea').setValue('x'.repeat(2000))

    expect(wrapper.get('.char-counter').text()).toBe('2000 / 2000')
    expect(wrapper.get('.char-counter').classes()).toContain('char-counter--full')
  })

  it('adds the note through the store and clears the textarea (US6-AS1)', async () => {
    addNote.mockResolvedValue({ id: 7, body: 'Called customer.', created_at: CREATED_AT })
    const wrapper = mountForm()

    await wrapper.get('textarea').setValue('Called customer.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(addNote).toHaveBeenCalledWith(12, 'Called customer.')
    expect(wrapper.get('textarea').element.value).toBe('')
    expect(wrapper.get('.char-counter').text()).toBe('0 / 2000')
    expect(wrapper.find('.field-error').exists()).toBe(false)
  })

  it('sends HTML exactly as typed', async () => {
    addNote.mockResolvedValue({ id: 7, body: '<b>hi</b>', created_at: CREATED_AT })
    const wrapper = mountForm()

    await wrapper.get('textarea').setValue('<b>hi</b>')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(addNote).toHaveBeenCalledWith(12, '<b>hi</b>')
  })

  it('disables the textarea and button while saving', async () => {
    let resolve
    addNote.mockReturnValue(new Promise((r) => (resolve = r)))
    const wrapper = mountForm()

    await wrapper.get('textarea').setValue('Called customer.')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button').text()).toBe('Adding…')

    resolve({ id: 7, body: 'Called customer.', created_at: CREATED_AT })
    await flushPromises()
  })

  it('on a 422, keeps the message and the typed text and re-fetches silently (US6-AS2)', async () => {
    addNote.mockRejectedValue({
      status: 422,
      message: 'The body field is required.',
      errors: { body: ['The body field is required.'] },
    })
    const wrapper = mountForm()
    const store = useTicketsStore()

    await wrapper.get('textarea').setValue('   ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.field-error').text()).toBe('The body field is required.')
    expect(wrapper.get('textarea').element.value).toBe('   ')
    expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true')
    expect(getTicket).toHaveBeenCalledWith(12)
    expect(store.ticketLoading).toBe(false)
  })

  it('keeps the 422 message when the re-fetch shows the ticket was closed elsewhere (US6-AS3)', async () => {
    addNote.mockRejectedValue({
      status: 422,
      message: 'Closed tickets cannot be changed.',
      errors: { body: ['Closed tickets cannot be changed.'] },
    })
    getTicket.mockResolvedValue(ticket({ is_closed: true }))
    const wrapper = mountForm()

    await wrapper.get('textarea').setValue('Late note')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.setProps({ ticket: useTicketsStore().currentTicket })

    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.get('.field-error').text()).toBe('Closed tickets cannot be changed.')
  })

  it('shows no form for a closed ticket', () => {
    const wrapper = mountForm({ ticket: ticket({ is_closed: true }) })

    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('Closed tickets are read-only.')
  })

  it('shows other failures without re-fetching and keeps the text', async () => {
    addNote.mockRejectedValue({ status: 0, message: 'Cannot reach the server.', errors: {} })
    const wrapper = mountForm()

    await wrapper.get('textarea').setValue('Called customer.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.field-error').text()).toBe('Cannot reach the server.')
    expect(wrapper.get('textarea').element.value).toBe('Called customer.')
    expect(getTicket).not.toHaveBeenCalled()
  })

  it('clears the text and the error when another ticket is shown', async () => {
    addNote.mockRejectedValue({ status: 0, message: 'Cannot reach the server.', errors: {} })
    const wrapper = mountForm()
    await wrapper.get('textarea').setValue('Draft for ticket 12')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    await wrapper.setProps({ ticket: ticket({ id: 13 }) })

    expect(wrapper.get('textarea').element.value).toBe('')
    expect(wrapper.find('.field-error').exists()).toBe(false)
  })
})

describe('NoteForm on the ticket detail page', () => {
  async function mountDetail() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/tickets/:id', name: 'ticket-detail', component: TicketDetail }],
    })
    router.push('/tickets/12')
    await router.isReady()

    const wrapper = mount(TicketDetail, { global: { plugins: [router] } })
    await flushPromises()
    return wrapper
  }

  const BASE = {
    id: 12,
    number: 'TCK-0012',
    subject: 'Refund not received',
    description: null,
    status: { value: 'open', label: 'Open' },
    priority: { value: 'high', label: 'High' },
    category: { value: 'billing', label: 'Billing' },
    is_closed: false,
    allowed_transitions: [],
    customer: { id: 3, name: 'Sara Ali', email: 'sara@example.com', phone: null },
    agent: null,
    notes: [],
    history: [],
    created_at: CREATED_AT,
  }

  beforeEach(() => {
    getMeta.mockResolvedValue({ statuses: [], priorities: [], categories: [], transitions: {} })
    getAgents.mockResolvedValue([])
  })

  it('shows an added <b>hi</b> note as literal text, with its history entry', async () => {
    const note = { id: 7, body: '<b>hi</b>', created_at: CREATED_AT }
    getTicket.mockResolvedValueOnce(BASE).mockResolvedValueOnce({
      ...BASE,
      notes: [note],
      history: [{ id: 41, event: 'note_added', description: 'Note added', created_at: CREATED_AT }],
    })
    addNote.mockResolvedValue(note)
    const wrapper = await mountDetail()

    await wrapper.get('.ticket-notes textarea').setValue('<b>hi</b>')
    await wrapper.get('.ticket-notes form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.ticket-notes b').exists()).toBe(false)
    expect(wrapper.get('.note-body').text()).toBe('<b>hi</b>')
    expect(wrapper.text()).toContain('Note added')
  })

  it('renders the note form inside the notes section', async () => {
    getTicket.mockResolvedValue(BASE)
    const wrapper = await mountDetail()

    expect(wrapper.find('.ticket-notes').findComponent(NoteForm).exists()).toBe(true)
  })
})
