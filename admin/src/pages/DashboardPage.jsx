import { useQuery } from '@tanstack/react-query'
import { Activity, Users, ClipboardList } from 'lucide-react'
import { api } from '../api.js'
import { Skeleton } from '../components/ui/skeleton.jsx'

function StatCard({ title, value, icon: Icon, loading }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-plantation bg-gradient-to-br from-timber/90 to-aztec p-6 shadow-lg">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-turquoise/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-arena">
            {title}
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-9 w-20" />
          ) : (
            <p className="mt-2 font-sans text-3xl font-bold tabular-nums text-catskill">{value}</p>
          )}
        </div>
        <div className="rounded-xl border border-turquoise/25 bg-turquoise/10 p-3 text-turquoise">
          <Icon className="h-6 w-6" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}

function ActivityChart({ points, loading }) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl border border-plantation bg-timber/30 p-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  const max = Math.max(1, ...points.map((p) => p.count))
  return (
    <div className="rounded-2xl border border-plantation bg-timber/30 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-turquoise">
            Активность
          </h3>
          <p className="mt-1 text-sm text-gull">Новые решения по дням (30 дней)</p>
        </div>
        <Activity className="h-5 w-5 text-turquoise/70" />
      </div>
      <div className="flex h-44 items-end gap-0.5 sm:gap-1">
        {points.map((p) => (
          <div key={p.date} className="group flex flex-1 flex-col items-center justify-end">
            <div
              className="w-full max-w-[10px] rounded-t-md bg-gradient-to-t from-turquoise/20 to-turquoise transition-all group-hover:from-turquoise/40 group-hover:to-half-baked sm:max-w-[14px]"
              style={{
                height: `${8 + (p.count / max) * 100}%`,
                minHeight: p.count ? '12px' : '4px',
              }}
              title={`${p.date}: ${p.count}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[9px] text-slate-arena">
        <span>{points[0]?.date?.slice(5)}</span>
        <span>{points[points.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: () => api('/admin/metrics'),
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-bold uppercase tracking-tight text-catskill">
          Главная
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-gull">
          Сводка по участникам, очереди проверки и потоку решений — чтобы держать Basalt Arena под
          контролем.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Участники"
          value={data?.membersCount ?? '—'}
          icon={Users}
          loading={isPending}
        />
        <StatCard
          title="На проверке"
          value={data?.pendingReviewCount ?? '—'}
          icon={ClipboardList}
          loading={isPending}
        />
      </div>

      <ActivityChart points={data?.activityByDay ?? []} loading={isPending} />
    </div>
  )
}
