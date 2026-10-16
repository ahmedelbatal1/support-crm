<script setup>
import { computed } from 'vue'

const DEFAULT_MESSAGES = {
  loading: 'Loading…',
  empty: 'Nothing to show.',
  error: 'Something went wrong.',
  notfound: 'Not found.',
}

const props = defineProps({
  type: {
    type: String,
    required: true,
    // Inlined because defineProps is hoisted and cannot read DEFAULT_MESSAGES.
    validator: (value) => ['loading', 'empty', 'error', 'notfound'].includes(value),
  },
  message: { type: String, default: '' },
})

defineEmits(['retry'])

const text = computed(() => props.message || DEFAULT_MESSAGES[props.type])
</script>

<template>
  <div class="state" :class="`state--${type}`" :role="type === 'error' ? 'alert' : 'status'">
    <p>{{ text }}</p>
    <button v-if="type === 'error'" type="button" class="btn" @click="$emit('retry')">Retry</button>
    <slot />
  </div>
</template>
