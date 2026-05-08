import { useState } from 'react'

import { siteAssets } from '@/config/site'

import { TextScramble } from './TextScramble'

const BRAND_ICON_SRC = siteAssets.logo

export interface LogoProps {
  className?: string
  width?: number
  height?: number
  showText?: boolean
  colorMode?: 'light' | 'dark'
  forceHover?: boolean
}

export function Logo({
  className = '',
  width = 32,
  height = 32,
  showText = true,
  colorMode = 'dark',
  forceHover = false,
}: LogoProps) {
  const isLight = colorMode === 'light'
  const mainTextColor = isLight ? 'text-black' : 'text-white'
  const [internalHover, setInternalHover] = useState(false)
  const isHovered = forceHover || internalHover

  return (
    <div
      className={`flex items-center gap-3.5 ${className} group cursor-default`}
      onMouseEnter={() => setInternalHover(true)}
      onMouseLeave={() => setInternalHover(false)}
    >
      <div className="relative flex items-center justify-center" style={{ width, height }}>
        <img
          src={BRAND_ICON_SRC}
          alt="4626.fun"
          width={width}
          height={height}
          className="block select-none object-contain transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          draggable={false}
          style={{
            width,
            height,
            transform: isHovered ? 'scale(1.06)' : 'scale(1)',
          }}
        />
      </div>

      {showText ? (
        <div className="flex flex-col justify-center leading-none" aria-hidden="true">
          <div className="flex items-center gap-1.5">
            <div className={`font-sans text-lg font-semibold tracking-tight ${mainTextColor} select-none`}>
              <TextScramble
                text="ERCreator"
                trigger={isHovered}
                complexity="simple"
                speed={forceHover ? 1.5 : 0.6}
              />
            </div>
            <div className="font-sans text-lg font-bold tracking-tight text-brand-primary select-none">
              <TextScramble
                text="4626"
                font="doto"
                trigger={isHovered}
                className="tracking-tighter"
                complexity="simple"
                speed={0.8}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

