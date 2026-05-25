import { createProlinkUrl, encodeProlink } from '@base-org/account/prolink'

const csw = '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef'
const data = '0x0f0f3f24000000000000000000000000b2aad65a5402714bf428a66731ae62ba5c45cac0'

const payload = await encodeProlink({
  method: 'wallet_sendCalls',
  params: [
    {
      version: '1.0',
      chainId: '0x2105',
      atomicRequired: true,
      calls: [{ to: csw, value: '0x0', data }],
    },
  ],
})

const url = createProlinkUrl(payload, 'https://base.app/base-pay')
console.log('PAYLOAD:')
console.log(payload)
console.log('')
console.log('URL:')
console.log(url)
