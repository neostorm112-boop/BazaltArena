import { MaterialIcon } from '../components/ui/MaterialIcon.jsx'
import { submissionStatusLabel } from '../lib/submissionStatusLabel.js'

function linkHref(raw) {
  if (raw == null) return null
  const t = String(raw).trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

function formatSubmittedRu(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function statusPillClass(status) {
  switch (status) {
    case 'ACCEPTED':
      return 'border-turquoise/25 bg-turquoise/10 text-turquoise'
    case 'REVIEWED':
      return 'border-spring/20 bg-spring/10 text-spring'
    case 'REJECTED':
      return 'border-red-500/25 bg-red-500/10 text-red-300'
    case 'PENDING':
    default:
      return 'border-slate-arena/35 bg-slate-arena/10 text-gull'
  }
}

export function ProfileSprintHistory({ items }) {
  const list = Array.isArray(items) ? [...items] : []
  list.sort((a, b) => {
    const ta = new Date(a?.createdAt ?? 0).getTime()
    const tb = new Date(b?.createdAt ?? 0).getTime()
    return tb - ta
  })

  if (list.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-plantation bg-timber/30 px-5 py-8 text-center font-mono text-sm leading-6 text-gull">
        Пока нет отправленных решений — они появятся здесь после участия в спринтах.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-4 max-[360px]:gap-3">
      {list.map((row) => {
        const repo = linkHref(row.repoUrl)
        const demo = linkHref(row.demoUrl)
        const submitted = formatSubmittedRu(row.createdAt)
        const comment = String(row.mentorComment ?? '').trim()
        const score = Number(row.mentorScore)
        const scoreLabel = Number.isFinite(score) ? `${score} б.` : '—'

        return (
          <li
            key={String(row.id)}
            className="rounded-xl border border-plantation bg-timber p-5 transition-colors duration-150 hover:border-fiord max-[360px]:p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold leading-6 text-white">{row.sprintTitle}</h3>
                {submitted ? (
                  <p className="mt-1 font-mono text-xs leading-4 text-gull">
                    Отправлено: {submitted}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                <span
                  className={[
                    'inline-flex max-w-full items-center rounded border px-2 py-0.5 text-xs font-bold leading-4',
                    statusPillClass(row.status),
                  ].join(' ')}
                >
                  {submissionStatusLabel(row.status)}
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-plantation bg-aztec/60 px-2 py-0.5 font-mono text-xs font-semibold leading-4 text-catskill/90">
                  <MaterialIcon
                    name="grade"
                    size={14}
                    opticalSize={14}
                    className="text-turquoise"
                  />
                  {scoreLabel}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs leading-4">
              {repo ? (
                <a
                  href={repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gull underline decoration-gull/30 underline-offset-2 transition hover:text-turquoise hover:decoration-turquoise/40"
                >
                  Репозиторий
                </a>
              ) : null}
              {demo ? (
                <a
                  href={demo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gull underline decoration-gull/30 underline-offset-2 transition hover:text-turquoise hover:decoration-turquoise/40"
                >
                  Демо
                </a>
              ) : null}
            </div>

            {comment ? (
              <div className="mt-4 border-l-2 border-turquoise bg-aztec/40 pl-4 pr-3 py-3">
                <p className="pb-1.5 text-[10px] font-bold uppercase leading-4 tracking-[1px] text-gull">
                  Комментарий наставника
                </p>
                <p className="whitespace-pre-wrap font-mono text-xs leading-[1.55] text-catskill/90">
                  {comment}
                </p>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
