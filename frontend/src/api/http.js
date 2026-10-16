import axios from 'axios'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
  headers: { Accept: 'application/json' },
})

/**
 * Every failed request rejects with the same shape, so pages and the store never read Axios
 * internals: { status, message, errors }. status is 0 when the server could not be reached, and
 * errors maps field names to messages (empty unless the API sent a 422).
 */
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject({ status: 0, message: 'Cannot reach the server.', errors: {} })
    }

    const { status, data } = error.response
    const body = data && typeof data === 'object' ? data : {}

    return Promise.reject({
      status,
      message: body.message || 'Something went wrong. Please try again.',
      errors: body.errors ?? {},
    })
  },
)

export default http
