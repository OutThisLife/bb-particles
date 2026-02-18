type Rect = { left: number; top: number; width: number; height: number }

export function SelectionOverlay({ rect }: { rect: Rect | null }) {
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
