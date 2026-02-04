import { cn } from '@/utils'

export const Footer = () => {
  return (
    <footer
      className={cn(
        'z-10 fixed inset-x-0 bottom-0 p-5',
        'text-center text-xs text-white text-opacity-75'
      )}
    >
      (alt|opt)+rmb to enable camera .. right click to save
    </footer>
  )
}
