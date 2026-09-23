import type { Modifier } from '@dnd-kit/core'

// Keep the dragged card inside the visible card area, below the sticky title bar.
export const restrictCardDrag: Modifier = ({ activeNodeRect, transform }) => {
  if (!activeNodeRect) return transform

  const sidebar = document.querySelector<HTMLElement>('.app-sidebar')
  const header = sidebar?.querySelector<HTMLElement>(':scope > .app-drag')
  const grid = sidebar?.querySelector<HTMLElement>('.app-sidebar-grid')
  if (!sidebar || !header || !grid) return transform

  const sidebarRect = sidebar.getBoundingClientRect()
  const top = Math.max(header.getBoundingClientRect().bottom + 8, grid.getBoundingClientRect().top)

  return {
    ...transform,
    x: Math.max(
      sidebarRect.left + 8 - activeNodeRect.left,
      Math.min(transform.x, sidebarRect.right - 8 - activeNodeRect.right)
    ),
    y: Math.max(
      top - activeNodeRect.top,
      Math.min(transform.y, sidebarRect.bottom - 8 - activeNodeRect.bottom)
    )
  }
}
