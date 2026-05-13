import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/cn.js'

export function Tabs({ className, ...props }) {
  return <TabsPrimitive.Root className={cn('w-full', className)} {...props} />
}

export function TabsList({ className, ...props }) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-10 w-full items-center justify-stretch gap-1 rounded-xl border border-plantation bg-timber/40 p-1 text-gull',
        className
      )}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'flex-1 rounded-lg px-3 py-1.5 font-sans text-xs font-semibold transition-all data-[state=active]:bg-aztec data-[state=active]:text-turquoise data-[state=active]:shadow-sm',
        className
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }) {
  return (
    <TabsPrimitive.Content
      className={cn('mt-4 min-h-[200px] outline-none', className)}
      {...props}
    />
  )
}
