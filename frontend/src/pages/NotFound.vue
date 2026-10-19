<script setup>
import { RouterLink } from 'vue-router'

import StateMessage from '@/components/StateMessage.vue'
</script>

<template>
  <StateMessage type="notfound" message="Page not found.">
    <RouterLink to="/tickets">Back to tickets</RouterLink>
  </StateMessage>
</template>
