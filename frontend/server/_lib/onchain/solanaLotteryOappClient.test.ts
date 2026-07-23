import { describe, expect, it, vi } from 'vitest'
import { Keypair, PublicKey } from '@solana/web3.js'
import { keccak256 } from 'viem'
import { createHash } from 'node:crypto'
import { EndpointProgram } from '@layerzerolabs/lz-solana-sdk-v2'

import {
  buildLotteryOappExecutorLzReceiveOptions,
  buildLotteryOappInitStoreInstruction,
  buildLotteryOappSetBasePeerInstruction,
  decodeUpgradeableProgramDataAddress,
  decodeLotteryOappPeer,
  decodeLotteryOappPeerConfig,
  decodeLotteryOappStoreAdmin,
  decodeLotteryOappStoreOperator,
  deriveLotteryOappEndpointRegistrationPdas,
  deriveLotteryOappPdas,
  deriveLotteryOappStoreBytes32,
  encodeLotteryOappPacketSender,
  SOLANA_LOTTERY_TEST_RECEIVER,
  sendLotteryEntryFromSolanaOapp,
} from './solanaLotteryOappClient.js'

describe('solanaLotteryOappClient', () => {
  const storeDiscriminator = createHash('sha256').update('account:Store').digest().subarray(0, 8)
  const peerDiscriminator = createHash('sha256').update('account:PeerConfig').digest().subarray(0, 8)

  it('derives stable, distinct Store and Base peer PDAs', () => {
    const programId = new PublicKey('8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC')
    const first = deriveLotteryOappPdas(programId)
    const second = deriveLotteryOappPdas(programId)
    expect(first.store.toBase58()).toBe(second.store.toBase58())
    expect(first.peer.toBase58()).toBe(second.peer.toBase58())
    expect(first.peer.equals(first.store)).toBe(false)
    expect(deriveLotteryOappStoreBytes32(programId)).toBe(`0x${first.store.toBuffer().toString('hex')}`)
  })

  it('derives a distinct peer PDA for the isolated Base Sepolia test route', () => {
    const programId = new PublicKey('8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC')
    const mainnet = deriveLotteryOappPdas(programId)
    const testnet = deriveLotteryOappPdas(programId, 40_245)
    expect(testnet.store.toBase58()).toBe(mainnet.store.toBase58())
    expect(testnet.peer.equals(mainnet.peer)).toBe(false)
  })

  it('encodes the Store sender as the 32-byte hex address expected by LayerZero', () => {
    const programId = new PublicKey('8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC')
    const { store } = deriveLotteryOappPdas(programId)
    expect(encodeLotteryOappPacketSender(store)).toBe(`0x${store.toBuffer().toString('hex')}`)
    expect(encodeLotteryOappPacketSender(store)).not.toBe(store.toBase58())
  })

  it('builds an init_store instruction with only the Store and Endpoint registry creations', () => {
    const programId = Keypair.generate().publicKey
    const programData = Keypair.generate().publicKey
    const payer = Keypair.generate().publicKey
    const admin = Keypair.generate().publicKey
    const operator = Keypair.generate().publicKey
    const instruction = buildLotteryOappInitStoreInstruction({
      programId,
      programData,
      payer,
      upgradeAuthority: payer,
      admin,
      operator,
    })
    const { store } = deriveLotteryOappPdas(programId)
    const { oappRegistry, eventAuthority } = deriveLotteryOappEndpointRegistrationPdas({ store })

    expect(instruction.programId.equals(programId)).toBe(true)
    expect(instruction.keys.map((key) => key.pubkey.toBase58())).toEqual([
      payer.toBase58(), payer.toBase58(), programId.toBase58(), programData.toBase58(), store.toBase58(),
      '11111111111111111111111111111111', EndpointProgram.PROGRAM_ID.toBase58(), payer.toBase58(), store.toBase58(), oappRegistry.toBase58(),
      '11111111111111111111111111111111', eventAuthority.toBase58(), EndpointProgram.PROGRAM_ID.toBase58(),
    ])
    expect(instruction.keys[4]).toMatchObject({ isWritable: true, isSigner: false })
    expect(instruction.keys[9]).toMatchObject({ isWritable: true, isSigner: false })
    expect(instruction.data).toHaveLength(104)
    expect(instruction.data.subarray(0, 8)).toEqual(createHash('sha256').update('global:init_store').digest().subarray(0, 8))
    expect(new PublicKey(instruction.data.subarray(8, 40)).equals(admin)).toBe(true)
    expect(new PublicKey(instruction.data.subarray(40, 72)).equals(operator)).toBe(true)
    expect(new PublicKey(instruction.data.subarray(72, 104)).equals(EndpointProgram.PROGRAM_ID)).toBe(true)
  })

  it('decodes only an upgradeable Program account into its ProgramData address', () => {
    const programData = Keypair.generate().publicKey
    const data = Buffer.alloc(36)
    data.writeUInt32LE(2, 0)
    programData.toBuffer().copy(data, 4)
    expect(decodeUpgradeableProgramDataAddress(data).equals(programData)).toBe(true)
    expect(() => decodeUpgradeableProgramDataAddress(Buffer.alloc(36))).toThrow('oapp_program_account_malformed')
    expect(() => decodeUpgradeableProgramDataAddress(data.subarray(0, 35))).toThrow('oapp_program_account_malformed')
  })

  it('refuses an init_store builder with a zero admin or a non-Endpoint program', () => {
    const base = {
      programId: Keypair.generate().publicKey,
      programData: Keypair.generate().publicKey,
      payer: Keypair.generate().publicKey,
      upgradeAuthority: Keypair.generate().publicKey,
      admin: PublicKey.default,
      operator: Keypair.generate().publicKey,
    }
    expect(() => buildLotteryOappInitStoreInstruction(base)).toThrow('oapp_init_admin_or_operator_zero')
    expect(() => buildLotteryOappInitStoreInstruction({
      ...base,
      admin: Keypair.generate().publicKey,
      endpointProgram: Keypair.generate().publicKey,
    })).toThrow('oapp_init_endpoint_program_mismatch')
  })

  it('builds only an admin-authorized Type-3 Base peer instruction', () => {
    const programId = Keypair.generate().publicKey
    const admin = Keypair.generate().publicKey
    const peerAddress = `0x${'00'.repeat(12)}46f77a5e204dbd9a31870e819e671914b40477a3` as const
    const enforcedOptions = buildLotteryOappExecutorLzReceiveOptions(200_000n)
    const instruction = buildLotteryOappSetBasePeerInstruction({
      programId,
      admin,
      destinationEid: 40_245,
      peerAddress,
      enforcedOptions,
    })
    const { store, peer } = deriveLotteryOappPdas(programId, 40_245)

    expect(enforcedOptions.toString('hex')).toBe('00030100110100000000000000000000000000030d40')
    expect(instruction.keys.map((key) => key.pubkey.toBase58())).toEqual([
      admin.toBase58(), store.toBase58(), peer.toBase58(), '11111111111111111111111111111111',
    ])
    expect(instruction.keys[0]).toMatchObject({ isSigner: true, isWritable: true })
    expect(instruction.keys[2]).toMatchObject({ isSigner: false, isWritable: true })
    expect(instruction.data.subarray(0, 8)).toEqual(createHash('sha256').update('global:set_base_peer').digest().subarray(0, 8))
    expect(`0x${instruction.data.subarray(8, 40).toString('hex')}`).toBe(peerAddress)
    expect(instruction.data.readUInt32LE(40)).toBe(enforcedOptions.length)
    expect(instruction.data.subarray(44)).toEqual(enforcedOptions)
  })

  it('refuses a zero peer, a malformed destination EID, or non-Type-3 options', () => {
    const base = {
      programId: Keypair.generate().publicKey,
      admin: Keypair.generate().publicKey,
      destinationEid: 40_245,
      peerAddress: `0x${'00'.repeat(12)}46f77a5e204dbd9a31870e819e671914b40477a3` as const,
      enforcedOptions: buildLotteryOappExecutorLzReceiveOptions(200_000n),
    }
    expect(() => buildLotteryOappSetBasePeerInstruction({ ...base, peerAddress: `0x${'00'.repeat(32)}` })).toThrow('oapp_peer_address_zero')
    expect(() => buildLotteryOappSetBasePeerInstruction({ ...base, destinationEid: 0 })).toThrow('oapp_peer_destination_eid_invalid')
    expect(() => buildLotteryOappSetBasePeerInstruction({ ...base, enforcedOptions: Buffer.from([0, 2]) })).toThrow('oapp_peer_enforced_options_invalid')
    expect(() => buildLotteryOappExecutorLzReceiveOptions(0n)).toThrow('oapp_peer_receive_gas_invalid')
  })

  it('decodes the peer address and rejects a truncated account', () => {
    const peer = `0x${'ab'.repeat(32)}`
    const options = buildLotteryOappExecutorLzReceiveOptions(200_000n)
    const data = Buffer.concat([peerDiscriminator, Buffer.from(peer.slice(2), 'hex'), Buffer.from([options.length, 0, 0, 0]), options, Buffer.alloc(1)])
    expect(decodeLotteryOappPeer(data)).toBe(peer)
    expect(decodeLotteryOappPeerConfig(data).enforcedOptions).toEqual(options)
    const padded = Buffer.alloc(45 + 512)
    peerDiscriminator.copy(padded)
    Buffer.from(peer.slice(2), 'hex').copy(padded, 8)
    padded.writeUInt32LE(options.length, 40)
    options.copy(padded, 44)
    expect(decodeLotteryOappPeer(padded)).toBe(peer)
    padded[padded.length - 1] = 1
    expect(() => decodeLotteryOappPeer(padded)).toThrow('oapp_peer_account_malformed')
    expect(() => decodeLotteryOappPeer(Buffer.alloc(39))).toThrow('oapp_peer_account_malformed')
  })

  it('decodes the authorized Store operator and rejects malformed Store state', () => {
    const admin = Keypair.generate().publicKey
    const operator = Keypair.generate().publicKey
    const data = Buffer.alloc(105)
    storeDiscriminator.copy(data)
    admin.toBuffer().copy(data, 8)
    operator.toBuffer().copy(data, 40)
    expect(decodeLotteryOappStoreAdmin(data).equals(admin)).toBe(true)
    expect(decodeLotteryOappStoreOperator(data).equals(operator)).toBe(true)
    expect(() => decodeLotteryOappStoreOperator(Buffer.alloc(104))).toThrow('oapp_store_account_malformed')
  })

  it('rejects a peer that is not the requested LotteryManager before any RPC read', async () => {
    const payload = `0x${'12'.repeat(64)}` as const
    const getAccountInfo = vi.fn()
    await expect(sendLotteryEntryFromSolanaOapp({
      connection: { getAccountInfo } as any,
      programId: new PublicKey('8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC'),
      payer: Keypair.generate(),
      request: {
        payload,
        expectedPayloadHash: keccak256(payload),
        expectedPeerBytes32: `0x${'34'.repeat(32)}`,
        expectedLotteryManager: '0xb45e68a5867935a5734e4185977f81c528006650',
      },
    })).rejects.toThrow('oapp_request_peer_lottery_manager_mismatch')
    expect(getAccountInfo).not.toHaveBeenCalled()
  })

  it('rejects a non-canonical LotteryManager before any RPC read', async () => {
    const payload = `0x${'12'.repeat(64)}` as const
    const getAccountInfo = vi.fn()
    await expect(sendLotteryEntryFromSolanaOapp({
      connection: { getAccountInfo } as any,
      programId: new PublicKey('8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC'),
      payer: Keypair.generate(),
      request: {
        payload,
        expectedPayloadHash: keccak256(payload),
        expectedPeerBytes32: `0x${'56'.repeat(32)}`,
        expectedLotteryManager: `0x${'56'.repeat(20)}`,
      },
    })).rejects.toThrow('oapp_noncanonical_lottery_manager')
    expect(getAccountInfo).not.toHaveBeenCalled()
  })

  it('rejects a test-route request unless it targets the isolated deployed OApp before any RPC read', async () => {
    const payload = `0x${'12'.repeat(64)}` as const
    const getAccountInfo = vi.fn()
    const expectedPeer = `0x${SOLANA_LOTTERY_TEST_RECEIVER.slice(2).padStart(64, '0')}` as const
    await expect(sendLotteryEntryFromSolanaOapp({
      connection: { getAccountInfo } as any,
      programId: Keypair.generate().publicKey,
      payer: Keypair.generate(),
      request: {
        payload,
        expectedPayloadHash: keccak256(payload),
        expectedPeerBytes32: expectedPeer,
        expectedLotteryManager: SOLANA_LOTTERY_TEST_RECEIVER,
        testRoute: true,
      },
    })).rejects.toThrow('oapp_test_route_program_mismatch')
    expect(getAccountInfo).not.toHaveBeenCalled()
  })

  it('rejects a payload-hash mismatch before any RPC read', async () => {
    const lotteryManager = '0xb45e68a5867935a5734e4185977f81c528006650' as const
    const getAccountInfo = vi.fn()
    await expect(sendLotteryEntryFromSolanaOapp({
      connection: { getAccountInfo } as any,
      programId: new PublicKey('8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC'),
      payer: Keypair.generate(),
      request: {
        payload: `0x${'12'.repeat(64)}`,
        expectedPayloadHash: `0x${'00'.repeat(32)}`,
        expectedPeerBytes32: `0x${lotteryManager.slice(2).padStart(64, '0')}`,
        expectedLotteryManager: lotteryManager,
      },
    })).rejects.toThrow('oapp_payload_hash_mismatch')
    expect(getAccountInfo).not.toHaveBeenCalled()
  })

  it('rejects an unauthorized on-chain Base peer before quoting or sending', async () => {
    const programId = new PublicKey('8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC')
    const lotteryManager = '0xb45e68a5867935a5734e4185977f81c528006650' as const
    const expectedPeer = `0x${lotteryManager.slice(2).padStart(64, '0')}` as const
    const owner = programId
    const payer = Keypair.generate()
    const storeData = Buffer.alloc(105)
    storeDiscriminator.copy(storeData)
    payer.publicKey.toBuffer().copy(storeData, 40)
    EndpointProgram.PROGRAM_ID.toBuffer().copy(storeData, 72)
    const connection = {
      getAccountInfo: vi.fn(async () => ({ executable: true })),
      getMultipleAccountsInfo: vi.fn(async () => [
        { owner, data: storeData },
        { owner, data: Buffer.concat([
          peerDiscriminator,
          Buffer.alloc(32, 0x77),
          Buffer.from([22, 0, 0, 0]),
          buildLotteryOappExecutorLzReceiveOptions(200_000n),
          Buffer.alloc(1),
        ]) },
      ]),
      simulateTransaction: vi.fn(),
    }
    const payload = `0x${'12'.repeat(64)}` as const
    await expect(sendLotteryEntryFromSolanaOapp({
      connection: connection as any,
      programId,
      payer,
      request: { payload, expectedPayloadHash: keccak256(payload), expectedPeerBytes32: expectedPeer, expectedLotteryManager: lotteryManager },
    })).rejects.toThrow('oapp_onchain_peer_mismatch')
    expect(connection.simulateTransaction).not.toHaveBeenCalled()
  })

  it('rejects a payer that is not the Store operator before quoting', async () => {
    const programId = new PublicKey('8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC')
    const lotteryManager = '0xb45e68a5867935a5734e4185977f81c528006650' as const
    const expectedPeer = `0x${lotteryManager.slice(2).padStart(64, '0')}` as const
    const storeData = Buffer.alloc(105)
    storeDiscriminator.copy(storeData)
    Keypair.generate().publicKey.toBuffer().copy(storeData, 40)
    EndpointProgram.PROGRAM_ID.toBuffer().copy(storeData, 72)
    const connection = {
      getAccountInfo: vi.fn(async () => ({ executable: true })),
      getMultipleAccountsInfo: vi.fn(async () => [
        { owner: programId, data: storeData },
        { owner: programId, data: Buffer.concat([
          peerDiscriminator,
          Buffer.from(expectedPeer.slice(2), 'hex'),
          Buffer.from([22, 0, 0, 0]),
          buildLotteryOappExecutorLzReceiveOptions(200_000n),
          Buffer.alloc(1),
        ]) },
      ]),
      simulateTransaction: vi.fn(),
    }
    const payload = `0x${'12'.repeat(64)}` as const
    await expect(sendLotteryEntryFromSolanaOapp({ connection: connection as any, programId, payer: Keypair.generate(),
      request: { payload, expectedPayloadHash: keccak256(payload), expectedPeerBytes32: expectedPeer, expectedLotteryManager: lotteryManager } }))
      .rejects.toThrow('oapp_payer_not_authorized_operator')
    expect(connection.simulateTransaction).not.toHaveBeenCalled()
  })

  it('rejects a Store bound to a different Endpoint program before quoting', async () => {
    const programId = new PublicKey('8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC')
    const lotteryManager = '0xb45e68a5867935a5734e4185977f81c528006650' as const
    const expectedPeer = `0x${lotteryManager.slice(2).padStart(64, '0')}` as const
    const payer = Keypair.generate()
    const storeData = Buffer.alloc(105)
    storeDiscriminator.copy(storeData)
    payer.publicKey.toBuffer().copy(storeData, 40)
    const connection = {
      getAccountInfo: vi.fn(async () => ({ executable: true })),
      getMultipleAccountsInfo: vi.fn(async () => [
        { owner: programId, data: storeData },
        { owner: programId, data: Buffer.concat([
          peerDiscriminator,
          Buffer.from(expectedPeer.slice(2), 'hex'),
          Buffer.from([22, 0, 0, 0]),
          buildLotteryOappExecutorLzReceiveOptions(200_000n),
          Buffer.alloc(1),
        ]) },
      ]),
      simulateTransaction: vi.fn(),
    }
    const payload = `0x${'12'.repeat(64)}` as const
    await expect(sendLotteryEntryFromSolanaOapp({ connection: connection as any, programId, payer,
      request: { payload, expectedPayloadHash: keccak256(payload), expectedPeerBytes32: expectedPeer, expectedLotteryManager: lotteryManager } }))
      .rejects.toThrow('oapp_store_endpoint_program_mismatch')
    expect(connection.simulateTransaction).not.toHaveBeenCalled()
  })
})
