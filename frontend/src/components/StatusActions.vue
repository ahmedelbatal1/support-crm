<script setup>
import { ref, watch } from 'vue'

import { useTicketsStore } from '@/stores/tickets'
import FieldError from '@/components/FieldError.vue'

const props = defineProps({
  // Needs id, is_closed and allowed_transitions ([{ value, label, action_label }]).
  ticket: { type: Object, required: true },
})

const store = useTicketsStore()

const saving = ref(false)
const errors = ref({})

// The page reuses this component when the route moves to another ticket.
watch(
  () => props.ticket.id,
  () => {
    errors.value = {}
  },
)

async function move(status) {
  if (saving.value) return

  saving.value = true
  errors.value = {}

  try {
    await store.changeStatus(props.ticket.id, status)
  } catch (error) {
    // Show the rule's message, or the general one (network, 500) in the same place.
    errors.value = error.errors?.status ? error.errors : { status: [error.message] }

    // The move may have failed because the ticket changed elsewhere (spec edge case: stale
    // data), so reload it quietly while the message stays on screen.
    if (error.status === 422) {
      store.fetchTicket(props.ticket.id, { silent: true })
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="status-actions">
    <!-- Only the moves the API allows from the current status; the server still checks them. -->
    <div v-if="ticket.allowed_transitions.length" class="actions" :aria-busy="saving">
      <button
        v-for="transition in ticket.allowed_transitions"
        :key="transition.value"
        type="button"
        class="btn"
        :disabled="saving"
        @click="move(transition.value)"
      >
        {{ transition.action_label }}
      </button>
    </div>
    <p v-else class="muted">No further status changes.</p>
    <!-- Kept for closed tickets too, so a rejection caused by a close elsewhere stays visible. -->
    <FieldError field="status" :errors="errors" />
  </div>
</template>
