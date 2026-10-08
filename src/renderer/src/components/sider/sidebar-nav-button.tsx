import { Button } from '@renderer/components/ui'
import type { ButtonProps } from '@renderer/components/ui/controls'
import { createContext, useContext } from 'react'

export const SidebarExpandedContext = createContext(false)

export default function SidebarNavButton({
  label,
  children,
  control,
  className = '',
  ...props
}: ButtonProps & { label: string; control?: React.ReactNode }): React.JSX.Element {
  const expanded = useContext(SidebarExpandedContext)
  return (
    <div
      className="app-sidebar-nav-item"
      data-selected={expanded && props.color === 'primary' && props.variant === 'solid'}
    >
      <Button
        {...props}
        size="sm"
        isIconOnly={!expanded}
        aria-label={label}
        className={`app-sidebar-nav-button ${className}`}
      >
        <span className="app-sidebar-nav-icon" aria-hidden="true">
          {children}
        </span>
        <span className="app-sidebar-nav-label" aria-hidden="true">
          {label}
        </span>
      </Button>
      {expanded && control}
    </div>
  )
}
