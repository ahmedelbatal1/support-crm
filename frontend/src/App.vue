<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header class="app-header">
    <div class="container app-header__inner">
      <span class="app-header__title">Support CRM</span>
      <nav class="app-nav">
        <RouterLink to="/tickets">Tickets</RouterLink>
        <RouterLink to="/tickets/new">New ticket</RouterLink>
      </nav>
    </div>
  </header>

  <main class="container">
    <RouterView />
  </main>
</template>
