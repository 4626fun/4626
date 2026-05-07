export type WalletConnectorLike = {
  id?: string
  name?: string
}

function connectorText(connector: WalletConnectorLike): string {
  return `${connector.id ?? ''} ${connector.name ?? ''}`.trim().toLowerCase()
}

function connectorId(connector: WalletConnectorLike): string {
  return String(connector.id ?? '').trim().toLowerCase()
}

function isGenericInjectedConnector(connector: WalletConnectorLike): boolean {
  const id = connectorId(connector)
  return id === 'injected' || id.endsWith('.injected')
}

function isInjectedExtensionConnector(connector: WalletConnectorLike): boolean {
  const text = connectorText(connector)
  return isGenericInjectedConnector(connector) || text.includes('metamask')
}

export function filterHiddenInjectedConnectors<T extends WalletConnectorLike>(
  connectors: readonly T[],
  shouldHideInjectedConnector: boolean,
): T[] {
  if (!shouldHideInjectedConnector) return [...connectors]
  return connectors.filter((connector) => !isInjectedExtensionConnector(connector))
}

export function selectPreferredWalletConnector<T extends WalletConnectorLike>(connectors: readonly T[]): T | null {
  if (connectors.length === 0) return null

  return (
    connectors.find((connector) => connectorText(connector).includes('rabby')) ??
    connectors.find((connector) => connectorText(connector).includes('coinbase')) ??
    connectors.find((connector) => connectorText(connector).includes('base')) ??
    connectors.find((connector) => connectorText(connector).includes('metamask')) ??
    connectors.find((connector) => !isGenericInjectedConnector(connector)) ??
    connectors[0] ??
    null
  )
}
