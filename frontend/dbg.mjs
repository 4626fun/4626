import { encodeEventTopics, decodeEventLog, parseAbi } from 'viem'
const abi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])
const topics = encodeEventTopics({
  abi,
  eventName: 'Transfer',
  args: { from: '0xaAaAaaAAaAAaAaaAaAAAaAaAaAaAaaAaAaAaAAAa', to: '0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3' },
})
console.log('topics:', topics)
const data = '0x' + (100_000_000n).toString(16).padStart(64, '0')
console.log('data:', data)
try {
  const decoded = decodeEventLog({ abi, data, topics })
  console.log('decoded:', decoded)
} catch (e) {
  console.log('threw:', e.message)
}
