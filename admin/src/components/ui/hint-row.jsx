import { cn } from '../../lib/cn.js'

export function HintRow({ icon = 'info', children, className }) {
  return (
    <div className={cn('flex items-start gap-2 text-xs text-gull', className)}>
      <span
        className="material-symbols-outlined shrink-0 text-[16px] leading-none text-turquoise/70"
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 leading-snug">{children}</span>
    </div>
  )
}
