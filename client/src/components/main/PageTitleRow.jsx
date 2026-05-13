import { MaterialIcon } from '../ui/MaterialIcon.jsx'

const DEFAULT_TITLE_ICON = 'sensors'

function titleIconName(tabIcon) {
  const raw = String(tabIcon ?? '').trim()
  if (!raw) return DEFAULT_TITLE_ICON
  if (!/^[a-z0-9_]+$/i.test(raw)) return DEFAULT_TITLE_ICON
  return raw
}

export function PageTitleRow({
  title = '#2 BASALT ARENA (FRONTEND)',
  systemActive = true,
  tabIcon = null,
}) {
  return (
    <div className="flex w-full flex-row flex-nowrap items-center justify-between gap-2 max-[360px]:gap-1 md:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 max-[360px]:gap-2 md:gap-4">
        <MaterialIcon
          name={titleIconName(tabIcon)}
          size={20}
          opticalSize={20}
          className="shrink-0 text-turquoise"
        />
        <h1 className="max-w-[198px] text-balance text-[22px] font-semibold leading-[28px] tracking-[-0.5px] text-catskill max-[360px]:max-w-[170px] max-[360px]:text-[18px] max-[360px]:leading-[24px] sm:max-w-[220px] md:max-w-[276px] lg:max-w-none">
          {title}
        </h1>
      </div>
      <div
        className={[
          'box-border flex shrink-0 flex-row items-center gap-2 rounded-full border px-3 py-1 max-[360px]:gap-1 max-[360px]:px-2 max-[360px]:py-[3px] md:h-[25px] md:gap-2',
          systemActive ? 'border-spring/30 bg-spring/10' : 'border-gull/30 bg-gull/10',
        ].join(' ')}
      >
        <span
          className={[
            'h-2 w-[5.52px] shrink-0 rounded-full md:w-2',
            systemActive ? 'bg-spring' : 'bg-gull',
          ].join(' ')}
          aria-hidden
        />
        {systemActive ? (
          <span className="pr-1 text-left text-[10px] font-medium uppercase leading-[15px] tracking-[1px] text-spring max-[360px]:text-[9px] max-[360px]:leading-[12px] max-[360px]:tracking-[0.8px] md:pr-2">
            <span className="flex flex-col items-start justify-center gap-0 md:hidden">
              <span>СИСТЕМА</span>
              <span>АКТИВНА</span>
            </span>
            <span className="hidden whitespace-nowrap md:inline">СИСТЕМА АКТИВНА</span>
          </span>
        ) : (
          <span className="max-w-[4.5rem] text-left text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-gull">
            Система недоступна
          </span>
        )}
      </div>
    </div>
  )
}
