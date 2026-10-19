import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import router from '@/router'
import NotFound from '@/pages/NotFound.vue'

describe('router', () => {
  it('redirects / to /tickets', async () => {
    await router.push('/')

    expect(router.currentRoute.value.path).toBe('/tickets')
  })

  it('sends unknown URLs to NotFound', async () => {
    await router.push('/no/such/page')

    const route = router.currentRoute.value
    expect(route.name).toBe('not-found')
    expect(route.matched[0].components.default).toBe(NotFound)
  })
})

describe('NotFound page', () => {
  it('shows a not-found message with a link back to the tickets', async () => {
    await router.push('/missing')
    await router.isReady()

    const wrapper = mount(NotFound, { global: { plugins: [router] } })
    const link = wrapper.find('a')

    expect(wrapper.find('.state--notfound').text()).toContain('Page not found.')
    expect(link.text()).toBe('Back to tickets')
    expect(link.attributes('href')).toBe('/tickets')
  })
})
