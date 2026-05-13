import { useEffect, useState } from 'react'
import { getMeta } from '../../api/basaltApi.js'
import { MaterialIcon } from '../ui/MaterialIcon.jsx'

const metaText = 'font-mono text-[11px] leading-4 lg:text-[12px]'
const pipeClass = `${metaText} text-fiord`
const legalText = `${metaText} max-md:max-w-[min(100%,14rem)] cursor-default whitespace-nowrap text-center text-[11px] font-bold uppercase leading-snug text-slate-arena transition-colors hover:text-turquoise max-[360px]:text-[10px] md:text-[11px] md:leading-4 lg:text-[12px] [font-synthesis:none]`
const metaBlock = `${metaText} text-slate-arena [font-synthesis:none]`

export function AppFooter() {
  const [serverTime, setServerTime] = useState('14:02')
  const [build, setBuild] = useState('…')
  const [year, setYear] = useState(2024)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const m = await getMeta()
        if (cancelled) return
        setServerTime(m.serverTimeUtcDisplay)
        setBuild(m.build)
        setYear(m.copyrightYear)
      } catch (_error) {
        void _error
      }
    }
    load()
    const id = window.setInterval(load, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <footer className="mt-auto border-t border-plantation bg-aztec">
      <div className="mx-auto flex max-w-[1400px] flex-col items-stretch gap-8 px-6 py-8 max-[360px]:gap-5 max-[360px]:px-3 max-[360px]:py-5 md:h-[92px] md:flex-row md:items-center md:justify-between md:gap-3 md:px-6 md:py-0 lg:gap-0 lg:px-10">
        <div className="flex flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center max-[360px]:gap-x-3 max-[360px]:gap-y-1.5 md:flex-row md:flex-nowrap md:items-center md:justify-start md:gap-x-3 md:gap-y-0 md:text-left lg:gap-x-8">
          <span
            className={`${metaBlock} font-bold whitespace-nowrap md:max-lg:w-[102px] md:max-lg:whitespace-normal`}
          >
            <span className="inline md:max-lg:block">© {year}</span>
            <span className="ml-1 inline md:max-lg:ml-0 md:max-lg:block">BASALT</span>
            <span className="ml-1 inline md:max-lg:ml-0 md:max-lg:block">ARENA</span>
          </span>
          <span className={`${pipeClass} hidden md:inline`} aria-hidden>
            |
          </span>
          <span
            className={`${metaBlock} font-normal whitespace-nowrap md:max-lg:w-[130px] md:max-lg:whitespace-normal`}
          >
            <span className="inline md:max-lg:block">ВРЕМЯ СЕРВЕРА:</span>
            <span className="ml-1 inline md:max-lg:ml-0 md:max-lg:block">{serverTime} UTC</span>
          </span>
          <span className={`${pipeClass} hidden md:inline`} aria-hidden>
            |
          </span>
          <span
            className={`${metaBlock} font-normal whitespace-nowrap md:max-lg:w-[92px] md:max-lg:whitespace-normal`}
          >
            <span className="inline md:max-lg:block">СБОРКА:</span>
            <span className="ml-1 inline md:max-lg:ml-0 md:max-lg:block">{build}</span>
          </span>
        </div>

        <div className="flex flex-col items-center gap-4 max-[360px]:gap-3 md:flex-row md:flex-nowrap md:items-center md:justify-end md:gap-2 lg:gap-6">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 max-[360px]:gap-x-3 max-[360px]:gap-y-1.5 sm:gap-x-6 md:flex-nowrap md:gap-3 lg:gap-6">
            <span className={legalText}>API</span>
            <span className={legalText}>КОНФИДЕНЦИАЛЬНОСТЬ</span>
            <span className={legalText}>УСЛОВИЯ</span>
          </div>
          <div className="flex items-center justify-center gap-2 border-t border-plantation pt-4 max-[360px]:pt-3 md:h-7 md:gap-3 md:border-l md:border-t-0 md:pl-3 md:pt-0 lg:pl-4">
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex size-6 items-center justify-center text-slate-arena transition hover:text-white md:size-7"
              aria-label="Документация React (внешняя ссылка)"
            >
              <MaterialIcon name="code" size={18} opticalSize={18} />
            </a>
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex size-6 items-center justify-center text-slate-arena transition hover:text-white md:size-7"
              aria-label="Документация Node.js (внешняя ссылка)"
            >
              <MaterialIcon name="terminal" size={18} opticalSize={18} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
