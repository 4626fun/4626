#!/usr/bin/env tsx
import { concatHex, encodeAbiParameters, encodePacked, getAddress, keccak256, parseAbiParameters, type Hex } from 'viem'

import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'
import { DEPLOY_BYTECODE } from '../../src/deploy/bytecode.generated.js'
import { predictCreate2AddressFromInitCode } from '../../src/lib/deploy/perVaultVanityVersionSearch.js'
import {
  toShareName,
  toShareSymbol,
  toVaultName,
  toVaultSymbol,
} from '../../src/lib/tokens/tokenSymbols.js'

const CREATOR = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
const batcher = getAddress(SPLIT_PHASE1_DEPLOYMENT_BATCHER)
const create2 = getAddress('0x4760216AFd59B843671E0FdFCe6498Ec8CFf38a7')

const vaultArgs = encodeAbiParameters(parseAbiParameters('address,address,string,string'), [
  CREATOR,
  batcher,
  toVaultName('AKITA'),
  toVaultSymbol('AKITA'),
])
const vaultInit = concatHex([DEPLOY_BYTECODE.CreatorOVault as Hex, vaultArgs])
const oftSalt = keccak256(encodePacked(['string'], ['4626:OFTBootstrapRegistry:v1']))
const oft = predictCreate2AddressFromInitCode({
  create2Deployer: create2,
  salt: oftSalt,
  initCode: DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex,
})
const shareArgs = encodeAbiParameters(parseAbiParameters('string,string,address,address'), [
  toShareName('AKITA'),
  toShareSymbol('AKITA'),
  oft,
  batcher,
])
const shareInit = concatHex([DEPLOY_BYTECODE.CreatorShareOFT as Hex, shareArgs])

process.stdout.write(`${JSON.stringify({ vaultInitCodeHash: keccak256(vaultInit), shareOftInitCodeHash: keccak256(shareInit) }, null, 2)}\n`)