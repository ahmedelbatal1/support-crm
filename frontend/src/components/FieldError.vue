<script setup>
import { computed } from 'vue'

const props = defineProps({
  field: { type: String, required: true },
  // The `errors` object from a 422 response: field name → list of messages.
  errors: { type: Object, default: () => ({}) },
})

const message = computed(() => props.errors[props.field]?.[0] ?? '')
</script>

<template>
  <p v-if="message" class="field-error">{{ message }}</p>
</template>
