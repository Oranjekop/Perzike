import { Button, Tooltip } from '@renderer/components/ui'
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
    <div className="app-sidebar-nav-item">
      <Tooltip content={label} placement="right" isOpen={expanded ? false : undefined}>
        <Button
          {...props}
          size="sm"
          isIconOnly={!expanded}
          aria-label={label}
          className={`app-sidebar-nav-button ${className}`}
        >
          {children}
          <span className="app-sidebar-nav-label" aria-hidden="true">
            {label}
          </span>
        </Button>
      </Tooltip>
      {expanded && control}
    </div>
  )
}
