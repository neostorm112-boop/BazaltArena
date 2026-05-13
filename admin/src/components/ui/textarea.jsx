import { cn } from '../../lib/cn.js'

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        'min-h-[140px] w-full resize-y rounded-lg border border-plantation bg-aztec px-3 py-2 font-sans text-sm text-catskill outline-none ring-turquoise/30 placeholder:text-slate-arena focus:border-turquoise/60 focus:ring-2',
        className
      )}
      {...props}
    />
  )
}
