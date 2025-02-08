import clsx from 'clsx'

export default function Footer() {
  return (
    <footer
      className={clsx(
        'z-10 fixed inset-x-0 bottom-0 p-5',
        'text-center text-xs text-white text-opacity-75'
      )}>
      alt/opt + rmb to pan :: mousewheel to zoom
    </footer>
  )
}
