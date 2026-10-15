'use client'

import { useEffect, RefObject } from 'react'

export function useLoginParticles(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const setSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    setSize()

    type Particle = { x: number; y: number; v: number; o: number }
    let particles: Particle[] = []
    let animationFrameId = 0

    const makeParticle = (): Particle => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      v: Math.random() * 0.25 + 0.05,
      o: Math.random() * 0.35 + 0.15,
    })

    const init = () => {
      particles = []
      const count = Math.floor((canvas.width * canvas.height) / 10000)
      for (let i = 0; i < count; i++) particles.push(makeParticle())
    }

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--sc-accent').trim() || 'currentColor'

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p) => {
        p.y -= p.v
        if (p.y < 0) {
          p.x = Math.random() * canvas.width
          p.y = canvas.height + Math.random() * 40
          p.v = Math.random() * 0.25 + 0.05
          p.o = Math.random() * 0.35 + 0.15
        }
        ctx.globalAlpha = p.o * 0.45
        ctx.fillStyle = accent
        ctx.fillRect(p.x, p.y, 1.2, 2.4)
        ctx.globalAlpha = 1
      })
      animationFrameId = requestAnimationFrame(draw)
    }

    const onResize = () => {
      setSize()
      init()
    }

    window.addEventListener('resize', onResize)
    init()
    animationFrameId = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [canvasRef])
}
