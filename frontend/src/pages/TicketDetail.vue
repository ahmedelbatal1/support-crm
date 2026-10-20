<script setup>
import { watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'

import { useTicketsStore } from '@/stores/tickets'
import AssignAgentForm from '@/components/AssignAgentForm.vue'
import HistoryList from '@/components/HistoryList.vue'
import NoteForm from '@/components/NoteForm.vue'
import StatusActions from '@/components/StatusActions.vue'
import StateMessage from '@/components/StateMessage.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { formatDateTime } from '@/utils/format'

const store = useTicketsStore()
const {
  currentTicket: ticket,
  ticketLoading,
  ticketError,
  ticketNotFound,
  agents,
  metaError,
} = storeToRefs(store)

const route = useRoute()

// The agent list for the assign form; cached after the first page that loads it.
store.loadReferenceData()

function load() {
  store.fetchTicket(route.params.id)
}

watch(
  () => route.params.id,
  () => {
    // The params also change while leaving this page; only react while it is shown.
    if (route.name === 'ticket-detail') {
      load()
    }
  },
  { immediate: true },
)
</script>

<template>
  <StateMessage v-if="ticketNotFound" type="notfound" message="Ticket not found.">
    <RouterLink to="/tickets">Back to tickets</RouterLink>
  </StateMessage>
  <StateMessage v-else-if="ticketError" type="error" :message="ticketError" @retry="load" />
  <StateMessage v-else-if="ticketLoading && !ticket" type="loading" />

  <article v-else-if="ticket" class="ticket-detail">
    <RouterLink to="/tickets" class="back-link">← All tickets</RouterLink>

    <header class="ticket-header">
      <h1>
        <span class="ticket-number">{{ ticket.number }}</span>
        {{ ticket.subject }}
      </h1>
      <StatusBadge :status="ticket.status" />
    </header>

    <section class="card ticket-status">
      <h2>Change status</h2>
      <StatusActions :ticket="ticket" />
    </section>

    <div class="ticket-grid">
      <section class="card">
        <h2>Details</h2>
        <dl class="details">
          <dt>Priority</dt>
          <dd>{{ ticket.priority.label }}</dd>
          <dt>Category</dt>
          <dd>{{ ticket.category.label }}</dd>
          <dt>Created</dt>
          <dd>
            <time :datetime="ticket.created_at">{{ formatDateTime(ticket.created_at) }}</time>
          </dd>
          <dt>Agent</dt>
          <dd>{{ ticket.agent?.name ?? 'Unassigned' }}</dd>
        </dl>

        <!-- Always rendered: on a closed ticket the form hides its own controls but can still
             show the message of an assignment rejected because the ticket was closed elsewhere. -->
        <div class="ticket-assign">
          <StateMessage
            v-if="metaError && !ticket.is_closed"
            type="error"
            :message="`Could not load the agents: ${metaError}`"
            class="state--inline"
            @retry="store.loadReferenceData()"
          />
          <AssignAgentForm v-else :ticket="ticket" :agents="agents" />
        </div>

        <h3>Description</h3>
        <p class="ticket-description" :class="{ muted: !ticket.description }">
          {{ ticket.description || 'No description.' }}
        </p>
      </section>

      <section class="card ticket-customer">
        <h2>Customer</h2>
        <dl class="details">
          <dt>Name</dt>
          <dd>{{ ticket.customer.name }}</dd>
          <dt>Email</dt>
          <dd>{{ ticket.customer.email }}</dd>
          <dt>Phone</dt>
          <dd>{{ ticket.customer.phone || '—' }}</dd>
        </dl>
      </section>
    </div>

    <section class="card ticket-notes">
      <h2>Notes</h2>
      <ul v-if="ticket.notes.length" class="note-list">
        <li v-for="note in ticket.notes" :key="note.id">
          <time :datetime="note.created_at">{{ formatDateTime(note.created_at) }}</time>
          <p class="note-body">{{ note.body }}</p>
        </li>
      </ul>
      <p v-else class="muted">No notes yet.</p>

      <NoteForm :ticket="ticket" />
    </section>

    <section class="card">
      <h2>History</h2>
      <HistoryList :entries="ticket.history" />
    </section>
  </article>
</template>
