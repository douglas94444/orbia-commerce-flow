import { useState, createElement } from 'react'
import type { MouseEvent, ReactNode } from 'react'

interface Ripple {
  id: number
  x: number
  y: number
}

export function useRipple<T extends HTMLElement = HTMLElement>() {
  const [ripples, setRipples] = useState<Ripple[]>([])

  function onMouseDown(e: MouseEvent<T>): void {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = performance.now() + Math.random()
    setRipples((prev) => [...prev, { id, x, y }])
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 700)
  }

  const rippleElements: ReactNode = ripples.map((r) =>
    createElement('span', {
      key: r.id,
      'aria-hidden': 'true',
      className: 'ripple-glow-element',
      style: { left: r.x, top: r.y },
    }),
  )

  return { onMouseDown, rippleElements }
}
