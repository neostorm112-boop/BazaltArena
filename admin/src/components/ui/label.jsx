import { cn } from '../../lib/cn.js'

export function Label({ className, ...props }) {
  return (
    <label
      className={cn(
        'block text-xs font-mono font-semibold uppercase tracking-wide text-slate-arena',
        className
      )}
      {...props}
    />
  )
}
