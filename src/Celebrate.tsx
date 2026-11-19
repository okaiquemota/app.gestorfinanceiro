// Comemoração: confete, o Poupin pulando e uma frase. Some sozinha.

import { useEffect, useMemo } from 'react'
import { playFanfare } from './lib/fun.ts'
import { useStore } from './store.tsx'
import { Emoji } from './ui.tsx'

const COLORS = ['#7c3aed', '#f5b400', '#16a34a', '#e879a6', '#3987e5']

export function Celebration() {
  const { celebration, endCelebration } = useStore()

  useEffect(() => {
    if (!celebration) return
    playFanfare()
    const t = window.setTimeout(endCelebration, 2800)
    return () => window.clearTimeout(t)
  }, [celebration, endCelebration])

  // posições sorteadas uma vez por comemoração
  const pieces = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        time: 1.6 + Math.random() * 1.1,
        drift: (Math.random() - 0.5) * 240,
        color: COLORS[i % COLORS.length],
        round: i % 3 === 0,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [celebration],
  )

  if (!celebration) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" role="status">
      <div aria-hidden>
        {pieces.map((p, i) => (
          <span
            key={i}
            className="confetti absolute top-0 block h-3 w-2"
            style={{
              left: `${p.left}%`,
              background: p.color,
              borderRadius: p.round ? '50%' : 2,
              animationDuration: `${p.time}s`,
              animationDelay: `${p.delay}s`,
              ['--drift' as string]: `${p.drift}px`,
            }}
          />
        ))}
      </div>
      <div className="celebrate-card absolute left-1/2 top-[38%] w-[min(320px,86vw)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-line bg-surface p-5 text-center shadow-pop">
        <Emoji name="mascote-festa" size={120} className="celebrate-jump mx-auto" />
        <p className="mt-2 text-lg font-semibold tracking-[-0.01em]">{celebration}</p>
      </div>
    </div>
  )
}
