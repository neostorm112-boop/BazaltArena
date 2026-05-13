import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MaterialIcon } from '../ui/MaterialIcon.jsx'

const TRANSITION_MS = 320

const FALLBACK_BRIEF = {
  taskParagraphs: [
    {
      chunks: [
        'Описание спринта приходит с API в поле brief. Обновите страницу или перезапустите сервер с актуальным mock-api.',
      ],
    },
  ],
  acceptanceTitle: 'Критерии приёмки',
  acceptanceItems: [
    { parts: ['Соответствие макету и работоспособный фронтенд по заданию спринта.'] },
  ],
  resourceLinks: [],
  sprintPath: '/',
}

function RichLine({ parts }) {
  return (
    <span className="font-mono text-sm font-normal leading-5 text-half-baked">
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <span key={i} className="text-spring">
            {p.h}
          </span>
        )
      )}
    </span>
  )
}

function TaskParagraph({ chunks }) {
  return (
    <p className="font-mono text-sm font-normal leading-[23px] text-half-baked">
      {chunks.map((c, i) =>
        typeof c === 'string' ? (
          <span key={i}>{c}</span>
        ) : (
          <span key={i}>
            <span className="text-turquoise">{c.code}</span>
            {c.after ? <span>{c.after}</span> : null}
          </span>
        )
      )}
    </p>
  )
}

export function SprintBriefModal({ open, onClose, sprint }) {
  const [rendered, setRendered] = useState(false)
  const [entered, setEntered] = useState(false)
  const closeBtnRef = useRef(null)

  useEffect(() => {
    if (open) {
      const showId = requestAnimationFrame(() => setRendered(true))
      const enterId = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true))
      })
      return () => {
        cancelAnimationFrame(showId)
        cancelAnimationFrame(enterId)
      }
    }
    const exitId = requestAnimationFrame(() => setEntered(false))
    return () => cancelAnimationFrame(exitId)
  }, [open])

  useEffect(() => {
    if (!open && rendered) {
      const t = window.setTimeout(() => setRendered(false), TRANSITION_MS)
      return () => window.clearTimeout(t)
    }
  }, [open, rendered])

  useEffect(() => {
    if (!rendered || !entered) return
    closeBtnRef.current?.focus()
  }, [rendered, entered])

  useEffect(() => {
    if (!rendered) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rendered, onClose])

  useEffect(() => {
    if (!rendered) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [rendered])

  if (!rendered || !sprint) return null

  const brief = sprint.brief && typeof sprint.brief === 'object' ? sprint.brief : FALLBACK_BRIEF

  const title = String(sprint.heroTitle ?? '')
  const tags = Array.isArray(sprint.tags) ? sprint.tags : []
  const completed = String(sprint.completedLabel ?? '')
  const sprintTo = typeof brief.sprintPath === 'string' ? brief.sprintPath : '/'

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto px-4 py-6 md:px-6 md:py-8"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Закрыть бриф"
        className={[
          'absolute inset-0 z-0 bg-black/70 backdrop-blur-[2px] transition-opacity duration-300 ease-out',
          entered ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sprint-brief-title"
        className={[
          'relative z-[1] isolate flex w-full max-w-[768px] max-h-[calc(100dvh-4rem)] flex-col overflow-hidden rounded-2xl border border-plantation bg-timber transition-[opacity,transform] duration-300 ease-out',
          entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-6 scale-[0.98] opacity-0',
        ].join(' ')}
      >
        <header className="relative z-[1] flex shrink-0 items-center justify-between gap-4 border-b border-plantation p-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-plantation bg-aztec">
              <MaterialIcon name="description" size={20} className="text-turquoise" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-normal uppercase leading-[15px] tracking-[1px] text-slate-arena">
                Бриф спринта
              </p>
              <h2
                id="sprint-brief-title"
                className="font-sans text-lg font-bold leading-7 tracking-[-0.45px] text-white"
              >
                {title}
              </h2>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-gull transition hover:bg-white/5 hover:text-catskill"
            aria-label="Закрыть"
          >
            <MaterialIcon name="close" size={24} />
          </button>
        </header>

        <div className="scrollbar-track-transparent relative z-[2] flex min-h-0 flex-1 flex-col gap-[23.3px] overflow-y-auto overscroll-contain p-8 md:max-h-[630px]">
          <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-[#334155] bg-aztec px-2.5 py-1 font-mono text-xs font-normal leading-4 text-[#CBD5E1]"
              >
                {tag}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-md border border-[#334155] bg-aztec px-2.5 py-1 font-mono text-xs font-normal leading-4 text-gull">
              <MaterialIcon name="event" size={12} className="text-gull" />
              {completed}
            </span>
          </div>

          {brief.quote ? (
            <div className="relative rounded-md bg-aztec px-4 py-4 pl-5">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-turquoise"
              />
              <p className="font-mono text-sm font-normal italic leading-[23px] text-catskill">
                {String(brief.quote)}
              </p>
            </div>
          ) : null}

          {Array.isArray(brief.taskParagraphs)
            ? brief.taskParagraphs.map((para, idx) => (
                <TaskParagraph key={idx} chunks={para.chunks} />
              ))
            : null}

          {brief.acceptanceTitle ? (
            <div className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 font-sans text-sm font-bold uppercase leading-5 tracking-[1.4px] text-turquoise">
                <MaterialIcon name="checklist" size={16} className="text-turquoise" />
                {String(brief.acceptanceTitle)}
              </h3>
              {Array.isArray(brief.acceptanceItems) ? (
                <ul className="flex flex-col gap-2">
                  {brief.acceptanceItems.map((item, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="mt-0.5 shrink-0">
                        <MaterialIcon name="check_circle" size={16} className="text-spring" />
                      </span>
                      <div className="min-w-0">
                        <RichLine parts={item.parts} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {Array.isArray(brief.resourceLinks) && brief.resourceLinks.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-plantation pt-[16.7px]">
              <h4 className="font-sans text-xs font-bold uppercase leading-4 tracking-[1.2px] text-slate-arena">
                Полезные ссылки
              </h4>
              <div className="flex flex-wrap gap-x-3 gap-y-2">
                {brief.resourceLinks.map((link, li) => (
                  <a
                    key={`${link.label}-${li}`}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-plantation bg-aztec px-3 py-2 font-sans text-xs font-normal leading-4 text-[#CBD5E1] transition hover:border-turquoise/40 hover:bg-white/[0.03]"
                  >
                    <MaterialIcon name={link.icon ?? 'link'} size={14} className="text-[#CBD5E1]" />
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <footer className="relative z-[3] flex shrink-0 flex-col gap-4 border-t border-plantation bg-aztec/40 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 text-left font-mono text-xs font-normal uppercase leading-4 tracking-[1.2px] text-slate-arena transition hover:text-gull"
          >
            <span aria-hidden className="text-slate-arena">
              ←
            </span>
            Назад в зал славы
          </button>
          <Link
            to={sprintTo}
            onClick={onClose}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-turquoise px-5 font-sans text-sm font-semibold leading-5 text-white transition-colors duration-150 hover:bg-[#6d4ef0] sm:w-auto"
          >
            <MaterialIcon name="rocket_launch" size={16} className="text-white" />
            Перейти к спринту
          </Link>
        </footer>
      </div>
    </div>
  )
}
