export type ConsumedAuthLink = {
  values: Record<string, string>
  sanitizedSearch: string
  containedSensitiveParameters: boolean
}

/**
 * Auth secrets are delivered in the URL fragment so they are never sent in
 * HTTP referrers or server requests. Query support is retained for old links,
 * but recognized values are removed from either location immediately.
 */
export function consumeAuthLinkParameters(
  hash: string,
  search: string,
  keys: readonly string[],
): ConsumedAuthLink {
  const fragment = new URLSearchParams(hash.replace(/^#/, '').replace(/^\?/, ''))
  const query = new URLSearchParams(search)
  const values: Record<string, string> = {}
  let containedSensitiveParameters = false

  for (const key of keys) {
    const fragmentValue = fragment.get(key)
    const queryValue = query.get(key)
    const value = fragmentValue ?? queryValue
    if (value !== null) values[key] = value
    if (fragment.has(key) || query.has(key)) containedSensitiveParameters = true
    query.delete(key)
  }

  const remainingQuery = query.toString()
  return {
    values,
    sanitizedSearch: remainingQuery ? `?${remainingQuery}` : '',
    containedSensitiveParameters,
  }
}
