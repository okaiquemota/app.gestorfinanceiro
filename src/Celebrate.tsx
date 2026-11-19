// Comemoração: confete, o Poupin pulando e uma frase. Some sozinha.

import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { navigate } from './router.tsx'
import { playFanfare } from './lib/fun.ts'
import { useStore } from './store.tsx'
import { Button, Emoji } from './ui.tsx'

const COLORS = ['#7c3aed', '#f5b400', '#16a34a', '#e879a6', '#3987e5']

export function Celebration() {
  const { celebration, endCelebration } = useStore()

  useEffect(() => {
    if (!celebration) return
    playFanfare()
    // conquista fica até a pessoa fechar; a frase rápida some sozinha
    if (typeof celebration !== 'string') return
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
  const confetti = (
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
  )

  if (typeof celebration !== 'string') return <AchievementPopup c={celebration} onClose={endCelebration} confetti={confetti} />

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" role="status">
      {confetti}
      <div className="celebrate-card absolute left-1/2 top-[38%] w-[min(320px,86vw)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-line bg-surface p-5 text-center shadow-pop">
        <Emoji name="mascote-festa" size={120} className="celebrate-jump mx-auto" />
        <p className="mt-2 text-lg font-semibold tracking-[-0.01em]">{celebration}</p>
      </div>
    </div>
  )
}

type AchievementCelebration = Exclude<NonNullable<ReturnType<typeof useStore>['celebration']>, string>

/** A telinha da conquista: ícone grande brilhando, nome e o que foi feito. */
function AchievementPopup({ c, onClose, confetti }: { c: AchievementCelebration; onClose: () => void; confetti: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const kicker = c.secret ? 'Conquista secreta revelada!' : c.mine ? 'Você conseguiu!' : 'Conquista desbloqueada!'
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/40 p-4" onClick={onClose}>
      {confetti}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conquista-titulo"
        onClick={(e) => e.stopPropagation()}
        className="celebrate-card relative w-[min(380px,100%)] rounded-3xl border border-line bg-surface p-6 text-center shadow-pop"
      >
        <p className="text-micro font-semibold tracking-[0.08em] text-accent uppercase">{kicker}</p>
        <div className="achievement-glow relative mx-auto mt-4 flex size-32 items-center justify-center rounded-full bg-primary-soft">
          <Emoji name={c.emoji} size={84} className="celebrate-jump" />
        </div>
        <h2 id="conquista-titulo" className="mt-4 text-2xl font-semibold tracking-[-0.02em]">
          {c.title}
        </h2>
        {c.text && <p className="mt-1 text-muted">{c.text}</p>}
        <div className="mt-5 flex items-center justify-center gap-3">
          <Emoji name="mascote-festa" size={44} />
          <p className="text-left text-caption text-muted">
            {c.secret ? 'Essa estava escondida. Tem mais por aí…' : 'O Poupin tá orgulhoso de você.'}
          </p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button autoFocus onClick={onClose}>
            Fechar
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onClose()
              navigate('/reserva')
            }}
          >
            Ver conquistas
          </Button>
        </div>
      </div>
    </div>
  )
}
