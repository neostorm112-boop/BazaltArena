import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/cn.js'
import { Button } from './button.jsx'

/**
 * Модальное подтверждение действия (вместо window.confirm), в стиле тёмной админки.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  confirmVariant = 'danger',
  isPending = false,
  onConfirm,
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm data-[state=open]:animate-in"
          aria-hidden
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[120] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-plantation bg-gradient-to-b from-timber to-aztec p-6 shadow-2xl shadow-black/50 focus:outline-none data-[state=open]:animate-in'
          )}
          onPointerDownOutside={(e) => {
            if (isPending) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            if (isPending) e.preventDefault()
          }}
        >
          <DialogPrimitive.Title className="font-mono text-sm font-bold uppercase tracking-widest text-turquoise">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-3 font-sans text-sm leading-relaxed text-gull">
            {description}
          </DialogPrimitive.Description>
          <div className="mt-8 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={confirmVariant === 'danger' ? 'danger' : 'gradient'}
              disabled={isPending}
              onClick={() => void onConfirm?.()}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
