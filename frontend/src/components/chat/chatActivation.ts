export function hasChatDeepLinkSearch(search: string): boolean {
  if (typeof search !== 'string' || search.length === 0) return false
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    return params.has('chatAction') || params.has('chatPeer') || params.has('chatName')
  } catch {
    return false
  }
}
