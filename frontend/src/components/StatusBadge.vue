<script setup>
defineProps({
  // A { value, label } object as returned by the API.
  status: { type: Object, required: true },
})
</script>

<template>
  <span class="badge" :class="`badge--${status.value}`">{{ status.label }}</span>
</template>
