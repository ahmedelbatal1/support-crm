<script setup>
import { computed, ref, watch } from 'vue'

import { useTicketsStore } from '@/stores/tickets'
import FieldError from '@/components/FieldError.vue'

const MAX_LENGTH = 2000

const props = defineProps({
  // Needs id and is_closed.
  ticket: { type: Object, required: true },
})

const store = useTicketsStore()

const body = ref('')
const saving = ref(false)
const errors = ref({})

// The page reuses this component when the route moves to another ticket.
watch(
  () => props.ticket.id,
  () => {
    body.value = ''
    errors.value = {}
  },
)

const textareaId = computed(() => `note-body-${props.ticket.id}`)
const counter = computed(() => `${body.value.length} / ${MAX_LENGTH}`)

async function submit() {
  saving.value = true
  errors.value = {}

  try {
    await store.addNote(props.ticket.id, body.value)
    body.value = ''
  } catch (error) {
    // Show the field message, or the general one (network, 500) in the same place. The typed
    // text stays so nothing is lost.
    errors.value = error.errors?.body ? error.errors : { body: [error.message] }

    // The note may have been refused because the ticket changed elsewhere (spec edge case: stale
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
  <form class="note-form" @submit.prevent="submit">
    <template v-if="!ticket.is_closed">
      <label :for="textareaId">Add an internal note</label>
      <textarea
        :id="textareaId"
        v-model="body"
        rows="3"
        :maxlength="MAX_LENGTH"
        :disabled="saving"
        :aria-invalid="errors.body ? 'true' : undefined"
      ></textarea>
      <div class="note-form__footer">
        <span
          class="char-counter"
          :class="{ 'char-counter--full': body.length >= MAX_LENGTH }"
          aria-live="polite"
          >{{ counter }}</span
        >
        <button type="submit" class="btn btn--primary" :disabled="saving">
          {{ saving ? 'Adding…' : 'Add note' }}
        </button>
      </div>
    </template>
    <p v-else class="muted">Closed tickets are read-only.</p>
    <!-- Kept for closed tickets too, so a note refused because of a close elsewhere stays visible. -->
    <FieldError field="body" :errors="errors" />
  </form>
</template>
