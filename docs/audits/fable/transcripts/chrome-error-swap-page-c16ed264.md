---
title: Chrome-error / swap page
sidebar_label: c16ed264…
sidebar_position: 99
hide_table_of_contents: true
last_updated: '2026-06-28'
audience:
  - developers
  - protocols
stage: use
owner: docs-team
last_reviewed: '2026-06-28'
status: current
---
<div class="audit-transcript-meta">
[← Source sessions](/audits/fable/key-sessions) · [Transcript archive](/audits/fable/transcripts) · [Executive summary](/audits/fable/findings-summary)
</div>
# Chrome-error / swap page
| Field | Value |
| --- | --- |
| Session ID | `c16ed264-3756-401a-b489-7e5cd345462c` |
| Record type | Lead review session export |
:::note Appendix record
Readable export of a supplementary review session. Tool outputs and system context are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## Engagement brief

<timestamp>Friday, Jun 12, 2026, 2:47 AM (UTC-7)</timestamp>
Navigated to chrome-error://chromewebdata/
Navigated to https://app.4626.fun/swap
evmAsk.js:15 Uncaught TypeError: Cannot redefine property: ethereum
    at Object.defineProperty (<anonymous>)
    at r.inject (evmAsk.js:15:5093)
    at Lv.window.addEventListener.once (evmAsk.js:15:9013)
inject @ evmAsk.js:15
Lv.window.addEventListener.once @ evmAsk.js:15
await in Lv.window.addEventListener.once
(anonymous) @ contentScript.js:1
Lv @ evmAsk.js:15
(anonymous) @ evmAsk.js:15
await in (anonymous)
(anonymous) @ evmAsk.js:15
(anonymous) @ evmAsk.js:15
requestProvider.js:2 Uncaught TypeError: Cannot set property ethereum of #<Window> which has only a getter
    at requestProvider.js:2:585532
    at requestProvider.js:2:585712
    at requestProvider.js:2:585716
    at requestProvider.js:2:585720
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
injected.js:110 Uncaught ReferenceError: injected is not defined
    at injected.js:110:1
(anonymous) @ injected.js:110
main-DHCqnWBR.js:4611 Detected injected providers: (6) [{…}, {…}, {…}, {…}, {…}, {…}]
main-DHCqnWBR.js:4611 Connecting to 'https://privy.4626.fun/api/v1/sessions' violates the following Content Security Policy directive: "connect-src 'self' https://auth.privy.io https://api.developer.coinbase.com https://chain-proxy.wallet.coinbase.com https://keys.coinbase.com https://*.wallet.coinbase.com https://account.base.app https://api.cdp.coinbase.com https://base-mainnet.g.alchemy.com https://*.g.alchemy.com https://explorer-api.walletconnect.com https://metamask-sdk.api.cx.metamask.io wss://metamask-sdk.api.cx.metamask.io wss://www.walletlink.org https://www.walletlink.org https://*.rpc.privy.systems https://rpc.zora.energy https://mainnet.base.org https://api.production.xmtp.network:5558 https://*.xmtp.network:5558 https://*.xmtp.network:* wss://*.xmtp.network:* https://ipfs.decentralized-content.com https://api.lens.xyz https://ccip.ens.xyz https://res.cloudinary.com". The action has been blocked.
window.fetch @ main-DHCqnWBR.js:4611
(anonymous) @ wallet-auth-y22PQqM9.js:80
a @ wallet-auth-y22PQqM9.js:80
await in a
s @ wallet-auth-y22PQqM9.js:80
post @ wallet-auth-y22PQqM9.js:21245
_refresh @ wallet-auth-y22PQqM9.js:21245
await in _refresh
(anonymous) @ wallet-auth-y22PQqM9.js:20833
execute @ wallet-auth-y22PQqM9.js:20833
refresh @ wallet-auth-y22PQqM9.js:21245
getAuthenticatedUser @ wallet-auth-y22PQqM9.js:21245
(anonymous) @ wallet-auth-y22PQqM9.js:21245
(anonymous) @ wallet-auth-y22PQqM9.js:21245
Rr @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
_p @ vendor-CPvvbQqE.js:8
(anonymous) @ vendor-CPvvbQqE.js:8
W @ vendor-CPvvbQqE.js:1
postMessage
ee @ vendor-CPvvbQqE.js:1
W @ vendor-CPvvbQqE.js:1
postMessage
ee @ vendor-CPvvbQqE.js:1
i.unstable_scheduleCallback @ vendor-CPvvbQqE.js:1
Tp @ vendor-CPvvbQqE.js:8
wp @ vendor-CPvvbQqE.js:8
(anonymous) @ vendor-CPvvbQqE.js:8
main-DHCqnWBR.js:4611 Fetch API cannot load https://privy.4626.fun/api/v1/sessions. Refused to connect because it violates the document's Content Security Policy.
window.fetch @ main-DHCqnWBR.js:4611
(anonymous) @ wallet-auth-y22PQqM9.js:80
a @ wallet-auth-y22PQqM9.js:80
await in a
s @ wallet-auth-y22PQqM9.js:80
post @ wallet-auth-y22PQqM9.js:21245
_refresh @ wallet-auth-y22PQqM9.js:21245
await in _refresh
(anonymous) @ wallet-auth-y22PQqM9.js:20833
execute @ wallet-auth-y22PQqM9.js:20833
refresh @ wallet-auth-y22PQqM9.js:21245
getAuthenticatedUser @ wallet-auth-y22PQqM9.js:21245
(anonymous) @ wallet-auth-y22PQqM9.js:21245
(anonymous) @ wallet-auth-y22PQqM9.js:21245
Rr @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
_p @ vendor-CPvvbQqE.js:8
(anonymous) @ vendor-CPvvbQqE.js:8
W @ vendor-CPvvbQqE.js:1
postMessage
ee @ vendor-CPvvbQqE.js:1
W @ vendor-CPvvbQqE.js:1
postMessage
ee @ vendor-CPvvbQqE.js:1
i.unstable_scheduleCallback @ vendor-CPvvbQqE.js:1
Tp @ vendor-CPvvbQqE.js:8
wp @ vendor-CPvvbQqE.js:8
(anonymous) @ vendor-CPvvbQqE.js:8
requestProvider.js:2 Uncaught TypeError: Cannot set property ethereum of #<Window> which has only a getter
    at requestProvider.js:2:585532
    at requestProvider.js:2:585712
    at requestProvider.js:2:585716
    at requestProvider.js:2:585720
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
injected.js:110 Uncaught ReferenceError: injected is not defined
    at injected.js:110:1
(anonymous) @ injected.js:110
evmAsk.js:15 Uncaught TypeError: Cannot redefine property: ethereum
    at Object.defineProperty (<anonymous>)
    at r.inject (evmAsk.js:15:5093)
    at Lv.window.addEventListener.once (evmAsk.js:15:9013)
inject @ evmAsk.js:15
Lv.window.addEventListener.once @ evmAsk.js:15
await in Lv.window.addEventListener.once
Fr @ contentScript.js:1
(anonymous) @ contentScript.js:1
(anonymous) @ contentScript.js:1
embedded-wallets-3943017ed1ce1fe9.js?dpl=dpl_3sAG3aQsxrbvq87A9Ci619WRcBTZ:1 Warning!
embedded-wallets-3943017ed1ce1fe9.js?dpl=dpl_3sAG3aQsxrbvq87A9Ci619WRcBTZ:1 You are reading this message because you opened the browser console, a developer tool. Do not enter or paste code you do not understand. Never share your tokens or any other info with anyone. If someone told you to do this, it is very likely a scam.
main-DHCqnWBR.js:4611 Connecting to 'https://privy.4626.fun/api/v1/sessions' violates the following Content Security Policy directive: "connect-src 'self' https://auth.privy.io https://api.developer.coinbase.com https://chain-proxy.wallet.coinbase.com https://keys.coinbase.com https://*.wallet.coinbase.com https://account.base.app https://api.cdp.coinbase.com https://base-mainnet.g.alchemy.com https://*.g.alchemy.com https://explorer-api.walletconnect.com https://metamask-sdk.api.cx.metamask.io wss://metamask-sdk.api.cx.metamask.io wss://www.walletlink.org https://www.walletlink.org https://*.rpc.privy.systems https://rpc.zora.energy https://mainnet.base.org https://api.production.xmtp.network:5558 https://*.xmtp.network:5558 https://*.xmtp.network:* wss://*.xmtp.network:* https://ipfs.decentralized-content.com https://api.lens.xyz https://ccip.ens.xyz https://res.cloudinary.com". The action has been blocked.
window.fetch @ main-DHCqnWBR.js:4611
(anonymous) @ wallet-auth-y22PQqM9.js:80
a @ wallet-auth-y22PQqM9.js:80
await in a
i @ wallet-auth-y22PQqM9.js:80
await in i
a @ wallet-auth-y22PQqM9.js:80
await in a
s @ wallet-auth-y22PQqM9.js:80
post @ wallet-auth-y22PQqM9.js:21245
_refresh @ wallet-auth-y22PQqM9.js:21245
await in _refresh
(anonymous) @ wallet-auth-y22PQqM9.js:20833
execute @ wallet-auth-y22PQqM9.js:20833
refresh @ wallet-auth-y22PQqM9.js:21245
getAuthenticatedUser @ wallet-auth-y22PQqM9.js:21245
(anonymous) @ wallet-auth-y22PQqM9.js:21245
(anonymous) @ wallet-auth-y22PQqM9.js:21245
Rr @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
_p @ vendor-CPvvbQqE.js:8
(anonymous) @ vendor-CPvvbQqE.js:8
W @ vendor-CPvvbQqE.js:1
postMessage
ee @ vendor-CPvvbQqE.js:1
W @ vendor-CPvvbQqE.js:1
postMessage
ee @ vendor-CPvvbQqE.js:1
i.unstable_scheduleCallback @ vendor-CPvvbQqE.js:1
Tp @ vendor-CPvvbQqE.js:8
wp @ vendor-CPvvbQqE.js:8
(anonymous) @ vendor-CPvvbQqE.js:8
main-DHCqnWBR.js:4611 Fetch API cannot load https://privy.4626.fun/api/v1/sessions. Refused to connect because it violates the document's Content Security Policy.
window.fetch @ main-DHCqnWBR.js:4611
(anonymous) @ wallet-auth-y22PQqM9.js:80
a @ wallet-auth-y22PQqM9.js:80
await in a
i @ wallet-auth-y22PQqM9.js:80
await in i
a @ wallet-auth-y22PQqM9.js:80
await in a
s @ wallet-auth-y22PQqM9.js:80
post @ wallet-auth-y22PQqM9.js:21245
_refresh @ wallet-auth-y22PQqM9.js:21245
await in _refresh
(anonymous) @ wallet-auth-y22PQqM9.js:20833
execute @ wallet-auth-y22PQqM9.js:20833
refresh @ wallet-auth-y22PQqM9.js:21245
getAuthenticatedUser @ wallet-auth-y22PQqM9.js:21245
(anonymous) @ wallet-auth-y22PQqM9.js:21245
(anonymous) @ wallet-auth-y22PQqM9.js:21245
Rr @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
_p @ vendor-CPvvbQqE.js:8
(anonymous) @ vendor-CPvvbQqE.js:8
W @ vendor-CPvvbQqE.js:1
postMessage
ee @ vendor-CPvvbQqE.js:1
W @ vendor-CPvvbQqE.js:1
postMessage
ee @ vendor-CPvvbQqE.js:1
i.unstable_scheduleCallback @ vendor-CPvvbQqE.js:1
Tp @ vendor-CPvvbQqE.js:8
wp @ vendor-CPvvbQqE.js:8
(anonymous) @ vendor-CPvvbQqE.js:8
requestProvider.js:2 Uncaught TypeError: Cannot set property ethereum of #<Window> which has only a getter
    at requestProvider.js:2:585532
    at requestProvider.js:2:585712
    at requestProvider.js:2:585716
    at requestProvider.js:2:585720
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
injected.js:110 Uncaught ReferenceError: injected is not defined
    at injected.js:110:1
(anonymous) @ injected.js:110
evmAsk.js:15 Uncaught TypeError: Cannot redefine property: ethereum
    at Object.defineProperty (<anonymous>)
    at r.inject (evmAsk.js:15:5093)
    at Lv.window.addEventListener.once (evmAsk.js:15:9013)
inject @ evmAsk.js:15
Lv.window.addEventListener.once @ evmAsk.js:15
await in Lv.window.addEventListener.once
Fr @ contentScript.js:1
(anonymous) @ contentScript.js:1
(anonymous) @ contentScript.js:1
main-DHCqnWBR.js:4611 Connecting to 'https://privy.4626.fun/api/v1/sessions' violates the following Content Security Policy directive: "connect-src 'self' https://auth.privy.io https://api.developer.coinbase.com https://chain-proxy.wallet.coinbase.com https://keys.coinbase.com https://*.wallet.coinbase.com https://account.base.app https://api.cdp.coinbase.com https://base-mainnet.g.alchemy.com https://*.g.alchemy.com https://explorer-api.walletconnect.com https://metamask-sdk.api.cx.metamask.io wss://metamask-sdk.api.cx.metamask.io wss://www.walletlink.org https://www.walletlink.org https://*.rpc.privy.systems https://rpc.zora.energy https://mainnet.base.org https://api.production.xmtp.network:5558 https://*.xmtp.network:5558 https://*.xmtp.network:* wss://*.xmtp.network:* https://ipfs.decentralized-content.com https://api.lens.xyz https://ccip.ens.xyz https://res.cloudinary.com". The action has been blocked.
window.fetch @ main-DHCqnWBR.js:4611
(anonymous) @ wallet-auth-y22PQqM9.js:80
a @ wallet-auth-y22PQqM9.js:80
await in a
i @ wallet-auth-y22PQqM9.js:80
await in i
a @ wallet-auth-y22PQqM9.js:80
await in a
i @ wallet-auth-y22PQqM9.js:80
await in i
a @ wallet-auth-y22PQqM9.js:80
await in a
s @ wallet-auth-y22PQqM9.js:80
post @ wallet-auth-y22PQqM9.js:21245
_refresh @ wallet-auth-y22PQqM9.js:21245
await in _refresh
(anonymous) @ wallet-auth-y22PQqM9.js:20833
execute @ wallet-auth-y22PQqM9.js:20833
refresh @ wallet-auth-y22PQqM9.js:21245
getAuthenticatedUser @ wallet-auth-y22PQqM9.js:21245
(anonymous) @ wallet-auth-y22PQqM9.js:21245
(anonymous) @ wallet-auth-y22PQqM9.js:21245
Rr @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
_p @ vendor-CPvvbQqE.js:8
(anonymous) @ vendor-CPvvbQqE.js:8
W @ vendor-CPvvbQqE.js:1
postMessage
ee @ vendor-CPvvbQqE.js:1
W @ vendor-CPvvbQqE.js:1
postMessage
ee @ vendor-CPvvbQqE.js:1
i.unstable_scheduleCallback @ vendor-CPvvbQqE.js:1
Tp @ vendor-CPvvbQqE.js:8
wp @ vendor-CPvvbQqE.js:8
(anonymous) @ vendor-CPvvbQqE.js:8
main-DHCqnWBR.js:4611 Fetch API cannot load https://privy.4626.fun/api/v1/sessions. Refused to connect because it violates the document's Content Security Policy.
window.fetch @ main-DHCqnWBR.js:4611
(anonymous) @ wallet-auth-y22PQqM9.js:80
a @ wallet-auth-y22PQqM9.js:80
await in a
i @ wallet-auth-y22PQqM9.js:80
await in i
a @ wallet-auth-y22PQqM9.js:80
await in a
i @ wallet-auth-y22PQqM9.js:80
await in i
a @ wallet-auth-y22PQqM9.js:80
await in a
s @ wallet-auth-y22PQqM9.js:80
post @ wallet-auth-y22PQqM9.js:21245
_refresh @ wallet-auth-y22PQqM9.js:21245
await in _refresh
(anonymous) @ wallet-auth-y22PQqM9.js:20833
execute @ wallet-auth-y22PQqM9.js:20833
refresh @ wallet-auth-y22PQqM9.js:21245
getAuthenticatedUser @ wallet-auth-y22PQqM9.js:21245
(anonymous) @ wallet-auth-y22PQqM9.js:21245
(anonymous) @ wallet-auth-y22PQqM9.js:21245
Rr @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
On @ vendor-CPvvbQqE.js:8
Wm @ vendor-CPvvbQqE.js:8
_p @ vendor-CPvvbQqE.js:8
(anonymous) @ vendor-CPvvbQqE.js:8
W @ vendor-CPvvbQqE.js:1
postMessage
ee @ vendor-CPvvbQqE.js:1
W @ vendor-CPvvbQqE.js:1
postMessage
ee @ vendor-CPvvbQqE.js:1
i.unstable_scheduleCallback @ vendor-CPvvbQqE.js:1
Tp @ vendor-CPvvbQqE.js:8
wp @ vendor-CPvvbQqE.js:8
(anonymous) @ vendor-CPvvbQqE.js:8
main-DHCqnWBR.js:2 [app-loading] overlay still active after 8s — held by: privy-init

## Analysis

The smoking gun here is the CSP block on `https://privy.4626.fun/api/v1/sessions` — the custom Privy auth domain is missing from the production `connect-src`, so Privy can never restore its session and the loading overlay hangs on `privy-init`. The wallet-extension errors (`evmAsk.js`, `requestProvider.js`) are the known multi-extension provider-collision noise and not the cause. Let me find where the CSP is defined.

 Looking at the production errors, the issue is a Content Security Policy violation—the `connect-src` directive is blocking requests to `https://privy.4626.fun/api/v1/sessions`. The CSP currently allows `https://auth.privy.io` but is missing the custom Privy domain that needs to be configured according to the setup docs, so I need to add `https://privy.4626.fun` to the CSP rules.

The wallet extension errors are just noise from provider collisions and aren't causing the actual problem. I should check the CSP configuration in the frontend's Vercel config file to see if the custom Privy domain was accidentally removed in a recent change.

*Tools invoked:* Grep, Grep

## Analysis

*Tools invoked:* Grep

## Analysis

The grep truncated the long CSP line. Let me read it fully.

 I need to look at the full Content Security Policy header around line 191 since it's being cut off.

*Tools invoked:* Shell

## Analysis

So the issue is that the Privy SDK's custom auth domain endpoints aren't in the `connect-src` directive—they're only allowed in `child-src` and `frame-src`—which blocks the XHR/fetch requests to `https://privy.4626.fun/api/v1/sessions`. I need to add both `https://privy.4626.fun` and `https://privy.app.4626.fun` to `connect-src` to fix this.

Before applying the fix, I should check the git history of the vercel.json file to see if this was recently removed or if it's been missing, though the priority is just getting it working.I found that `connect-src` is missing the custom auth domain `https://privy.4626.fun` — it only allows `auth.privy.io` — which is why the Privy SDK's fetch calls are being blocked. I'll check if this is a regression and then add the missing domain to the CSP.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

The connect-src directive never included privy.4626.fun in the first place, so this isn't a recent regression. The site must have worked before with a different Privy endpoint, possibly auth.privy.io, and something changed either in the SDK's connection behavior or the dashboard configuration. I should also check if there's a separate CSP header for the app subdomain since this route pattern suggests there might be different policies for app.4626.fun versus 4626.fun — let me look through vercel.json for other CSP entries.I found that `connect-src` is missing `privy.4626.fun` even though the frame/child directives have it, so the CSP cutover was incomplete. I'll check for duplicate CSP blocks in `vercel.json` and add the missing origin.

*Tools invoked:* Shell, Read

## Analysis

There's a single CSP policy across all routes, and `connect-src` is missing the custom Privy domains (`https://privy.4626.fun` and possibly `https://privy.app.4626.fun`), even though `frame-src` and `child-src` include them. When the custom auth domain was added in 2026, only the frame/child directives were updated, leaving `connect-src` behind. This likely worked before because the Privy SDK probably only used the custom domain for iframe embedding, but a newer version now routes session API calls through it as well.

The fix is straightforward: I need to add both custom Privy domains to `connect-src` right after `'self'`, before the existing `https://auth.privy.io` entry. I'll also add a test in the CSP test file to prevent regression, then run it to verify the fix works.

Since this is a production outage and the user's preferences indicate they expect immediate commit and push after shipping fixes, I'll go ahead with that once the changes are verified.I found the issue: the custom Privy domain was added to `child-src` and `frame-src` but not `connect-src`, so the SDK's fetch calls are blocked and sessions can't restore. I'll add both custom domains to `connect-src` and add a regression test.

*Tools invoked:* StrReplace

## Analysis

Now a regression test next to the existing CSP assertions, so the custom Privy auth domain can't silently drop out of `connect-src` again.

 I should add a regression test to cover the CSP functionality alongside the existing tests.

*Tools invoked:* StrReplace

## Analysis

*Tools invoked:* Shell

## Analysis

All 11 tests pass and the JSON is valid. Production is broken and deploys are `main`-only, so I'll commit and push the fix now.

 Tests are passing, so I'll verify the current branch and status before committing and pushing to main—the user's production is down and they only deploy from main.

*Tools invoked:* Shell

## Analysis

I've got some unrelated changes sitting around—deploy hero stuff, NetworkBadge deletion, and an untracked migration—but I'm just going to commit my two files to keep things clean.I found unrelated local changes in the working tree, so I'll commit only the CSP fix and its test.

*Tools invoked:* Shell

## Analysis

Fixed and pushed to `main` (commit `5e7656ef9`), which triggers the Vercel production deploy.

**Root cause:** the production CSP in `frontend/vercel.json` allowed the custom Privy auth domain (`privy.4626.fun`) in `frame-src`/`child-src` but not in `connect-src`. The Privy SDK on the custom auth domain makes its session-refresh fetches to `https://privy.4626.fun/api/v1/sessions`, and the browser blocked every one of them. Privy init could never complete, which is exactly why the loading overlay reported `held by: privy-init` after 8 seconds.

**What I changed:**
- Added `https://privy.4626.fun` and `https://privy.app.4626.fun` to the CSP `connect-src` in `frontend/vercel.json` (both were already present in the frame directives, so I covered both hosts).
- Added a regression test in `alfaclubVercelWiring.test.ts` that asserts both custom Privy domains stay in `connect-src` specifically — all 11 tests in that file pass.

**Not the cause:** the `evmAsk.js` / `requestProvider.js` / `injected.js` errors at the top are the known multi-wallet-extension provider-collision noise (locked `window.ethereum` getter) — the app already handles that via `detectEthereumProviderCollision()`, and the page got past it ("Detected injected providers: 6").

Once the Vercel production deploy finishes, a hard refresh of `app.4626.fun/swap` should restore the Privy session and clear the stuck overlay. Note I left your other uncommitted local work (DeployHero changes, `NetworkBadge` deletion, the new Ethos migration) untouched.

 I've pushed the commit to main, which will trigger the Vercel production deploy. The root cause is identified, the fix is in place, and I should wait for the deploy to complete before doing a hard refresh to verify. There are some other local changes I haven't committed yet like the deploy hero updates, but those can wait.

