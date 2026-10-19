<script setup>
import { onMounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import { useTicketsStore } from '@/stores/tickets'
import TicketFilters from '@/components/TicketFilters.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import StateMessage from '@/components/StateMessage.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { formatDateTime } from '@/utils/format'

const FILTER_KEYS = ['status', 'priority', 'category', 'agent_id', 'search']

const store = useTicketsStore()
const { tickets, pagination, filters, listLoading, listError, meta, agents, metaError } =
  storeToRefs(store)

const route = useRoute()
const router = useRouter()

// The URL query is the source of truth for the filters and page, so refresh and back keep them.
function readQuery(query) {
  const first = (value) => (Array.isArray(value) ? value[0] : value) ?? ''

  const result = {}
  for (const key of FILTER_KEYS) {
    result[key] = String(first(query[key]))
  }

  const page = Number.parseInt(first(query.page), 10)
  return { filters: result, page: page >= 1 ? page : 1 }
}

function buildQuery(newFilters, page) {
  const query = {}
  for (const key of FILTER_KEYS) {
    const value = String(newFilters[key] ?? '').trim()
    if (value !== '') {
      query[key] = value
    }
  }
  if (page > 1) {
    query.page = String(page)
  }
  return query
}

function load() {
  const { filters: queryFilters, page } = readQuery(route.query)
  store.fetchTickets(queryFilters, page)
}

watch(
  () => route.query,
  () => {
    // The query also changes while leaving this page; only react while it is shown.
    if (route.name === 'tickets') {
      load()
    }
  },
  { immediate: true },
)

onMounted(() => {
  store.loadReferenceData()
})

function onFiltersChange(newFilters) {
  router.push({ query: buildQuery(newFilters, 1) })
}

function onPage(page) {
  router.push({ query: buildQuery(filters.value, page) })
}
</script>

<template>
  <h1>Tickets</h1>

  <StateMessage
    v-if="metaError"
    type="error"
    :message="`Could not load the filter options: ${metaError}`"
    class="state--inline"
    @retry="store.loadReferenceData()"
  />

  <TicketFilters :filters="filters" :meta="meta" :agents="agents" @change="onFiltersChange" />

  <StateMessage v-if="listError" type="error" :message="listError" @retry="load" />
  <StateMessage v-else-if="listLoading && tickets.length === 0" type="loading" />
  <StateMessage
    v-else-if="tickets.length === 0"
    type="empty"
    message="No tickets match these filters."
  />

  <div v-else class="table-wrapper" :class="{ 'is-loading': listLoading }" :aria-busy="listLoading">
    <table class="table">
      <thead>
        <tr>
          <th scope="col">Number</th>
          <th scope="col">Subject</th>
          <th scope="col">Customer</th>
          <th scope="col">Status</th>
          <th scope="col">Priority</th>
          <th scope="col">Category</th>
          <th scope="col">Agent</th>
          <th scope="col">Created</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="ticket in tickets" :key="ticket.id">
          <td>
            <RouterLink :to="`/tickets/${ticket.id}`">{{ ticket.number }}</RouterLink>
          </td>
          <td>{{ ticket.subject }}</td>
          <td>{{ ticket.customer?.name }}</td>
          <td><StatusBadge :status="ticket.status" /></td>
          <td>{{ ticket.priority.label }}</td>
          <td>{{ ticket.category.label }}</td>
          <td>{{ ticket.agent?.name ?? 'Unassigned' }}</td>
          <td>{{ formatDateTime(ticket.created_at) }}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <PaginationBar
    v-if="!listError && pagination.total > 0"
    :pagination="pagination"
    @page="onPage"
  />
</template>
