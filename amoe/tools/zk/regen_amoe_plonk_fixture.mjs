#!/usr/bin/env node
/**
 * Regenerate PLONK test fixtures for circuit v3 (9 public inputs).
 *
 * Uses the same canonical witness as `amoeWitness.test.ts` FALLBACK_FIXTURE,
 * runs snarkjs plonk fullProve against the fresh zkey/wasm from
 * `regen_amoe_plonk_verifier.sh`, and writes:
 *   - amoe/circuits/build/plonk_fresh/proof_plonk.json
 *   - amoe/circuits/build/plonk_fresh/public_plonk.json
 *   - amoe/circuits/build/plonk_fresh/calldata_plonk.txt
 *   - frontend/server/_lib/__tests__/fixtures/amoe-plonk/{proof,public,calldata}.json|txt
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const BUILD = join(ROOT, 'amoe/circuits/build/plonk_fresh')
const WASM = join(BUILD, 'amoe_eligibility_js/amoe_eligibility.wasm')
const ZKEY = join(BUILD, 'amoe_plonk_final.zkey')
const FRONT_FIX = join(ROOT, 'frontend/server/_lib/__tests__/fixtures/amoe-plonk')

const witness = {
  walletAddrCommit:
    '12236542066045852154230507228204214811726738104238129607972407123810631452405',
  creatorCoinAddr: '256540653394130413744119705557698342592',
  nonceCommit: '5430043169609360555050319474407844583358159147608804105680628998712185213076',
  epoch: '1',
  allowlistRoot:
    '12054404259887771673448915491247842365452579624340627996743275030129647435287',
  pointsBurnedAsUSD: '1000000',
  pointsLedgerRoot:
    '4258986812028554858946529553847958246124952924136142975253146101054090175239',
  pointsBurnNullifier:
    '3400027258985903365737705727950731065442821420678606743016111351159525614787',
  walletAddr: '103929005307927756724354605802047639613112342136',
  wallet: '103929005307927756724354605802047639613112342136',
  nonce: '1',
  twitterCreditNullifier: '2',
  pathElements: Array(20).fill('0'),
  pathIndices: Array(20).fill('0'),
  signupIdHash: '3',
  spendRefIdHash: '4',
  pointsLedgerPathElements: Array(20).fill('0'),
  pointsLedgerPathIndices: Array(20).fill('0'),
}

const snarkjs = await import(join(ROOT, 'frontend/node_modules/snarkjs/build/main.cjs'))

const { proof, publicSignals } = await snarkjs.plonk.fullProve(
  witness,
  WASM,
  ZKEY,
)
const calldata = await snarkjs.plonk.exportSolidityCallData(proof, publicSignals)

mkdirSync(FRONT_FIX, { recursive: true })
writeFileSync(join(BUILD, 'proof_plonk.json'), JSON.stringify(proof, null, 2))
writeFileSync(join(BUILD, 'public_plonk.json'), JSON.stringify(publicSignals, null, 2))
writeFileSync(join(BUILD, 'calldata_plonk.txt'), calldata)
writeFileSync(join(FRONT_FIX, 'proof.json'), JSON.stringify(proof, null, 2))
writeFileSync(join(FRONT_FIX, 'public.json'), JSON.stringify(publicSignals, null, 2))
writeFileSync(join(FRONT_FIX, 'calldata.txt'), calldata)

console.log(`public inputs: ${publicSignals.length}`)
console.log(`wrote fixtures to ${BUILD} and ${FRONT_FIX}`)
