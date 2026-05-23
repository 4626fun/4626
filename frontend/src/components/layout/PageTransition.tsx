import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'

export function PageTransitionOutlet() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={location.key}
        className="flex min-h-0 flex-1 flex-col"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.22,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  )
}
