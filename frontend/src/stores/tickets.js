import { ref } from 'vue'
import { defineStore } from 'pinia'

import { getMeta, getAgents } from '@/api/meta'

/**
 * The single store for ticket state. Pages call its actions and read its state; only the store
 * talks to src/api. Error fields hold the normalized message from src/api/http.js.
 */
export const useTicketsStore = defineStore('tickets', () => {
  // Reference data: enum options, allowed transitions and the agent list.
  const meta = ref(null)
  const agents = ref([])
  const metaLoading = ref(false)
  const metaError = ref(null)

  let referenceRequest = null

  /**
   * Loads meta and agents once. Later calls reuse the cached data, and calls made while a request
   * is in flight share it. A failure sets metaError and leaves the cache empty so a retry fetches
   * again.
   */
  function loadReferenceData() {
    if (meta.value) {
      return Promise.resolve()
    }

    if (!referenceRequest) {
      metaLoading.value = true
      metaError.value = null

      referenceRequest = Promise.all([getMeta(), getAgents()])
        .then(([metaData, agentList]) => {
          meta.value = metaData
          agents.value = agentList
        })
        .catch((error) => {
          metaError.value = error.message
        })
        .finally(() => {
          metaLoading.value = false
          referenceRequest = null
        })
    }

    return referenceRequest
  }

  return {
    meta,
    agents,
    metaLoading,
    metaError,
    loadReferenceData,
  }
})
