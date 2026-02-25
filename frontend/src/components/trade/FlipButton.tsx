import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown } from 'lucide-react'

export function FlipButton(props: { onClick: () => void; disabled?: boolean }) {
  const [flipped, setFlipped] = useState(false)

  function handleClick() {
    setFlipped((prev) => !prev)
    props.onClick()
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={props.disabled}
      whileTap={{ scale: 0.88 }}
      whileHover={{ boxShadow: '0 0 0 4px rgba(0, 82, 255, 0.16)' }}
      className="relative z-10 rounded-xl border border-white/18 bg-[#0f141f] p-3 text-zinc-300 shadow-[0_8px_28px_-10px_rgba(0,0,0,0.9)] transition-colors hover:border-white/25 hover:text-white disabled:opacity-50"
      title="Switch tokens"
      aria-label="Switch token direction"
    >
      <motion.span
        animate={{ rotate: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className="block motion-reduce:transform-none"
      >
        <ArrowDown className="h-4 w-4" />
      </motion.span>
    </motion.button>
  )
}
