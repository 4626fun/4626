import { motion } from 'framer-motion'

import { BASE_EASE, DURATION, STAGGER_STEP } from './motion'

const CELL_GAP = 3
const CELL_RX = 3

type BasemarkCell = {
  x: number
  y: number
  width: number
  height: number
  rx: number
  delay: number
}

function buildCells(size: number): BasemarkCell[] {
  const unit = (size - CELL_GAP) / 2
  const r = Math.min(CELL_RX, unit * 0.12)
  const right = unit + CELL_GAP
  const bottom = unit + CELL_GAP

  return [
    { x: 0, y: bottom, width: unit, height: unit, rx: r, delay: 0 },
    { x: right, y: 0, width: unit, height: unit, rx: r, delay: STAGGER_STEP },
    { x: right, y: bottom, width: unit, height: unit, rx: r, delay: STAGGER_STEP * 2 },
    { x: 0, y: 0, width: unit, height: unit, rx: r, delay: STAGGER_STEP * 3 },
  ]
}

export function AnimatedBasemark({
  size = 48,
  color = '#0052FF',
  className,
}: {
  size?: number
  color?: string
  className?: string
}) {
  const cells = buildCells(size)

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {cells.map((cell, i) => (
        <motion.rect
          key={i}
          x={cell.x}
          y={cell.y}
          width={cell.width}
          height={cell.height}
          rx={cell.rx}
          fill={color}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: DURATION.standard,
            delay: cell.delay,
            ease: BASE_EASE as unknown as number[],
          }}
          style={{ transformOrigin: `${cell.x + cell.width / 2}px ${cell.y + cell.height / 2}px` }}
        />
      ))}
    </motion.svg>
  )
}

export function PulsingBasemark({
  size = 48,
  color = '#0052FF',
  className,
}: {
  size?: number
  color?: string
  className?: string
}) {
  const cells = buildCells(size)

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {cells.map((cell, i) => (
        <motion.rect
          key={i}
          x={cell.x}
          y={cell.y}
          width={cell.width}
          height={cell.height}
          rx={cell.rx}
          fill={color}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{
            opacity: [0, 1, 0.75, 1],
            scale: [0.4, 1, 0.96, 1],
          }}
          transition={{
            duration: 2.4,
            delay: cell.delay,
            ease: BASE_EASE as unknown as number[],
            times: [0, 0.25, 0.65, 1],
            repeat: Infinity,
            repeatDelay: 3,
          }}
          style={{ transformOrigin: `${cell.x + cell.width / 2}px ${cell.y + cell.height / 2}px` }}
        />
      ))}
    </motion.svg>
  )
}
