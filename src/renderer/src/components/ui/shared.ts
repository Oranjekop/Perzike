import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { Children, Fragment, isValidElement } from 'react'

export { cn } from '@heroui/react'
export type Color = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
export type Size = 'sm' | 'md' | 'lg'
export type Radius = 'none' | 'sm' | 'md' | 'lg' | 'full'
export type Classes = Partial<Record<string, string>>
export type Appearance = { color?: Color; size?: Size; radius?: Radius; className?: string }

// Perzike keeps its existing palette and geometry independently of library defaults.
export function colorStyle(color: Color = 'default'): CSSProperties {
  const sharedToken = ['default', 'success', 'warning', 'danger'].includes(color)
  return {
    '--ui-color': sharedToken ? `var(--${color})` : `hsl(var(--heroui-${color}))`,
    '--ui-color-fg': sharedToken
      ? `var(--${color}-foreground)`
      : `hsl(var(--heroui-${color}-foreground, var(--heroui-foreground)))`
  } as CSSProperties
}

// Preserve explicit keys (Children.toArray rewrites them, breaking controlled selections).
export function elements<P>(children: ReactNode): ReactElement<P>[] {
  const result: ReactElement<P>[] = []
  Children.forEach(children, (child) => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      result.push(...elements<P>(child.props.children))
    } else if (isValidElement<P>(child)) {
      result.push(child)
    }
  })
  return result
}
