import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import StateMessage from '@/components/StateMessage.vue'
import FieldError from '@/components/FieldError.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { formatDateTime } from '@/utils/format'

describe('StateMessage', () => {
  it.each([
    ['loading', 'Loading…'],
    ['empty', 'Nothing to show.'],
    ['error', 'Something went wrong.'],
    ['notfound', 'Not found.'],
  ])('shows a default message for %s', (type, text) => {
    const wrapper = mount(StateMessage, { props: { type } })

    expect(wrapper.text()).toContain(text)
    expect(wrapper.classes()).toEqual(['state', `state--${type}`])
  })

  it('shows the given message instead of the default', () => {
    const wrapper = mount(StateMessage, {
      props: { type: 'empty', message: 'No tickets match these filters.' },
    })

    expect(wrapper.text()).toBe('No tickets match these filters.')
  })

  it('announces loading politely and errors as alerts', () => {
    expect(mount(StateMessage, { props: { type: 'loading' } }).attributes('role')).toBe('status')
    expect(mount(StateMessage, { props: { type: 'error' } }).attributes('role')).toBe('alert')
  })

  it('emits retry from the error state', async () => {
    const wrapper = mount(StateMessage, {
      props: { type: 'error', message: 'Cannot reach the server.' },
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.get('button').text()).toBe('Retry')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it.each(['loading', 'empty', 'notfound'])('has no retry button for %s', (type) => {
    expect(mount(StateMessage, { props: { type } }).find('button').exists()).toBe(false)
  })

  it('renders slot content, for example a link back', () => {
    const wrapper = mount(StateMessage, {
      props: { type: 'notfound', message: 'Ticket not found.' },
      slots: { default: '<a href="/tickets">Back to tickets</a>' },
    })

    expect(wrapper.get('a').text()).toBe('Back to tickets')
  })

  it('renders HTML in the message as text', () => {
    const wrapper = mount(StateMessage, { props: { type: 'error', message: '<b>boom</b>' } })

    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.text()).toContain('<b>boom</b>')
  })

  it('rejects an unknown type', () => {
    expect(StateMessage.props.type.validator('pending')).toBe(false)
    expect(StateMessage.props.type.validator('error')).toBe(true)
  })
})

describe('FieldError', () => {
  it('shows the first message for the field', () => {
    const wrapper = mount(FieldError, {
      props: {
        field: 'customer_email',
        errors: { customer_email: ['The email must be valid.', 'Second message.'] },
      },
    })

    expect(wrapper.get('.field-error').text()).toBe('The email must be valid.')
  })

  it('renders nothing when the field has no error', () => {
    const wrapper = mount(FieldError, {
      props: { field: 'subject', errors: { customer_email: ['Bad email.'] } },
    })

    expect(wrapper.find('.field-error').exists()).toBe(false)
  })

  it('renders nothing with the default empty errors', () => {
    expect(
      mount(FieldError, { props: { field: 'body' } })
        .find('.field-error')
        .exists(),
    ).toBe(false)
  })

  it('renders HTML in the message as text', () => {
    const wrapper = mount(FieldError, {
      props: { field: 'body', errors: { body: ['<i>x</i>'] } },
    })

    expect(wrapper.find('i').exists()).toBe(false)
    expect(wrapper.text()).toBe('<i>x</i>')
  })
})

describe('StatusBadge', () => {
  it.each([
    ['open', 'Open'],
    ['in_progress', 'In Progress'],
    ['resolved', 'Resolved'],
    ['closed', 'Closed'],
  ])('shows the %s label with a class for its value', (value, label) => {
    const wrapper = mount(StatusBadge, { props: { status: { value, label } } })

    expect(wrapper.text()).toBe(label)
    expect(wrapper.classes()).toEqual(['badge', `badge--${value}`])
  })
})

describe('formatDateTime', () => {
  const iso = '2026-10-07T06:00:00.000000Z'

  it('formats with medium date and short time in the given timezone', () => {
    const expected = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date('2026-10-07T06:00:00Z'))

    expect(formatDateTime(iso, { timeZone: 'UTC' })).toBe(expected)
  })

  it('converts to the requested timezone', () => {
    const utc = formatDateTime(iso, { timeZone: 'UTC' })
    const riyadh = formatDateTime(iso, { timeZone: 'Asia/Riyadh' })

    expect(riyadh).not.toBe(utc)
    expect(formatDateTime(iso, { timeZone: 'Asia/Riyadh', hour12: false })).toContain('09:00')
  })

  it('lets options override the default styles', () => {
    const expected = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date('2026-10-07T06:00:00Z'))

    expect(formatDateTime(iso, { dateStyle: 'short', timeZone: 'UTC' })).toBe(expected)
  })

  it.each([[null], [undefined], [''], ['not a date']])(
    'returns an empty string for %s',
    (value) => {
      expect(formatDateTime(value)).toBe('')
    },
  )
})
