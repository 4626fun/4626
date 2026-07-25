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
  /** MetaMask atomic batches — keep ≤20 so ~96 sells ≈ 5 confirms. */
  const ATOMIC_CHUNK = 20

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
      setStatus('No hay cartera inyectada. Instala MetaMask, Rabby o Coinbase Wallet.', 'warn')
      return
    }
    await ensureBase(provider)
    const accounts = await provider.request({ method: 'eth_requestAccounts' })
    accountFrom = accounts[0] || null
    account = accountFrom ? accountFrom.toLowerCase() : null
    if (!account || !accountFrom) {
      setStatus('La cartera no ha devuelto ninguna cuenta.', 'warn')
      return
    }
    $('wallet').textContent = accountFrom
    $('connectBtn').textContent = 'Conectada'
    setStatus('Conectada. Escaneando posiciones…', 'info')
    await refresh()
  }

  async function getGasWei(addr) {
    const hex = await rpc('eth_getBalance', [addr, 'latest'])
    return BigInt(hex)
  }

  async function refresh() {
    if (!account) {
      setStatus('Conecta una cartera primero.', 'warn')
      return
    }
    if (!subjects.length) {
      setStatus('No se ha cargado la lista de sujetos.', 'warn')
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
        : 'Manda al menos ~0,001 ETH a esta cartera en Base para el gas antes de retirar.'

      setStatus(`Leyendo saldos de ${subjects.length} sujetos…`, 'info')

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
        setStatus('Esta cartera no tiene shares de Friend.tech v1 (según la lista de sujetos preparada).', 'warn')
        return
      }

      setStatus(`Hay ${held.length} posiciones. Calculando precios…`, 'info')
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
        `${sellable.length} vendibles · ${stuckN} bloqueadas (última share) · est. ${formatEth(total)} ETH tras comisiones` +
          (gasOk ? '' : ' · primero mete gas'),
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
      const note = p.stuck
        ? 'no vendible (última share)'
        : p.sellable < p.balance
          ? 'parcial (dejar 1)'
          : ''
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

  function isUserReject(err) {
    const msg = ((err && err.message) || String(err)).toLowerCase()
    const code = err && err.code
    return code === 4001 || /user rejected|denied|rejected the request/i.test(msg)
  }

  /**
   * MetaMask on Base supports atomic EIP-5792 batches via EIP-7702.
   * Check wallet_getCapabilities before calling wallet_sendCalls.
   */
  async function walletSupportsAtomicBatch(provider, from) {
    try {
      const caps = await provider.request({
        method: 'wallet_getCapabilities',
        params: [from, [BASE_CHAIN_HEX]],
      })
      const chainCaps =
        (caps && (caps[BASE_CHAIN_HEX] || caps['0x2105'] || caps[String(BASE_CHAIN_ID)])) ||
        null
      const atomic = chainCaps && chainCaps.atomic
      if (!atomic) return false
      // EIP-5792: status supported | ready | unsupported
      const status = typeof atomic === 'object' ? atomic.status : atomic
      return status === 'supported' || status === 'ready' || status === true
    } catch (_) {
      return false
    }
  }

  async function sendAtomicChunk(provider, chunk, from, label) {
    const calls = chunk.map((p) => ({
      to: FT,
      value: '0x0',
      data: callDataSell(p.subject, p.sellable),
    }))
    // MetaMask docs: only atomic batches are supported on Base.
    return provider.request({
      method: 'wallet_sendCalls',
      params: [
        {
          version: '2.0.0',
          from,
          chainId: BASE_CHAIN_HEX,
          atomicRequired: true,
          calls,
        },
      ],
    })
  }

  /**
   * One sellShares tx fallback. Plain eth_sendTransaction for wallets
   * without EIP-5792 atomic support.
   */
  async function sendOneSell(provider, p, from) {
    const data = callDataSell(p.subject, p.sellable)
    const shapes = [
      { from, to: FT, data },
      { from, to: FT, data, value: '0x0' },
      { from, to: FT.toLowerCase(), data },
    ]
    let lastErr
    for (const tx of shapes) {
      try {
        return await provider.request({
          method: 'eth_sendTransaction',
          params: [tx],
        })
      } catch (err) {
        lastErr = err
        if (isUserReject(err)) throw err
        const msg = ((err && err.message) || String(err)).toLowerCase()
        const code = err && err.code
        if (code === -32602 || /invalid params|invalid request|invalid argument/i.test(msg)) {
          continue
        }
        throw err
      }
    }
    throw lastErr || new Error('eth_sendTransaction ha fallado')
  }

  async function sellSequential(provider, rows, lines) {
    let ok = 0
    let fail = 0
    const from = txFrom()
    for (let i = 0; i < rows.length; i++) {
      const p = rows[i]
      setStatus(`Vendiendo ${i + 1}/${rows.length}: ${shortAddr(p.subject)}…`, 'info')
      try {
        const hash = await sendOneSell(provider, p, from)
        ok++
        lines.push(`ok ${shortAddr(p.subject)} ${hash}`)
      } catch (err) {
        fail++
        const msg = (err && err.message) || String(err)
        lines.push(`fallo ${shortAddr(p.subject)} ${msg}`)
        if (isUserReject(err)) {
          lines.push('Parado: has rechazado en la cartera.')
          break
        }
      }
      setLog(lines)
    }
    return { ok, fail }
  }

  async function sellAtomicBatches(provider, rows, lines) {
    const from = txFrom()
    const totalChunks = Math.ceil(rows.length / ATOMIC_CHUNK)
    let submitted = 0
    for (let i = 0; i < rows.length; i += ATOMIC_CHUNK) {
      const chunk = rows.slice(i, i + ATOMIC_CHUNK)
      const n = i / ATOMIC_CHUNK + 1
      const label = `${n}/${totalChunks}`
      setStatus(
        `MetaMask lote atómico ${label}: ${chunk.length} ventas (confirma una vez)…`,
        'info',
      )
      try {
        const result = await sendAtomicChunk(provider, chunk, from, label)
        submitted += chunk.length
        lines.push(
          `lote ${label} ok (${chunk.length}): ` +
            (typeof result === 'string' ? result : JSON.stringify(result)),
        )
        setLog(lines)
      } catch (err) {
        if (isUserReject(err)) {
          lines.push('Parado: has rechazado el lote en MetaMask.')
          setLog(lines)
          return { submitted, aborted: true, err }
        }
        // Fall through to sequential for the remainder
        lines.push(
          `Lote ${label} falló (${(err && err.code) || ''} ${(err && err.message) || err}). Paso a una tx por sujeto.`,
        )
        setLog(lines)
        const remaining = rows.slice(i)
        const { ok, fail } = await sellSequential(provider, remaining, lines)
        return { submitted: submitted + ok, fail, aborted: false, err }
      }
    }
    return { submitted, fail: 0, aborted: false }
  }

  async function withdrawAll() {
    if (!account || busy) return
    const provider = getEthereum()
    if (!provider) return

    const sellable = positions.filter((p) => p.sellable > 0n)
    if (!sellable.length) {
      setStatus('No hay nada vendible.', 'warn')
      return
    }

    const gasWei = await getGasWei(account)
    if (gasWei < MIN_GAS_WEI) {
      setStatus('Hace falta ~0,001 ETH en Base para el gas antes de retirar.', 'warn')
      $('gasHint').hidden = false
      return
    }

    busy = true
    updateButtons()
    const lines = []
    setLog(lines)

    try {
      await ensureBase(provider)
      const from = txFrom()
      const canBatch = await walletSupportsAtomicBatch(provider, from)
      const clicks = Math.ceil(sellable.length / ATOMIC_CHUNK)

      if (canBatch) {
        setStatus(
          `MetaMask admite lotes atómicos: ~${clicks} confirmación(es) para ${sellable.length} ventas…`,
          'info',
        )
        lines.push(
          `Modo: wallet_sendCalls atómico (MetaMask/EIP-7702), lotes de ${ATOMIC_CHUNK} → ~${clicks} clicks.`,
        )
        setLog(lines)
        const result = await sellAtomicBatches(provider, sellable, lines)
        if (result.aborted) {
          setStatus(
            `Parado tras ${result.submitted} enviadas. Volviendo a escanear…`,
            'warn',
          )
        } else {
          setStatus(
            `Listo: ${result.submitted} enviadas` +
              (result.fail ? `, ${result.fail} fallidas` : '') +
              '. Volviendo a escanear…',
            result.fail ? 'warn' : 'ok',
          )
        }
      } else {
        setStatus(
          `Esta cartera no admite lotes atómicos. Vendiendo ${sellable.length} sujetos uno a uno…`,
          'info',
        )
        lines.push(
          'Modo: una tx por sujeto (wallet_getCapabilities no reporta atomic en Base). Usa MetaMask en Base para 1–5 clicks.',
        )
        setLog(lines)
        const { ok, fail } = await sellSequential(provider, sellable, lines)
        setStatus(
          `Listo: ${ok} enviadas, ${fail} fallidas. Volviendo a escanear…`,
          fail ? 'warn' : 'ok',
        )
      }

      await new Promise((r) => setTimeout(r, 2500))
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
      if (!res.ok) throw new Error('No se ha podido cargar subjects.json')
      const data = await res.json()
      subjects = (data.subjects || []).map((s) => s.toLowerCase())
      $('bakedFor').textContent = data.bakedFor || '—'
      $('subjectCount').textContent = String(subjects.length)
      setStatus(
        'Cargados ' + subjects.length + ' sujetos candidatos. Conecta la cartera para escanear.',
        'info',
      )
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
      setStatus('No se detecta ninguna cartera inyectada.', 'warn')
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
