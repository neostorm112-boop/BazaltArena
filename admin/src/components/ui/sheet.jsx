import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn.js'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger

export function SheetContent({ className, children, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-plantation bg-aztec shadow-2xl focus:outline-none data-[state=open]:slide-in-from-right',
          className
        )}
        {...props}
      >
        <DialogPrimitive.Close
          className="absolute right-4 top-4 z-10 rounded-lg p-2 text-gull hover:bg-white/10 hover:text-catskill"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function SheetHeader({ title, description }) {
  return (
    <div className="border-b border-plantation px-6 pb-4 pr-14 pt-6">
      <DialogPrimitive.Title className="font-mono text-sm font-bold uppercase tracking-widest text-turquoise">
        {title}
      </DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="mt-2 text-xs text-gull">
          {description}
        </DialogPrimitive.Description>
      ) : (
        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
      )}
    </div>
  )
}

export function SheetBody({ className, ...props }) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', className)} {...props} />
}
