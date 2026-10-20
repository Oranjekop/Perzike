import type { Modifier } from '@dnd-kit/core'

// Keep the dragged card inside the scrolling card area, below the fixed mode switcher.
export const restrictCardDrag: Modifier = ({ activeNodeRect, transform }) => {
  if (!activeNodeRect) return transform

  const sidebar = document.querySelector<HTMLElement>('.app-sidebar')
  const cards = sidebar?.querySelector<HTMLElement>('.app-sidebar-cards')
  const grid = sidebar?.querySelector<HTMLElement>('.app-sidebar-grid')
  if (!sidebar || !cards || !grid) return transform

  const sidebarRect = cards.getBoundingClientRect()
  const top = Math.max(sidebarRect.top + 8, grid.getBoundingClientRect().top)

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
