<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const SEARCH_DELAY_MS = 300
const EMPTY_FILTERS = { status: '', priority: '', category: '', agent_id: '', search: '' }

const props = defineProps({
  // The applied filters: { status, priority, category, agent_id, search }.
  filters: { type: Object, required: true },
  // GET /meta data; null until it has loaded, in which case only the "All" options show.
  meta: { type: Object, default: null },
  agents: { type: Array, default: () => [] },
})

const emit = defineEmits(['change'])

const local = ref(normalize(props.filters))
let searchTimer = null

// Agent ids are compared as strings because filters coming from the URL query are strings.
function normalize(filters) {
  const result = { ...EMPTY_FILTERS }
  for (const key of Object.keys(EMPTY_FILTERS)) {
    result[key] = String(filters[key] ?? '')
  }
  return result
}

watch(
  () => props.filters,
  (filters) => {
    cancelSearch()
    local.value = normalize(filters)
  },
)

const hasFilters = computed(() => Object.values(local.value).some((value) => value !== ''))

function cancelSearch() {
  clearTimeout(searchTimer)
  searchTimer = null
}

function emitChange() {
  cancelSearch()
  emit('change', { ...local.value })
}

function onSearchInput() {
  cancelSearch()
  searchTimer = setTimeout(emitChange, SEARCH_DELAY_MS)
}

function clear() {
  local.value = { ...EMPTY_FILTERS }
  emitChange()
}

onBeforeUnmount(cancelSearch)
</script>

<template>
  <form class="filters" role="search" @submit.prevent="emitChange">
    <div class="form-field">
      <label for="filter-search">Search</label>
      <input
        id="filter-search"
        v-model="local.search"
        type="search"
        maxlength="100"
        placeholder="Subject or ticket number"
        @input="onSearchInput"
      />
    </div>

    <div class="form-field">
      <label for="filter-status">Status</label>
      <select id="filter-status" v-model="local.status" @change="emitChange">
        <option value="">All statuses</option>
        <option v-for="option in meta?.statuses ?? []" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="form-field">
      <label for="filter-priority">Priority</label>
      <select id="filter-priority" v-model="local.priority" @change="emitChange">
        <option value="">All priorities</option>
        <option v-for="option in meta?.priorities ?? []" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="form-field">
      <label for="filter-category">Category</label>
      <select id="filter-category" v-model="local.category" @change="emitChange">
        <option value="">All categories</option>
        <option v-for="option in meta?.categories ?? []" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="form-field">
      <label for="filter-agent">Agent</label>
      <select id="filter-agent" v-model="local.agent_id" @change="emitChange">
        <option value="">All agents</option>
        <option value="none">Unassigned</option>
        <option v-for="agent in agents" :key="agent.id" :value="String(agent.id)">
          {{ agent.name }}
        </option>
      </select>
    </div>

    <div class="filters__actions">
      <button type="button" class="btn" :disabled="!hasFilters" @click="clear">Clear</button>
    </div>
  </form>
</template>
