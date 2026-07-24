/* Friend.tech v1 withdraw — CSP-safe, no external CDN */
;(function () {
  'use strict'

  const BASE_CHAIN_ID = 8453
  const BASE_CHAIN_HEX = '0x2105'
  const RPC = 'https://mainnet.base.org'
  const FT = '0xCF205808Ed36593aa40a44F10c7f7C2F67d4A4d4'
  const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
  const MIN_GAS_WEI = 1_000_000_000_000_000n // 0.001 ETH
  const MC_CHUNK = 120
  const SEL = {
    sharesBalance: '0x020235ff',
    sharesSupply: '0xf9931be0',
    getSellPriceAfterFee: '0x2267a89c',
    sellShares: '0xb51d0534',
    aggregate3: '0x82ad56cb',
  }

  /** @type {string[]} */
  let subjects = []
  /** @type {string|null} */
  let account = null
  /** Checksum / wallet-cased address for eth_sendTransaction / wallet_sendCalls `from`. */
  /** @type {string|null} */
  let accountFrom = null
  /** @type {Array<{subject:string,balance:bigint,sellable:bigint,supply:bigint,estWei:bigint,stuck:boolean}>} */
  let positions = []
  let busy = false
  /** @type {bigint} */
  let lastGasWei = 0n
  const SEND_CALLS_CHUNK = 10

  const $ = (id) => document.getElementById(id)

  function padAddr(addr) {
    return addr.toLowerCase().replace(/^0x/, '').padStart(64, '0')
  }

  function padUint(n) {
    return BigInt(n).toString(16).padStart(64, '0')
  }

  function shortAddr(a) {
    return a.slice(0, 6) + '…' + a.slice(-4)
  }

  function formatEth(wei) {
    const v = Number(wei) / 1e18
    if (!Number.isFinite(v)) return '—'
    if (v === 0) return '0'
    if (v < 0.000001) return v.toExponential(2)
    return v.toFixed(6)
  }

  function setStatus(msg, kind) {
    const el = $('status')
    el.textContent = msg
    el.dataset.kind = kind || 'info'
  }

  function setLog(lines) {
    $('log').textContent = lines.join('\n')
  }

  async function rpc(method, params) {
    const provider = getEthereum()
    if (provider && method === 'eth_call') {
      try {
        return await provider.request({ method, params })
      } catch (_) {
        /* fall through to public RPC */
      }
    }
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    const j = await res.json()
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error))
    return j.result
  }

  async function ethCall(to, data) {
    return rpc('eth_call', [{ to, data }, 'latest'])
  }

  async function ethCallRetry(to, data, attempts) {
    let lastErr
    for (let i = 0; i < (attempts || 4); i++) {
      try {
        return await ethCall(to, data)
      } catch (err) {
        lastErr = err
        const msg = (err && err.message) || String(err)
        if (!/rate limit|429|-32016/i.test(msg)) throw err
        await new Promise((r) => setTimeout(r, 400 * (i + 1) * (i + 1)))
      }
    }
    throw lastErr
  }

  function encodeAggregate3(calls) {
    const n = calls.length
    const tupleEncodings = calls.map((c) => {
      const target = padAddr(c.target)
      const allow = (c.allowFailure ? 1 : 0).toString(16).padStart(64, '0')
      const data = c.data.replace(/^0x/, '')
      const dataLen = data.length / 2
      const dataPad = data + '0'.repeat((64 - (data.length % 64)) % 64)
      const bytesPart = dataLen.toString(16).padStart(64, '0') + dataPad
      return target + allow + (0x60).toString(16).padStart(64, '0') + bytesPart
    })
    let cursor = 32 * n
    const offsets = []
    for (const enc of tupleEncodings) {
      offsets.push(cursor.toString(16).padStart(64, '0'))
      cursor += enc.length / 2
    }
    const arr =
      n.toString(16).padStart(64, '0') + offsets.join('') + tupleEncodings.join('')
    return SEL.aggregate3 + (32).toString(16).padStart(64, '0') + arr
  }

  function decodeAggregate3(result) {
    const hex = result.replace(/^0x/, '')
    const arrOff = parseInt(hex.slice(0, 64), 16) * 2
    const arr = hex.slice(arrOff)
    const len = parseInt(arr.slice(0, 64), 16)
    const out = []
    for (let i = 0; i < len; i++) {
      const off = parseInt(arr.slice(64 + i * 64, 64 + (i + 1) * 64), 16) * 2
      const tuple = arr.slice(off)
      const success = parseInt(tuple.slice(0, 64), 16) === 1
      const dataOff = parseInt(tuple.slice(64, 128), 16) * 2
      const dataRegion = tuple.slice(dataOff)
      const dataLen = parseInt(dataRegion.slice(0, 64), 16)
      const data = dataRegion.slice(64, 64 + dataLen * 2)
      out.push({ success, data: data ? '0x' + data : '0x' })
    }
    return out
  }

  async function multicall(callDatas) {
    const results = []
    for (let i = 0; i < callDatas.length; i += MC_CHUNK) {
      const chunk = callDatas.slice(i, i + MC_CHUNK)
      const data = encodeAggregate3(
        chunk.map((cd) => ({ target: FT, allowFailure: true, data: cd })),
      )
      const raw = await ethCallRetry(MULTICALL3, data, 5)
      results.push(...decodeAggregate3(raw))
      if (i + MC_CHUNK < callDatas.length) {
        await new Promise((r) => setTimeout(r, 250))
      }
    }
    return results
  }

  function callDataBalance(subject, holder) {
    return SEL.sharesBalance + padAddr(subject) + padAddr(holder)
  }

  function callDataSupply(subject) {
    return SEL.sharesSupply + padAddr(subject)
  }

  function callDataSellPrice(subject, amount) {
    return SEL.getSellPriceAfterFee + padAddr(subject) + padUint(amount)
  }

  function callDataSell(subject, amount) {
    return SEL.sellShares + padAddr(subject) + padUint(amount)
  }

  function getEthereum() {
    return window.ethereum || null
  }

  async function ensureBase(provider) {
    const chainId = await provider.request({ method: 'eth_chainId' })
    if (chainId === BASE_CHAIN_HEX) return
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_HEX }],
      })
    } catch (err) {
      if (err && (err.code === 4902 || err.code === -32603)) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: BASE_CHAIN_HEX,
              chainName: 'Base',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: [RPC],
              blockExplorerUrls: ['https://basescan.org'],
            },
          ],
        })
        return
      }
      throw err
    }
  }

  async function connect() {
    const provider = getEthereum()
    if (!provider) {
      setStatus('No injected wallet found. Install MetaMask, Rabby, or Coinbase Wallet.', 'warn')
      return
    }
    await ensureBase(provider)
    const accounts = await provider.request({ method: 'eth_requestAccounts' })
    accountFrom = accounts[0] || null
    account = accountFrom ? accountFrom.toLowerCase() : null
    if (!account || !accountFrom) {
      setStatus('No account returned.', 'warn')
      return
    }
    $('wallet').textContent = accountFrom
    $('connectBtn').textContent = 'Connected'
    setStatus('Connected. Scanning positions…', 'info')
    await refresh()
  }

  async function getGasWei(addr) {
    const hex = await rpc('eth_getBalance', [addr, 'latest'])
    return BigInt(hex)
  }

  async function refresh() {
    if (!account) {
      setStatus('Connect a wallet first.', 'warn')
      return
    }
    if (!subjects.length) {
      setStatus('No subject list loaded.', 'warn')
      return
    }

    busy = true
    updateButtons()
    try {
      const gasWei = await getGasWei(account)
      lastGasWei = gasWei
      $('gas').textContent = formatEth(gasWei) + ' ETH'
      const gasOk = gasWei >= MIN_GAS_WEI
      $('gasHint').hidden = gasOk
      $('gasHint').textContent = gasOk
        ? ''
        : 'Send at least ~0.001 ETH to this wallet on Base for gas before withdrawing.'

      setStatus(`Reading balances for ${subjects.length} subjects…`, 'info')

      const balResults = await multicall(subjects.map((s) => callDataBalance(s, account)))

      const held = []
      for (let i = 0; i < subjects.length; i++) {
        const r = balResults[i]
        if (!r || !r.success || !r.data || r.data === '0x') continue
        const bal = BigInt(r.data)
        if (bal > 0n) held.push({ subject: subjects[i], balance: bal })
      }

      if (!held.length) {
        positions = []
        renderPositions()
        setStatus('No Friend.tech v1 share balances for this wallet (against baked subject list).', 'warn')
        return
      }

      setStatus(`Found ${held.length} positions. Pricing…`, 'info')
      const supplyResults = await multicall(held.map((h) => callDataSupply(h.subject)))

      const priced = []
      const priceCallDatas = []
      const priceMeta = []

      for (let i = 0; i < held.length; i++) {
        const supply = supplyResults[i] && supplyResults[i].success ? BigInt(supplyResults[i].data) : 0n
        const balance = held[i].balance
        let sellable = balance
        let stuck = false
        if (supply <= balance) {
          sellable = supply > 1n ? supply - 1n : 0n
          stuck = sellable === 0n
        }
        const row = {
          subject: held[i].subject,
          balance,
          sellable,
          supply,
          estWei: 0n,
          stuck,
        }
        priced.push(row)
        if (sellable > 0n) {
          priceMeta.push(priced.length - 1)
          priceCallDatas.push(callDataSellPrice(held[i].subject, sellable))
        }
      }

      const priceResults = priceCallDatas.length ? await multicall(priceCallDatas) : []
      for (let i = 0; i < priceMeta.length; i++) {
        const r = priceResults[i]
        if (r && r.success && r.data && r.data !== '0x') priced[priceMeta[i]].estWei = BigInt(r.data)
      }

      priced.sort((a, b) => (a.estWei < b.estWei ? 1 : a.estWei > b.estWei ? -1 : 0))
      positions = priced
      renderPositions()

      const sellable = positions.filter((p) => p.sellable > 0n)
      const stuckN = positions.filter((p) => p.stuck).length
      const total = sellable.reduce((s, p) => s + p.estWei, 0n)
      setStatus(
        `${sellable.length} sellable · ${stuckN} last-share stuck · est. ${formatEth(total)} ETH after fees` +
          (gasOk ? '' : ' · fund gas first'),
        gasOk ? 'ok' : 'warn',
      )
    } catch (err) {
      console.error(err)
      setStatus(err.message || String(err), 'err')
    } finally {
      busy = false
      updateButtons()
    }
  }

  function renderPositions() {
    const tbody = $('rows')
    tbody.replaceChildren()
    let total = 0n
    for (const p of positions) {
      total += p.estWei
      const tr = document.createElement('tr')
      if (p.stuck) tr.className = 'stuck'
      const note = p.stuck ? 'unsellable (last share)' : p.sellable < p.balance ? 'partial (leave 1)' : ''
      tr.innerHTML =
        `<td><code>${p.subject}</code></td>` +
        `<td>${p.balance.toString()}</td>` +
        `<td>${p.sellable.toString()}</td>` +
        `<td>${p.supply.toString()}</td>` +
        `<td>${formatEth(p.estWei)}</td>` +
        `<td>${note}</td>`
      tbody.appendChild(tr)
    }
    $('totalEst').textContent = formatEth(total) + ' ETH'
    $('countHeld').textContent = String(positions.length)
    $('countSellable').textContent = String(positions.filter((p) => p.sellable > 0n).length)
  }

  function updateButtons() {
    const provider = getEthereum()
    $('connectBtn').disabled = busy || !provider
    $('refreshBtn').disabled = busy || !account
    const sellable = positions.some((p) => p.sellable > 0n)
    const gasOk = lastGasWei >= MIN_GAS_WEI
    $('withdrawBtn').disabled = busy || !account || !sellable || !gasOk
  }

  function txFrom() {
    return accountFrom || account
  }

  function buildSellCall(p) {
    return {
      to: FT,
      data: callDataSell(p.subject, p.sellable),
    }
  }

  async function sendCallsChunk(provider, chunk, chunkLabel) {
    const from = txFrom()
    const calls = chunk.map(buildSellCall)
    // EIP-5792: Invalid params (-32602) often means schema/bundle issues.
    // Try v2 non-atomic first; then omit empty value; then fail over to sequential.
    const attempts = [
      {
        version: '2.0.0',
        from,
        chainId: BASE_CHAIN_HEX,
        atomicRequired: false,
        calls: calls.map((c) => ({ ...c, value: '0x0' })),
      },
      {
        version: '2.0.0',
        from,
        chainId: BASE_CHAIN_HEX,
        atomicRequired: false,
        calls,
      },
    ]
    let lastErr
    for (const params of attempts) {
      try {
        return await provider.request({
          method: 'wallet_sendCalls',
          params: [params],
        })
      } catch (err) {
        lastErr = err
        const msg = ((err && err.message) || String(err)).toLowerCase()
        const code = err && err.code
        // Unsupported method → stop trying sendCalls
        if (code === -32601 || /method .*not (found|supported)|unsupported method/i.test(msg)) {
          throw err
        }
        // Keep trying alternate shapes for invalid params
        if (code === -32602 || /invalid params|invalid request/i.test(msg)) {
          continue
        }
        throw err
      }
    }
    throw lastErr || new Error('wallet_sendCalls failed (' + chunkLabel + ')')
  }

  async function sellSequential(provider, rows, lines) {
    let ok = 0
    let fail = 0
    const from = txFrom()
    for (let i = 0; i < rows.length; i++) {
      const p = rows[i]
      setStatus(`Selling ${i + 1}/${rows.length}: ${shortAddr(p.subject)}…`, 'info')
      try {
        const hash = await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from,
              to: FT,
              data: callDataSell(p.subject, p.sellable),
              value: '0x0',
            },
          ],
        })
        ok++
        lines.push(`ok ${shortAddr(p.subject)} ${hash}`)
      } catch (err) {
        fail++
        const msg = (err && err.message) || String(err)
        lines.push(`fail ${shortAddr(p.subject)} ${msg}`)
        // User rejected — stop hammering confirmations
        if ((err && err.code === 4001) || /user rejected|denied|rejected the request/i.test(msg)) {
          lines.push('Stopped: user rejected in wallet.')
          break
        }
      }
      setLog(lines)
    }
    return { ok, fail }
  }

  async function withdrawAll() {
    if (!account || busy) return
    const provider = getEthereum()
    if (!provider) return

    const sellable = positions.filter((p) => p.sellable > 0n)
    if (!sellable.length) {
      setStatus('Nothing sellable.', 'warn')
      return
    }

    const gasWei = await getGasWei(account)
    if (gasWei < MIN_GAS_WEI) {
      setStatus('Need ~0.001 ETH on Base for gas before withdrawing.', 'warn')
      $('gasHint').hidden = false
      return
    }

    busy = true
    updateButtons()
    const lines = []
    setLog(lines)

    try {
      await ensureBase(provider)

      let usedBatch = false
      let batchOk = 0
      try {
        setStatus(
          `Batching ${sellable.length} sells in chunks of ${SEND_CALLS_CHUNK}…`,
          'info',
        )
        for (let i = 0; i < sellable.length; i += SEND_CALLS_CHUNK) {
          const chunk = sellable.slice(i, i + SEND_CALLS_CHUNK)
          const label = `${i / SEND_CALLS_CHUNK + 1}/${Math.ceil(sellable.length / SEND_CALLS_CHUNK)}`
          setStatus(`Wallet batch ${label} (${chunk.length} sells)…`, 'info')
          const result = await sendCallsChunk(provider, chunk, label)
          usedBatch = true
          batchOk += chunk.length
          lines.push(
            `batch ${label} ok: ` +
              (typeof result === 'string' ? result : JSON.stringify(result)),
          )
          setLog(lines)
        }
        setStatus(`Submitted ${batchOk} sells via wallet batch. Re-scanning…`, 'ok')
      } catch (batchErr) {
        const msg = (batchErr && batchErr.message) || String(batchErr)
        const code = batchErr && batchErr.code
        lines.push(
          `Batch unavailable (${code != null ? code + ' ' : ''}${msg}). Falling back to one-tx-per-subject.`,
        )
        setLog(lines)

        // If some chunks already landed, only sell the remainder sequentially
        const remaining = usedBatch ? sellable.slice(batchOk) : sellable
        const { ok, fail } = await sellSequential(provider, remaining, lines)
        setStatus(
          `Done: ${batchOk + ok} submitted, ${fail} failed. Re-scanning…`,
          fail ? 'warn' : 'ok',
        )
      }

      if (usedBatch) {
        await new Promise((r) => setTimeout(r, 4000))
      }
      await refresh()
    } catch (err) {
      console.error(err)
      setStatus(err.message || String(err), 'err')
    } finally {
      busy = false
      updateButtons()
    }
  }

  async function init() {
    $('chain').textContent = 'Base (' + BASE_CHAIN_ID + ')'
    $('ft').textContent = FT
    $('ft').href = 'https://basescan.org/address/' + FT + '#writeContract'

    try {
      const res = await fetch('/ft/subjects.json', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load subjects.json')
      const data = await res.json()
      subjects = (data.subjects || []).map((s) => s.toLowerCase())
      $('bakedFor').textContent = data.bakedFor || '—'
      $('subjectCount').textContent = String(subjects.length)
      setStatus('Loaded ' + subjects.length + ' candidate subjects. Connect wallet to scan.', 'info')
    } catch (err) {
      setStatus(err.message || String(err), 'err')
    }

    $('connectBtn').addEventListener('click', () => {
      connect().catch((e) => setStatus(e.message || String(e), 'err'))
    })
    $('refreshBtn').addEventListener('click', () => {
      refresh().catch((e) => setStatus(e.message || String(e), 'err'))
    })
    $('withdrawBtn').addEventListener('click', () => {
      withdrawAll().catch((e) => setStatus(e.message || String(e), 'err'))
    })

    const provider = getEthereum()
    if (!provider) {
      setStatus('No injected wallet detected.', 'warn')
      $('connectBtn').disabled = true
    } else {
      provider.on?.('accountsChanged', (accs) => {
        accountFrom = accs[0] || null
        account = accountFrom ? accountFrom.toLowerCase() : null
        $('wallet').textContent = accountFrom || '—'
        positions = []
        renderPositions()
        if (account) refresh().catch(() => {})
        else updateButtons()
      })
      provider.on?.('chainChanged', () => {
        window.location.reload()
      })
    }
    updateButtons()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
