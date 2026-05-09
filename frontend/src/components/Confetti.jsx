import { useEffect, useRef } from 'react'

const COLORS = ['#833AB4','#DD2A7B','#FCB045','#0095F6','#FD1D1D','#3db56e','#FFD700','#fff']
const FUN_EMOJI = ['🎉','⭐','✨','💫','🌟','❤️','🎊','🥳']

export default function Confetti({ active, onDone }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const W = canvas.width  = window.innerWidth
    const H = canvas.height = window.innerHeight

    // Burst from top-centre where the upload button lives
    const originX = W / 2
    const originY = H * 0.12

    const particles = Array.from({ length: 180 }, () => {
      const type = Math.random() < 0.12 ? 'emoji'
                 : Math.random() < 0.55  ? 'rect'
                 : 'circle'
      const angle = (Math.random() * 180 + 180) * Math.PI / 180 // downward fan
      const speed = Math.random() * 14 + 4
      return {
        x: originX + (Math.random() - 0.5) * 120,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: type === 'emoji' ? 18 + Math.random() * 10 : 5 + Math.random() * 9,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 14,
        type,
        emoji: FUN_EMOJI[Math.floor(Math.random() * FUN_EMOJI.length)],
      }
    })

    const DURATION = 3800
    const start = performance.now()
    let frame

    const tick = (now) => {
      const elapsed = now - start
      const alpha = Math.max(0, 1 - elapsed / DURATION)
      ctx.clearRect(0, 0, W, H)

      particles.forEach(p => {
        p.x  += p.vx
        p.y  += p.vy
        p.vy += 0.32        // gravity
        p.vx *= 0.992       // air drag
        p.rot += p.rotV

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot * Math.PI / 180)

        if (p.type === 'emoji') {
          ctx.font = `${p.size}px serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(p.emoji, 0, 0)
        } else if (p.type === 'rect') {
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        } else {
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      })

      if (elapsed < DURATION) {
        frame = requestAnimationFrame(tick)
      } else {
        onDone?.()
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, onDone])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}
    />
  )
}
