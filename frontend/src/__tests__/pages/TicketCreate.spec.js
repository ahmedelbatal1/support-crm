import { describe, it, expect, beforeEach, vi } from 'vitest'
import { h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

import TicketCreate from '@/pages/TicketCreate.vue'
import { createTicket } from '@/api/tickets'
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

const META = {
  statuses: [{ value: 'open', label: 'Open' }],
  priorities: [
    { value: 'low', label: 'Low' },
    { value: 'high', label: 'High' },
  ],
  categories: [
    { value: 'billing', label: 'Billing' },
    { value: 'technical', label: 'Technical' },
  ],
  transitions: {},
}

const CREATED = { id: 21, number: 'TCK-0021', subject: 'Refund not received' }

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tickets', component: { render: () => h('p', 'List page') } },
      { path: '/tickets/new', component: TicketCreate },
      { path: '/tickets/:id', component: { render: () => h('p', 'Detail page') } },
    ],
  })
  router.push('/tickets/new')
  await router.isReady()

  const wrapper = mount(TicketCreate, { global: { plugins: [router] } })
  await flushPromises()

  return { wrapper, router }
}

async function fillValid(wrapper) {
  await wrapper.get('#customer_name').setValue('Sara Ali')
  await wrapper.get('#customer_email').setValue('Sara@Example.com')
  await wrapper.get('#customer_phone').setValue('+966500000000')
  await wrapper.get('#subject').setValue('Refund not received')
  await wrapper.get('#description').setValue('Paid twice in September.')
  await wrapper.get('#category').setValue('billing')
  await wrapper.get('#priority').setValue('high')
}

function errorUnder(wrapper, id) {
  return wrapper.get(`#${id}`).element.closest('.form-field').querySelector('.field-error')
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  getMeta.mockResolvedValue(META)
  getAgents.mockResolvedValue([])
})

describe('TicketCreate page', () => {
  it('shows the loading state instead of the form while reference data loads', async () => {
    getMeta.mockReturnValue(new Promise(() => {}))
    const { wrapper } = await mountPage()

    expect(wrapper.find('.state--loading').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('shows the reference-data error with a retry that loads it again', async () => {
    getMeta.mockRejectedValueOnce({ status: 0, message: 'Cannot reach the server.', errors: {} })
    const { wrapper } = await mountPage()

    const error = wrapper.get('.state--error')
    expect(error.text()).toContain('Cannot reach the server.')
    expect(wrapper.find('form').exists()).toBe(false)

    await error.get('button').trigger('click')
    await flushPromises()

    expect(getMeta).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.state--error').exists()).toBe(false)
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('shows every input with a label, and the selects built from meta', async () => {
    const { wrapper } = await mountPage()

    for (const id of [
      'customer_name',
      'customer_email',
      'customer_phone',
      'subject',
      'description',
      'category',
      'priority',
    ]) {
      expect(wrapper.find(`label[for="${id}"]`).exists()).toBe(true)
    }
    expect(wrapper.findAll('#category option').map((o) => o.text())).toEqual([
      'Select a category',
      'Billing',
      'Technical',
    ])
    expect(wrapper.findAll('#priority option').map((o) => o.text())).toEqual([
      'Select a priority',
      'Low',
      'High',
    ])
  })

  it('submits the form and goes to the new ticket (US1-AS1)', async () => {
    createTicket.mockResolvedValue(CREATED)
    const { wrapper, router } = await mountPage()

    await fillValid(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createTicket).toHaveBeenCalledWith({
      customer_name: 'Sara Ali',
      customer_email: 'Sara@Example.com',
      customer_phone: '+966500000000',
      subject: 'Refund not received',
      description: 'Paid twice in September.',
      category: 'billing',
      priority: 'high',
    })
    expect(router.currentRoute.value.path).toBe('/tickets/21')
  })

  it('disables the submit button while saving', async () => {
    let resolve
    createTicket.mockReturnValue(new Promise((r) => (resolve = r)))
    const { wrapper } = await mountPage()
    await fillValid(wrapper)

    await wrapper.get('form').trigger('submit')
    const button = wrapper.get('button[type="submit"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toBe('Creating…')

    resolve(CREATED)
    await flushPromises()
  })

  it('shows 422 errors under the matching inputs and stays on the page (US1-AS3)', async () => {
    createTicket.mockRejectedValue({
      status: 422,
      message: 'The customer name field is required. (and 4 more errors)',
      errors: {
        customer_name: ['The customer name field is required.'],
        customer_email: ['The customer email field must be a valid email address.'],
        subject: ['The subject field is required.'],
        category: ['The category field is required.'],
        priority: ['The priority field is required.'],
      },
    })
    const { wrapper, router } = await mountPage()
    await wrapper.get('#customer_email').setValue('not-an-email')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(errorUnder(wrapper, 'customer_name').textContent).toBe(
      'The customer name field is required.',
    )
    expect(errorUnder(wrapper, 'customer_email').textContent).toBe(
      'The customer email field must be a valid email address.',
    )
    expect(errorUnder(wrapper, 'subject').textContent).toBe('The subject field is required.')
    expect(errorUnder(wrapper, 'category').textContent).toBe('The category field is required.')
    expect(errorUnder(wrapper, 'priority').textContent).toBe('The priority field is required.')
    expect(errorUnder(wrapper, 'customer_phone')).toBeNull()
    expect(errorUnder(wrapper, 'description')).toBeNull()

    expect(wrapper.get('#customer_name').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#customer_phone').attributes('aria-invalid')).toBeUndefined()
    expect(wrapper.get('#customer_email').element.value).toBe('not-an-email')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(router.currentRoute.value.path).toBe('/tickets/new')
  })

  it('clears the old field errors on the next submit', async () => {
    createTicket
      .mockRejectedValueOnce({
        status: 422,
        message: 'The subject field is required.',
        errors: { subject: ['The subject field is required.'] },
      })
      .mockReturnValueOnce(new Promise(() => {}))
    const { wrapper } = await mountPage()

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(errorUnder(wrapper, 'subject')).not.toBeNull()

    await fillValid(wrapper)
    await wrapper.get('form').trigger('submit')

    expect(errorUnder(wrapper, 'subject')).toBeNull()
  })

  it('shows the message of a failure that has no field errors', async () => {
    createTicket.mockRejectedValue({ status: 0, message: 'Cannot reach the server.', errors: {} })
    const { wrapper } = await mountPage()
    await fillValid(wrapper)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.form-error').text()).toBe('Cannot reach the server.')
    expect(wrapper.get('#subject').element.value).toBe('Refund not received')
  })

  it('has a cancel link back to the list', async () => {
    const { wrapper } = await mountPage()

    expect(wrapper.get('a.btn').attributes('href')).toBe('/tickets')
  })
})
