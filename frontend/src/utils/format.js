/**
 * Formats an ISO 8601 timestamp from the API for display. It uses the viewer's locale and local
 * timezone unless `options` says otherwise (tests pass { timeZone: 'UTC' }). Returns '' for a
 * missing or invalid value so templates never show "Invalid Date".
 */
export function formatDateTime(iso, options = {}) {
  if (!iso) {
    return ''
  }

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(date)
}
