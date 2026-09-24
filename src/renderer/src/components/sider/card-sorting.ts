import { arrayMove, type SortingStrategy } from '@dnd-kit/sortable'

const statusKeys: Record<string, keyof AppConfig> = {
  proxy: 'proxyCardStatus',
  profile: 'profileCardStatus',
  sysproxy: 'sysproxyCardStatus',
  tun: 'tunCardStatus',
  dns: 'dnsCardStatus',
  sniff: 'sniffCardStatus',
  connection: 'connectionCardStatus',
  traffic: 'trafficCardStatus',
  mihomo: 'mihomoCoreCardStatus',
  rule: 'ruleCardStatus',
  resource: 'resourceCardStatus',
  override: 'overrideCardStatus',
  log: 'logCardStatus',
  substore: 'substoreCardStatus'
}

export function visibleCardOrder(order: string[], config?: Partial<AppConfig>): string[] {
  return order.filter((id) => {
    if (!statusKeys[id] || config?.[statusKeys[id]] === 'hidden') return false
    if (id === 'dns' && config?.controlDns === false) return false
    if (id === 'sniff' && config?.controlSniff === false) return false
    if (id === 'substore' && config?.useSubStore === false) return false
    return true
  })
}

// Reflow the two-column grid instead of moving differently sized cards into old slots.
export const sidebarGridSortingStrategy: SortingStrategy = ({
  rects,
  activeIndex,
  overIndex,
  index
}) => {
  if (
    activeIndex < 0 ||
    overIndex < 0 ||
    rects.some((rect) => !rect || !rect.width || !rect.height)
  )
    return null
  const original = rects[index]
  if (!original) return null
  const left = Math.min(...rects.map((rect) => rect.left))
  const right = Math.max(...rects.map((rect) => rect.right))
  const top = Math.min(...rects.map((rect) => rect.top))
  const gap = 8 // Matches the sidebar grid's gap-2.
  const columnWidth = (right - left - gap) / 2
  const reordered = arrayMove(
    rects.map((rect, id) => ({ rect, id })),
    activeIndex,
    overIndex
  )
  let column = 0
  let rowTop = top
  let rowHeight = 0

  for (const { rect, id } of reordered) {
    const span = rect.width > columnWidth + 1 ? 2 : 1
    if (column + span > 2) {
      rowTop += rowHeight + gap
      rowHeight = 0
      column = 0
    }
    if (id === index) {
      return {
        x: left + column * (columnWidth + gap) - original.left,
        y: rowTop - original.top,
        scaleX: 1,
        scaleY: 1
      }
    }
    rowHeight = Math.max(rowHeight, rect.height)
    column += span
  }
  return null
}
