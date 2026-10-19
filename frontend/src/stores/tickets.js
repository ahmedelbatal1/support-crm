import { ref } from 'vue'
import { defineStore } from 'pinia'

import { getMeta, getAgents } from '@/api/meta'
import { listTickets } from '@/api/tickets'

const EMPTY_FILTERS = { status: '', priority: '', category: '', agent_id: '', search: '' }

/**
 * The single store for ticket state. Pages call its actions and read its state; only the store
 * talks to src/api. Error fields hold the normalized message from src/api/http.js.
 */
export const useTicketsStore = defineStore('tickets', () => {
  // Reference data: enum options, allowed transitions and the agent list.
  const meta = ref(null)
  const agents = ref([])
  const metaLoading = ref(false)
  const metaError = ref(null)

  let referenceRequest = null

  /**
   * Loads meta and agents once. Later calls reuse the cached data, and calls made while a request
   * is in flight share it. A failure sets metaError and leaves the cache empty so a retry fetches
   * again.
   */
  function loadReferenceData() {
    if (meta.value) {
      return Promise.resolve()
    }

    if (!referenceRequest) {
      metaLoading.value = true
      metaError.value = null

      referenceRequest = Promise.all([getMeta(), getAgents()])
        .then(([metaData, agentList]) => {
          meta.value = metaData
          agents.value = agentList
        })
        .catch((error) => {
          metaError.value = error.message
        })
        .finally(() => {
          metaLoading.value = false
          referenceRequest = null
        })
    }

    return referenceRequest
  }

  // Ticket list: the current page of tickets, the filters it was fetched with, and its pagination.
  const tickets = ref([])
  const pagination = ref({ current_page: 1, last_page: 1, per_page: 15, total: 0 })
  const filters = ref({ ...EMPTY_FILTERS })
  const listLoading = ref(false)
  const listError = ref(null)

  let latestListRequest = 0

  /**
   * Fetches one page of tickets. Only filters with a value are sent, and search is trimmed. When
   * requests overlap (for example while typing a search), only the latest one updates the state.
   */
  async function fetchTickets(newFilters = filters.value, page = 1) {
    const requestId = ++latestListRequest
    // Unset filters are stored as '' so selects and inputs always have a value to show.
    const next = {}
    const params = {}
    for (const key of Object.keys(EMPTY_FILTERS)) {
      const value = newFilters[key] ?? ''
      const sent = typeof value === 'string' ? value.trim() : value
      next[key] = value
      if (sent !== '') {
        params[key] = sent
      }
    }
    params.page = page
    filters.value = next

    listLoading.value = true
    listError.value = null

    try {
      const body = await listTickets(params)
      if (requestId !== latestListRequest) return

      const { current_page, last_page, per_page, total } = body.meta
      tickets.value = body.data
      pagination.value = { current_page, last_page, per_page, total }
    } catch (error) {
      if (requestId !== latestListRequest) return

      listError.value = error.message
    } finally {
      if (requestId === latestListRequest) {
        listLoading.value = false
      }
    }
  }

  return {
    meta,
    agents,
    metaLoading,
    metaError,
    loadReferenceData,
    tickets,
    pagination,
    filters,
    listLoading,
    listError,
    fetchTickets,
  }
})
