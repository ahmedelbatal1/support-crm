<script setup>
import { formatDateTime } from '@/utils/format'

defineProps({
  // The ticket's history entries, oldest first as the API returns them.
  entries: { type: Array, required: true },
})
</script>

<template>
  <ol v-if="entries.length" class="history-list">
    <li v-for="entry in entries" :key="entry.id">
      <time :datetime="entry.created_at">{{ formatDateTime(entry.created_at) }}</time>
      <span class="history-description">{{ entry.description }}</span>
    </li>
  </ol>
  <p v-else class="muted">No history yet.</p>
</template>
