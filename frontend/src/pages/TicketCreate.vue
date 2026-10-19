<script setup>
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import { useTicketsStore } from '@/stores/tickets'
import FieldError from '@/components/FieldError.vue'
import StateMessage from '@/components/StateMessage.vue'

const store = useTicketsStore()
const { meta, metaLoading, metaError } = storeToRefs(store)
const router = useRouter()

const form = reactive({
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  subject: '',
  description: '',
  category: '',
  priority: '',
})

const saving = ref(false)
const errors = ref({})
const formError = ref('')

// Called during setup rather than in onMounted so metaLoading is already true on the first render
// and the empty form never flashes.
store.loadReferenceData()

async function submit() {
  saving.value = true
  errors.value = {}
  formError.value = ''

  try {
    const ticket = await store.createTicket({ ...form })
    router.push(`/tickets/${ticket.id}`)
  } catch (error) {
    errors.value = error.errors ?? {}
    // Field errors are shown under their inputs; anything else (network, 500) is shown once here.
    if (Object.keys(errors.value).length === 0) {
      formError.value = error.message
    }
  } finally {
    saving.value = false
  }
}

function invalid(field) {
  return errors.value[field] ? 'true' : undefined
}
</script>

<template>
  <h1>New ticket</h1>

  <StateMessage
    v-if="metaError"
    type="error"
    :message="metaError"
    @retry="store.loadReferenceData()"
  />
  <StateMessage v-else-if="metaLoading || !meta" type="loading" />

  <form v-else class="form card" novalidate @submit.prevent="submit">
    <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

    <fieldset>
      <legend>Customer</legend>

      <div class="form-field">
        <label for="customer_name">Name <span class="required">*</span></label>
        <input
          id="customer_name"
          v-model="form.customer_name"
          type="text"
          maxlength="255"
          required
          autocomplete="name"
          :aria-invalid="invalid('customer_name')"
        />
        <FieldError field="customer_name" :errors="errors" />
      </div>

      <div class="form-field">
        <label for="customer_email">Email <span class="required">*</span></label>
        <input
          id="customer_email"
          v-model="form.customer_email"
          type="email"
          maxlength="255"
          required
          autocomplete="email"
          :aria-invalid="invalid('customer_email')"
        />
        <FieldError field="customer_email" :errors="errors" />
      </div>

      <div class="form-field">
        <label for="customer_phone">Phone</label>
        <input
          id="customer_phone"
          v-model="form.customer_phone"
          type="tel"
          maxlength="30"
          autocomplete="tel"
          :aria-invalid="invalid('customer_phone')"
        />
        <FieldError field="customer_phone" :errors="errors" />
      </div>
    </fieldset>

    <fieldset>
      <legend>Ticket</legend>

      <div class="form-field">
        <label for="subject">Subject <span class="required">*</span></label>
        <input
          id="subject"
          v-model="form.subject"
          type="text"
          maxlength="255"
          required
          :aria-invalid="invalid('subject')"
        />
        <FieldError field="subject" :errors="errors" />
      </div>

      <div class="form-field">
        <label for="description">Description</label>
        <textarea
          id="description"
          v-model="form.description"
          rows="5"
          maxlength="5000"
          :aria-invalid="invalid('description')"
        ></textarea>
        <FieldError field="description" :errors="errors" />
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="category">Category <span class="required">*</span></label>
          <select
            id="category"
            v-model="form.category"
            required
            :aria-invalid="invalid('category')"
          >
            <option value="">Select a category</option>
            <option v-for="option in meta.categories" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <FieldError field="category" :errors="errors" />
        </div>

        <div class="form-field">
          <label for="priority">Priority <span class="required">*</span></label>
          <select
            id="priority"
            v-model="form.priority"
            required
            :aria-invalid="invalid('priority')"
          >
            <option value="">Select a priority</option>
            <option v-for="option in meta.priorities" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <FieldError field="priority" :errors="errors" />
        </div>
      </div>
    </fieldset>

    <div class="actions">
      <button type="submit" class="btn btn--primary" :disabled="saving">
        {{ saving ? 'Creating…' : 'Create ticket' }}
      </button>
      <RouterLink to="/tickets" class="btn">Cancel</RouterLink>
    </div>
  </form>
</template>
