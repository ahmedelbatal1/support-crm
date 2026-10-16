import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AxiosError } from 'axios'

import http from '@/api/http'
import {
  listTickets,
  getTicket,
  createTicket,
  assignTicket,
  changeStatus,
  addNote,
} from '@/api/tickets'
import { getMeta, getAgents } from '@/api/meta'

/**
 * Replaces the Axios adapter so requests never leave the test, while the real instance config and
 * interceptors still run. `reply(config)` returns { status, data } or throws.
 */
let requests
let reply
const originalAdapter = http.defaults.adapter

beforeEach(() => {
  requests = []
  reply = () => ({ status: 200, data: {} })
  http.defaults.adapter = async (config) => {
    requests.push(config)
    const { status, data } = reply(config)
    const response = { status, data, statusText: '', headers: {}, config }

    if (status >= 400) {
      throw new AxiosError(
        `Request failed with status code ${status}`,
        'ERR_BAD_RESPONSE',
        config,
        {},
        response,
      )
    }

    return response
  }
})

afterEach(() => {
  http.defaults.adapter = originalAdapter
})

describe('http instance', () => {
  it('uses the API base URL and asks for JSON', () => {
    expect(http.defaults.baseURL).toBe(import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api')
    expect(http.defaults.headers.Accept).toBe('application/json')
  })
})

describe('error normalizer', () => {
  it('turns a 422 into { status, message, errors }', async () => {
    reply = () => ({
      status: 422,
      data: {
        message: 'Cannot change status from Open to Resolved.',
        errors: { status: ['Cannot change status from Open to Resolved.'] },
      },
    })

    await expect(changeStatus(1, 'resolved')).rejects.toEqual({
      status: 422,
      message: 'Cannot change status from Open to Resolved.',
      errors: { status: ['Cannot change status from Open to Resolved.'] },
    })
  })

  it('turns a 404 into a message with empty errors', async () => {
    reply = () => ({ status: 404, data: { message: 'Ticket not found.' } })

    await expect(getTicket(999999)).rejects.toEqual({
      status: 404,
      message: 'Ticket not found.',
      errors: {},
    })
  })

  it('reports a network error as status 0', async () => {
    http.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config, {})
    }

    await expect(listTickets()).rejects.toEqual({
      status: 0,
      message: 'Cannot reach the server.',
      errors: {},
    })
  })

  it('falls back to a generic message when the body has none', async () => {
    reply = () => ({ status: 500, data: '<html>Server Error</html>' })

    await expect(getMeta()).rejects.toEqual({
      status: 500,
      message: 'Something went wrong. Please try again.',
      errors: {},
    })
  })
})

describe('tickets API', () => {
  it('listTickets sends the filters as params and returns the whole body', async () => {
    const body = {
      data: [{ id: 1 }],
      meta: { current_page: 2, last_page: 3, total: 31 },
      links: { next: '...' },
    }
    reply = () => ({ status: 200, data: body })

    const result = await listTickets({ status: 'open', agent_id: 'none', page: 2 })

    expect(result).toEqual(body)
    expect(requests[0].method).toBe('get')
    expect(requests[0].url).toBe('/tickets')
    expect(requests[0].params).toEqual({ status: 'open', agent_id: 'none', page: 2 })
  })

  it('getTicket returns the unwrapped ticket', async () => {
    reply = () => ({ status: 200, data: { data: { id: 12, number: 'TCK-0012' } } })

    await expect(getTicket(12)).resolves.toEqual({ id: 12, number: 'TCK-0012' })
    expect(requests[0].method).toBe('get')
    expect(requests[0].url).toBe('/tickets/12')
  })

  it('createTicket posts the payload and returns the unwrapped ticket', async () => {
    reply = () => ({ status: 201, data: { data: { id: 1, number: 'TCK-0001' } } })
    const payload = { customer_name: 'Sara Ali', subject: 'Refund not received' }

    await expect(createTicket(payload)).resolves.toEqual({ id: 1, number: 'TCK-0001' })
    expect(requests[0].method).toBe('post')
    expect(requests[0].url).toBe('/tickets')
    expect(JSON.parse(requests[0].data)).toEqual(payload)
  })

  it('assignTicket patches agent_id', async () => {
    reply = () => ({ status: 200, data: { data: { id: 3, agent: { id: 7 } } } })

    await expect(assignTicket(3, 7)).resolves.toEqual({ id: 3, agent: { id: 7 } })
    expect(requests[0].method).toBe('patch')
    expect(requests[0].url).toBe('/tickets/3/assign')
    expect(JSON.parse(requests[0].data)).toEqual({ agent_id: 7 })
  })

  it('changeStatus patches status', async () => {
    reply = () => ({ status: 200, data: { data: { id: 3, status: { value: 'in_progress' } } } })

    await expect(changeStatus(3, 'in_progress')).resolves.toEqual({
      id: 3,
      status: { value: 'in_progress' },
    })
    expect(requests[0].method).toBe('patch')
    expect(requests[0].url).toBe('/tickets/3/status')
    expect(JSON.parse(requests[0].data)).toEqual({ status: 'in_progress' })
  })

  it('addNote posts the body and returns the unwrapped note', async () => {
    reply = () => ({ status: 201, data: { data: { id: 5, body: 'Called customer.' } } })

    await expect(addNote(3, 'Called customer.')).resolves.toEqual({
      id: 5,
      body: 'Called customer.',
    })
    expect(requests[0].method).toBe('post')
    expect(requests[0].url).toBe('/tickets/3/notes')
    expect(JSON.parse(requests[0].data)).toEqual({ body: 'Called customer.' })
  })
})

describe('meta API', () => {
  it('getMeta returns the unwrapped reference data', async () => {
    const meta = { statuses: [], priorities: [], categories: [], transitions: {} }
    reply = () => ({ status: 200, data: { data: meta } })

    await expect(getMeta()).resolves.toEqual(meta)
    expect(requests[0].url).toBe('/meta')
  })

  it('getAgents returns the unwrapped agent list', async () => {
    reply = () => ({ status: 200, data: { data: [{ id: 1, name: 'Lina' }] } })

    await expect(getAgents()).resolves.toEqual([{ id: 1, name: 'Lina' }])
    expect(requests[0].url).toBe('/agents')
  })
})
