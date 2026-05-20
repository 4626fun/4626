import { useMemo, useState } from 'react'
import { HelpCircle } from 'lucide-react'

import { SingleAccordion, type AccordionItemData } from '@/components/ui/Accordion'

interface FAQItem {
  question: string
  answer: string
  highlight?: boolean
}

const faqItems: FAQItem[] = [
  {
    question: 'How does the auction work?',
    answer:
      'The Continuous Clearing Auction (CCA) by Uniswap discovers fair market price through real-time bids. Your bid is spread over time to prevent manipulation. You specify your max price and the amount you want to spend.',
    highlight: true,
  },
  {
    question: 'When do I receive my tokens?',
    answer:
      'After the auction graduates (reaches target), you can claim your tokens proportional to your bid. The final clearing price determines exactly how many tokens you receive.',
  },
  {
    question: 'Can I get a refund?',
    answer:
      "Yes! If the auction doesn't graduate or you change your mind before settlement, you can withdraw your bid. The smart contract is non-custodial, so you always control your funds.",
    highlight: true,
  },
  {
    question: 'What happens to my bid?',
    answer:
      'Your bid is locked in the auction contract until graduation. If the price rises above your max price, your bid partially fills. You only pay the final clearing price, not your max.',
  },
  {
    question: 'Is this safe?',
    answer:
      "The auction runs on Uniswap's battle-tested CCA protocol. Contracts are verified on BaseScan. The mechanism is non-custodial, meaning you control your funds through your wallet.",
  },
  {
    question: 'Why should I bid early?',
    answer:
      'Early bids help establish price discovery and often get better avg prices. Plus, you secure your allocation before the auction potentially graduates.',
  },
]

export function AuctionFAQ() {
  const [activeKey, setActiveKey] = useState<string | null>('0')

  const items = useMemo<AccordionItemData[]>(
    () =>
      faqItems.map((item, index) => ({
        key: String(index),
        title: item.question,
        children: (
          <div className="text-sm leading-relaxed text-zinc-400 max-w-prose">{item.answer}</div>
        ),
      })),
    [],
  )

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/20">
      <div className="px-6 py-5 border-b border-white/10 flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-uniswap" />
        <h4 className="headline text-lg">Common Questions</h4>
      </div>

      <SingleAccordion items={items} activeKey={activeKey} onChange={setActiveKey} />

      <div className="px-6 py-5 border-t border-white/10">
        <a
          href="/faq"
          className="text-sm text-zinc-400 hover:text-uniswap transition-colors inline-flex items-center gap-2"
        >
          <span>View full FAQ</span>
          <span className="text-zinc-600">→</span>
        </a>
      </div>
    </div>
  )
}
