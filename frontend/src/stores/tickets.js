import { ref } from 'vue'
import { defineStore } from 'pinia'

import { getMeta, getAgents } from '@/api/meta'
import { listTickets, getTicket } from '@/api/tickets'

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

  // Current ticket: the one shown on the detail page, with notes and history.
  const currentTicket = ref(null)
  const ticketLoading = ref(false)
  const ticketError = ref(null)
  const ticketNotFound = ref(false)

  let latestTicketRequest = 0

  /**
   * Loads one ticket. A 404 sets ticketNotFound instead of ticketError. With `silent: true` (used
   * after a rejected action) it only replaces currentTicket on success: loading and error state
   * stay as they are, so the page neither flashes nor hides the ticket.
   */
  async function fetchTicket(id, { silent = false } = {}) {
    // A silent request would supersede an in-flight load and leave ticketLoading stuck, so while
    // a load is running it becomes a normal one; there is no ticket on screen to protect anyway.
    if (ticketLoading.value) {
      silent = false
    }

    const requestId = ++latestTicketRequest

    if (!silent) {
      ticketLoading.value = true
      ticketError.value = null
      ticketNotFound.value = false
      // Route params are strings, ids are numbers.
      if (String(currentTicket.value?.id) !== String(id)) {
        currentTicket.value = null
      }
    }

    try {
      const ticket = await getTicket(id)
      if (requestId !== latestTicketRequest) return

      currentTicket.value = ticket
    } catch (error) {
      if (requestId !== latestTicketRequest || silent) return

      if (error.status === 404) {
        ticketNotFound.value = true
        currentTicket.value = null
      } else {
        ticketError.value = error.message
      }
    } finally {
      if (requestId === latestTicketRequest && !silent) {
        ticketLoading.value = false
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
    currentTicket,
    ticketLoading,
    ticketError,
    ticketNotFound,
    fetchTicket,
  }
})
