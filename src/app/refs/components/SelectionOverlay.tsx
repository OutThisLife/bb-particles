export function SelectionOverlay({ rect }: SelectionOverlayProps) {
  if (!rect || rect.width < 4 || rect.height < 4) {
    return null
  }

  return (
    <div
      className="pointer-events-none fixed z-30 border border-blue-500/60 bg-blue-500/10"
      style={rect}
    />
  )
}

interface OverlayRect {
  height: number
  left: number
  top: number
  width: number
}

interface SelectionOverlayProps {
  rect: OverlayRect | null
}
