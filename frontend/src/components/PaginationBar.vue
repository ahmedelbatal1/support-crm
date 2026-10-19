<script setup>
import { computed } from 'vue'

const props = defineProps({
  // The store's pagination: { current_page, last_page, per_page, total }.
  pagination: { type: Object, required: true },
})

const emit = defineEmits(['page'])

const current = computed(() => props.pagination.current_page)
const last = computed(() => Math.max(props.pagination.last_page, 1))
const ticketsText = computed(() =>
  props.pagination.total === 1 ? '1 ticket' : `${props.pagination.total} tickets`,
)

// From a page past the end (an old link), Prev goes to the last real page.
function previous() {
  emit('page', Math.min(current.value - 1, last.value))
}

function next() {
  emit('page', current.value + 1)
}
</script>

<template>
  <nav class="pagination" aria-label="Pagination">
    <button type="button" class="btn" :disabled="current <= 1" @click="previous">Prev</button>
    <span class="pagination__info">Page {{ current }} of {{ last }} ({{ ticketsText }})</span>
    <button type="button" class="btn" :disabled="current >= last" @click="next">Next</button>
  </nav>
</template>
