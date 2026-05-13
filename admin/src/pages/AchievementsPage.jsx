import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api.js'
import { Button } from '../components/ui/button.jsx'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog.jsx'
import { HintRow } from '../components/ui/hint-row.jsx'
import { Input } from '../components/ui/input.jsx'
import { Label } from '../components/ui/label.jsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select.jsx'
import { Skeleton } from '../components/ui/skeleton.jsx'

/** Пресеты значков для карточки награды. */
const MATERIAL_ICON_PRESETS = [
  'emoji_events',
  'star',
  'local_fire_department',
  'rocket_launch',
  'diamond',
  'track_changes',
  'shield',
  'bolt',
  'military_tech',
  'construction',
  'terrain',
  'auto_awesome',
]

const DEFAULT_MATERIAL_ICON = 'emoji_events'

const iconShellClass =
  'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-plantation bg-aztec/90 shadow-inner'

/** Эмодзи / символ или короткое имя значка (латиница, слова через подчёркивание). */
function AchievementCardIcon({ icon }) {
  const raw = (icon || '').trim()
  if (!raw) {
    return (
      <div className={iconShellClass} aria-hidden>
        <span className="material-symbols-outlined text-[2rem] text-turquoise/85">
          {DEFAULT_MATERIAL_ICON}
        </span>
      </div>
    )
  }
  const normalized = raw.replace(/-/g, '_')
  const isMaterialToken = /^[a-z][a-z0-9_]*$/.test(normalized)
  if (isMaterialToken) {
    return (
      <div className={iconShellClass}>
        <span className="material-symbols-outlined text-[2rem] text-turquoise/85" aria-hidden>
          {normalized}
        </span>
      </div>
    )
  }
  return (
    <div className={iconShellClass} aria-hidden>
      <span className="text-[2rem] leading-none">{raw}</span>
    </div>
  )
}

export function AchievementsPage() {
  const qc = useQueryClient()
  const [editor, setEditor] = useState(null)
  const [grant, setGrant] = useState(null)
  const [form, setForm] = useState({
    id: '',
    slug: '',
    title: '',
    subtitle: '',
    icon: DEFAULT_MATERIAL_ICON,
  })
  const [sprintId, setSprintId] = useState('')

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'achievements'],
    queryFn: () => api('/admin/achievements'),
  })

  const { data: sprints } = useQuery({
    queryKey: ['admin', 'sprints'],
    queryFn: () => api('/admin/sprints'),
  })

  const saveMut = useMutation({
    mutationFn: (body) => api('/admin/achievements', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Ачивка сохранена')
      void qc.invalidateQueries({ queryKey: ['admin', 'achievements'] })
      setEditor(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const grantMut = useMutation({
    mutationFn: ({ sprintId: sid, achievementId }) =>
      api(`/admin/sprints/${sid}/achievements/${achievementId}/grant-sprint`, { method: 'POST' }),
    onSuccess: (res) => {
      toast.success(`Выдано участникам: ${res.granted ?? 0}`)
      setGrant(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const list = data?.achievements ?? []

  const openNew = () => {
    setForm({ id: '', slug: '', title: '', subtitle: '', icon: DEFAULT_MATERIAL_ICON })
    setEditor('new')
  }

  const openEdit = (a) => {
    setForm({
      id: a.id,
      slug: a.slug,
      title: a.title,
      subtitle: a.subtitle,
      icon: a.icon?.trim() || DEFAULT_MATERIAL_ICON,
    })
    setEditor('edit')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold uppercase tracking-tight text-catskill">
            Ачивки
          </h1>
          <p className="mt-2 text-sm text-gull">
            Конструктор, иконки и массовая выдача по спринту.
          </p>
        </div>
        <Button variant="gradient" onClick={openNew}>
          + Добавить ачивку
        </Button>
      </div>

      <Dialog open={editor !== null} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent>
          <DialogTitle>{editor === 'new' ? 'Новая ачивка' : 'Редактирование'}</DialogTitle>
          <DialogDescription className="sr-only">
            Форма награды: служебный ключ, заголовок, описание и значок.
          </DialogDescription>
          <HintRow className="mt-2" icon="tips_and_updates">
            Участники видят только заголовок, описание и значок. Короткий ключ нужен системе и не
            выводится на сайте. Значок — из набора иконок арены (латинское имя или эмодзи); ниже
            можно вписать код вручную.
          </HintRow>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              const body = {
                slug: form.slug.trim(),
                title: form.title.trim(),
                subtitle: form.subtitle.trim(),
                icon: form.icon.trim() || DEFAULT_MATERIAL_ICON,
              }
              if (form.id) body.id = form.id
              saveMut.mutate(body)
            }}
          >
            <div>
              <Label>Служебный ключ</Label>
              <Input
                className="mt-1 font-mono text-xs"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
              <HintRow className="mt-1.5" icon="tag">
                Латиница без пробелов — так награда связывается с выдачами и логами.
              </HintRow>
            </div>
            <div>
              <Label>Заголовок</Label>
              <Input
                className="mt-1"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Описание</Label>
              <Input
                className="mt-1"
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
              />
            </div>
            <div>
              <Label>Значок</Label>
              <HintRow className="mt-1" icon="palette">
                Выберите пресет или введите код вручную — так же, как иконки на арене.
              </HintRow>
              <div className="mt-2 grid grid-cols-6 gap-2 sm:grid-cols-6">
                {MATERIAL_ICON_PRESETS.map((name) => {
                  const selected = form.icon.replace(/-/g, '_') === name
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      aria-label={`Иконка ${name}`}
                      className={`flex h-11 w-11 items-center justify-center justify-self-center rounded-xl border transition ${
                        selected
                          ? 'border-turquoise bg-turquoise/15'
                          : 'border-plantation hover:border-turquoise/40'
                      }`}
                      onClick={() => setForm((f) => ({ ...f, icon: name }))}
                    >
                      <span
                        className="material-symbols-outlined text-[22px] text-catskill"
                        aria-hidden
                      >
                        {name}
                      </span>
                    </button>
                  )
                })}
              </div>
              <Input
                className="mt-2 font-mono text-xs"
                placeholder="Например emoji_events или смайл"
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                Отмена
              </Button>
              <Button type="submit" variant="gradient" disabled={saveMut.isPending}>
                Сохранить
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isPending
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-plantation p-5">
                <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
                <Skeleton className="mt-4 h-6 w-[min(100%,12rem)]" />
                <Skeleton className="mt-2 h-4 w-full" />
                <Skeleton className="mt-3 h-9 w-full" />
              </div>
            ))
          : list.map((a) => (
              <div
                key={a.id}
                className="group flex flex-col rounded-2xl border border-plantation bg-gradient-to-br from-timber/80 to-aztec p-5 shadow-lg transition hover:border-turquoise/30"
              >
                <AchievementCardIcon icon={a.icon} />
                <h2 className="mt-4 font-sans text-lg font-semibold leading-snug tracking-tight text-catskill">
                  {a.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gull">{a.subtitle}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 py-2 text-[10px]"
                    onClick={() => openEdit(a)}
                  >
                    Изменить
                  </Button>
                  <Button
                    variant="gradient"
                    className="flex-1 py-2 text-[10px]"
                    onClick={() => {
                      setGrant(a)
                      setSprintId('')
                    }}
                  >
                    Выдать спринту
                  </Button>
                </div>
              </div>
            ))}
      </div>

      <Dialog open={!!grant} onOpenChange={(o) => !o && setGrant(null)}>
        <DialogContent>
          <DialogTitle>Всем участникам спринта</DialogTitle>
          <DialogDescription className="sr-only">
            Массовая выдача награды по выбранному спринту.
          </DialogDescription>
          <HintRow className="mt-2" icon="groups">
            Награда попадёт всем, у кого есть отправленная работа или отдельно выданный доступ к
            этому спринту (без дублей).
          </HintRow>
          <div className="mt-4 space-y-4">
            <div>
              <Label>Спринт</Label>
              {(sprints?.sprints ?? []).length > 0 ? (
                <Select value={sprintId || undefined} onValueChange={setSprintId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Выберите спринт" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sprints?.sprints ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-2 font-sans text-sm text-gull">Сначала создайте спринт.</p>
              )}
            </div>
            <Button
              variant="gradient"
              className="w-full"
              disabled={!sprintId || !grant || grantMut.isPending}
              onClick={() =>
                grant && sprintId && grantMut.mutate({ sprintId, achievementId: grant.id })
              }
            >
              Выдать «{grant?.title ?? ''}»
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
