<script setup>
import { computed, ref, watch } from 'vue'

import { useTicketsStore } from '@/stores/tickets'
import FieldError from '@/components/FieldError.vue'

const props = defineProps({
  ticket: { type: Object, required: true },
  agents: { type: Array, default: () => [] },
})

const store = useTicketsStore()

// Select values are strings; the current agent is preselected.
const selected = ref('')
const saving = ref(false)
const errors = ref({})

watch(
  () => props.ticket.agent?.id,
  (agentId) => {
    selected.value = agentId ? String(agentId) : ''
  },
  { immediate: true },
)

// The page reuses this component when the route moves to another ticket.
watch(
  () => props.ticket.id,
  () => {
    errors.value = {}
  },
)

const buttonLabel = computed(() => (props.ticket.agent ? 'Reassign' : 'Assign'))
const selectId = computed(() => `assign-agent-${props.ticket.id}`)

async function submit() {
  saving.value = true
  errors.value = {}

  try {
    await store.assignAgent(props.ticket.id, Number(selected.value))
  } catch (error) {
    // Show the field message, or the general one (network, 500) in the same place.
    errors.value = error.errors?.agent_id ? error.errors : { agent_id: [error.message] }

    // The rule may have failed because the ticket changed elsewhere (spec edge case: stale
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
  <form class="assign-form" @submit.prevent="submit">
    <template v-if="!ticket.is_closed">
      <label :for="selectId">Agent</label>
      <div class="inline-form">
        <select
          :id="selectId"
          v-model="selected"
          :disabled="saving"
          :aria-invalid="errors.agent_id ? 'true' : undefined"
        >
          <option value="">Select an agent</option>
          <option v-for="agent in agents" :key="agent.id" :value="String(agent.id)">
            {{ agent.name }}
          </option>
        </select>
        <button type="submit" class="btn btn--primary" :disabled="saving || !selected">
          {{ buttonLabel }}
        </button>
      </div>
    </template>
    <!-- Kept for closed tickets too, so a rejection caused by a close elsewhere stays visible. -->
    <FieldError field="agent_id" :errors="errors" />
  </form>
</template>
