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
      className="relative z-10 rounded-xl border border-white/8 bg-[#0f141f] p-2.5 text-zinc-300 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.9)] transition-colors hover:border-white/18 hover:text-white disabled:opacity-50"
      title="Switch tokens"
      aria-label="Switch token direction"
    >
      <motion.span
        animate={{ rotate: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className="block motion-reduce:transform-none"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </motion.span>
    </motion.button>
  )
}
