import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import TicketFilters from '@/components/TicketFilters.vue'
import PaginationBar from '@/components/PaginationBar.vue'

const META = {
  statuses: [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
  ],
  priorities: [
    { value: 'low', label: 'Low' },
    { value: 'high', label: 'High' },
  ],
  categories: [{ value: 'billing', label: 'Billing' }],
  transitions: {},
}

const AGENTS = [
  { id: 1, name: 'Omar Hassan', email: 'omar@example.com' },
  { id: 2, name: 'Lina Saad', email: 'lina@example.com' },
]

const EMPTY = { status: '', priority: '', category: '', agent_id: '', search: '' }

function mountFilters(filters = EMPTY, props = {}) {
  return mount(TicketFilters, { props: { filters, meta: META, agents: AGENTS, ...props } })
}

function optionTexts(wrapper, selector) {
  return wrapper.findAll(`${selector} option`).map((o) => o.text())
}

describe('TicketFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds the selects from meta and agents, with an "All" option first', () => {
    const wrapper = mountFilters()

    expect(optionTexts(wrapper, '#filter-status')).toEqual(['All statuses', 'Open', 'In Progress'])
    expect(optionTexts(wrapper, '#filter-priority')).toEqual(['All priorities', 'Low', 'High'])
    expect(optionTexts(wrapper, '#filter-category')).toEqual(['All categories', 'Billing'])
    expect(optionTexts(wrapper, '#filter-agent')).toEqual([
      'All agents',
      'Unassigned',
      'Omar Hassan',
      'Lina Saad',
    ])
    expect(wrapper.find('#filter-agent option:nth-child(2)').attributes('value')).toBe('none')
  })

  it('shows only the "All" options while meta is not loaded', () => {
    const wrapper = mountFilters(EMPTY, { meta: null, agents: [] })

    expect(optionTexts(wrapper, '#filter-status')).toEqual(['All statuses'])
    expect(optionTexts(wrapper, '#filter-agent')).toEqual(['All agents', 'Unassigned'])
  })

  it('shows the current filters', () => {
    const wrapper = mountFilters({ ...EMPTY, status: 'open', agent_id: '2', search: 'refund' })

    expect(wrapper.get('#filter-status').element.value).toBe('open')
    expect(wrapper.get('#filter-agent').element.value).toBe('2')
    expect(wrapper.get('#filter-search').element.value).toBe('refund')
  })

  it('emits change at once when a select changes', async () => {
    const wrapper = mountFilters()

    await wrapper.get('#filter-status').setValue('in_progress')
    await wrapper.get('#filter-agent').setValue('none')

    expect(wrapper.emitted('change')).toEqual([
      [{ ...EMPTY, status: 'in_progress' }],
      [{ ...EMPTY, status: 'in_progress', agent_id: 'none' }],
    ])
  })

  it('emits agent ids as strings, the same as in the URL', async () => {
    const wrapper = mountFilters()

    await wrapper.get('#filter-agent').setValue('1')

    expect(wrapper.emitted('change')[0][0].agent_id).toBe('1')
  })

  it('debounces the search and emits once after typing stops', async () => {
    const wrapper = mountFilters()
    const input = wrapper.get('#filter-search')

    await input.setValue('r')
    vi.advanceTimersByTime(200)
    await input.setValue('ref')
    vi.advanceTimersByTime(299)
    expect(wrapper.emitted('change')).toBeUndefined()

    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('change')).toEqual([[{ ...EMPTY, search: 'ref' }]])
  })

  it('sends a pending search with a select change instead of a second event', async () => {
    const wrapper = mountFilters()

    await wrapper.get('#filter-search').setValue('refund')
    await wrapper.get('#filter-priority').setValue('high')
    vi.advanceTimersByTime(1000)

    expect(wrapper.emitted('change')).toEqual([[{ ...EMPTY, priority: 'high', search: 'refund' }]])
  })

  it('clears every filter and emits empty filters', async () => {
    const wrapper = mountFilters({ ...EMPTY, status: 'open', search: 'refund' })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('change')).toEqual([[EMPTY]])
    expect(wrapper.get('#filter-status').element.value).toBe('')
    expect(wrapper.get('#filter-search').element.value).toBe('')
  })

  it('disables Clear when no filter is set', () => {
    expect(mountFilters().get('button').attributes('disabled')).toBeDefined()
    expect(
      mountFilters({ ...EMPTY, category: 'billing' })
        .get('button')
        .attributes('disabled'),
    ).toBeUndefined()
  })

  it('follows new filters from the parent, for example on back navigation', async () => {
    const wrapper = mountFilters({ ...EMPTY, status: 'open' })

    await wrapper.setProps({ filters: { ...EMPTY, priority: 'low', search: 'tck' } })

    expect(wrapper.get('#filter-status').element.value).toBe('')
    expect(wrapper.get('#filter-priority').element.value).toBe('low')
    expect(wrapper.get('#filter-search').element.value).toBe('tck')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('renders agent names as text', () => {
    const wrapper = mountFilters(EMPTY, {
      agents: [{ id: 9, name: '<b>Bold</b>', email: 'b@example.com' }],
    })

    expect(wrapper.find('#filter-agent b').exists()).toBe(false)
    expect(optionTexts(wrapper, '#filter-agent')).toContain('<b>Bold</b>')
  })
})

describe('PaginationBar', () => {
  function mountBar(pagination) {
    return mount(PaginationBar, {
      props: {
        pagination: { current_page: 1, last_page: 1, per_page: 15, total: 0, ...pagination },
      },
    })
  }

  function buttons(wrapper) {
    const [prev, next] = wrapper.findAll('button')
    return { prev, next }
  }

  it('shows the page and the total', () => {
    const wrapper = mountBar({ current_page: 2, last_page: 3, total: 31 })

    expect(wrapper.text()).toContain('Page 2 of 3 (31 tickets)')
  })

  it('uses the singular for one ticket', () => {
    expect(mountBar({ total: 1 }).text()).toContain('Page 1 of 1 (1 ticket)')
  })

  it('emits the previous and next page', async () => {
    const wrapper = mountBar({ current_page: 2, last_page: 3, total: 31 })
    const { prev, next } = buttons(wrapper)

    await prev.trigger('click')
    await next.trigger('click')

    expect(wrapper.emitted('page')).toEqual([[1], [3]])
  })

  it('disables Prev on the first page and Next on the last page', () => {
    const first = buttons(mountBar({ current_page: 1, last_page: 2, total: 20 }))
    const last = buttons(mountBar({ current_page: 2, last_page: 2, total: 20 }))

    expect(first.prev.text()).toBe('Prev')
    expect(first.prev.attributes('disabled')).toBeDefined()
    expect(first.next.attributes('disabled')).toBeUndefined()
    expect(last.prev.attributes('disabled')).toBeUndefined()
    expect(last.next.text()).toBe('Next')
    expect(last.next.attributes('disabled')).toBeDefined()
  })

  it('goes back to the last page from a page past the end', async () => {
    const wrapper = mountBar({ current_page: 5, last_page: 2, total: 20 })
    const { prev, next } = buttons(wrapper)

    expect(next.attributes('disabled')).toBeDefined()
    await prev.trigger('click')
    expect(wrapper.emitted('page')).toEqual([[2]])
  })
})
