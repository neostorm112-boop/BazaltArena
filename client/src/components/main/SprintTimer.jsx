import { useEffect, useMemo, useState } from 'react'

function pad2(n) {
  return String(n).padStart(2, '0')
}

const defaultOffsetMs = () => Date.now() + 2 * 3600 * 1000 + 45 * 60 * 1000 + 12 * 1000

export function SprintTimer({ endAt }) {
  const target = useMemo(() => {
    if (endAt instanceof Date && !Number.isNaN(endAt.getTime())) return endAt
    if (typeof endAt === 'string' && endAt.trim()) {
      const parsed = new Date(endAt)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    return new Date(defaultOffsetMs())
  }, [endAt])

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const ms = Math.max(0, target.getTime() - now)
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  const digitBase =
    'font-mono tabular-nums text-[56px] font-bold leading-[60px] tracking-[-2px] max-[360px]:text-[44px] max-[360px]:leading-[48px] max-[360px]:tracking-[-1.5px]'
  const digitHours = `${digitBase} text-catskill`
  const digitMinutes = `${digitBase} text-catskill`
  const digitSeconds = `${digitBase} text-turquoise`
  const colonClass =
    'shrink-0 font-mono text-[44px] font-bold leading-[60px] text-fiord translate-y-[-4px] max-[360px]:text-[36px] max-[360px]:leading-[48px]'

  return (
    <section className="relative isolate overflow-hidden rounded-xl border border-plantation bg-timber p-8 max-[360px]:p-4">
      <div className="relative z-[1] flex flex-col items-center">
        <p className="box-border min-h-9 pb-4 text-center font-mono text-[11px] font-medium uppercase leading-5 tracking-[1.5px] text-slate-arena max-[360px]:pb-2 max-[360px]:text-[10px] max-[360px]:leading-4 sm:whitespace-nowrap">
          // до завершения спринта
        </p>
        <div className="flex w-full min-w-0 max-w-full items-start justify-center gap-[10px] max-[360px]:gap-2 md:gap-10">
          <div className="flex w-[69px] shrink-0 flex-col items-center max-[360px]:w-[56px]">
            <span className={digitHours}>{pad2(h)}</span>
            <span className="mt-2 font-mono text-[10px] font-normal uppercase leading-[15px] tracking-[1px] text-slate-arena max-[360px]:mt-1 max-[360px]:text-[9px] max-[360px]:leading-3">
              Часов
            </span>
          </div>
          <span className={colonClass} aria-hidden>
            :
          </span>
          <div className="flex w-[69px] shrink-0 flex-col items-center max-[360px]:w-[56px]">
            <span className={digitMinutes}>{pad2(m)}</span>
            <span className="mt-2 font-mono text-[10px] font-normal uppercase leading-[15px] tracking-[1px] text-slate-arena max-[360px]:mt-1 max-[360px]:text-[9px] max-[360px]:leading-3">
              Минут
            </span>
          </div>
          <span className={colonClass} aria-hidden>
            :
          </span>
          <div className="flex w-[60px] shrink-0 flex-col items-center max-[360px]:w-[50px]">
            <span className={digitSeconds}>{pad2(s)}</span>
            <span className="mt-2 font-mono text-[10px] font-normal uppercase leading-[15px] tracking-[1px] text-slate-arena max-[360px]:mt-1 max-[360px]:text-[9px] max-[360px]:leading-3">
              Секунд
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
