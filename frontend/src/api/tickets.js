import http from './http'

/**
 * Returns the whole paginated body ({ data, meta, links }) because the list needs the pagination
 * details. Every other function returns the unwrapped resource.
 */
export async function listTickets(params = {}) {
  const response = await http.get('/tickets', { params })
  return response.data
}

export async function getTicket(id) {
  const response = await http.get(`/tickets/${id}`)
  return response.data.data
}

export async function createTicket(payload) {
  const response = await http.post('/tickets', payload)
  return response.data.data
}

export async function assignTicket(id, agentId) {
  const response = await http.patch(`/tickets/${id}/assign`, { agent_id: agentId })
  return response.data.data
}

export async function changeStatus(id, status) {
  const response = await http.patch(`/tickets/${id}/status`, { status })
  return response.data.data
}

export async function addNote(id, body) {
  const response = await http.post(`/tickets/${id}/notes`, { body })
  return response.data.data
}
