import { createRouter, createWebHistory } from 'vue-router'

import NotFound from '@/pages/NotFound.vue'
import TicketList from '@/pages/TicketList.vue'
import TicketDetail from '@/pages/TicketDetail.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/tickets' },
    { path: '/tickets', name: 'tickets', component: TicketList },
    { path: '/tickets/:id', name: 'ticket-detail', component: TicketDetail },
    // Keep last: anything no other route matches.
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFound },
  ],
})

export default router
