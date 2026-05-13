import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { postSubmission } from '../../api/basaltApi.js'
import { queryKeys } from '../../lib/queryKeys.js'
import { MaterialIcon } from '../ui/MaterialIcon.jsx'

export function SubmissionTerminal() {
  const queryClient = useQueryClient()
  const [repo, setRepo] = useState('')
  const [demo, setDemo] = useState('')
  const [notice, setNotice] = useState(null)

  const submitMutation = useMutation({
    mutationFn: (payload) => postSubmission(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      void queryClient.invalidateQueries({ queryKey: ['hall'] })
    },
  })

  async function handleSubmit(e) {
    e.preventDefault()
    if (!repo.trim()) {
      setNotice({ type: 'err', text: 'Укажите ссылку на репозиторий' })
      return
    }
    setNotice(null)
    try {
      const res = await submitMutation.mutateAsync({
        repoUrl: repo.trim(),
        demoUrl: demo.trim() || undefined,
      })
      setNotice({ type: 'ok', text: `Решение принято. Id отправки: ${res.id}` })
      setRepo('')
      setDemo('')
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Ошибка отправки' })
    }
  }

  const pending = submitMutation.isPending

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-plantation bg-timber p-6 max-[360px]:gap-4 max-[360px]:p-4">
      <div className="flex items-center gap-2">
        <MaterialIcon name="upload" size={20} opticalSize={20} className="text-turquoise" />
        <h2 className="text-base font-semibold leading-6 text-catskill max-[360px]:text-sm max-[360px]:leading-5">
          Отправить решение
        </h2>
      </div>

      <form className="flex flex-col gap-5 max-[360px]:gap-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="block pl-1 text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-half-baked max-[360px]:text-[9px]">
            Ссылка на репозиторий
          </label>
          <div className="relative">
            <MaterialIcon
              name="code"
              size={14}
              opticalSize={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-arena"
            />
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="https://github.com/..."
              className="box-border h-[38px] w-full rounded-lg border border-plantation bg-aztec py-[9px] pl-10 pr-3 font-sans text-sm font-normal leading-[18px] text-catskill placeholder:text-pale-sky/90 focus:border-plantation focus:outline-none focus:ring-1 focus:ring-turquoise/15 [font-synthesis:none] max-[360px]:text-[13px]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block pl-1 text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-half-baked max-[360px]:text-[9px]">
            Ссылка на демо (необязательно)
          </label>
          <div className="relative">
            <MaterialIcon
              name="visibility"
              size={14}
              opticalSize={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-arena"
            />
            <input
              value={demo}
              onChange={(e) => setDemo(e.target.value)}
              placeholder="https://demo.basalt..."
              className="box-border h-[38px] w-full rounded-lg border border-plantation bg-aztec py-[9px] pl-10 pr-3 font-sans text-sm font-normal leading-[18px] text-catskill placeholder:text-pale-sky/90 focus:border-plantation focus:outline-none focus:ring-1 focus:ring-turquoise/15 [font-synthesis:none] max-[360px]:text-[13px]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="group flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-turquoise px-4 font-sans text-sm font-semibold leading-5 text-white transition-colors duration-150 hover:bg-[#6d4ef0] disabled:opacity-60"
        >
          <MaterialIcon name="send" size={16} opticalSize={16} className="text-white" />
          {pending ? 'Отправка…' : 'Отправить решение'}
        </button>
        {notice ? (
          <p
            className={
              notice.type === 'ok'
                ? 'text-center text-xs text-spring'
                : 'text-center text-xs text-red-400'
            }
            role="status"
          >
            {notice.text}
          </p>
        ) : null}
      </form>
    </section>
  )
}
