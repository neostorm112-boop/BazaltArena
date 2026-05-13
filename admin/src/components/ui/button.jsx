import { cn } from '../../lib/cn.js'

const variants = {
  gradient:
    'rounded-xl bg-gradient-to-r from-[#5b3fd4] via-turquoise to-[#9d7cff] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-turquoise/20 hover:brightness-110 active:scale-[0.99]',
  outline:
    'rounded-xl border border-plantation bg-timber/40 px-4 py-2 font-mono text-xs font-semibold text-catskill hover:border-turquoise/50 hover:bg-white/[0.04]',
  ghost: 'rounded-lg px-3 py-1.5 font-mono text-xs text-gull hover:bg-white/5 hover:text-catskill',
  danger:
    'rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 font-mono text-xs font-bold text-red-300 hover:bg-red-500/20',
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-40'

export function Button({ className, variant = 'gradient', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(buttonBase, variants[variant] ?? variants.gradient, className)}
      {...props}
    />
  )
}
