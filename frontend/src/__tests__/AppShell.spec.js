import { describe, it, expect } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

import App from '../App.vue'

function makeRouter() {
  const Page = (text) => ({ render: () => h('p', text) })

  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tickets', component: Page('List page') },
      { path: '/tickets/new', component: Page('Create page') },
    ],
  })
}

describe('App shell', () => {
  it('shows the Tickets and New ticket links', async () => {
    const router = makeRouter()
    router.push('/tickets')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [router] } })
    const links = wrapper.findAll('nav a')

    expect(links.map((a) => a.text())).toEqual(['Tickets', 'New ticket'])
    expect(links.map((a) => a.attributes('href'))).toEqual(['/tickets', '/tickets/new'])
  })

  it('renders the current route in the RouterView', async () => {
    const router = makeRouter()
    router.push('/tickets/new')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.find('main').text()).toBe('Create page')
  })
})
