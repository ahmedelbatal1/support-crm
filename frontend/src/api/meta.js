import http from './http'

export async function getMeta() {
  const response = await http.get('/meta')
  return response.data.data
}

export async function getAgents() {
  const response = await http.get('/agents')
  return response.data.data
}
